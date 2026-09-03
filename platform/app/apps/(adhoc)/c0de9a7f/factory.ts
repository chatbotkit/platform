import type { getSessionClient } from '@/lib/cbk.sdk'
import { captureException } from '@/lib/error'
import fetch from '@/lib/fetch'

import {
  DAY_IN_SECONDS,
  DEFAULT_DAILY_TOKEN_BUDGET,
  FACTORY_ALIAS_PREFIX,
  factoryAliases,
  factoryMeta,
} from './const'
import { buildTemplate } from './factory-template'

type UserClient = Awaited<ReturnType<typeof getSessionClient>>

/**
 * Writes a UTF-8 text file into the space storage using the signed upload
 * request the platform returns.
 */
async function writeSpaceFile(
  userClient: UserClient,
  spaceRef: string,
  path: string,
  content: string
): Promise<void> {
  const body = new TextEncoder().encode(content)

  const { uploadRequest } = await userClient.space.storage.upload(
    spaceRef,
    path,
    { file: { type: 'text/markdown', size: body.byteLength } }
  )

  if (uploadRequest) {
    const { method, url, headers } = uploadRequest

    await fetch(url, { method, headers: headers ?? {}, body })
  }
}

/**
 * Seeds the workspace with starter playbooks so the agent has operating
 * standards to read from its first run. Best-effort: failures are captured.
 */
async function seedStarterFiles(
  userClient: UserClient,
  spaceRef: string
): Promise<void> {
  await writeSpaceFile(
    userClient,
    spaceRef,
    'playbooks/README.md',
    [
      '# Factory Playbooks',
      '',
      'These files are the operating standards the agent reads at the start of',
      'every task. Edit them to teach the agent how your organisation works -',
      'which repositories matter, your review bar, your branch and PR',
      'conventions, and anything it should never touch.',
      '',
      '- `scope.md` - which repositories and teams are in scope',
      '- `standards.md` - code review, PR, and branch conventions',
      '',
    ].join('\n')
  )

  await writeSpaceFile(
    userClient,
    spaceRef,
    'playbooks/scope.md',
    [
      '# Scope',
      '',
      'Describe the organisation and which repositories the agent should focus',
      'on. The connected GitHub App defines the hard boundary; this file sets',
      'priorities within it.',
      '',
      '## Organisation',
      '',
      '- GitHub org:',
      '',
      '## In scope (priority order)',
      '',
      '- ',
      '',
      '## Out of scope / do not touch',
      '',
      '- ',
      '',
    ].join('\n')
  )

  await writeSpaceFile(
    userClient,
    spaceRef,
    'playbooks/standards.md',
    [
      '# Standards',
      '',
      '## Pull requests',
      '',
      '- One concern per PR; clear title; description states the why.',
      '- Never force-push, delete branches, or rewrite history.',
      '',
      '## Review bar',
      '',
      '- ',
      '',
      '## Branch conventions',
      '',
      '- ',
      '',
    ].join('\n')
  )
}

/**
 * Converts the template (designer-export shape) into the import endpoint's
 * `{ category: [{ id, ...fields }] }` shape.
 */
function templateToImportResources(
  resources: ReturnType<typeof buildTemplate>['resources']
): Record<string, Array<Record<string, unknown>>> {
  const out: Record<string, Array<Record<string, unknown>>> = {}

  for (const [token, node] of Object.entries(resources)) {
    if (!out[node.type]) {
      out[node.type] = []
    }

    out[node.type].push({ id: token, ...node.data })
  }

  return out
}

/**
 * A short, alias-safe key for a new factory.
 */
function newFactoryKey(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10)
}

const POLICY_NAME = 'Daily token budget'

const POLICY_DESCRIPTION =
  "Caps the agent's token usage per day so a runaway task can't burn through the account."

/** The tokens-per-day usage-policy config for a given daily budget. */
function buildPolicyConfig(threshold: number) {
  return {
    metric: 'tokens',
    threshold,
    windowInSeconds: DAY_IN_SECONDS,
    actions: {
      // block the bot for a day once the day's token budget is exhausted.
      block: { durationInSeconds: DAY_IN_SECONDS },
    },
  }
}

/**
 * Ensures the factory has its cost policy: a bot-scoped `usage` policy that caps
 * daily token spend. Created once (idempotent) and never overwritten, so the
 * budget the user sets in Settings survives.
 *
 * @note provisioned via the policy endpoint rather than the blueprint template
 * so the policy is created once and never re-synced: a template re-apply must
 * not reset a user-set budget. (Historically the import also stripped a usage
 * config to `{}` via the loose PolicyConfig union; imports now validate the
 * config by row `type` and preserve it.)
 */
async function ensurePolicy(
  userClient: UserClient,
  factory: string,
  blueprintId: string
): Promise<void> {
  const alias = factoryAliases(factory)

  // already provisioned? leave it untouched so a user-set budget is preserved.
  try {
    await userClient.policy.fetch(`@${alias.policy}`)

    return
  } catch {
    // not found - create it below
  }

  // scope the policy to this factory's bot; an omitted botId would make it a
  // global policy across all of the user's bots. If the bot isn't resolvable
  // yet, skip - a later re-apply will provision the policy once it is.
  let botId: string

  try {
    const bot = await userClient.bot.fetch(`@${alias.bot}`)

    botId = bot.id
  } catch {
    return
  }

  await userClient.policy.create({
    blueprintId,
    botId,
    alias: alias.policy,
    type: 'usage',
    name: POLICY_NAME,
    description: POLICY_DESCRIPTION,
    config: buildPolicyConfig(DEFAULT_DAILY_TOKEN_BUDGET),
  })
}

export interface Factory {
  /** The factory blueprint alias, `f-<key>` - the route + address key. */
  factory: string
  id: string
  name: string
  description: string
}

/**
 * Creates a new factory: a fresh blueprint (marked with `meta.app`) populated
 * once from the template, then seeded with starter playbooks. The template is
 * imported a single time - never re-imported - because the integration's
 * managed `appId` field would be blanked by a re-sync.
 */
export async function createFactory(
  userClient: UserClient,
  name: string,
  description: string
): Promise<Factory> {
  const factory = `${FACTORY_ALIAS_PREFIX}-${newFactoryKey()}`

  const blueprint = await userClient.blueprint.create({
    alias: factory,
    name,
    description,
    meta: factoryMeta(),
  })

  try {
    await userClient.blueprint.importResources(blueprint.id, {
      resources: templateToImportResources(buildTemplate(factory).resources),
    })
  } catch (error) {
    // a failed provision must not leave a bare, resource-less orphan factory -
    // roll the blueprint and any partial resources back before surfacing.
    try {
      await userClient.blueprint.delete(blueprint.id, { deleteResources: true })
    } catch (cleanupError) {
      await captureException(cleanupError)
    }

    throw error
  }

  try {
    await seedStarterFiles(userClient, `@${factoryAliases(factory).workspace}`)
  } catch (error) {
    await captureException(error)
  }

  try {
    await ensurePolicy(userClient, factory, blueprint.id)
  } catch (error) {
    await captureException(error)
  }

  return { factory, id: blueprint.id, name, description }
}

/**
 * Re-applies the template to an existing factory, reconciling its structural
 * fields (backstory, abilities, instructions, ...) to match the template - so
 * the template stays the source of truth. User-owned values are preserved: the
 * import skips UNMANAGED_FIELDS (secret value, privateKey, webhookSecret, secret
 * config) and `$default` seed fields (the bot's model, the integration's appId).
 * No `ensure` - the blueprint must already exist (addressed by its `@alias`).
 */
export async function ensureFactory(
  userClient: UserClient,
  factory: string
): Promise<void> {
  await userClient.blueprint.importResources(`@${factory}`, {
    resources: templateToImportResources(buildTemplate(factory).resources),
  })

  // record the template version this factory is now on. @note the alias MUST be
  // resent: blueprint/update defaults an omitted alias to null and writes it raw
  // (unlike meta/config, which merge-preserve), so a partial update would wipe
  // the factory's alias - the load-bearing `@f-<key>` address the whole app (and
  // listFactories' `Boolean(b.alias)` filter) depends on.
  const blueprint = await userClient.blueprint.update(`@${factory}`, {
    alias: factory,
    meta: factoryMeta(),
  })

  // back-fill the cost policy for factories created before it existed (and a
  // no-op once provisioned). Best-effort: never block opening the factory.
  try {
    await ensurePolicy(userClient, factory, blueprint.id)
  } catch (error) {
    await captureException(error)
  }
}

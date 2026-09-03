import prisma from '@/prisma/client'
import { PolicyType } from '@/prisma/types'

import {
  getReferenceFieldType,
  isUnmanagedBlueprintField,
} from '@/lib/blueprint.fields'
import { canUseBot } from '@/lib/bot.access'
import { canUseContact } from '@/lib/contact.access'
import { cuid } from '@/lib/cuid'
import { canUseDataset } from '@/lib/dataset.access'
import { canUseFile } from '@/lib/file.access'
import { uploadFileObject } from '@/lib/file.storage'
import { nameToType } from '@/lib/mime2'
import { parsePolicyConfig } from '@/lib/policy.config'
import { canUseSecret } from '@/lib/secret.access'
import { canUseSkillset } from '@/lib/skillset.access'
import { topologicalSortWithCycleDetection } from '@/lib/sort'
import { canUseSpace } from '@/lib/space.access'
import { uploadStorageFile as uploadSpaceStorageFile } from '@/lib/space.storage'

import { blueprintSchema as AbilityBlueprintSchema } from '@/schemas/api/v1/ability'
import { blueprintSchema as AnamIntegrationBlueprintSchema } from '@/schemas/api/v1/anamIntegration'
import { blueprintSchema as AvatarIntegrationBlueprintSchema } from '@/schemas/api/v1/avatarIntegration'
import { blueprintSchema as BotBlueprintSchema } from '@/schemas/api/v1/bot'
import { blueprintSchema as DatasetBlueprintSchema } from '@/schemas/api/v1/dataset'
import { blueprintSchema as DiscordIntegrationBlueprintSchema } from '@/schemas/api/v1/discordIntegration'
import { blueprintSchema as EmailIntegrationBlueprintSchema } from '@/schemas/api/v1/emailIntegration'
import { blueprintSchema as ExtractIntegrationBlueprintSchema } from '@/schemas/api/v1/extractIntegration'
import { blueprintSchema as FileBlueprintSchema } from '@/schemas/api/v1/file'
import { blueprintSchema as GithubIntegrationBlueprintSchema } from '@/schemas/api/v1/githubIntegration'
import { blueprintSchema as GooglechatIntegrationBlueprintSchema } from '@/schemas/api/v1/googlechatIntegration'
import { blueprintSchema as InstagramIntegrationBlueprintSchema } from '@/schemas/api/v1/instagramIntegration'
import { blueprintSchema as McpserverIntegrationBlueprintSchema } from '@/schemas/api/v1/mcpserverIntegration'
import { blueprintSchema as MessengerIntegrationBlueprintSchema } from '@/schemas/api/v1/messengerIntegration'
import { blueprintSchema as MicrosoftteamsIntegrationBlueprintSchema } from '@/schemas/api/v1/microsoftteamsIntegration'
import { blueprintSchema as NotionIntegrationBlueprintSchema } from '@/schemas/api/v1/notionIntegration'
import { blueprintSchema as PolicyBlueprintSchema } from '@/schemas/api/v1/policy'
import { blueprintSchema as PortalBlueprintSchema } from '@/schemas/api/v1/portal'
import { blueprintSchema as RecallIntegrationBlueprintSchema } from '@/schemas/api/v1/recallIntegration'
import { blueprintSchema as SecretBlueprintSchema } from '@/schemas/api/v1/secret'
import { blueprintSchema as SitemapIntegrationBlueprintSchema } from '@/schemas/api/v1/sitemapIntegration'
import { blueprintSchema as SkillserverIntegrationBlueprintSchema } from '@/schemas/api/v1/skillserverIntegration'
import { blueprintSchema as SkillsetBlueprintSchema } from '@/schemas/api/v1/skillset'
import { blueprintSchema as SlackIntegrationBlueprintSchema } from '@/schemas/api/v1/slackIntegration'
import { blueprintSchema as SpaceBlueprintSchema } from '@/schemas/api/v1/space'
import { blueprintSchema as SupportIntegrationBlueprintSchema } from '@/schemas/api/v1/supportIntegration'
import { blueprintSchema as TaskBlueprintSchema } from '@/schemas/api/v1/task'
import { blueprintSchema as TelegramIntegrationBlueprintSchema } from '@/schemas/api/v1/telegramIntegration'
import { blueprintSchema as TriggerIntegrationBlueprintSchema } from '@/schemas/api/v1/triggerIntegration'
import { blueprintSchema as TwilioIntegrationBlueprintSchema } from '@/schemas/api/v1/twilioIntegration'
import { blueprintSchema as WhatsappIntegrationBlueprintSchema } from '@/schemas/api/v1/whatsappIntegration'
import { cloneableBlueprintSchema as WidgetIntegrationBlueprintSchema } from '@/schemas/api/v1/widgetIntegration'

import crypto from 'crypto'
import { ZodError, type ZodTypeAny, z } from 'zod'

// ── Public types ────────────────────────────────────────────────────────────

/** A reference token in the portable document, e.g. `#bot:::local-1`. */
export type ResourceRefToken = `#${string}:::${string}`

/** The portable resource document - what export emits and clone feeds in. */
export interface BlueprintResourceDocument {
  resources: Record<string, { type: string; data: Record<string, unknown> }>
}

/** A single parsed resource ready for reconciliation. */
export interface ResourceNode {
  id: string
  category: string
  type: string
  refKey: string
  schema: ZodTypeAny
  data: Record<string, unknown>
  /**
   * Fields the template marked as seed-only via a `$default` marker: written on
   * create, skipped on update so a re-applied template never clobbers a value
   * the user has since changed. Absent/empty means "no seed fields".
   */
  seedFields?: Set<string>
  /**
   * Files to seed into this resource's object storage on create, declared via a
   * `$files` directive. Currently only `space` resources support it (each entry
   * is written to its `path` in the space's storage as part of the import).
   * Seed-only, like `$default`: applied on create, skipped on update so a
   * re-import never clobbers files the agent has since edited.
   */
  seedSpaceFiles?: SpaceSeedFile[]
  /**
   * Text to seed into this resource's object storage on create, declared via a
   * `$text` directive. Only `file` resources support it (a `File` row has no
   * column for its body - the content lives in object storage). Seed-only, like
   * `$default`: written on create, skipped on update.
   */
  seedFileText?: string
}

/** The named import policy a caller selects; the engine resolves it to knobs. */
export type ImportPolicy = 'sync' | 'clone' | 'restore'

interface ResolvedImportPolicy {
  /** `upsert` matches by alias and updates/re-homes; `strip` always creates fresh, unaliased. */
  alias: 'upsert' | 'strip'
  /**
   * How to treat a `*Id` reference that does not resolve to a node in this
   * payload:
   * - `external` - validate it against caller access (`canUse*`); reject if not usable.
   * - `internal` - trust it (the document is the caller's own, self-contained export).
   * - `strip` - null it. Used by clone, whose document may come from another
   *   owner (a public hub blueprint): an unresolved ref would point at that
   *   owner's resource, so it must never survive the clone.
   */
  refs: 'external' | 'internal' | 'strip'
  /**
   * What happens to a `task`/`triggerIntegration` cadence:
   * - `preserve` - the document is the caller's own (their template, their
   *   backup), so its cadence is theirs to keep.
   * - `disable` - used by clone: the copy lands in an account that did not
   *   author it, so `schedule` is nulled and the copy lands dormant. The new
   *   owner turns it back on deliberately.
   */
  schedules: 'preserve' | 'disable'
}

/** The reconcile target. Managed/ownership fields are always engine-controlled. */
export interface TargetBlueprint {
  id: string
  userId: string
  alias: string | null
}

export interface ImportUser {
  id: string
  [key: string]: unknown
}

export type TouchedResource = {
  id: string
  name: string | null
  description: string | null
}

export type TouchedResourcesByCategory = Record<string, TouchedResource[]>

/** The reconcile result: the touched resources plus the source-id → new-id map. */
export interface ImportResult {
  resources: TouchedResourcesByCategory
  /** Maps each input node id (caller-local / source real id) to its written id. */
  idMap: Map<string, string>
}

export interface ImportIssue {
  error: string
  [key: string]: unknown
}

/** Result of parsing a resource payload into nodes (or why it was rejected). */
export type PrepareNodesResult =
  | { ok: true; nodes: ResourceNode[]; nodesById: Map<string, ResourceNode> }
  | {
      ok: false
      reason: 'invalid' | 'empty' | 'duplicate'
      issues: ImportIssue[]
    }

// @note a transaction client exposes the same model delegates as the root
// client, minus the `$`-prefixed lifecycle methods
type ImportTx = Omit<typeof prisma, `$${string}`>
type ImportClient = ImportTx | typeof prisma

type ModelDelegate = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>
  findUnique: (args: unknown) => Promise<Record<string, unknown> | null>
  create: (args: unknown) => Promise<TouchedResource>
  update: (args: unknown) => Promise<TouchedResource>
}

/** Dynamic model access by refKey (`bot`, `triggerIntegration`, …). */
function modelDelegate(client: ImportClient, refKey: string): ModelDelegate {
  return (client as unknown as Record<string, ModelDelegate>)[refKey]
}

const RESOURCE_SELECT = { id: true, name: true, description: true } as const

// ── Policy resolution (the only place "what mode means" is decided) ──────────

const POLICY_TABLE: Record<ImportPolicy, ResolvedImportPolicy> = {
  sync: { alias: 'upsert', refs: 'external', schedules: 'preserve' },
  clone: { alias: 'strip', refs: 'strip', schedules: 'disable' },
  restore: { alias: 'upsert', refs: 'internal', schedules: 'preserve' },
}

export function resolveImportPolicy(
  policy: ImportPolicy
): ResolvedImportPolicy {
  return POLICY_TABLE[policy]
}

// ── Field taxonomy ───────────────────────────────────────────────────────────

/** Ownership/system fields a caller may never set; always engine-controlled. */
const MANAGED_FIELDS = new Set([
  'id',
  'userId',
  'blueprintId',
  'lockId',
  'createdAt',
  'updatedAt',
])

function stripManagedFields(
  data: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !MANAGED_FIELDS.has(key))
  )
}

/** Removes credential/token fields a template must never overwrite on update. */
function stripUnmanagedFields(
  data: Record<string, unknown>,
  category?: string
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([key]) => !isUnmanagedBlueprintField(key, category)
    )
  )
}

// ── Seed defaults (`$default`) ─────────────────────────────────────────────────

/**
 * The seed-default marker key. A field value of `{ $default: <value> }` (in
 * place of a plain value) declares a *seed-only* default: `<value>` is written
 * on create, but the field is skipped on update (reconcile), so re-applying the
 * template never overwrites a value the user has since changed. It is the
 * template-driven counterpart to `UNMANAGED_FIELDS` (which the platform, not the
 * template, decides).
 */
const SEED_DEFAULT_KEY = '$default'

/** Whether a value is a `{ $default: … }` marker rather than a plain value. */
function isSeedDefaultMarker(
  value: unknown
): value is Record<typeof SEED_DEFAULT_KEY, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    Object.prototype.hasOwnProperty.call(value, SEED_DEFAULT_KEY)
  )
}

/**
 * Splits a resource's raw data into plain values - with any `$default` markers
 * unwrapped to their seed value so validation and create see the real value -
 * and the set of field names that were marked seed-only.
 */
function extractSeedDefaults(data: Record<string, unknown>): {
  data: Record<string, unknown>
  seedFields: Set<string>
} {
  const out: Record<string, unknown> = {}
  const seedFields = new Set<string>()

  for (const [key, value] of Object.entries(data)) {
    if (isSeedDefaultMarker(value)) {
      out[key] = value[SEED_DEFAULT_KEY]
      seedFields.add(key)
    } else {
      out[key] = value
    }
  }

  return { data: out, seedFields }
}

/** Removes seed-only (`$default`) fields on update so a re-apply preserves them. */
function stripSeedFields(
  data: Record<string, unknown>,
  seedFields?: Set<string>
): Record<string, unknown> {
  if (!seedFields || seedFields.size === 0) {
    return data
  }

  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !seedFields.has(key))
  )
}

// ── Space seed files (`$files`) ────────────────────────────────────────────────

/**
 * The space-storage seed directive key. On a `space` resource, a
 * `$files: [{ path, content }]` entry on the raw resource data declares files to
 * write into that space's storage when it is first created. It is `$files` (not
 * `$spaceFiles`) because it sits on a space and reads naturally there; the
 * engine-internal names stay `spaceSeedFiles` to distinguish this from the `file`
 * resource. It is stripped from the data before schema validation (it is not a
 * persisted column), carried on the node, and - like `$default` - applied
 * seed-only: written on create, skipped on update, so a re-import never clobbers
 * files the space's agent has since changed.
 */
const SPACE_FILES_KEY = '$files'

/** A single file to seed into a space's storage (`$files` entry). */
export interface SpaceSeedFile {
  path: string
  content: string
}

// ── File seed text (`$text`) ──────────────────────────────────────────────────

/**
 * The file-content seed directive key. On a `file` resource, `$text: "..."`
 * declares the text to write into that file's object storage when it is first
 * created. A `File` row carries only a name, description and visibility - its
 * body lives in object storage behind the upload endpoint - so there is no
 * column to hold this and it cannot be a plain field.
 *
 * It is the `file` counterpart to a space's `$files`: stripped before schema
 * validation, carried on the node, and applied seed-only (written on create,
 * skipped on update) so a re-import never clobbers a file the user has since
 * edited.
 */
const FILE_TEXT_KEY = '$text'

/** Whether a value is a well-formed `$text` directive (a non-empty string). */
function isFileTextDirective(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

/** Whether a value is a well-formed `$files` array of `{ path, content }` entries. */
function isSpaceFilesDirective(value: unknown): value is SpaceSeedFile[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).path === 'string' &&
        (entry as Record<string, unknown>).path !== '' &&
        typeof (entry as Record<string, unknown>).content === 'string'
    )
  )
}

// ── Registries ───────────────────────────────────────────────────────────────

interface ReferenceAccessEntry {
  refKey: string
  select: Record<string, boolean>
  // @note the resource shape is the registry's dynamic `select` result, checked
  // structurally by each access helper - typed permissively at this boundary
  canUse: (
    user: ImportUser,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resource: any
  ) => boolean | Promise<boolean>
}

export const referenceAccessRegistry: Record<string, ReferenceAccessEntry> = {
  bot: {
    refKey: 'bot',
    select: { id: true, userId: true, visibility: true },
    canUse: async (user, resource) => await canUseBot(user.id, resource),
  },
  dataset: {
    refKey: 'dataset',
    select: { id: true, userId: true, visibility: true },
    canUse: async (user, resource) => await canUseDataset(user.id, resource),
  },
  skillset: {
    refKey: 'skillset',
    select: { id: true, userId: true, visibility: true },
    canUse: async (user, resource) => await canUseSkillset(user.id, resource),
  },
  secret: {
    refKey: 'secret',
    select: { id: true, userId: true, visibility: true, kind: true },
    canUse: async (user, resource) =>
      await canUseSecret(user as Parameters<typeof canUseSecret>[0], resource),
  },
  file: {
    refKey: 'file',
    select: { id: true, userId: true, visibility: true },
    canUse: async (user, resource) => canUseFile(user.id, resource),
  },
  space: {
    refKey: 'space',
    select: { id: true, userId: true },
    canUse: async (user, resource) => canUseSpace(user.id, resource),
  },
  contact: {
    refKey: 'contact',
    select: { id: true, userId: true },
    canUse: async (user, resource) => canUseContact(user.id, resource),
  },
  oAuthConnection: {
    refKey: 'oAuthConnection',
    select: { id: true, userId: true },
    canUse: async (user, resource) => resource.userId === user.id,
  },
}

interface CategoryEntry {
  type: string
  refKey: string
  schema: ZodTypeAny
}

// @note a policy config must be validated against the shape selected by the
// row `type` - the same contract as the create/update endpoints and the
// runtime (`parsePolicyConfig`). The model schema types `config` as the loose
// PolicyConfig union, whose branches strip unknown keys, so parsing through it
// here could silently rewrite a config (a stripped `{}` usage config both
// disables enforcement and errors on every usage event). The config is carried
// as raw JSON instead and type-checked without being transformed.
const TypedConfigPolicyBlueprintSchema = PolicyBlueprintSchema.extend({
  config: z.record(z.unknown()).nullish(),
}).superRefine((data, ctx) => {
  if (data.config === null || data.config === undefined) {
    return
  }

  try {
    parsePolicyConfig(data.type ?? PolicyType.retention, data.config)
  } catch (e) {
    if (e instanceof ZodError) {
      for (const issue of e.issues) {
        ctx.addIssue({ ...issue, path: ['config', ...issue.path] })
      }
    } else {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['config'],
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }
})

export const categoryRegistry: Record<string, CategoryEntry> = {
  bot: { type: 'Bot', refKey: 'bot', schema: BotBlueprintSchema },
  dataset: {
    type: 'Dataset',
    refKey: 'dataset',
    schema: DatasetBlueprintSchema,
  },
  skillset: {
    type: 'Skillset',
    refKey: 'skillset',
    schema: SkillsetBlueprintSchema,
  },
  ability: {
    type: 'Ability',
    refKey: 'ability',
    schema: AbilityBlueprintSchema,
  },
  secret: { type: 'Secret', refKey: 'secret', schema: SecretBlueprintSchema },
  file: { type: 'File', refKey: 'file', schema: FileBlueprintSchema },
  portal: { type: 'Portal', refKey: 'portal', schema: PortalBlueprintSchema },
  portals: { type: 'Portal', refKey: 'portal', schema: PortalBlueprintSchema },
  space: { type: 'Space', refKey: 'space', schema: SpaceBlueprintSchema },
  policy: {
    type: 'Policy',
    refKey: 'policy',
    schema: TypedConfigPolicyBlueprintSchema,
  },
  task: { type: 'Task', refKey: 'task', schema: TaskBlueprintSchema },
  extractIntegration: {
    type: 'ExtractIntegration',
    refKey: 'extractIntegration',
    schema: ExtractIntegrationBlueprintSchema,
  },
  notionIntegration: {
    type: 'NotionIntegration',
    refKey: 'notionIntegration',
    schema: NotionIntegrationBlueprintSchema,
  },
  sitemapIntegration: {
    type: 'SitemapIntegration',
    refKey: 'sitemapIntegration',
    schema: SitemapIntegrationBlueprintSchema,
  },
  supportIntegration: {
    type: 'SupportIntegration',
    refKey: 'supportIntegration',
    schema: SupportIntegrationBlueprintSchema,
  },
  emailIntegration: {
    type: 'EmailIntegration',
    refKey: 'emailIntegration',
    schema: EmailIntegrationBlueprintSchema,
  },
  triggerIntegration: {
    type: 'TriggerIntegration',
    refKey: 'triggerIntegration',
    schema: TriggerIntegrationBlueprintSchema,
  },
  avatarIntegration: {
    type: 'AvatarIntegration',
    refKey: 'avatarIntegration',
    schema: AvatarIntegrationBlueprintSchema,
  },
  anamIntegration: {
    type: 'AnamIntegration',
    refKey: 'anamIntegration',
    schema: AnamIntegrationBlueprintSchema,
  },
  recallIntegration: {
    type: 'RecallIntegration',
    refKey: 'recallIntegration',
    schema: RecallIntegrationBlueprintSchema,
  },
  widgetIntegration: {
    type: 'WidgetIntegration',
    refKey: 'widgetIntegration',
    schema: WidgetIntegrationBlueprintSchema,
  },
  slackIntegration: {
    type: 'SlackIntegration',
    refKey: 'slackIntegration',
    schema: SlackIntegrationBlueprintSchema,
  },
  githubIntegration: {
    type: 'GithubIntegration',
    refKey: 'githubIntegration',
    schema: GithubIntegrationBlueprintSchema,
  },
  discordIntegration: {
    type: 'DiscordIntegration',
    refKey: 'discordIntegration',
    schema: DiscordIntegrationBlueprintSchema,
  },
  microsoftteamsIntegration: {
    type: 'MicrosoftteamsIntegration',
    refKey: 'microsoftteamsIntegration',
    schema: MicrosoftteamsIntegrationBlueprintSchema,
  },
  googlechatIntegration: {
    type: 'GooglechatIntegration',
    refKey: 'googlechatIntegration',
    schema: GooglechatIntegrationBlueprintSchema,
  },
  telegramIntegration: {
    type: 'TelegramIntegration',
    refKey: 'telegramIntegration',
    schema: TelegramIntegrationBlueprintSchema,
  },
  whatsappIntegration: {
    type: 'WhatsappIntegration',
    refKey: 'whatsappIntegration',
    schema: WhatsappIntegrationBlueprintSchema,
  },
  messengerIntegration: {
    type: 'MessengerIntegration',
    refKey: 'messengerIntegration',
    schema: MessengerIntegrationBlueprintSchema,
  },
  instagramIntegration: {
    type: 'InstagramIntegration',
    refKey: 'instagramIntegration',
    schema: InstagramIntegrationBlueprintSchema,
  },
  twilioIntegration: {
    type: 'TwilioIntegration',
    refKey: 'twilioIntegration',
    schema: TwilioIntegrationBlueprintSchema,
  },
  mcpserverIntegration: {
    type: 'McpserverIntegration',
    refKey: 'mcpserverIntegration',
    schema: McpserverIntegrationBlueprintSchema,
  },
  skillserverIntegration: {
    type: 'SkillserverIntegration',
    refKey: 'skillserverIntegration',
    schema: SkillserverIntegrationBlueprintSchema,
  },
}

// ── Structured errors (carry `.details.issues` for the route to surface) ─────

export class ImportError extends Error {
  details: { issues: ImportIssue[] }

  constructor(message: string, issues: ImportIssue[]) {
    super(message)
    this.name = 'ImportError'
    this.details = { issues }
  }
}

// ── Reference resolution ──────────────────────────────────────────────────────

type ReferenceMaps = Record<string, Map<string, string>>

function createReferenceMaps(): ReferenceMaps {
  const maps: ReferenceMaps = {}

  for (const { refKey } of Object.values(categoryRegistry)) {
    maps[refKey] = new Map()
  }

  return maps
}

function replaceReferences(
  data: Record<string, unknown>,
  maps: ReferenceMaps
): void {
  for (const key of Object.keys(data || {})) {
    if (!key.endsWith('Id')) {
      continue
    }

    const type = getReferenceFieldType(key)
    const map = type ? maps[type] : undefined

    if (!map) {
      continue
    }

    const value = data[key]

    if (typeof value !== 'string') {
      continue
    }

    if (map.has(value)) {
      data[key] = map.get(value)
    }
  }
}

/**
 * Deep-resolves token-format references ('#type:::localId') anywhere in the
 * data - including embedded inside string fields such as an ability
 * instruction - by replacing each resolved token with its real id. Gated to
 * token ids (containing ':::') so arbitrary local ids are never substring-
 * replaced inside prose.
 */
export function resolveEmbeddedTokenReferences(
  data: Record<string, unknown>,
  resolvedByLocalId: Map<string, string>
): Record<string, unknown> {
  let json = JSON.stringify(data)

  // @note replace longer tokens first so a token that is a prefix of another
  // (e.g. `#ability:::a-1` vs `#ability:::a-10`) can never corrupt the longer
  const tokens = [...resolvedByLocalId]
    .filter(([localId]) => localId.includes(':::'))
    .sort(([a], [b]) => b.length - a.length)

  for (const [localId, realId] of tokens) {
    json = json.split(localId).join(realId)
  }

  return JSON.parse(json)
}

function isResolvedImportedReference(
  field: string,
  value: string,
  maps: ReferenceMaps
): boolean {
  const type = getReferenceFieldType(field)
  const map = type ? maps[type] : undefined

  if (!map) {
    return false
  }

  return [...map.values()].includes(value)
}

/**
 * Every `*Id` type-prefix that names an actual blueprint-resource reference: a
 * clonable category (whose ids are remapped during import) or an access-checked
 * external reference type. Scalar config fields that merely end in `Id` (e.g.
 * `phoneNumberId`, `personaId`, `appId`) are deliberately absent.
 */
const REFERENCE_FIELD_TYPES = new Set<string>([
  ...Object.values(categoryRegistry).map(({ refKey }) => refKey),
  ...Object.keys(referenceAccessRegistry),
])

/**
 * Whether a `*Id` field names an actual blueprint-resource reference (see
 * REFERENCE_FIELD_TYPES). Keeps scalar config fields out of reference
 * resolution, dependency ordering and unresolved-reference detection.
 */
function isReferenceField(field: string): boolean {
  const type = getReferenceFieldType(field)

  return type !== null && REFERENCE_FIELD_TYPES.has(type)
}

/**
 * Nulls every `*Id` **resource reference** that did not resolve to a node
 * created by this import. Used by the clone policy: an unresolved reference
 * points at a resource outside the cloned set - for a public hub blueprint, that
 * is the source owner's resource - so it must not survive into the cloner's
 * copy. Non-reference config scalars that merely end in `Id` are left intact.
 */
export function nullifyUnresolvedReferences(
  data: Record<string, unknown>,
  maps: ReferenceMaps
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data }

  for (const [key, value] of Object.entries(out)) {
    if (
      key.endsWith('Id') &&
      typeof value === 'string' &&
      value &&
      isReferenceField(key) &&
      !isResolvedImportedReference(key, value, maps)
    ) {
      out[key] = null
    }
  }

  return out
}

function findUnresolvedImportedReferences(
  data: Record<string, unknown>,
  importedNodeIds: Set<string>
): Array<{ field: string; value: string }> {
  const unresolved: Array<{ field: string; value: string }> = []

  for (const [key, value] of Object.entries(data || {})) {
    if (!key.endsWith('Id') || !isReferenceField(key)) {
      continue
    }

    if (typeof value !== 'string') {
      continue
    }

    if (importedNodeIds.has(value)) {
      unresolved.push({ field: key, value })
    }
  }

  // @note also catch token-format references left embedded anywhere in the
  // data (e.g. inside a string field) so an unresolved one still fails loudly

  const json = JSON.stringify(data || {})

  for (const id of importedNodeIds) {
    if (id.includes(':::') && json.includes(id)) {
      unresolved.push({ field: '(embedded)', value: id })
    }
  }

  return unresolved
}

async function findExternalReferenceIssues({
  tx,
  data,
  referenceMaps,
  user,
  nodeId,
  category,
}: {
  tx: ImportTx
  data: Record<string, unknown>
  referenceMaps: ReferenceMaps
  user: ImportUser
  nodeId: string
  category: string
}): Promise<ImportIssue[]> {
  const issues: ImportIssue[] = []

  for (const [key, value] of Object.entries(data || {})) {
    if (!key.endsWith('Id')) {
      continue
    }

    if (typeof value !== 'string' || !value) {
      continue
    }

    if (isResolvedImportedReference(key, value, referenceMaps)) {
      continue
    }

    const type = getReferenceFieldType(key)
    const registry = type ? referenceAccessRegistry[type] : undefined

    if (!registry) {
      continue
    }

    const resource = await modelDelegate(tx, registry.refKey).findUnique({
      where: { id: value },
      select: registry.select,
    })

    if (!resource) {
      issues.push({
        nodeId,
        category,
        field: key,
        value,
        error: 'external_reference_not_found',
        message: 'Referenced resource was not found',
      })

      continue
    }

    if (!(await registry.canUse(user, resource))) {
      issues.push({
        nodeId,
        category,
        field: key,
        value,
        error: 'external_reference_not_authorized',
        message: 'Referenced resource is not usable by the current user',
      })
    }
  }

  return issues
}

// ── Parsing ───────────────────────────────────────────────────────────────────

function collectNodesFromResourcePayload(
  resourcePayload: Record<string, unknown>
): { nodes: ResourceNode[]; issues: ImportIssue[] } {
  const nodes: ResourceNode[] = []
  const issues: ImportIssue[] = []

  for (const [category, entries] of Object.entries(resourcePayload || {})) {
    const registry = categoryRegistry[category]

    if (!registry) {
      issues.push({
        category,
        error: 'unsupported_resource_category',
        allowedCategories: Object.keys(categoryRegistry),
      })

      continue
    }

    if (!Array.isArray(entries)) {
      issues.push({
        category,
        error: 'invalid_category_payload',
        message: 'Each category must be an array of resources',
      })

      continue
    }

    for (const item of entries) {
      if (!item || typeof item !== 'object') {
        issues.push({
          category,
          error: 'invalid_resource_entry',
          message: 'Each resource entry must be an object',
        })

        continue
      }

      if (!item.id || typeof item.id !== 'string') {
        issues.push({
          category,
          error: 'missing_resource_id',
          message: 'Each resource entry must contain string id field',
        })

        continue
      }

      const {
        id,
        [SPACE_FILES_KEY]: rawSpaceFiles,
        [FILE_TEXT_KEY]: rawFileText,
        ...rawData
      } = item

      // @note peel the `$files` directive off before validation/create - it is
      // not a persisted field. Only spaces support it today; reject it elsewhere
      // rather than silently drop it.
      let seedSpaceFiles

      if (rawSpaceFiles !== undefined) {
        if (category !== 'space') {
          issues.push({
            category,
            error: 'unsupported_space_files',
            message: `"${SPACE_FILES_KEY}" is only supported on space resources`,
          })

          continue
        }

        if (!isSpaceFilesDirective(rawSpaceFiles)) {
          issues.push({
            category,
            error: 'invalid_space_files',
            message: `"${SPACE_FILES_KEY}" must be an array of { path, content } objects`,
          })

          continue
        }

        seedSpaceFiles = rawSpaceFiles
      }

      // @note peel the `$text` directive off before validation/create - a File
      // row has no column for its body. Only files support it; reject it
      // elsewhere rather than silently drop it.
      let seedFileText

      if (rawFileText !== undefined) {
        if (category !== 'file') {
          issues.push({
            category,
            error: 'unsupported_file_text',
            message: `"${FILE_TEXT_KEY}" is only supported on file resources`,
          })

          continue
        }

        if (!isFileTextDirective(rawFileText)) {
          issues.push({
            category,
            error: 'invalid_file_text',
            message: `"${FILE_TEXT_KEY}" must be a non-empty string`,
          })

          continue
        }

        seedFileText = rawFileText
      }

      const { data, seedFields } = extractSeedDefaults(rawData)

      nodes.push({
        id,
        category,
        type: registry.type,
        refKey: registry.refKey,
        schema: registry.schema,
        data,
        seedFields,
        seedSpaceFiles,
        seedFileText,
      })
    }
  }

  return { nodes, issues }
}

/**
 * Parses the public category-array payload (`{ bot: [{ id, ...fields }] }`)
 * into deduplicated nodes, or the issues that blocked it.
 */
export function parseCategoryArrayResources(
  resourcePayload: Record<string, unknown>
): PrepareNodesResult {
  const { nodes, issues } = collectNodesFromResourcePayload(resourcePayload)

  if (issues.length) {
    return { ok: false, reason: 'invalid', issues }
  }

  if (!nodes.length) {
    return { ok: false, reason: 'empty', issues: [] }
  }

  const duplicateIds: ImportIssue[] = []
  const nodesById = new Map<string, ResourceNode>()

  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      duplicateIds.push({ id: node.id, error: 'duplicate_resource_id' })

      continue
    }

    nodesById.set(node.id, node)
  }

  if (duplicateIds.length) {
    return { ok: false, reason: 'duplicate', issues: duplicateIds }
  }

  return { ok: true, nodes, nodesById }
}

/**
 * Parses the portable export document (`{ '#type:::id': { type, data } }`)
 * into nodes - used by clone (export → import). The token is kept as the node
 * id so embedded `:::` references resolve.
 */
export function parseExportDocument(
  document: BlueprintResourceDocument
): PrepareNodesResult {
  const payload: Record<string, unknown[]> = {}

  for (const [token, node] of Object.entries(document?.resources || {})) {
    const category = categoryByType(node.type)

    if (!category) {
      return {
        ok: false,
        reason: 'invalid',
        issues: [
          {
            error: 'unsupported_resource_category',
            type: node.type,
            allowedCategories: Object.keys(categoryRegistry),
          },
        ],
      }
    }

    if (!payload[category]) {
      payload[category] = []
    }

    payload[category].push({ id: token, ...node.data })
  }

  return parseCategoryArrayResources(payload)
}

function categoryByType(type: string): string | null {
  for (const [category, entry] of Object.entries(categoryRegistry)) {
    // @note prefer the canonical category whose key matches the refKey casing
    if (entry.type === type && category === entry.refKey) {
      return category
    }
  }

  for (const [category, entry] of Object.entries(categoryRegistry)) {
    if (entry.type === type) {
      return category
    }
  }

  return null
}

// ── Dependency ordering ───────────────────────────────────────────────────────

export function buildDependencies(nodesById: Map<string, ResourceNode>): {
  dependencies: Record<string, string[]>
  importedNodeIds: Set<string>
} {
  const dependencies: Record<string, string[]> = {}
  const importedNodeIds = new Set<string>(nodesById.keys())

  for (const [nodeId, node] of nodesById.entries()) {
    const deps: string[] = []

    for (const [key, value] of Object.entries(node.data || {})) {
      if (!key.endsWith('Id') || !isReferenceField(key)) {
        continue
      }

      if (typeof value !== 'string') {
        continue
      }

      if (importedNodeIds.has(value)) {
        deps.push(value)
      }
    }

    // @note also depend on any token-format id ('#type:::id') referenced
    // anywhere in the data - e.g. embedded inside an instruction string - so
    // topo-sort creates the referenced resource first

    const json = JSON.stringify(node.data || {})

    for (const otherId of importedNodeIds) {
      if (otherId === nodeId || !otherId.includes(':::')) {
        continue
      }

      if (!deps.includes(otherId) && json.includes(otherId)) {
        deps.push(otherId)
      }
    }

    dependencies[nodeId] = deps
  }

  return { dependencies, importedNodeIds }
}

/**
 * Computes the create order. Runs outside the transaction so a cyclic payload
 * never opens one.
 *
 * @throws {ImportError} `cyclic_dependency` when the resource graph has a cycle.
 */
export function planImportOrder(nodesById: Map<string, ResourceNode>): {
  sortedNodeIds: string[]
  importedNodeIds: Set<string>
} {
  const { dependencies, importedNodeIds } = buildDependencies(nodesById)

  let sortedNodeIds: string[]

  try {
    sortedNodeIds = topologicalSortWithCycleDetection(dependencies)
  } catch (error) {
    const details = (error as { details?: { issues?: ImportIssue[] } })?.details

    throw new ImportError(
      'Resource graph contains cyclic dependencies',
      details?.issues || [{ error: 'cyclic_dependency' }]
    )
  }

  return { sortedNodeIds, importedNodeIds }
}

// ── Create / update dispatch ──────────────────────────────────────────────────

/**
 * Auto-generated, required-with-no-default fields a template never carries
 * (stripped on export, minted on create - mirrors clone). Create only.
 */
function generatedDefaultsForCreate(nodeType: string): Record<string, string> {
  const token = () => crypto.randomBytes(32).toString('hex')

  switch (nodeType) {
    case 'TriggerIntegration':
      return { secret: token() }
    case 'WhatsappIntegration':
    case 'MessengerIntegration':
    case 'InstagramIntegration':
      return { verifyToken: token() }
    case 'McpserverIntegration':
    case 'SkillserverIntegration':
      return { accessToken: token() }
    case 'NotionIntegration':
      return { token: token() }
    default:
      return {}
  }
}

async function createResource(
  tx: ImportTx,
  node: ResourceNode,
  data: Record<string, unknown>,
  resourceId: string,
  blueprintId: string,
  userId: string
): Promise<TouchedResource> {
  const payload = {
    // @note generated first so any explicitly provided value still wins
    ...generatedDefaultsForCreate(node.type),
    ...stripManagedFields(data),
    id: resourceId,
    blueprintId,
    userId,
  }

  return modelDelegate(tx, node.refKey).create({
    data: payload,
    select: RESOURCE_SELECT,
  })
}

async function updateResource(
  tx: ImportTx,
  node: ResourceNode,
  data: Record<string, unknown>,
  resourceId: string,
  blueprintId: string
): Promise<TouchedResource> {
  // @note the validated data carries no id; the id is the match target in `where`
  const payload = {
    ...stripManagedFields(
      stripSeedFields(
        stripUnmanagedFields(data, node.category),
        node.seedFields
      )
    ),
    blueprintId,
  }

  return modelDelegate(tx, node.refKey).update({
    where: { id: resourceId },
    data: payload,
    select: RESOURCE_SELECT,
  })
}

// ── Change detection ──────────────────────────────────────────────────────────

/**
 * Structural deep-equality for reconcile change-detection. Handles the JSON-ish
 * values Prisma scalar and JSON fields produce - primitives, arrays (order-
 * sensitive), and plain objects (key-order independent).
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }

  // @note Dates have no enumerable keys, so the object branch below would treat
  // any two as equal - compare by timestamp instead (a changed date must count)
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }

  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false
  }

  const aIsArray = Array.isArray(a)

  if (aIsArray !== Array.isArray(b)) {
    return false
  }

  if (aIsArray) {
    const arrB = b as unknown[]

    return (
      (a as unknown[]).length === arrB.length &&
      (a as unknown[]).every((item, i) => deepEqual(item, arrB[i]))
    )
  }

  const objA = a as Record<string, unknown>
  const objB = b as Record<string, unknown>
  const aKeys = Object.keys(objA)
  const bKeys = Object.keys(objB)

  return (
    aKeys.length === bKeys.length &&
    aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(objB, key) &&
        deepEqual(objA[key], objB[key])
    )
  )
}

/** Whether an update would be a no-op: every managed field already matches. */
function isManagedDataUnchanged(
  managedData: Record<string, unknown>,
  existing: Record<string, unknown> | undefined
): boolean {
  if (!existing) {
    return false
  }

  return Object.entries(managedData).every(([key, value]) =>
    deepEqual(value, existing[key])
  )
}

// ── Alias matching + blueprint discovery ──────────────────────────────────────

function collectAliasLookupsByCategory(
  nodesById: Map<string, ResourceNode>
): Map<string, { refKey: string; aliases: Set<string> }> {
  const byCategory = new Map<string, { refKey: string; aliases: Set<string> }>()

  for (const node of nodesById.values()) {
    const alias =
      typeof node.data?.alias === 'string' ? (node.data.alias as string) : ''

    if (!alias) {
      continue
    }

    let entry = byCategory.get(node.category)

    if (!entry) {
      entry = { refKey: node.refKey, aliases: new Set() }
      byCategory.set(node.category, entry)
    }

    entry.aliases.add(alias)
  }

  return byCategory
}

async function buildBlueprintAliasMap(
  tx: ImportTx,
  blueprintIds: Set<string>
): Promise<Map<string, string | null>> {
  const rows = await tx.blueprint.findMany({
    where: { id: { in: [...blueprintIds] } },
    select: { id: true, alias: true },
  })

  return new Map(rows.map((row) => [row.id, row.alias]))
}

interface AliasMatch {
  id: string
  data: Record<string, unknown>
}

/**
 * Matches incoming aliased nodes against the caller's existing resources, keyed
 * by `"category:alias"`. Matching is scoped to the **user** - the same scope as
 * the `@@unique([userId, alias])` constraint and `@alias` resolution - not the
 * blueprint. A resource orphaned by a deleted blueprint (`blueprintId: null`) is
 * matched and re-homed on update. A resource in a different *active* blueprint
 * is re-homed only when the target is aliased and the source is not (an
 * intentional alias move); otherwise it is reported as a conflict so import
 * never steals live nodes.
 */
async function buildExistingMatchesByAlias(
  tx: ImportTx,
  nodesById: Map<string, ResourceNode>,
  userId: string,
  blueprint: TargetBlueprint
): Promise<{ matches: Map<string, AliasMatch>; issues: ImportIssue[] }> {
  const byCategory = collectAliasLookupsByCategory(nodesById)
  const matches = new Map<string, AliasMatch>()
  const issues: ImportIssue[] = []
  const activeOtherBlueprintRows: Array<{
    category: string
    row: Record<string, unknown>
  }> = []

  for (const [category, { refKey, aliases }] of byCategory) {
    // @note no `select` - the full scalar record is compared field-by-field
    // against the incoming payload to detect (and skip) no-op updates

    const rows = await modelDelegate(tx, refKey).findMany({
      where: { userId, alias: { in: [...aliases] } },
    })

    for (const row of rows) {
      if (
        row.blueprintId !== null &&
        row.blueprintId !== undefined &&
        row.blueprintId !== blueprint.id
      ) {
        activeOtherBlueprintRows.push({ category, row })

        continue
      }

      matches.set(`${category}:${row.alias}`, {
        id: row.id as string,
        data: row,
      })
    }
  }

  if (activeOtherBlueprintRows.length) {
    const sourceBlueprintAliases = blueprint.alias
      ? await buildBlueprintAliasMap(
          tx,
          new Set(
            activeOtherBlueprintRows.map(({ row }) => row.blueprintId as string)
          )
        )
      : new Map<string, string | null>()

    for (const { category, row } of activeOtherBlueprintRows) {
      const sourceBlueprintAlias = sourceBlueprintAliases.get(
        row.blueprintId as string
      )

      if (
        blueprint.alias &&
        sourceBlueprintAliases.has(row.blueprintId as string) &&
        !sourceBlueprintAlias
      ) {
        matches.set(`${category}:${row.alias}`, {
          id: row.id as string,
          data: row,
        })

        continue
      }

      issues.push({
        category,
        alias: row.alias as string,
        resourceId: row.id as string,
        existingBlueprintId: row.blueprintId as string,
        existingBlueprintAlias: sourceBlueprintAlias ?? null,
        targetBlueprintId: blueprint.id,
        targetBlueprintAlias: blueprint.alias ?? null,
        error: 'resource_alias_in_active_blueprint',
        message:
          'A resource with this alias already belongs to another active blueprint',
      })
    }
  }

  return { matches, issues }
}

/**
 * When an ensured `@alias` does not resolve, an existing active blueprint can
 * still be identified by the stable resource aliases in the template. Reuse it
 * instead of creating a new blueprint and then re-homing its live resources.
 */
export async function findReusableBlueprintByResourceAliases(
  client: typeof prisma,
  nodesById: Map<string, ResourceNode>,
  userId: string
): Promise<{ blueprint: TargetBlueprint | null; issues: ImportIssue[] }> {
  const byCategory = collectAliasLookupsByCategory(nodesById)
  const blueprintIds = new Set<string>()
  const matches: Array<Record<string, unknown>> = []

  for (const [category, { refKey, aliases }] of byCategory) {
    const rows = await modelDelegate(client, refKey).findMany({
      where: {
        userId,
        alias: { in: [...aliases] },
        blueprintId: { not: null },
      },
      select: { id: true, alias: true, blueprintId: true },
    })

    for (const row of rows) {
      if (typeof row.blueprintId !== 'string') {
        continue
      }

      blueprintIds.add(row.blueprintId)
      matches.push({
        category,
        alias: row.alias,
        resourceId: row.id,
        blueprintId: row.blueprintId,
      })
    }
  }

  if (blueprintIds.size === 0) {
    return { blueprint: null, issues: [] }
  }

  if (blueprintIds.size > 1) {
    return {
      blueprint: null,
      issues: [
        {
          error: 'resource_aliases_span_active_blueprints',
          message:
            'Resource aliases in the import payload already belong to multiple active blueprints',
          matches,
        },
      ],
    }
  }

  const blueprintId = [...blueprintIds][0]
  const blueprint = await client.blueprint.findUnique({
    where: { id: blueprintId },
    select: { id: true, userId: true, alias: true },
  })

  if (!blueprint || blueprint.userId !== userId) {
    return { blueprint: null, issues: [] }
  }

  return { blueprint, issues: [] }
}

/**
 * Returns the caller's own alias from a `@alias` identifier, or null when it is
 * not ensure-able (a raw id, a parent `@@alias`, a compound `@user@resource`,
 * or an alias that fails validation).
 */
export function getEnsurableAlias(
  identifier: string,
  aliasValidator: { validate: (alias: string) => { error?: unknown } }
): string | null {
  if (typeof identifier !== 'string') {
    return null
  }

  if (!identifier.startsWith('@') || identifier.startsWith('@@')) {
    return null
  }

  const rest = identifier.slice(1)

  if (rest.includes('@')) {
    return null
  }

  const alias = rest.trim()

  if (!alias) {
    return null
  }

  if (aliasValidator.validate(alias).error) {
    return null
  }

  return alias
}

/**
 * Ensures the caller's blueprint with the given alias exists, creating a bare
 * one when it does not. A concurrent first-load may win the `userId_alias`
 * race, so on conflict we re-resolve and use the winner.
 */
export async function ensureBlueprintByAlias(
  user: { id: string },
  alias: string
): Promise<TargetBlueprint> {
  try {
    return await prisma.blueprint.create({
      data: { userId: user.id, alias },
      select: { id: true, userId: true, alias: true },
    })
  } catch (error) {
    const existing = await prisma.blueprint.findUnique({
      where: { userId_alias: { userId: user.id, alias } },
      select: { id: true, userId: true, alias: true },
    })

    if (existing) {
      return existing
    }

    throw error
  }
}

// ── Reconcile (runs inside the caller's transaction) ──────────────────────────

/**
 * Reconciles a parsed resource set into a target blueprint under the given
 * policy. Runs inside the caller's `tx`.
 *
 * @throws {ImportError} with structured `details.issues` on validation,
 *   reference, or alias-conflict failures.
 */
export async function importBlueprintResources(args: {
  tx: ImportTx
  user: ImportUser
  targetBlueprint: TargetBlueprint
  nodesById: Map<string, ResourceNode>
  sortedNodeIds: string[]
  importedNodeIds: Set<string>
  policy: ImportPolicy
}): Promise<ImportResult> {
  const {
    tx,
    user,
    targetBlueprint: blueprint,
    nodesById,
    sortedNodeIds,
    importedNodeIds,
    policy,
  } = args

  const resolved = resolveImportPolicy(policy)

  // @note assign a fresh platform id to every node up front
  const platformIdsBySourceId = new Map<string, string>()
  const assignedPlatformIds = new Set<string>()

  for (const nodeId of nodesById.keys()) {
    let platformId = cuid()

    while (assignedPlatformIds.has(platformId)) {
      platformId = cuid()
    }

    assignedPlatformIds.add(platformId)
    platformIdsBySourceId.set(nodeId, platformId)
  }

  const referenceMaps = createReferenceMaps()
  const resolvedRealIdByLocalId = new Map<string, string>()

  // @note alias matching only under the upsert policy; strip always creates fresh
  const { matches: matchesByAlias, issues: aliasMatchIssues } =
    resolved.alias === 'upsert'
      ? await buildExistingMatchesByAlias(tx, nodesById, user.id, blueprint)
      : { matches: new Map<string, AliasMatch>(), issues: [] }

  if (aliasMatchIssues.length) {
    throw new ImportError(
      'Resource alias belongs to another blueprint',
      aliasMatchIssues
    )
  }

  const targetIdBySourceId = new Map<string, string>()
  const opBySourceId = new Map<string, 'create' | 'update'>()
  const existingDataBySourceId = new Map<string, Record<string, unknown>>()

  for (const [sourceId, node] of nodesById) {
    const alias =
      typeof node.data?.alias === 'string' ? (node.data.alias as string) : ''

    const existing = alias
      ? matchesByAlias.get(`${node.category}:${alias}`)
      : undefined

    if (existing) {
      targetIdBySourceId.set(sourceId, existing.id)
      opBySourceId.set(sourceId, 'update')
      existingDataBySourceId.set(sourceId, existing.data)
    } else {
      targetIdBySourceId.set(
        sourceId,
        platformIdsBySourceId.get(sourceId) as string
      )
      opBySourceId.set(sourceId, 'create')
    }
  }

  const touchedResourcesByCategory: TouchedResourcesByCategory = {}

  for (const nodeId of sortedNodeIds) {
    const node = nodesById.get(nodeId)

    if (!node) {
      continue
    }

    let data = stripManagedFields({ ...node.data })

    // @note under the strip policy copies are unaliased (avoids the userId_alias
    // collision when cloning a blueprint into the same account)
    if (resolved.alias === 'strip') {
      delete data.alias
    }

    replaceReferences(data, referenceMaps)

    // @note resolve token references embedded in string fields
    data = resolveEmbeddedTokenReferences(data, resolvedRealIdByLocalId)

    // @note clone: drop any reference that points outside the cloned set, so a
    // cloned resource can never reference the source owner's resources
    if (resolved.refs === 'strip') {
      data = nullifyUnresolvedReferences(data, referenceMaps)
    }

    // @note clone: a copy must never inherit a live cadence, or the sweeps start
    // running it the moment it lands, on behalf of an owner who has not even
    // opened it yet. Nulling `schedule` is the only thing that stops them: both
    // queues select on it, and the named intervals (`hourly`, `daily`, ...) fire
    // off `lastRunAt`/`lastTriggerAt` without consulting `nextRunAt`. Done before
    // validation so the nulled schedule is what gets written.
    if (resolved.schedules === 'disable' && data.schedule) {
      data = { ...data, schedule: null }
    }

    const unresolved = findUnresolvedImportedReferences(data, importedNodeIds)

    if (unresolved.length) {
      throw new ImportError('Unresolved imported references remain', [
        {
          nodeId,
          category: node.category,
          error: 'unresolved_reference_after_replacement',
          unresolvedReferences: unresolved,
        },
      ])
    }

    const validation = node.schema.safeParse(data)

    if (!validation.success) {
      throw new ImportError('Resource validation failed', [
        {
          nodeId,
          category: node.category,
          error: 'resource_validation_failed',
          validationErrors: validation.error.issues.map((issue) => ({
            path: issue.path,
            code: issue.code,
            message: issue.message,
          })),
        },
      ])
    }

    const isUpdate = opBySourceId.get(node.id) === 'update'

    if (resolved.refs === 'external') {
      const referenceData = isUpdate
        ? stripUnmanagedFields(validation.data, node.category)
        : validation.data

      const externalReferenceIssues = await findExternalReferenceIssues({
        tx,
        data: referenceData,
        referenceMaps,
        user,
        nodeId,
        category: node.category,
      })

      if (externalReferenceIssues.length) {
        throw new ImportError(
          'External resource reference failed',
          externalReferenceIssues
        )
      }
    }

    const resourceId = targetIdBySourceId.get(node.id)

    if (!resourceId) {
      throw new ImportError('Target id missing for imported node', [
        {
          nodeId,
          category: node.category,
          error: 'missing_generated_resource_id',
        },
      ])
    }

    let resource: TouchedResource

    if (isUpdate) {
      const existingData = existingDataBySourceId.get(node.id)

      // @note skip the write when the resource already lives in this blueprint
      // AND every managed field matches. A match in another blueprint (or
      // orphaned with null blueprintId) is always written so it re-homes via the
      // payload's blueprintId.
      if (
        existingData &&
        existingData.blueprintId === blueprint.id &&
        isManagedDataUnchanged(
          stripManagedFields(
            stripSeedFields(
              stripUnmanagedFields(validation.data, node.category),
              node.seedFields
            )
          ),
          existingData
        )
      ) {
        resource = {
          id: existingData.id as string,
          name: (existingData.name as string) ?? null,
          description: (existingData.description as string) ?? null,
        }
      } else {
        resource = await updateResource(
          tx,
          node,
          validation.data,
          resourceId,
          blueprint.id
        )
      }
    } else {
      resource = await createResource(
        tx,
        node,
        validation.data,
        resourceId,
        blueprint.id,
        user.id
      )

      // @note seed `$files` into the new space's storage, only on create
      // (seed-only, like `$default`), so a re-import never overwrites files the
      // space's agent has since edited. This is part of the import: if the write
      // fails the whole import rolls back.
      if (node.category === 'space' && node.seedSpaceFiles?.length) {
        for (const file of node.seedSpaceFiles) {
          await uploadSpaceStorageFile({
            spaceId: resource.id,
            path: file.path,
            body: file.content,
            // @note derive the content type from the file name so a `.js`,
            // `.py`, `.json`, … seed is not mislabelled as markdown
            contentType: nameToType(file.path),
          })
        }
      }

      // @note seed `$text` into the new file's object storage, only on create -
      // same seed-only contract as `$files` above. A File row carries no body,
      // so without this the content a template ships would have nowhere to land.
      if (node.category === 'file' && node.seedFileText) {
        await uploadFileObject(resource.id, node.seedFileText, {
          // @note derive the content type from the file's name so a `.md`,
          // `.json`, `.py`, … seed is not mislabelled
          contentType: nameToType(
            typeof validation.data.name === 'string' ? validation.data.name : ''
          ),
        })
      }
    }

    referenceMaps[node.refKey].set(node.id, resource.id)
    resolvedRealIdByLocalId.set(node.id, resource.id)

    if (!touchedResourcesByCategory[node.category]) {
      touchedResourcesByCategory[node.category] = []
    }

    touchedResourcesByCategory[node.category].push(resource)
  }

  return {
    resources: touchedResourcesByCategory,
    idMap: resolvedRealIdByLocalId,
  }
}

'use server'

import { appActionHandler } from '@/lib/app.action'
import { getSessionClient } from '@/lib/cbk.sdk'
import { captureException } from '@/lib/error'
import fetch from '@/lib/fetch'
import { getExternalAPIHostURL } from '@/lib/host'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import {
  APP_NAME,
  DAY_IN_SECONDS,
  DEFAULT_DAILY_TOKEN_BUDGET,
  factoryAliases,
} from './const'
import { ensureFactory, createFactory as provisionFactory } from './factory'

type UserClient = Awaited<ReturnType<typeof getSessionClient>>

/** A factory is addressed by its blueprint alias; resources hang off it. */
const factorySchema = z.string().min(1).max(120)

function githubEndpoint(factory: string, action: string): string {
  return `/api/v1/integration/github/@${factoryAliases(factory).github}/${action}`
}

/**
 * A path inside the space, rejected if it tries to escape the space root.
 */
const PathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((p) => !p.startsWith('/') && !p.split('/').includes('..'), {
    message: 'Invalid path',
  })

/* -------------------------------- factories ------------------------------- */

export interface FactorySummary {
  factory: string
  id: string
  name: string
  description: string
}

/**
 * Lists this app's factories (blueprints marked with `meta.app`), newest first.
 *
 * @action
 */
export const listFactories = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}),
  async (_config, session): Promise<{ factories: FactorySummary[] }> => {
    const userClient = await getSessionClient(session)

    const { items } = await userClient.blueprint.list({ order: 'desc' })

    const factories = (items as Array<Record<string, unknown>>)
      .filter((b) => (b.meta as { app?: string } | null)?.app === APP_NAME)
      .filter((b) => Boolean(b.alias))
      .map((b) => ({
        factory: b.alias as string,
        id: b.id as string,
        name: (b.name as string) || 'Untitled factory',
        description: (b.description as string) || '',
      }))

    return { factories }
  }
)

/**
 * Creates a new factory (a fresh blueprint provisioned from the template).
 *
 * @action
 */
export const createFactory = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    name: z
      .string()
      .min(1)
      .max(200)
      .transform((v) => v.trim()),
    description: z
      .string()
      .max(8192)
      .default('')
      .transform((v) => v.trim()),
  }),
  async (_config, session, { name, description }): Promise<FactorySummary> => {
    const userClient = await getSessionClient(session)

    return provisionFactory(userClient, name, description ?? '')
  }
)

/**
 * Fetches a single factory (its blueprint) - used to render its name and verify
 * it exists.
 *
 * @action
 */
export const getFactory = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ factory: factorySchema }),
  async (_config, session, { factory }): Promise<FactorySummary> => {
    const userClient = await getSessionClient(session)

    // Re-apply the template so structural changes propagate to this factory.
    // Best-effort: a reconcile failure must not block opening the factory.
    try {
      await ensureFactory(userClient, factory)
    } catch (error) {
      await captureException(error)
    }

    const blueprint = await userClient.blueprint.fetch(`@${factory}`)

    return {
      factory,
      id: blueprint.id,
      name: blueprint.name || 'Untitled factory',
      description: (blueprint.description as string) || '',
    }
  }
)

/**
 * Updates a factory's name and description.
 *
 * @action
 */
export const updateFactory = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    factory: factorySchema,
    name: z
      .string()
      .min(1)
      .max(200)
      .transform((v) => v.trim()),
    description: z
      .string()
      .max(8192)
      .default('')
      .transform((v) => v.trim()),
  }),
  async (
    _config,
    session,
    { factory, name, description }
  ): Promise<{ ok: true }> => {
    const userClient = await getSessionClient(session)

    // @note resend the alias - blueprint/update defaults an omitted alias to
    // null and writes it raw, so a partial update would wipe the factory's
    // `@f-<key>` address (see ensureFactory for the full rationale).
    await userClient.blueprint.update(`@${factory}`, {
      alias: factory,
      name,
      description,
    })

    return { ok: true }
  }
)

/**
 * Deletes a factory (its blueprint and everything in it).
 *
 * @action
 */
export const deleteFactory = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ factory: factorySchema }),
  async (_config, session, { factory }): Promise<{ ok: true }> => {
    const userClient = await getSessionClient(session)

    // delete the whole factory - its blueprint AND all of its resources (bot,
    // skillset, space, integration, abilities), not just the container.
    await userClient.blueprint.delete(`@${factory}`, { deleteResources: true })

    return { ok: true }
  }
)

/* --------------------------------- github --------------------------------- */

interface GithubStatus {
  configured: boolean
  appId: string | null
  webhookUrl: string | null
}

async function getGithubStatus(
  userClient: UserClient,
  factory: string
): Promise<GithubStatus> {
  try {
    const integration = (await userClient.clientFetch(
      githubEndpoint(factory, 'fetch')
    )) as Record<string, unknown>

    const appId = (integration.appId as string) || null
    const privateKey = (integration.privateKey as string) || null
    const id = integration.id as string | undefined

    return {
      configured: Boolean(appId && privateKey),
      appId,
      webhookUrl: id
        ? getExternalAPIHostURL(`/v1/integration/github/${id}/event`)
        : null,
    }
  } catch {
    return { configured: false, appId: null, webhookUrl: null }
  }
}

interface SettingsSummary extends GithubStatus {
  /** The factory bot's current language model. */
  model: string
  /**
   * The factory's daily token budget (the usage policy's threshold). Falls back
   * to the template default when the policy hasn't been provisioned yet.
   */
  dailyTokenBudget: number
}

/**
 * Reads the factory's daily token budget from its usage policy. Falls back to
 * the template default if the policy is missing or not a tokens/usage policy.
 */
async function getDailyTokenBudget(
  userClient: UserClient,
  factory: string
): Promise<number> {
  try {
    const policy = (await userClient.policy.fetch(
      `@${factoryAliases(factory).policy}`
    )) as { config?: { metric?: string; threshold?: number } | null }

    const config = policy.config

    if (config && config.metric === 'tokens' && config.threshold) {
      return config.threshold
    }
  } catch {
    // policy not provisioned yet (older factory before its next re-apply)
  }

  return DEFAULT_DAILY_TOKEN_BUDGET
}

/**
 * Reads the factory's Settings surface: GitHub App connection status, the
 * agent's current model, and the daily token budget.
 *
 * @action
 */
export const getGithubSettings = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ factory: factorySchema }),
  async (_config, session, { factory }): Promise<SettingsSummary> => {
    const userClient = await getSessionClient(session)

    const github = await getGithubStatus(userClient, factory)

    let model = 'glm-5.2'

    try {
      const { botId } = await resolveContext(userClient, factory)
      const bot = (await userClient.bot.fetch(botId)) as { model?: string }

      model = (bot.model as string) || 'glm-5.2'
    } catch {
      model = 'glm-5.2'
    }

    const dailyTokenBudget = await getDailyTokenBudget(userClient, factory)

    return { ...github, model, dailyTokenBudget }
  }
)

/**
 * Updates the factory's daily token budget (the usage policy's threshold). The
 * rest of the policy - tokens metric, 1-day window, block action - is preserved.
 *
 * @action
 */
export const setDailyTokenBudget = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    factory: factorySchema,
    dailyTokenBudget: z
      .number()
      .int()
      .positive()
      .max(1_000_000_000),
  }),
  async (
    _config,
    session,
    { factory, dailyTokenBudget }
  ): Promise<{ ok: true }> => {
    const userClient = await getSessionClient(session)

    const policy = (await userClient.policy.fetch(
      `@${factoryAliases(factory).policy}`
    )) as {
      id: string
      alias?: string | null
      botId?: string | null
      name?: string
      description?: string
      config?: Record<string, unknown> | null
    }

    const current = policy.config ?? {}

    // @note resend alias / botId / type so a partial update can't null the bot
    // link or flip the policy type; only the threshold inside config changes.
    await userClient.policy.update(policy.id, {
      alias: policy.alias ?? factoryAliases(factory).policy,
      botId: policy.botId ?? undefined,
      type: 'usage',
      name: policy.name,
      description: policy.description,
      config: {
        metric: 'tokens',
        windowInSeconds: DAY_IN_SECONDS,
        actions: { block: { durationInSeconds: DAY_IN_SECONDS } },
        ...current,
        threshold: dailyTokenBudget,
      },
    })

    return { ok: true }
  }
)

/**
 * Updates the factory bot's language model.
 *
 * @action
 */
export const setBotModel = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    factory: factorySchema,
    model: z
      .string()
      .min(1)
      .max(512)
      .transform((v) => v.trim()),
  }),
  async (_config, session, { factory, model }): Promise<{ ok: true }> => {
    const userClient = await getSessionClient(session)

    const { botId } = await resolveContext(userClient, factory)

    await userClient.bot.update(botId, { model })

    return { ok: true }
  }
)

/**
 * Saves the GitHub App credentials onto the factory's integration and mirrors
 * the key onto its jwt secret. Empty fields are left unchanged.
 *
 * @action
 */
export const saveGithubApp = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    factory: factorySchema,
    appId: z
      .string()
      .max(64)
      .optional()
      .transform((v) => v?.trim() || undefined),
    privateKey: z
      .string()
      .max(1024 * 16)
      .optional()
      .transform((v) => v?.trim() || undefined),
    webhookSecret: z
      .string()
      .max(1024)
      .optional()
      .transform((v) => v?.trim() || undefined),
  }),
  async (
    _config,
    session,
    { factory, appId, privateKey, webhookSecret }
  ): Promise<GithubStatus> => {
    const userClient = await getSessionClient(session)

    const current = (await userClient.clientFetch(
      githubEndpoint(factory, 'fetch')
    )) as Record<string, unknown>

    // The GitHub abilities reference this integration directly (by id), so the
    // App credentials live only here - no mirrored secret to keep in sync.
    await userClient.clientFetch(githubEndpoint(factory, 'update'), {
      record: {
        alias: current.alias,
        name: current.name,
        description: (current.description as string) ?? '',
        botId: current.botId,
        contactCollection: (current.contactCollection as boolean) ?? false,
        sessionDuration: (current.sessionDuration as number | null) ?? null,
        appId: appId ?? (current.appId as string) ?? '',
        privateKey: privateKey ?? (current.privateKey as string) ?? '',
        webhookSecret: webhookSecret ?? (current.webhookSecret as string) ?? '',
      },
    })

    return getGithubStatus(userClient, factory)
  }
)

/**
 * Validates the factory's GitHub App credentials via the `/setup` probe.
 *
 * @action
 */
export const testGithubApp = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ factory: factorySchema }),
  async (_config, session, { factory }): Promise<{ installations: number }> => {
    const userClient = await getSessionClient(session)

    const result = (await userClient.clientFetch(
      githubEndpoint(factory, 'setup'),
      { record: {} }
    )) as { installations?: number }

    return { installations: result.installations ?? 0 }
  }
)

/* ---------------------------------- tasks --------------------------------- */

export interface TaskSummary {
  id: string
  name: string
  description: string
  schedule: string | null
  timezone: string | null
  status: string
  outcome: string
  nextRunAt: number | null
  lastRunAt: number | null
}

function toTaskSummary(task: Record<string, unknown>): TaskSummary {
  return {
    id: task.id as string,
    name: (task.name as string) ?? '',
    description: (task.description as string) ?? '',
    schedule: (task.schedule as string | null) ?? null,
    timezone: (task.timezone as string | null) ?? null,
    status: (task.status as string) ?? 'idle',
    outcome: (task.outcome as string) ?? 'pending',
    nextRunAt: (task.nextRunAt as number | null) ?? null,
    lastRunAt: (task.lastRunAt as number | null) ?? null,
  }
}

interface FactoryContext {
  blueprintId: string
  botId: string
}

/**
 * Resolves the factory's bot id. Fast path: the bot's `@alias`. Fallback: the
 * single bot that belongs to the factory's blueprint - so the factory keeps
 * working even if the bot was provisioned without its alias.
 */
async function resolveBotId(
  userClient: UserClient,
  factory: string,
  blueprintId: string
): Promise<string> {
  try {
    const bot = await userClient.bot.fetch(`@${factoryAliases(factory).bot}`)

    return bot.id
  } catch {
    const { items } = await userClient.bot.list({ take: 100, order: 'desc' })

    const match = (items as Array<Record<string, unknown>>).find(
      (b) => b.blueprintId === blueprintId
    )

    if (!match) {
      throw new Error('Factory bot not found')
    }

    return match.id as string
  }
}

async function resolveContext(
  userClient: UserClient,
  factory: string
): Promise<FactoryContext> {
  const blueprint = await userClient.blueprint.fetch(
    `@${factoryAliases(factory).blueprint}`
  )

  const botId = await resolveBotId(userClient, factory, blueprint.id)

  return { blueprintId: blueprint.id, botId }
}

async function listBlueprintTasks(
  userClient: UserClient,
  blueprintId: string
): Promise<TaskSummary[]> {
  // @note the list endpoint has no field filter (only cursor/order/take/meta),
  // so we fetch a page and scope to this factory's blueprint client-side.
  const { items } = await userClient.task.list({ take: 100, order: 'desc' })

  return (items as Array<Record<string, unknown>>)
    .filter((task) => task.blueprintId === blueprintId)
    .map(toTaskSummary)
}

interface Instance {
  name: string
  githubConfigured: boolean
  tasks: TaskSummary[]
}

/**
 * The factory's Tasks dashboard payload: name, GitHub status, and tasks.
 *
 * @action
 */
export const getInstance = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ factory: factorySchema }),
  async (_config, session, { factory }): Promise<Instance> => {
    const userClient = await getSessionClient(session)

    const alias = factoryAliases(factory)

    const blueprint = await userClient.blueprint.fetch(`@${alias.blueprint}`)

    let tasks: TaskSummary[] = []

    try {
      tasks = await listBlueprintTasks(userClient, blueprint.id)
    } catch {
      tasks = []
    }

    const { configured } = await getGithubStatus(userClient, factory)

    return {
      name: blueprint.name || 'Untitled factory',
      githubConfigured: configured,
      tasks,
    }
  }
)

/**
 * Re-lists the factory's tasks.
 *
 * @action
 */
export const listTasks = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ factory: factorySchema }),
  async (_config, session, { factory }): Promise<{ tasks: TaskSummary[] }> => {
    const userClient = await getSessionClient(session)

    const { blueprintId } = await resolveContext(userClient, factory)

    return { tasks: await listBlueprintTasks(userClient, blueprintId) }
  }
)

/**
 * Creates a task against the factory's bot and blueprint.
 *
 * @action
 */
export const createTask = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    factory: factorySchema,
    name: z
      .string()
      .min(1)
      .max(200)
      .transform((v) => v.trim()),
    description: z
      .string()
      .max(8192)
      .transform((v) => v.trim()),
    schedule: z
      .string()
      .max(200)
      .optional()
      .transform((v) => {
        const t = v?.trim()

        return t && t.length > 0 ? t : undefined
      }),
    timezone: z.string().max(100).optional(),
    runNow: z.boolean().optional(),
  }),
  async (
    _config,
    session,
    { factory, name, description, schedule, timezone, runNow }
  ): Promise<{ task: TaskSummary }> => {
    const userClient = await getSessionClient(session)

    const { blueprintId, botId } = await resolveContext(userClient, factory)

    const created = await userClient.task.create({
      blueprintId,
      botId,
      name,
      description,
      schedule,
      timezone,
    })

    if (runNow) {
      try {
        await userClient.task.trigger(created.id)
      } catch {
        // best-effort - the task is created either way and can be run manually.
      }
    }

    const task = await userClient.task.fetch(created.id)

    return { task: toTaskSummary(task as unknown as Record<string, unknown>) }
  }
)

/**
 * Updates a task's editable fields (name, description, schedule, timezone).
 *
 * @action
 */
export const updateTask = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    taskId: z.string(),
    name: z
      .string()
      .min(1)
      .max(200)
      .transform((v) => v.trim()),
    description: z
      .string()
      .max(8192)
      .transform((v) => v.trim()),
    schedule: z
      .string()
      .max(200)
      .optional()
      .transform((v) => {
        const t = v?.trim()

        return t && t.length > 0 ? t : undefined
      }),
    timezone: z.string().max(100).optional(),
  }),
  async (
    _config,
    session,
    { taskId, name, description, schedule, timezone }
  ): Promise<{ task: TaskSummary }> => {
    const userClient = await getSessionClient(session)

    await userClient.task.update(taskId, {
      name,
      description,
      schedule,
      timezone,
    })

    const task = await userClient.task.fetch(taskId)

    return { task: toTaskSummary(task as unknown as Record<string, unknown>) }
  }
)

/**
 * Runs a task now, independent of its schedule.
 *
 * @action
 */
export const triggerTask = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ taskId: z.string() }),
  async (_config, session, { taskId }): Promise<{ ok: true }> => {
    const userClient = await getSessionClient(session)

    await userClient.task.trigger(taskId)

    return { ok: true }
  }
)

/**
 * Cancels a task's currently running execution.
 *
 * @action
 */
export const cancelTask = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ taskId: z.string() }),
  async (_config, session, { taskId }): Promise<{ ok: true }> => {
    const userClient = await getSessionClient(session)

    await userClient.task.cancel(taskId)

    return { ok: true }
  }
)

/**
 * Deletes a task entirely.
 *
 * @action
 */
export const deleteTask = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ taskId: z.string() }),
  async (_config, session, { taskId }): Promise<{ ok: true }> => {
    const userClient = await getSessionClient(session)

    await userClient.task.delete(taskId)

    return { ok: true }
  }
)

export interface ExecutionSummary {
  id: string
  status: string
  outcome: string
  summary: string | null
  conversationId: string | null
  createdAt: number | null
}

/**
 * Lists the recent executions (runs) of a task.
 *
 * @action
 */
export const listExecutions = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ taskId: z.string() }),
  async (
    _config,
    session,
    { taskId }
  ): Promise<{ executions: ExecutionSummary[] }> => {
    const userClient = await getSessionClient(session)

    const { items } = await userClient.task.execution.list(taskId)

    const executions = (items as Array<Record<string, unknown>>).map((e) => ({
      id: e.id as string,
      status: (e.status as string) ?? 'idle',
      outcome: (e.outcome as string) ?? 'pending',
      summary: (e.summary as string | null) ?? null,
      conversationId: (e.conversationId as string | null) ?? null,
      createdAt: (e.createdAt as number | null) ?? null,
    }))

    return { executions }
  }
)

/* -------------------------------- playbooks ------------------------------- */

export type StorageItem = {
  path: string
  size: number
  updatedAt: number
  isDirectory: boolean
}

function spaceRef(factory: string): string {
  return `@${factoryAliases(factory).workspace}`
}

/**
 * Lists the factory's workspace playbook files (recursively).
 *
 * @action
 */
export const listFiles = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ factory: factorySchema }),
  async (_config, session, { factory }): Promise<{ items: StorageItem[] }> => {
    const userClient = await getSessionClient(session)

    const data = await userClient.space.storage.list(
      spaceRef(factory),
      undefined,
      { recursive: true }
    )

    return { items: data.items as StorageItem[] }
  }
)

/**
 * Reads a text file from the factory's workspace.
 *
 * @action
 */
export const readFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ factory: factorySchema, path: PathSchema }),
  async (_config, session, { factory, path }): Promise<{ content: string }> => {
    const userClient = await getSessionClient(session)

    const { url } = await userClient.space.storage.download(
      spaceRef(factory),
      path
    )

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('Failed to read file')
    }

    return { content: await response.text() }
  }
)

/**
 * Writes a text file into the factory's workspace (creating or overwriting).
 *
 * @action
 */
export const writeFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    factory: factorySchema,
    path: PathSchema,
    content: z.string().max(1024 * 1024),
  }),
  async (
    _config,
    session,
    { factory, path, content }
  ): Promise<{ ok: true }> => {
    const userClient = await getSessionClient(session)

    const body = new TextEncoder().encode(content)

    const { uploadRequest } = await userClient.space.storage.upload(
      spaceRef(factory),
      path,
      { file: { type: 'text/markdown', size: body.byteLength } }
    )

    if (uploadRequest) {
      const { method, url, headers } = uploadRequest

      const response = await fetch(url, {
        method,
        headers: headers ?? {},
        body,
      })

      if (!response.ok) {
        throw new Error('Failed to write file')
      }
    }

    return { ok: true }
  }
)

/**
 * Deletes a file from the factory's workspace.
 *
 * @action
 */
export const deleteFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({ factory: factorySchema, path: PathSchema }),
  async (_config, session, { factory, path }): Promise<{ ok: true }> => {
    const userClient = await getSessionClient(session)

    await userClient.space.storage.delete(spaceRef(factory), path, {
      recursive: false,
    })

    return { ok: true }
  }
)

/**
 * Moves (renames) a file within the factory's workspace.
 *
 * @action
 */
export const moveFile = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    factory: factorySchema,
    path: PathSchema,
    destinationPath: PathSchema,
  }),
  async (
    _config,
    session,
    { factory, path, destinationPath }
  ): Promise<{ ok: true }> => {
    const userClient = await getSessionClient(session)

    await userClient.space.storage.move(spaceRef(factory), path, {
      destinationPath,
    })

    return { ok: true }
  }
)

// @note pure, isomorphic normalizers shared by the server facade (SSR initial
// data) and the client (token-driven direct SDK calls). No server-only imports
// here so the client can use them directly.

export const EXECUTION_TAKE = 10

export type AutomationKind = 'task'

export type AutomationExecution = {
  id: string
  status?: string | null
  outcome?: string | null
  summary?: string | null
  conversationId?: string | null
  completedAt?: number | null
  createdAt?: number | null
  updatedAt?: number | null
}

export type AutomationItem = {
  kind: AutomationKind
  id: string
  name: string
  description?: string | null
  status?: string | null
  outcome?: string | null
  botId?: string | null
  contactId?: string | null
  schedule?: string | null
  lastRunAt?: number | null
  nextRunAt?: number | null
  createdAt?: number | null
  updatedAt?: number | null
  execution?: AutomationExecution | null
}

export function toTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (value instanceof Date) {
    return value.getTime()
  }

  if (typeof value === 'string' && value) {
    const parsed = new Date(value).getTime()

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function compareByUpdatedAtDesc(
  a: AutomationItem,
  b: AutomationItem
): number {
  return (
    (b.updatedAt || 0) - (a.updatedAt || 0) ||
    (b.createdAt || 0) - (a.createdAt || 0) ||
    a.id.localeCompare(b.id)
  )
}

export function normalizeExecution(
  execution: Record<string, unknown> | null
): AutomationExecution | null {
  if (!execution || typeof execution.id !== 'string') {
    return null
  }

  return {
    id: execution.id,
    status: toNullableString(execution.status),
    outcome: toNullableString(execution.outcome),
    summary: toNullableString(execution.summary),
    conversationId: toNullableString(execution.conversationId),
    completedAt: toTimestamp(execution.completedAt),
    createdAt: toTimestamp(execution.createdAt),
    updatedAt: toTimestamp(execution.updatedAt),
  }
}

export function normalizeTask(task: Record<string, unknown>): AutomationItem {
  return {
    kind: 'task',
    id: String(task.id || ''),
    name: (typeof task.name === 'string' && task.name) || String(task.id || ''),
    description: toNullableString(task.description),
    status: toNullableString(task.status),
    outcome: toNullableString(task.outcome),
    botId: toNullableString(task.botId),
    contactId: toNullableString(task.contactId),
    schedule: toNullableString(task.schedule),
    lastRunAt: toTimestamp(task.lastRunAt),
    nextRunAt: toTimestamp(task.nextRunAt),
    createdAt: toTimestamp(task.createdAt),
    updatedAt: toTimestamp(task.updatedAt),
    execution: null,
  }
}

/**
 * Pick the most relevant execution (the running one, else the latest) from a
 * task's execution list and normalize it.
 */
export function pickLatestExecution(
  executions: Array<Record<string, unknown>>
): AutomationExecution | null {
  const execution =
    executions.find((item) => item.status === 'running') || executions[0]

  return normalizeExecution(execution || null)
}

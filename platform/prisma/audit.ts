/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Prisma as PrismaNamespace } from '@chatbotkit-dev/db/client'

import { getContextRequestIpAddress } from '@/lib/context.store'
import { defer } from '@/lib/defer'
import type { AuditRelations } from '@/lib/log'
import { getSafeSessionStore } from '@/lib/session.context'

import { Prisma } from '@prisma/client/extension'

// --- Configuration ---

/**
 * Models whose writes should produce audit log entries. Any model not listed
 * here is ignored by the extension. Edit this const to opt models in.
 *
 * Each entry is keyed by Prisma operation (`create`, `update`, `upsert`,
 * `delete`) - the presence of an operation key opts it in. Each operation
 * may configure `name`, `description`, and `relations` (see
 * `OperationAuditConfig`).
 */
export const AUDITED_MODELS = {
  // DiscordIntegration: {
  //   delete: {
  //     name: 'Discord Integration Deleted',
  //     description: (r) =>
  //       `Discord integration with ID ${r?.id} was deleted`,
  //   },
  // },
  // Bot: {
  //   create: { name: 'Bot Created' },
  //   update: { name: 'Bot Updated' },
  //   delete: { name: 'Bot Deleted' },
  // },

  // resources

  Blueprint: {
    create: {
      name: 'Blueprint Created',
      description: (r) => `Blueprint with ID ${r?.id} was created`,
    },

    delete: {
      name: 'Blueprint Deleted',
      description: (r) => `Blueprint with ID ${r?.id} was deleted`,
    },
  },

  Bot: {
    create: {
      name: 'Bot Created',
      description: (r) => `Bot with ID ${r?.id} was created`,
    },

    delete: {
      name: 'Bot Deleted',
      description: (r) => `Bot with ID ${r?.id} was deleted`,
    },
  },

  Dataset: {
    create: {
      name: 'Dataset Created',
      description: (r) => `Dataset with ID ${r?.id} was created`,
    },

    delete: {
      name: 'Dataset Deleted',
      description: (r) => `Dataset with ID ${r?.id} was deleted`,
    },
  },

  Skillset: {
    create: {
      name: 'Skillset Created',
      description: (r) => `Skillset with ID ${r?.id} was created`,
    },

    delete: {
      name: 'Skillset Deleted',
      description: (r) => `Skillset with ID ${r?.id} was deleted`,
    },
  },

  Ability: {
    create: {
      name: 'Ability Created',
      description: (r) => `Ability with ID ${r?.id} was created`,
    },

    delete: {
      name: 'Ability Deleted',
      description: (r) => `Ability with ID ${r?.id} was deleted`,
    },
  },

  File: {
    create: {
      name: 'File Created',
      description: (r) => `File with ID ${r?.id} was created`,
    },

    delete: {
      name: 'File Deleted',
      description: (r) => `File with ID ${r?.id} was deleted`,
    },
  },

  Secret: {
    create: {
      name: 'Secret Created',
      description: (r) => `Secret with ID ${r?.id} was created`,
    },

    delete: {
      name: 'Secret Deleted',
      description: (r) => `Secret with ID ${r?.id} was deleted`,
    },
  },

  Space: {
    create: {
      name: 'Space Created',
      description: (r) => `Space with ID ${r?.id} was created`,
    },

    delete: {
      name: 'Space Deleted',
      description: (r) => `Space with ID ${r?.id} was deleted`,
    },
  },

  Portal: {
    create: {
      name: 'Portal Created',
      description: (r) => `Portal with ID ${r?.id} was created`,
    },

    delete: {
      name: 'Portal Deleted',
      description: (r) => `Portal with ID ${r?.id} was deleted`,
    },
  },

  // developer

  Token: {
    create: {
      name: 'Token Created',
      description: (r) => `Token with ID ${r?.id} was created`,
    },

    update: {
      name: 'Token Updated',
      description: (r) => `Token with ID ${r?.id} was updated`,
    },

    delete: {
      name: 'Token Deleted',
      description: (r) => `Token with ID ${r?.id} was deleted`,
    },
  },

  Webhook: {
    create: {
      name: 'Webhook Created',
      description: (r) => `Webhook with ID ${r?.id} was created`,
    },

    update: {
      name: 'Webhook Updated',
      description: (r) => `Webhook with ID ${r?.id} was updated`,
    },

    delete: {
      name: 'Webhook Deleted',
      description: (r) => `Webhook with ID ${r?.id} was deleted`,
    },
  },

  // @note must not create audit logs for the AuditLog models itself
} as const satisfies AuditModelMap

// --- Types ---

export type AuditableModelName = PrismaNamespace.ModelName

type AuditableAction = 'CREATE' | 'UPDATE' | 'DELETE'

/**
 * Single-record Prisma operations we can safely audit. `deleteMany` and
 * `updateMany` are deliberately excluded for now - they return `{ count }`
 * rather than the affected rows, so we cannot derive `oldValues`/`newValues`
 * or fall back to `result.userId`. Revisit if we need bulk auditing (would
 * require a pre-fetch to enumerate the affected rows).
 */
type AuditableOperation = 'create' | 'update' | 'upsert' | 'delete'

/**
 * Per-operation audit config. The `name` and `description` may be either a
 * literal string or a function of the Prisma result (the affected row).
 */
export interface OperationAuditConfig {
  name?: string | ((result: any) => string)
  description?: string | ((result: any) => string)
  fields?: readonly string[]
  relations?: (result: any) => Record<string, string>
}

/**
 * Per-model audit config. The presence of an operation key opts that
 * operation in; an omitted key is not audited. This keeps the naming and
 * description tightly bound to the specific operation they describe.
 */
export type ModelAuditConfig = {
  fields?: readonly string[]
} & {
  [K in AuditableOperation]?: OperationAuditConfig
}

export type AuditModelMap = {
  readonly [K in AuditableModelName]?: ModelAuditConfig
}

// --- Constants ---

const OPERATION_TO_ACTION: Record<AuditableOperation, AuditableAction> = {
  create: 'CREATE',
  update: 'UPDATE',
  upsert: 'UPDATE',
  delete: 'DELETE',
}

const DEFAULT_AUDIT_FIELDS = ['name', 'description', 'meta'] as const

// --- Helpers ---

function defaultName(model: string, action: AuditableAction): string {
  const suffix =
    action === 'DELETE'
      ? 'Deleted'
      : action === 'CREATE'
        ? 'Created'
        : 'Updated'

  return `${model} ${suffix}`
}

function resolve<T>(
  value: T | ((result: any) => T) | undefined,
  result: any
): T | undefined {
  return typeof value === 'function'
    ? (value as (result: any) => T)(result)
    : value
}

function resolveUserId(result: any): string | undefined {
  const sessionUserId = getSafeSessionStore()?.user?.id

  if (sessionUserId) {
    return sessionUserId
  }

  if (
    result &&
    typeof result === 'object' &&
    typeof result.userId === 'string'
  ) {
    return result.userId
  }

  return undefined
}

function pickAuditValues(
  result: Record<string, unknown>,
  fields: readonly string[]
): Record<string, unknown> {
  const values: Record<string, unknown> = {}

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(result, field)) {
      values[field] = result[field]
    }
  }

  return values
}

// --- Extension ---

/**
 * Builds the `$allOperations` handler for the audit extension. Exposed
 * separately so unit tests can exercise it directly without spinning up a
 * full PrismaClient.
 */
export function createAuditHandler(models: AuditModelMap) {
  const modelConfigs = new Map<string, ModelAuditConfig>(
    Object.entries(models) as [string, ModelAuditConfig][]
  )

  return async function handleAuditedOperation({
    model,
    operation,
    args,
    query,
  }: {
    model: string
    operation: string
    args: unknown
    query: (args: unknown) => Promise<unknown>
  }): Promise<unknown> {
    const modelConfig = modelConfigs.get(model)

    if (!modelConfig) {
      return query(args)
    }

    const opConfig = modelConfig[operation as AuditableOperation] ?? undefined

    if (!opConfig) {
      return query(args)
    }

    // @note never audit writes to the audit log itself to avoid recursion

    if (model === 'AuditLog') {
      return query(args)
    }

    const result = (await query(args)) as Record<string, unknown>

    const action = OPERATION_TO_ACTION[operation as AuditableOperation]

    const userId = resolveUserId(result)

    // @note without a user id we cannot persist an audit row; skip silently
    // rather than crash non-HTTP callers (scripts, workers)

    if (!userId) {
      return result
    }

    const name = resolve(opConfig.name, result) ?? defaultName(model, action)

    const description = resolve(opConfig.description, result)

    const relations = (opConfig.relations?.(result) ?? {}) as AuditRelations

    const auditFields = [
      ...DEFAULT_AUDIT_FIELDS,
      ...(modelConfig.fields ?? []),
      ...(opConfig.fields ?? []),
    ]

    const auditValues = pickAuditValues(result, auditFields)

    const oldValues =
      action === 'DELETE' || action === 'UPDATE' ? auditValues : undefined

    const newValues =
      action === 'CREATE' || action === 'UPDATE' ? auditValues : undefined

    // @note capture context-derived fields (like the request IP) *before*
    // handing control to defer. When the deferred callback runs it may be
    // after the response has been flushed and the context ALS may no longer
    // be populated, so we snapshot the values synchronously here.

    const ipAddress = getContextRequestIpAddress()

    // @note queue the audit write via defer so it runs after the response is
    // sent when inside a runInDeferred() context (see lib/defer.ts). Outside
    // that context defer awaits inline, preserving behaviour for scripts and
    // tests. defer itself catches errors via captureError, so an audit
    // failure never bubbles back into the underlying write.

    await defer(async () => {
      const logAuditNow = (await import('@/lib/log')).logAuditNow

      await logAuditNow({
        user: { id: userId },
        name,
        description,
        action,
        oldValues,
        newValues,
        relations,
        meta: {
          ipAddress,
        },
      })
    })

    return result
  }
}

/**
 * Creates a Prisma extension that emits audit log entries for the models
 * listed in `AUDITED_MODELS`. Any model not listed there is ignored.
 */
export function withAudit() {
  const handler = createAuditHandler(AUDITED_MODELS)

  return Prisma.defineExtension({
    name: 'prisma-audit',

    query: {
      $allModels: {
        $allOperations: handler,
      },
    },
  })
}

export default withAudit

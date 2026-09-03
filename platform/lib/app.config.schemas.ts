import { toJsonSchema } from '@/lib/zod.jsonschema'

import ConfigSchema3e882a70 from '@/app/apps/(adhoc)/3e882a70/config'
import ConfigSchema5c0a7a11 from '@/app/apps/(adhoc)/5c0a7a11/config'
import ConfigSchema6c4a7b9e from '@/app/apps/(adhoc)/6c4a7b9e/config'
import ConfigSchema7cb29ccc from '@/app/apps/(adhoc)/7cb29ccc/config'
import ConfigSchema7f1fb51c from '@/app/apps/(adhoc)/7f1fb51c/config'
import ConfigSchema8df57107 from '@/app/apps/(adhoc)/8df57107/config'
import ConfigSchema8ea0112f from '@/app/apps/(adhoc)/8ea0112f/config'
import ConfigSchema9f3b5e2a from '@/app/apps/(adhoc)/9f3b5e2a/config'
import ConfigSchema30fc6ef2 from '@/app/apps/(adhoc)/30fc6ef2/config'
import ConfigSchema41f203dc from '@/app/apps/(adhoc)/41f203dc/config'
import ConfigSchema81fdc94a from '@/app/apps/(adhoc)/81fdc94a/config'
import ConfigSchema90dff690 from '@/app/apps/(adhoc)/90dff690/config'
import ConfigSchema95ca8b4c from '@/app/apps/(adhoc)/95ca8b4c/config'
import ConfigSchema8734d1ad from '@/app/apps/(adhoc)/8734d1ad/config'
import ConfigSchemaB4d0c8f2 from '@/app/apps/(adhoc)/b4d0c8f2/config'
import ConfigSchemaB7f4c2de from '@/app/apps/(adhoc)/b7f4c2de/config'
import ConfigSchemaC0de9a7f from '@/app/apps/(adhoc)/c0de9a7f/config'
import ConfigSchemaD6d4b7eb from '@/app/apps/(adhoc)/d6d4b7eb/config'
import ConfigSchemaE083ca0f from '@/app/apps/(adhoc)/e083ca0f/config'
import ConfigSchemaF49c75da from '@/app/apps/(adhoc)/f49c75da/config'
import AuditlogConfigSchema from '@/app/apps/auditlog/config'
import ChatConfigSchema from '@/app/apps/chat/config'
import ConnectConfigSchema from '@/app/apps/connect/config'
import EventlogConfigSchema from '@/app/apps/eventlog/config'
import InboxConfigSchema from '@/app/apps/inbox/config'
import StaticConfigSchema from '@/app/apps/static/config'
import TaskConfigSchema from '@/app/apps/task/config'
import TraceConfigSchema from '@/app/apps/trace/config'
import UsageConfigSchema from '@/app/apps/usage/config'
import UsagelogConfigSchema from '@/app/apps/usagelog/config'

import type { ZodSchema } from 'zod'

// @note this registry is intentionally static to ensure next build can include all schemas
// @note this map cannot strictly satisfy config/apps known runtime app list because manifests are environment-driven

export const APP_CONFIG_SCHEMA_BY_SLUG = {
  chat: ChatConfigSchema,
  connect: ConnectConfigSchema,
  eventlog: EventlogConfigSchema,
  auditlog: AuditlogConfigSchema,
  inbox: InboxConfigSchema,
  task: TaskConfigSchema,
  trace: TraceConfigSchema,
  usage: UsageConfigSchema,
  usagelog: UsagelogConfigSchema,
  static: StaticConfigSchema,

  '30fc6ef2': ConfigSchema30fc6ef2,
  '41f203dc': ConfigSchema41f203dc,
  '3e882a70': ConfigSchema3e882a70,
  '5c0a7a11': ConfigSchema5c0a7a11,
  '6c4a7b9e': ConfigSchema6c4a7b9e,
  '7cb29ccc': ConfigSchema7cb29ccc,
  '7f1fb51c': ConfigSchema7f1fb51c,
  '81fdc94a': ConfigSchema81fdc94a,
  '8df57107': ConfigSchema8df57107,
  '8ea0112f': ConfigSchema8ea0112f,
  '90dff690': ConfigSchema90dff690,
  '95ca8b4c': ConfigSchema95ca8b4c,
  '9f3b5e2a': ConfigSchema9f3b5e2a,
  '8734d1ad': ConfigSchema8734d1ad,
  b4d0c8f2: ConfigSchemaB4d0c8f2,
  b7f4c2de: ConfigSchemaB7f4c2de,
  c0de9a7f: ConfigSchemaC0de9a7f,
  d6d4b7eb: ConfigSchemaD6d4b7eb,
  e083ca0f: ConfigSchemaE083ca0f,
  f49c75da: ConfigSchemaF49c75da,
} satisfies Record<string, ZodSchema> // @todo actual names

// @note hide advanced config options that this portal ui does not support
// yet. these can still be edited from the raw Advanced portal config tab.
const APP_CONFIG_EXCLUDED_FIELDS_BY_SLUG = {
  chat: ['bots'],
  task: ['bots'],
}

function normalizeSchemaForContextInput(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema
  }

  const next = {
    ...schema,
  }

  if (!next.type && Array.isArray(next.anyOf) && next.anyOf.length > 0) {
    Object.assign(next, next.anyOf[0])
  }

  if (next.type === 'object' && next.properties) {
    next.properties = Object.fromEntries(
      Object.entries(next.properties).map(([key, value]) => {
        return [key, normalizeSchemaForContextInput(value)]
      })
    )
  }

  if (next.type === 'array') {
    if (Array.isArray(next.items)) {
      next.items = next.items.map((item) =>
        normalizeSchemaForContextInput(item)
      )
    } else if (next.items && typeof next.items === 'object') {
      if (Array.isArray(next.items.anyOf)) {
        next.items = next.items.anyOf.map((item) =>
          normalizeSchemaForContextInput(item)
        )
      } else if (Array.isArray(next.items.oneOf)) {
        next.items = next.items.oneOf.map((item) =>
          normalizeSchemaForContextInput(item)
        )
      } else {
        next.items = [normalizeSchemaForContextInput(next.items)]
      }
    }
  }

  return next
}

export const APP_CONFIG_JSON_SCHEMA_BY_SLUG = Object.fromEntries(
  Object.entries(APP_CONFIG_SCHEMA_BY_SLUG).map(([slug, schema]) => {
    const excludeFields = APP_CONFIG_EXCLUDED_FIELDS_BY_SLUG[slug] || []

    return [
      slug,
      normalizeSchemaForContextInput(toJsonSchema(schema, { excludeFields })),
    ]
  })
)

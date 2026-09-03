'use server'

import fs from 'fs/promises'
import path from 'path'

import { appActionHandler } from '@/lib/app.action'
import { toTitleCase } from '@/lib/string'
import { z } from '@/lib/zod.schema'

import ConfigSchema from './config'
import { APP_NAME } from './const'

const SPEC_PATH = path.join(process.cwd(), 'public', 'api', 'v1', 'spec.json')

type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue }

type JsonObject = { [key: string]: JsonValue }

type SpecNavigationItem = {
  title: string
  slug: string
  href: string
  method: string
  path: string
  operationId: string
  summary?: string
}

type SpecNavigationGroup = {
  key: string
  title: string
  items: SpecNavigationItem[]
}

let specCache: JsonObject | null = null

const METHOD_SORT_ORDER = {
  get: 0,
  post: 1,
  put: 2,
  patch: 3,
  delete: 4,
  head: 5,
  options: 6,
} as const

// @note explicit ordering for the API reference groups (keyed by the first
// non-parameter path segment, e.g. /conversation/... -> 'conversation').
// Conversation leads, then the remaining objects, then resources (bots etc.),
// then integrations and the rest. Keys not listed fall to the end, sorted
// alphabetically. Mirrors API_PATH_GROUP_ORDER in cbkai-docs Layout.jsx.
const GROUP_SORT_ORDER = [
  // objects
  'conversation',
  'contact',
  'memory',
  'task',
  'event',
  // resources
  'bot',
  'dataset',
  'file',
  'skillset',
  'secret',
  'blueprint',
  'portal',
  'policy',
  // spaces & collaboration
  'space',
  'team',
  // channels
  'channel',
  // integrations
  'integration',
  'openai',
  // platform & account
  'platform',
  'partner',
  'usage',
  // misc / protocol
  'magic',
  'graphql',
]

function compareGroupKeys(a: string, b: string) {
  const indexA = GROUP_SORT_ORDER.indexOf(a)
  const indexB = GROUP_SORT_ORDER.indexOf(b)

  if (indexA === -1 && indexB === -1) {
    return a.localeCompare(b)
  }

  if (indexA === -1) {
    return 1
  }

  if (indexB === -1) {
    return -1
  }

  return indexA - indexB
}

function humanizeOperationId(value = '') {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

function humanizePathSegment(value = '') {
  return toTitleCase(value.replace(/[-_]+/g, ' '))
}

async function getRawSpec(): Promise<JsonObject> {
  if (specCache) {
    return specCache
  }

  const specContent = await fs.readFile(SPEC_PATH, 'utf-8')

  specCache = JSON.parse(specContent) as JsonObject

  return specCache
}

function getByPointer(root: JsonObject, ref: string) {
  if (!ref.startsWith('#/')) {
    return null
  }

  return ref
    .slice(2)
    .split('/')
    .reduce<JsonValue>((value, part) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null
      }

      const key = part.replace(/~1/g, '/').replace(/~0/g, '~')

      return (value as JsonObject)[key] ?? null
    }, root)
}

function dereferenceNode(
  node: JsonValue,
  root: JsonObject,
  stack = new Set<string>()
): JsonValue {
  if (Array.isArray(node)) {
    return node.map((item) => dereferenceNode(item, root, stack))
  }

  if (!node || typeof node !== 'object') {
    return node
  }

  if ('$ref' in node && typeof node.$ref === 'string') {
    const ref = node.$ref

    if (stack.has(ref)) {
      return null
    }

    const resolved = getByPointer(root, ref)

    if (!resolved) {
      return null
    }

    const nextStack = new Set(stack)

    nextStack.add(ref)

    const siblingEntries = Object.fromEntries(
      Object.entries(node).filter(([key]) => key !== '$ref')
    )

    const merged =
      resolved && typeof resolved === 'object' && !Array.isArray(resolved)
        ? {
            ...(dereferenceNode(resolved, root, nextStack) as JsonObject),
            ...siblingEntries,
          }
        : siblingEntries

    return dereferenceNode(merged, root, nextStack)
  }

  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => {
      return [key, dereferenceNode(value, root, stack)]
    })
  )
}

async function computeSpecNavigationGroups(): Promise<SpecNavigationGroup[]> {
  const spec = await getRawSpec()
  const pathEntries = Object.entries((spec.paths as JsonObject) || {})

  const grouped = new Map<string, SpecNavigationItem[]>()

  for (const [apiPath, methods] of pathEntries) {
    for (const [method, operation] of Object.entries(
      (methods as JsonObject) || {}
    )) {
      if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        continue
      }

      const operationId = String((operation as JsonObject).operationId || '')

      if (!operationId) {
        continue
      }

      const slug = operationId.toLowerCase()
      const groupKey =
        apiPath
          .split('/')
          .filter(Boolean)
          .find((segment) => !(segment.startsWith('{') && segment.endsWith('}'))) ||
        'general'

      const item = {
        title: humanizeOperationId(operationId),
        slug,
        href: `/apps/b4d0c8f2?operation=${slug}`,
        method,
        path: apiPath,
        operationId,
        summary: (operation as JsonObject).summary as string | undefined,
      }

      grouped.set(groupKey, [...(grouped.get(groupKey) || []), item])
    }
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => compareGroupKeys(a, b))
    .map(([key, items]) => ({
      key,
      title: humanizePathSegment(key),
      items: items.sort((a, b) => {
        const methodOrderA =
          METHOD_SORT_ORDER[a.method as keyof typeof METHOD_SORT_ORDER] ??
          Number.MAX_SAFE_INTEGER
        const methodOrderB =
          METHOD_SORT_ORDER[b.method as keyof typeof METHOD_SORT_ORDER] ??
          Number.MAX_SAFE_INTEGER

        if (methodOrderA !== methodOrderB) {
          return methodOrderA - methodOrderB
        }

        if (a.path.length !== b.path.length) {
          return a.path.length - b.path.length
        }

        return a.path.localeCompare(b.path) || a.title.localeCompare(b.title)
      }),
    }))
}

async function computeSpecOperationBySlug(slug: string) {
  const spec = await getRawSpec()
  const pathEntries = Object.entries((spec.paths as JsonObject) || {})

  for (const [apiPath, methods] of pathEntries) {
    const sharedParameters = ((methods as JsonObject)?.parameters ||
      []) as JsonValue[]

    for (const [method, operation] of Object.entries(
      (methods as JsonObject) || {}
    )) {
      if (method === 'parameters') {
        continue
      }

      if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        continue
      }

      const operationId = String((operation as JsonObject).operationId || '')

      if (operationId.toLowerCase() !== slug.toLowerCase()) {
        continue
      }

      const operationObject = operation as JsonObject

      return dereferenceNode(
        {
          ...operationObject,
          path: apiPath,
          method,
          parameters: [
            ...sharedParameters,
            ...(((operationObject.parameters || []) as JsonValue[]) || []),
          ],
          security:
            operationObject.security || (spec.security as JsonValue[]) || [],
        },
        spec
      ) as JsonObject
    }
  }

  return null
}

/**
 * @action
 */
export const listSpecOperations = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({}).optional(),
  async () => {
    return {
      groups: await computeSpecNavigationGroups(),
      updatedAt: Date.now(),
    }
  }
)

/**
 * @action
 */
export const fetchSpecOperation = appActionHandler(
  APP_NAME,
  ConfigSchema,
  z.object({
    slug: z.string(),
  }),
  async (_config, _session, { slug }) => {
    return computeSpecOperationBySlug(slug)
  }
)

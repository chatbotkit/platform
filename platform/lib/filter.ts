import { getQuery, queryParam } from '@/lib/query.get'

export interface MetaQueryFilter {
  meta: {
    path: string
    equals: string | number | boolean
  }
}

export interface BlueprintIdQueryFilter {
  blueprintId: string
}

export interface CursorConstraints {
  cursor?: {
    id: string
  }

  skip?: number

  orderBy: Array<
    | {
        createdAt: 'asc' | 'desc'
      }
    | {
        id: 'asc' | 'desc'
      }
  >
}

export interface TakeConstraints {
  take: number
}

/**
 * Flattens an object to a dictionary with MySQL-style JSON paths.
 * Arrays use bracket notation (e.g., $.items[0]) per Prisma MySQL JSON path syntax.
 */
function flattenWithJsonPath(
  obj: Record<string, unknown>,
  prefix = '$.'
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix + key

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const arrayPath = `${currentPath}[${i}]`
        const item = value[i]

        if (typeof item === 'object' && item !== null) {
          Object.assign(
            result,
            flattenWithJsonPath(
              item as Record<string, unknown>,
              arrayPath + '.'
            )
          )
        } else {
          result[arrayPath] = item
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(
        result,
        flattenWithJsonPath(value as Record<string, unknown>, currentPath + '.')
      )
    } else {
      result[currentPath] = value
    }
  }

  return result
}

/**
 * Builds a meta query filter from the provided metadata object with support
 * for nested paths and equality checks.
 */
export function buildMetaQueryFilter(
  meta: Record<string, unknown>
): MetaQueryFilter[] {
  const filter: MetaQueryFilter[] = []

  const entries = Object.entries(flattenWithJsonPath(meta))

  for (const [path, value] of entries) {
    if (
      value === undefined ||
      value === null ||
      (typeof value !== 'string' &&
        typeof value !== 'number' &&
        typeof value !== 'boolean')
    ) {
      continue
    }

    filter.push({
      meta: {
        path: path,
        equals: value,
      },
    })
  }

  return filter
}

/**
 * Builds a meta query filter from the provided metadata object with support
 * for nested paths and equality checks.
 */
export function getMetaQueryFilter(req: Request): MetaQueryFilter[] {
  const meta: MetaQueryFilter[] = []

  for (const [key, value] of getQuery(req)) {
    const array: string[] = []

    if (Array.isArray(value)) {
      array.push(...value)
    } else {
      if (value) {
        array.push(value)
      }
    }

    for (const item of array) {
      // handle meta.*=value format for metadata filtering

      if (key.startsWith('meta.') && item) {
        meta.push({
          meta: {
            path: `$.${key.slice(5)}`,
            equals: { true: true, false: false }[item as string] ?? item,
          },
        })

        continue
      }

      // handle meta[key]=value format for metadata filtering

      if (key.startsWith('meta[') && key.endsWith(']') && item) {
        const path = key.slice(5, -1)

        meta.push({
          meta: {
            path: `$.${path}`,
            equals: { true: true, false: false }[item as string] ?? item,
          },
        })
      }
    }
  }

  return meta
}

/**
 * Builds a blueprint ID query filter from the provided request.
 */
export function getBlueprintIdQueryFilter(
  req: Request
): BlueprintIdQueryFilter[] {
  const blueprintId = queryParam(req, 'blueprintId')

  if (blueprintId) {
    return [
      {
        blueprintId,
      },
    ]
  }

  return []
}

/**
 * Builds a field query filter from the provided request and fields. Fields
 * ending in `Id` support comma-separated values through Prisma's `in` filter.
 * Prisma model validation prevents spelling mistakes and ensures only valid
 * model fields are used for filtering.
 *
 * @param req - The request object containing query parameters
 * @param fields - Array of field names to filter by
 * @returns Array of field filters for Prisma queries
 *
 * @example
 * // Basic usage (backward compatible)
 * getFieldQueryFilter(req, ['botId', 'contactId'])
 *
 * @example
 * // With Prisma model validation to prevent typos
 * import { Conversation } from '@/prisma/types'
 * getFieldQueryFilter(req, ['botId', 'contactId'], null as Conversation | null)
 */
export function getFieldQueryFilter<T = unknown>(
  req: Request,
  fields: (keyof T | [keyof T, string])[]
): Record<string, string | { in: string[] }>[] {
  const filters: Record<string, string | { in: string[] }>[] = []

  // If model template is provided, validate that all fields exist in the model type
  // This happens at compile-time with TypeScript, providing spelling mistake prevention

  for (const field of fields) {
    let dbKey: string
    let queryKey: string

    if (Array.isArray(field)) {
      dbKey = field[0] as string
      queryKey = field[1] as string
    } else {
      dbKey = field as string
      queryKey = field as string
    }

    const value = queryParam(req, queryKey)

    if (value) {
      const values = dbKey.endsWith('Id')
        ? value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [value]

      if (values.length === 0) {
        continue
      }

      filters.push({
        [dbKey]: values.length > 1 ? { in: values } : values[0],
      })
    }
  }

  return filters
}

/**
 * Builds a value query filter for ratings filtering (upvote/downvote) and
 * numeric comparisons.
 *
 * Supports multiple filter formats:
 * - 'upvote': value >= 0
 * - 'downvote': value < 0
 * - '>100': value > 100 (greater than)
 * - '<100': value < 100 (less than)
 * - '>=100': value >= 100 (greater than or equal)
 * - '<=100': value <= 100 (less than or equal)
 * - '100': value = 100 (exact match)
 */
export function buildValueQueryFilter(
  value: string | null | undefined
): Array<
  | { value: { gte: number } }
  | { value: { lte: number } }
  | { value: { gt: number } }
  | { value: { lt: number } }
  | { value: { equals: number } }
> {
  if (!value) {
    return []
  }

  // handle upvote/downvote filters

  if (value === 'upvote') {
    return [{ value: { gte: 0 } }]
  } else if (value === 'downvote') {
    return [{ value: { lt: 0 } }]
  }

  // handle numeric comparison filters
  // @note regex patterns match comparison operators followed by numeric values including negatives

  if (value.match(/^>=-?\d+$/)) {
    const num = parseInt(value.slice(2))

    if (!isNaN(num)) {
      return [{ value: { gte: num } }]
    }
  } else if (value.match(/^<=-?\d+$/)) {
    const num = parseInt(value.slice(2))

    if (!isNaN(num)) {
      return [{ value: { lte: num } }]
    }
  } else if (value.match(/^>-?\d+$/)) {
    const num = parseInt(value.slice(1))

    if (!isNaN(num)) {
      return [{ value: { gt: num } }]
    }
  } else if (value.match(/^<-?\d+$/)) {
    const num = parseInt(value.slice(1))

    if (!isNaN(num)) {
      return [{ value: { lt: num } }]
    }
  } else if (value.match(/^-?\d+$/)) {
    // handle exact numeric match

    const num = parseInt(value)

    if (!isNaN(num)) {
      return [{ value: { equals: num } }]
    }
  }

  return []
}

/**
 * Builds a value query filter from the value parameter on a request.
 */
export function getValueQueryFilter(
  req: Request
): ReturnType<typeof buildValueQueryFilter> {
  return buildValueQueryFilter(queryParam(req, 'value'))
}

/**
 * Builds a cursor constraints object from the provided request.
 */
export function getCursorConstraints(
  req: Request,
  cursor?: string,
  defaultOrder: 'desc' | 'asc' = 'desc'
): CursorConstraints {
  const order = queryParam(req, 'order') || defaultOrder

  const resolvedOrder =
    { desc: 'desc' as const, asc: 'asc' as const }[order] || defaultOrder

  cursor = cursor?.trim()

  const orderBy = [
    {
      createdAt: resolvedOrder,
    },
    { id: resolvedOrder },
  ]

  return !!cursor
    ? {
        cursor: {
          id: cursor,
        },

        skip: 1,

        orderBy,
      }
    : {
        orderBy,
      }
}

/**
 * Builds a take constraints object from the provided request.
 */
export function getTakeConstraints(
  req: Request,
  defaultTake: number = 100
): TakeConstraints {
  let take: number | undefined = parseInt(queryParam(req, 'take') || '')

  // @note treat NaN and 0 as invalid - use default instead

  if (isNaN(take) || take === 0) {
    take = undefined
  }

  return {
    take: Math.min(Math.max(1, take ?? defaultTake), 100), // @note the max is 100 and this is because we don't want to run out of memory
  }
}

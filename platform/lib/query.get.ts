import type { NextApiRequest } from 'next'

import { assert, error } from '@/lib/debug'
import { throwBadRequest } from '@/lib/response'

type AnyRequest = Request | NextApiRequest

export function getQuery(req: AnyRequest): Map<string, string | undefined> {
  const query = new Map<string, string | undefined>()

  let searchParams: URLSearchParams

  if ('query' in req) {
    searchParams = new URLSearchParams(
      new URL(req.url || '/', 'https://localhost').searchParams
    )

    // @note we append additional query parameters to the url so this must be
    // safe - at least in principle

    for (const [name, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v !== undefined && v !== null) {
            searchParams.append(name, v.toString())
          }
        }
      } else {
        if (value !== undefined && value !== null) {
          searchParams.set(name, value.toString())
        }
      }
    }
  } else {
    searchParams = new URL(req.url, 'http://localhost').searchParams
  }

  for (const [key, value] of searchParams) {
    // @note the first one has a priority over the second one

    if (query.has(key)) {
      continue
    }

    query.set(key, value)
  }

  return query
}

export function requiredUrlParam(req: AnyRequest, key: string): string {
  const query = getQuery(req)

  const anything = query.get(key)

  if (Array.isArray(anything)) {
    error(`requiredUrlParam: ${key} is an array`, { anything })

    throwBadRequest()
  }

  const string = anything?.trim()

  if (!string) {
    error(`requiredUrlParam: ${key} is not truthy`, { string })

    throwBadRequest()
  }

  assert(string, 'string must be truthy')

  return string
}

export function queryParam(req: AnyRequest, key: string): string | undefined {
  const query = getQuery(req)

  const anything = query.get(key)

  if (Array.isArray(anything)) {
    throwBadRequest()
  }

  const string = anything?.trim()

  return string
}

export function catchAllParam(req: AnyRequest, key: string): string[] {
  if ('query' in req) {
    const value = (req as NextApiRequest).query[key]

    if (Array.isArray(value)) {
      return value.filter((v): v is string => v != null)
    }

    if (typeof value === 'string' && value) {
      return [value]
    }

    return []
  }

  return new URL(req.url, 'http://localhost').searchParams.getAll(key)
}

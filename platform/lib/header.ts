import type { NextApiRequest } from 'next'

import { TIMEZONE_HEADER_NAME } from '@/config/headers'

import { getRandomId } from '@/lib/string'

// @todo scan the code and redirect all of these to be imported from config/headers

export { TIMEZONE_HEADER_NAME } from '@/config/headers'

export type AnyRequest = NextApiRequest | Request | Response | Headers

export function toHeaders(
  headers: Record<string, string | string[] | undefined>
): Headers {
  const result = new Headers()

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        try {
          result.append(key, item)
        } catch {
          // @note we silently ignore invalid headers
        }
      }
    } else {
      try {
        result.append(key, value)
      } catch {
        // @note we silently ignore invalid headers
      }
    }
  }

  return result
}

export function toHeadersHashMap(
  headers: Headers | Record<string, string | string[]>
): Record<string, string> {
  const thisHeaders: Headers =
    headers instanceof Headers ? headers : toHeaders(headers)

  const result: Record<string, string> = {}

  // @note Headers always combines duplicate keys into single value separated
  // by comma, therefore the resulting object is always a simple map

  for (const [key, value] of thisHeaders.entries()) {
    if (key in result) {
      continue
    }

    result[key] = value
  }

  return result
}

export function cleanupEmptyHeaders(
  headers: Headers | Record<string, string | string[]>
): Headers {
  const thisHeaders: Headers =
    headers instanceof Headers ? headers : toHeaders(headers)

  // @note create new Headers to avoid modifying the original

  const result = new Headers()

  for (const [key, value] of thisHeaders.entries()) {
    if (value) {
      result.set(key, value)
    }
  }

  return result
}

export function getHeader(
  req: AnyRequest,
  name: string,
  ...altNames: string[]
): string | null {
  let result: string | null = null

  let headers: Headers

  {
    if (req instanceof Headers) {
      headers = req
    } else if (req.headers) {
      if (req.headers instanceof Headers) {
        headers = req.headers
      } else {
        try {
          headers = new Headers(
            // @ts-ignore
            req.headers
          )
        } catch {
          return null
        }
      }
    } else {
      return null
    }
  }

  result = headers.get(name) || null

  if (result === null && altNames.length > 0) {
    result = getHeader(req, altNames[0], ...altNames.slice(1))
  }

  return result
}

export function setHeader(req: AnyRequest, name: string, value: string): void {
  if (req instanceof Headers) {
    req.set(name, value)
  } else if (req.headers) {
    if (typeof req.headers.set === 'function') {
      req.headers.set(name, value)
    } else {
      req.headers[name] = value
    }
  }
}

export function getAcceptHeader(req: AnyRequest, defaultValue: string): string

export function getAcceptHeader(
  req: AnyRequest,
  defaultValue?: undefined
): string | null

export function getAcceptHeader(
  req: AnyRequest,
  defaultValue?: string
): string | null {
  let accept: string | null = getHeader(req, 'accept') || ''

  accept = accept.split(',')[0].split(';')[0].trim().toLowerCase()

  if (!accept || accept === '*/*') {
    accept = defaultValue ?? null
  }

  return accept
}

export function getContentTypeHeader(
  req: AnyRequest,
  defaultValue: string
): string

export function getContentTypeHeader(
  req: AnyRequest,
  defaultValue: true
): string

export function getContentTypeHeader(
  req: AnyRequest,
  defaultValue?: undefined
): string | null

export function getContentTypeHeader(
  req: AnyRequest,
  defaultValue?: string | true
): string | null {
  let contentType: string | null = getHeader(req, 'content-type') || ''

  contentType = contentType.split(';')[0].trim().toLowerCase()

  if (!contentType || contentType === '*/*') {
    if (defaultValue === true) {
      contentType = 'application/octet-stream'
    } else {
      contentType = defaultValue ?? null
    }
  }

  return contentType
}

export function getContentDispositionHeader(
  req: AnyRequest,
  defaultValue: string
): string

export function getContentDispositionHeader(
  req: AnyRequest,
  defaultValue: true
): string

export function getContentDispositionHeader(
  req: AnyRequest,
  defaultValue?: undefined
): string | null

export function getContentDispositionHeader(
  req: AnyRequest,
  defaultValue?: string | true
): string | null {
  let contentDisposition: string | null =
    getHeader(req, 'content-disposition') || ''

  if (!contentDisposition || contentDisposition === 'inline') {
    if (defaultValue === true) {
      contentDisposition = `attachment; filename="${getRandomId('file-')}.bin"`
    } else {
      contentDisposition = defaultValue ?? null
    }
  }

  return contentDisposition
}

export function getContentDispositionAttachmentFilename(
  req: AnyRequest,
  defaultValue: string
): string

export function getContentDispositionAttachmentFilename(
  req: AnyRequest,
  defaultValue: true
): string

export function getContentDispositionAttachmentFilename(
  req: AnyRequest,
  defaultValue?: undefined
): string | null

export function getContentDispositionAttachmentFilename(
  req: AnyRequest,
  defaultValue?: string | true
): string | null {
  let filename: string | null = null

  const contentDisposition: string | null = getContentDispositionHeader(req)

  if (!contentDisposition) {
    if (defaultValue === true) {
      filename = `${getRandomId('file-')}.bin`
    } else {
      filename = defaultValue ?? null
    }

    return filename
  }

  // @note RFC 6266: handle quoted and unquoted filenames, and filename* with UTF-8 encoding
  const match = contentDisposition.match(
    /filename\*?=(?:UTF-8'')?(?:"([^"]*)"|([^;]+))/i
  )

  if (match && (match[1] || match[2])) {
    try {
      // @note use quoted group if present, otherwise unquoted

      const filenameRaw = match[1] ?? match[2]

      // @note decode URI encoding and trim, but preserve exact filename otherwise

      filename = decodeURIComponent(filenameRaw.trim())

      // @note treat empty strings as no filename

      if (!filename) {
        filename = null
      }
    } catch (e) {
      if (e instanceof URIError) {
        if (defaultValue === true) {
          filename = `${getRandomId('file-')}.bin`
        } else {
          filename = defaultValue ?? null
        }

        return filename
      }

      throw e
    }
  }

  if (!filename) {
    if (defaultValue === true) {
      filename = `${getRandomId('file-')}.bin`
    } else {
      filename = defaultValue ?? null
    }
  }

  return filename
}

/**
 *
 */
export function getTimezoneHeader(req: AnyRequest): string | null {
  return getHeader(req, TIMEZONE_HEADER_NAME)
}

/**
 *
 */
export function getUserAgentHeader(req: AnyRequest): string | null {
  return getHeader(req, 'user-agent')
}

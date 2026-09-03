import { buf2str, str2buf } from '@chatbotkit-dev/buffer'
import { ONE_MINUTE_IN_SECONDS, getShortDateTime } from '@chatbotkit-dev/time'

import { siteUrl } from '@/config/site'

import type {
  ActionInput,
  ActionOptions,
  ActionReturn,
} from '@/lib/action.exec.all'
import { isText } from '@/lib/binary'
import { getContextContact, getContextTimezone } from '@/lib/context.store'
import debug from '@/lib/debug'
import { chunkFile, isSupportedContentType } from '@/lib/dsd2'
import call from '@/lib/egress.call'
import { isDevelopment } from '@/lib/env'
import { captureObservation } from '@/lib/error'
import {
  HEADER_CONTENT_ORIGINAL_TYPE,
  HEADER_CONTENT_TRUNCATED,
  withLimit,
  withRetry,
} from '@/lib/fetch'
import type { AnyRequest } from '@/lib/header'
import {
  cleanupEmptyHeaders,
  getContentTypeHeader,
  toHeaders,
  toHeadersHashMap,
} from '@/lib/header'
import {
  getExternalAPIHostURL,
  getExternalHostURL,
  getLocalAPIHostURL,
} from '@/lib/host'
import {
  normalizeRequest as normalizeHttpRequest,
  parseRequest as parseHttpRequest,
} from '@/lib/http'
import type {
  NormalizedRequest,
  Request,
  UnnormalizedRequest,
} from '@/lib/http'
import json, { tryParse as tryParseJson } from '@/lib/json'
import { repair } from '@/lib/json.repair'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { omit, rename } from '@/lib/object'
import { redactEntropyFields } from '@/lib/redact.entropy'
import { swapSecrets } from '@/lib/secret.value'
import { getTemporaryUserToken } from '@/lib/session.temp'
import { DEFAULT_RERANK_TOP_N, applyRerank, transform } from '@/lib/transform'
import { recordFetchUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'
import yaml, { isParsable, tryParse as tryParseYaml } from '@/lib/yaml'
import { z } from '@/lib/zod.schema'

import { fileTypeFromBuffer } from 'file-type'

// Re-export for backward compatibility
export { DEFAULT_RERANK_TOP_N }

export const FETCH_TIMEOUT_MIN = 10000 // 10 seconds
export const FETCH_TIMEOUT_MAX = 300000 // 5 minutes

export const FETCH_RESPONSE_SIZE = 0.5 * 1024 * 1024 // 0.5 MB

// @todo aligns types with schema

/**
 * request schema
 */
export const requestSchema = z.object({
  method: z
    .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
    .optional(),
  url: z.string(), // @note we don't specify `.url()` to ensure we can pass relative URLs
  path: z
    .union([
      z.string(),
      z.array(z.union([z.string(), z.number(), z.boolean()])),
    ])
    .optional(),
  query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  headers: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(), // @note deliberately allow other primitives for convenience
  authorization: z.string().optional(),
  body: z.union([z.string(), z.record(z.unknown())]).optional(),
  options: z
    .object({
      text: z.boolean().optional(),

      format: z.string().optional(),

      selectors: z.string().optional(),

      jsonpath: z.string().optional(),
      jmespath: z.string().optional(),

      errorJsonpath: z.string().optional(),
      errorJmespath: z.string().optional(),

      error: z
        .object({
          jsonpath: z.string().optional(),
          jmespath: z.string().optional(),
        })
        .optional(),

      rerank: z.string().optional(),

      transformNestedStrings: z
        .object({
          json: z.union([z.boolean(), z.literal('toon')]).optional(),
          html: z.enum(['text', 'json', 'toon']).optional(),
          xml: z.enum(['text', 'json', 'toon']).optional(),
        })
        .optional(),

      debug: z.boolean().optional(),

      auth: z.enum(['internal']).optional(),

      context: z.array(z.enum(['user', 'conversation', 'contact'])).optional(),

      _internal: z
        .object({
          template: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
})

export type RequestSchema = z.infer<typeof requestSchema>

/**
 * Fetch function with enforced response size limit
 */
// @note `call` from egress.call: the destination is the model's, so every
// connection goes through the egress boundary (lib/egress.core.ts)
const fetch = withRetry(withLimit(call, { maxSize: FETCH_RESPONSE_SIZE }))

/**
 * Transformation definitions for custom data processing
 */
const transformations: Record<string, (sourceValue: unknown) => unknown> = {
  $epochToDateTime: (sourceValue: unknown): unknown => {
    if (typeof sourceValue === 'number') {
      return getShortDateTime(new Date(sourceValue * 1000))
    } else if (typeof sourceValue === 'string') {
      const timestamp = parseFloat(sourceValue)

      if (!isNaN(timestamp)) {
        return getShortDateTime(new Date(timestamp * 1000))
      }
    }

    return sourceValue // Keep original if not a valid timestamp
  },
}

/**
 * Cleans up an object by removing keys with undefined, null, or empty values,
 * and renaming keys that end with '?' by removing the '?' suffix.
 */
function normalizeObject(
  obj: Record<string, unknown>
): Record<string, unknown> {
  return rename(
    omit(
      obj,
      [
        (k: string, v: unknown) => {
          if (k.endsWith('?')) {
            if (v === undefined || v === null) {
              return true
            } else if (Array.isArray(v) && v.length === 0) {
              return true
            } else if (
              typeof v === 'object' &&
              v !== null &&
              Object.keys(v).length === 0
            ) {
              return true
            }
          }

          return false
        },
      ],
      Infinity
    ),
    /\?$/,
    (k: string) => k.slice(0, -1)
  ) as Record<string, unknown>
}

/**
 * Inserts the query parameters into the searchParams object.
 */
export function insertSearchParams(
  query: unknown,
  searchParams: URLSearchParams
): void {
  // parse the query as an array
  {
    if (Array.isArray(query)) {
      for (const item of query) {
        if (!item) {
          continue
        }

        if (typeof item === 'object' && item !== null) {
          const obj = normalizeObject(
            item as Record<string, unknown>
          ) as Record<string, string>

          for (const [key, value] of Object.entries(obj)) {
            searchParams.append(key, value)
          }
        } else {
          searchParams.append(item as string, '')
        }
      }

      return
    }
  }

  // parse the query as an object
  {
    if (typeof query === 'object' && query !== null) {
      const obj = normalizeObject(query as Record<string, unknown>) as Record<
        string,
        string
      >

      for (const [key, value] of Object.entries(obj)) {
        searchParams.append(key, value)
      }

      return
    }
  }
}

/**
 * Extended request type that includes options from YAML parsing
 */
export interface ParsedRequest extends Request {
  url?: string
  authorization?: string
  options?: {
    text?: boolean
    format?: string
    selectors?: string
    jsonpath?: string
    jmespath?: string
    errorJsonpath?: string
    errorJmespath?: string
    error?: {
      jsonpath?: string
      jmespath?: string
    }
    rerank?: string
    transformNestedStrings?: {
      json?: boolean | 'toon'
      html?: 'text' | 'json' | 'toon'
      xml?: 'text' | 'json' | 'toon'
    }
    debug?: boolean
    auth?: 'internal'
    context?: ('user' | 'conversation' | 'contact')[]
    _internal?: {
      template?: boolean
    }
  }
}

function shouldObserveTemplateFailure(request: ParsedRequest): boolean {
  return request.options?._internal?.template === true
}

function shouldIgnoreTemplateObservationStatus(status: number): boolean {
  return status === 401 || status === 403
}

/**
 * Similar to parseHttpRequest but also detects if yaml or json is used to
 * represent the request structure. By default all URLs are based on the
 * external API host.
 *
 * @throws {Error} When parsing fails unexpectedly
 */
export function parseRequest(input: string, delim?: string): ParsedRequest {
  // @todo the whole file requires refactoring

  {
    // edge-case quoted json string

    const maybeJson = tryParseJson(input)

    if (typeof maybeJson === 'string') {
      input = maybeJson
    }
  }

  // try to parse url
  {
    if (/^\s*https?:\/\//i.test(input)) {
      debug(`parsing request as URL`, { input })

      const request: ParsedRequest = {
        method: 'GET',
        url: input.trim(),
        uri: input.trim(),
        version: 'HTTP/1.1',
        headers: {},
      }

      return request
    }
  }

  // try to parse yaml
  {
    const request = yaml.tryParse(input) as ParsedRequest | null

    if (typeof request === 'object' && request !== null) {
      debug(`parsing request as YAML`, { input })

      const url = new URL(request.uri || request.url!, getLocalAPIHostURL())

      if ('path' in request && (request as { path?: unknown }).path !== null) {
        const path = (request as { path?: unknown }).path

        if (Array.isArray(path)) {
          url.pathname += path.join('') // @note we don't do any special handling for slashes to allow for extra flexibility

          url.pathname = url.pathname.replace(/\/+/g, '/')
        } else if (typeof path === 'string') {
          url.pathname += path

          url.pathname = url.pathname.replace(/\/+/g, '/')
        }
      }

      if (
        'query' in request &&
        (request as { query?: unknown }).query != null
      ) {
        insertSearchParams(
          (request as { query?: unknown }).query,
          url.searchParams
        )
      }

      request.uri = url.toString()
      request.url = url.toString()

      return request
    }
  }

  // parse http request normally
  {
    debug(`parsing request as HTTP`, { input, delim })

    const request = parseHttpRequest(input, delim) as ParsedRequest

    return request
  }

  throw new Error('Unexpected state')
}

/**
 * Normalizes the request object. If the body is an object it will be converted
 * to a string based on the content-type header. If the body is a string it will
 * be repaired if it is JSON.
 */
export function normalizeRequest(req: ParsedRequest): NormalizedRequest {
  const { authorization, headers, ...rest } = req

  // @note fold the top-level `authorization` field into the Authorization
  // header; empty values are dropped later by normalizeHeaders

  const normReq = normalizeHttpRequest({
    ...rest,
    headers: authorization
      ? { ...headers, Authorization: authorization }
      : headers,
  } as UnnormalizedRequest)

  if (typeof normReq.body === 'object' && normReq.body !== null) {
    // @note using toHeaders helper to safely handle invalid header names

    const headersObj = toHeaders(normReq.headers)

    let contentType = getContentTypeHeader(headersObj as AnyRequest)

    if (!contentType) {
      normReq.headers['content-type'] = 'application/json'

      contentType = 'application/json'
    }

    const body = normalizeObject(
      normReq.body as Record<string, unknown>
    ) as Record<string, unknown>

    switch (contentType) {
      case 'application/json': {
        normReq.body = json.stringify(body)

        break
      }

      case 'application/yaml': {
        normReq.body = yaml.stringify(body)

        break
      }

      case 'application/x-www-form-urlencoded': {
        normReq.body = new URLSearchParams(
          body as Record<string, string>
        ).toString()

        break
      }
    }
  }

  if (typeof normReq.body === 'string') {
    // @note using toHeaders helper to safely handle invalid header names

    const headersObj = toHeaders(normReq.headers)

    const contentType = getContentTypeHeader(headersObj as AnyRequest)

    switch (contentType) {
      case 'application/json': {
        // @note the reason we try is because repair can throw an error and at
        // this point we don't want to throw an error

        try {
          normReq.body = repair(normReq.body)
        } catch {
          // pass
        }

        break
      }
    }
  }

  return normReq
}

/**
 * Reranks the result based on the query using the BGE V2/V3 model.
 * @deprecated Use applyRerank from transform.ts instead
 */
export async function rerankResult(
  query: string,
  result: unknown,
  userId: string,
  _params: Record<string, unknown>
): Promise<unknown> {
  const rerankResult = await applyRerank(result, query, {
    user: { id: userId },
  })

  return rerankResult.data
}

/**
 * Recursively replace exact placeholder matches in any data structure
 */
function replaceExactPlaceholders(
  value: unknown,
  replacements: Record<string, unknown>
): unknown {
  if (typeof value === 'string') {
    if (replacements[value] !== undefined) {
      return replacements[value]
    }

    let result = value

    for (const [placeholder, replacement] of Object.entries(replacements)) {
      if (replacement !== undefined && result.includes(placeholder)) {
        result = result.replaceAll(placeholder, replacement as string)
      }
    }

    return result
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceExactPlaceholders(item, replacements))
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(value)) {
      const newKey = replaceExactPlaceholders(key, replacements) as string

      result[newKey] = replaceExactPlaceholders(val, replacements)
    }

    return result
  }

  return value
}

interface SwapPlaceholdersOptions {
  linkedResources?: {
    botId?: string
    fileId?: string
    spaceId?: string
  }
}

/**
 * Swap placeholder values in the request object with actual values from linkedResources
 */
function swapPlaceholders(
  obj: unknown,
  options: SwapPlaceholdersOptions
): unknown {
  const placeholderMap: Record<string, string | undefined> = {
    '${BOT_DEFAULT}': options.linkedResources?.botId,
    '${FILE_DEFAULT}': options.linkedResources?.fileId,
    '${SPACE_DEFAULT}': options.linkedResources?.spaceId,
  }

  return replaceExactPlaceholders(obj, placeholderMap)
}

/**
 * Action params type
 */
export interface ActionParams {
  timeout?: string
  auth?: string
  context?: string
  text?: boolean
  format?: string
  selectors?: string
  jsonpath?: string
  jmespath?: string
  errorJsonpath?: string
  errorJmespath?: string
  rerank?: string
  debug?: boolean
  [key: string]: unknown
}

/**
 * Executes a fetch action. This action is used to make HTTP requests to other
 * services and APIs. It supports secrets and other types of authentication.
 */
export async function executeFetchAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  const user = await fastGetUserById(options.userId)

  if (!user) {
    throw new Error(`User not found`)
  }

  if (!(await accountLimitsOk(user, ['fetch']))) {
    const error = 'You have reached your fetch limit.'

    return {
      error: error,
    }
  }

  debug(`using`, { input, params, options }).log(
    'action.exec.fetch.executeFetchAction'
  )

  // @todo run through the zod schema declared above

  const request = parseRequest(input, '\n')

  debug(`using request`, { request }).log(
    'action.exec.fetch.executeFetchAction'
  )

  const { method, uri, headers, body } = normalizeRequest(
    swapPlaceholders(request, options) as ParsedRequest
  )

  // @note url may be reassigned for development environment
  let url = uri

  // @note record and transform auxiliary API URLs to shortened format in order
  // to obfuscate the actual location of the API endpoints

  let formattedUrl = url

  if (url.includes('/api/auxiliary/skillset/ability/')) {
    debug(`recording auxiliary URL`, { originalUrl: url }).log(
      'action.exec.fetch.executeFetchAction'
    )

    // transform URL from full format to shortened auxiliary format
    // FROM: /api/auxiliary/skillset/ability/notion/search
    // TO: auxiliary:notion/search

    const auxiliaryPath = url.split('/api/auxiliary/skillset/ability/')[1]

    if (auxiliaryPath) {
      const newUrl = `auxiliary:${auxiliaryPath}`

      debug(`transformed auxiliary URL`, { url, newUrl }).log(
        'action.exec.fetch.executeFetchAction'
      )

      formattedUrl = newUrl
    }
  }

  debug(`using normalized request`, { method, url, headers, body }).log(
    'action.exec.fetch.executeFetchAction'
  )

  const timeout = Math.min(
    FETCH_TIMEOUT_MAX,

    Math.max(
      FETCH_TIMEOUT_MIN,

      parseInt(params.timeout as string) || FETCH_TIMEOUT_MIN
    )
  )

  const auth = params.auth || request.options?.auth

  if (auth === 'internal') {
    // @note the platform only injects its own credentials toward itself: the
    // deployment's site and API origins, derived from configuration rather
    // than spelled as hosts. Anything else keeps auth out of the request.
    let selfOrigin = false

    try {
      const target = new URL(url)

      selfOrigin = [
        new URL(siteUrl).origin,
        new URL(getExternalHostURL()).origin,
        new URL(getExternalAPIHostURL('/')).origin,
      ].includes(target.origin)
    } catch {
      // not a parsable url - never self
    }

    if (selfOrigin || (isDevelopment && url.startsWith(getLocalAPIHostURL()))) {
      if (isDevelopment) {
        try {
          const u = new URL(url)

          url = getLocalAPIHostURL(u.pathname + u.search)
        } catch {
          // pass
        }
      }

      ;(headers as Record<string, string>).authorization =
        `Bearer ${await getTemporaryUserToken(options.userId, {
          durationInSeconds: ONE_MINUTE_IN_SECONDS,
        })}`
    }
  }

  const requestHeaders = toHeadersHashMap(
    cleanupEmptyHeaders(
      await swapSecrets(headers, {
        userId: options.userId,
        abilityId: options.contextResources?.abilityId,
        secretId: options.linkedResources?.secretId,

        inlineSecrets: options.inlineSecrets,

        // @todo maybe remove secret placeholders we could not replace
        // discardSecretPlaceholders: true,
      })
    )
  )

  const contextParam = params.context || request.options?.context

  if (contextParam) {
    // @note params.context is a string (from action tag), options.context is an
    // array of enums

    const types = (
      typeof contextParam === 'string'
        ? contextParam
            .split(/[,;\s]+/g)
            .map((type) => type.trim().toLowerCase())
        : contextParam.map((type) => type.trim().toLowerCase())
    ).filter((type) => !!type)

    if (types.includes('user')) {
      requestHeaders['x-chatbotkit-user-id'] = options.userId
    }

    if (types.includes('conversation')) {
      const conversation = getContextContact()

      if (conversation) {
        requestHeaders['x-chatbotkit-conversation-id'] = conversation.id
      }
    }

    if (types.includes('contact')) {
      const contact = getContextContact()

      if (contact) {
        requestHeaders['x-chatbotkit-contact-id'] = contact.id

        if (contact.name) {
          requestHeaders['x-chatbotkit-contact-name'] = contact.name
        }

        if (contact.email) {
          requestHeaders['x-chatbotkit-contact-email'] = contact.email
        }

        if (contact.phone) {
          requestHeaders['x-chatbotkit-contact-phone'] = contact.phone
        }

        if (contact.nick) {
          requestHeaders['x-chatbotkit-contact-nick'] = contact.nick
        }
      }
    }
  }

  const timezone = getContextTimezone()

  {
    if (timezone) {
      requestHeaders['x-timezone'] = timezone
    }
  }

  let response: Response | undefined

  try {
    const fetchOptions = {
      method,

      headers: requestHeaders,

      body,

      timeout,

      // @todo per user size limit configurations
    }

    debug(`making fetch request`, { url, options: fetchOptions }).log(
      'development:action.exec.fetch.executeFetchAction'
    )

    response = await fetch(url, fetchOptions)
  } catch (e) {
    const error = e as Error

    if (shouldObserveTemplateFailure(request)) {
      debug(`fetch request failed`, { error: error.message, method, url }).log(
        'action.exec.fetch.executeFetchAction'
      )

      await captureObservation('template fetch execution failed', {
        status: 0,
        error: error.message || error.toString(),
        method,
        url: formattedUrl,
        isTemplate: true,
        userId: options.userId,
        blueprintId: options.contextResources?.blueprintId,
        skillsetId: options.contextResources?.skillsetId,
        abilityId: options.contextResources?.abilityId,
      })
    }

    await logEvent({
      user: { id: options.userId },
      type: 'action.fetch',
      relations: {
        blueprintId: options.contextResources?.blueprintId,
        skillsetId: options.contextResources?.skillsetId,
        abilityId: options.contextResources?.abilityId,
      },
      meta: {
        params,
        request: {
          method: method,
          url: formattedUrl,

          timeout,

          status: 0,

          error: error.message || error.toString(),
        },
      },
    })

    const errorMessage =
      error.message || `Status code: ${response?.status || 0}`

    return {
      error: errorMessage,
    }
  }

  const responseStatus = response.status

  let responseContentType = getContentTypeHeader(
    response as AnyRequest,
    'application/octet-stream'
  )

  let responseBuffer = await response.arrayBuffer()

  if (!isText(responseBuffer)) {
    // @todo if the result is still not binary host the file within the current
    // user session and return it as link

    const text = params.text ?? request.options?.text

    if (text) {
      if (/application\/octet-stream/i.test(responseContentType)) {
        const type = await fileTypeFromBuffer(responseBuffer)

        if (type) {
          responseContentType = type.mime
        }
      }

      switch (true) {
        case /^application\/(json|yaml)$/i.test(responseContentType): {
          if (isParsable(buf2str(responseBuffer))) {
            break
          }
        }

        case isSupportedContentType(responseContentType): {
          const blob = new Blob([responseBuffer], { type: responseContentType })

          const chunkResponse = await chunkFile(blob, {
            userId: options.userId,
            size: Number.MAX_SAFE_INTEGER,
            overlap: 0,
          })

          const content = chunkResponse.items
            .map((c: { text: string }) => c.text)
            .join('\n')

          responseContentType = 'text/plain'
          responseBuffer = str2buf(content).buffer as ArrayBuffer

          break
        }

        default: {
          return {
            error: `Unsupported content type ${responseContentType}`,
          }
        }
      }
    } else {
      return {
        error: 'Response is not text',
      }
    }
  }

  const responseText = buf2str(responseBuffer)

  const contentWasTruncated =
    response.headers.get(HEADER_CONTENT_TRUNCATED) === 'true'
  const contentOriginalType = response.headers.get(HEADER_CONTENT_ORIGINAL_TYPE)

  debug(`response`, {
    responseStatus,
    responseContentType,
    responseText,
    contentWasTruncated,
    contentOriginalType,
  }).log('action.exec.fetch.executeFetchAction')

  const actionReturn: ActionReturn = {
    result: {
      status: responseStatus,
      body: responseText,
    },
  }

  if (!response.ok) {
    actionReturn.error = `Status code: ${responseStatus}`
  }

  await logEvent({
    user: { id: options.userId },
    type: 'action.fetch',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
      request: {
        method: method,
        url: formattedUrl,

        timeout,

        status: response.status,

        error: actionReturn.error || null,
      },
    },
  })

  const format = params.format || request.options?.format
  const selectors = params.selectors || request.options?.selectors
  const jsonpath = params.jsonpath || request.options?.jsonpath
  const jmespath = params.jmespath || request.options?.jmespath

  const errorJsonpath =
    params.errorJsonpath ||
    request.options?.errorJsonpath ||
    request.options?.error?.jsonpath

  const errorJmespath =
    params.errorJmespath ||
    request.options?.errorJmespath ||
    request.options?.error?.jmespath

  const rerank = params.rerank || request.options?.rerank

  const transformNestedStrings =
    params.transformNestedStrings || request.options?.transformNestedStrings

  const isDebug = params.debug || request.options?.debug

  debug(`post-processing options`, {
    format,
    selectors,
    jsonpath,
    jmespath,
    errorJsonpath,
    errorJmespath,
    rerank,
    transformNestedStrings,
    isDebug,
  }).log('action.exec.fetch.executeFetchAction')

  // Transform response using the transform pipeline (unless content was truncated)
  // Apply transformations if:
  // 1. Explicit transformation options are provided
  // 2. Content type indicates structured data (JSON, NDJSON)

  const hasStructuredContentType =
    responseContentType.includes('json') ||
    responseContentType.includes('x-ndjson') ||
    responseContentType.includes('jsonl')

  const hasParsingOptions = !!(format || selectors || transformNestedStrings)

  const hasFilteringOptions = !!(
    jsonpath ||
    jmespath ||
    errorJsonpath ||
    errorJmespath ||
    rerank
  )

  const canTransformTruncatedContent =
    contentWasTruncated && (format === 'text' || format === 'markdown')

  const shouldTransform =
    (!contentWasTruncated || canTransformTruncatedContent) &&
    (hasParsingOptions ||
      hasStructuredContentType ||
      (!actionReturn.error && hasFilteringOptions))

  if (shouldTransform) {
    const transformResult = await transform(responseText, {
      contentType: responseContentType,
      format,
      selectors,
      url,
      jsonpath: actionReturn.error ? undefined : jsonpath,
      jmespath: actionReturn.error ? undefined : jmespath,
      errorJsonpath: actionReturn.error ? undefined : errorJsonpath,
      errorJmespath: actionReturn.error ? undefined : errorJmespath,
      rerank: actionReturn.error ? undefined : rerank,
      user: { id: options.userId },
      transformNestedStrings,
      markers: transformations,
    })

    const shouldPreserveHttpErrorEnvelope =
      !!actionReturn.error &&
      responseStatus >= 400 &&
      !!transformResult.error?.startsWith('Parse failed')

    if (transformResult.error && !actionReturn.error) {
      actionReturn.error = transformResult.error
    }

    if (
      transformResult.data !== undefined &&
      !shouldPreserveHttpErrorEnvelope
    ) {
      actionReturn.result = transformResult.data
    }
  }

  // Handle HTTP errors with JSON bodies - extract meaningful error information
  if (
    actionReturn.error?.startsWith('Status code:') &&
    responseContentType.includes('json')
  ) {
    debug(`json error handling for HTTP errors`).log(
      'action.exec.fetch.executeFetchAction'
    )

    try {
      const { parse: parseJson } = await import('@/lib/json')
      const parsedBody = parseJson(responseText) as Record<string, unknown>

      if (parsedBody && typeof parsedBody === 'object' && parsedBody.error) {
        actionReturn.result = { error: parsedBody.error }
      } else {
        actionReturn.result = parsedBody
      }
    } catch {
      // keep the original raw response if JSON parsing fails
    }
  }

  if (isDebug) {
    let debugResult: {
      request: Record<string, unknown>
      response: Record<string, unknown>
    } = {
      request: {},
      response: {},
    }

    try {
      debugResult.request.method = method
      debugResult.request.url = url
      debugResult.request.headers = requestHeaders // @todo make sure this is not dangerous for us
      debugResult.request.body = body

      debugResult.response.status = responseStatus
      debugResult.response.headers = Object.fromEntries(
        response.headers.entries()
      )
      debugResult.response.body = responseText

      debug(`debug`, debugResult).log(
        'action.exec.fetch.executeFetchAction.debug'
      )

      if (isDevelopment) {
        const body = tryParseYaml(debugResult.response.body as string)

        if (body) {
          debug(`body`, body).log('action.exec.fetch.executeFetchAction.debug')
        }
      }

      debugResult = redactEntropyFields(debugResult)
    } catch {
      // pass
    }

    actionReturn.result = {
      result: actionReturn.result,
      debug: debugResult,
    }
  }

  if (
    shouldObserveTemplateFailure(request) &&
    responseStatus >= 400 &&
    !shouldIgnoreTemplateObservationStatus(responseStatus)
  ) {
    debug(`fetch request failed with non-success status`, {
      status: responseStatus,
      method,
      url,
      responseBody: responseText,
    }).log('action.exec.fetch.executeFetchAction')

    await captureObservation('template fetch execution failed', {
      status: responseStatus,
      error: actionReturn.error,
      method,
      url: formattedUrl,
      isTemplate: true,
      responseBody: responseText,
      userId: options.userId,
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    })
  }

  debug(`using action return`, { actionReturn }).log(
    'action.exec.fetch.executeFetchAction'
  )

  await recordFetchUsage({
    user: { id: options.userId },
    count: 1,
    meta: {
      reason: 'action/fetch',
    },
  })

  return actionReturn
}

/**
 * @doc Skillsets
 * @index 42
 *
 * ## Fetch Action - Retrieving External Data
 *
 * The fetch action allows your chatbot to retrieve data from external URLs and APIs. It supports full HTTP requests with customizable headers, authentication, and response formatting. The action has built-in timeout and retry logic to ensure reliable data retrieval.
 *
 * ### Properties
 *
 * - **timeout**: Controls the maximum timeout in milliseconds (default: 10000 ms / 10 seconds)
 * - **format**: Specifies output format - `text`, `markdown`, `json`, or `toon`. Use `toon` for token-optimized notation that reduces token usage when passing data to LLMs
 * - **jsonpath**: Use JSONPath to extract specific sections of JSON responses
 * - **jmespath**: Use JMESPath to extract specific sections of JSON responses
 *
 * ### NDJSON Support
 *
 * The fetch action automatically parses newline-delimited JSON (NDJSON) responses when the content type is `application/x-ndjson` or `application/jsonl`. Each line is parsed as a separate JSON object and combined into an array. JSONPath, JMESPath, and toon format transformations work seamlessly with NDJSON data.
 *
 * ### Example
 *
 * `````markdown
 * ```fetch
 * url: $[url! ys|the URL to fetch]
 * format: ((format ys|output format: text, markdown, json, or toon))
 * ```
 * `````
 */

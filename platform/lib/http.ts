// @todo refactor some of this code to be better

/**
 * Splits a string by a delimiter, yielding each segment.
 *
 * @param input - The string to split
 * @param delim - The delimiter to split by
 * @yields Each segment of the input string between delimiters
 */
export function* split(input: string, delim: string): Generator<string> {
  let lastIndex = 0

  while (true) {
    const index = input.indexOf(delim, lastIndex)

    if (index < 0) {
      yield input.slice(lastIndex, input.length)

      break
    } else {
      yield input.slice(lastIndex, index)
    }

    lastIndex = index + delim.length
  }
}

/**
 * Parsed HTTP message components.
 */
interface ParsedMessage {
  initialLine: string
  headers: string[]
  body: string
}

/**
 * Parses a raw HTTP message into its components: initial line, headers, and body.
 *
 * @param input - The raw HTTP message string to parse
 * @param delim - The line delimiter (defaults to CRLF)
 * @returns The parsed message with initialLine, headers array, and body
 * @throws Error if the initial line cannot be parsed
 */
export function parseMessage(input: string, delim = '\r\n'): ParsedMessage {
  const it = split(input, delim)

  let offset = 0

  const next = it.next()

  let initialLine: string

  if (next.done === true || next.value === '') {
    throw new Error('cannot parse initial line')
  } else {
    initialLine = next.value
  }

  offset += initialLine.length + delim.length

  initialLine = initialLine.toString()

  const headers: string[] = []

  while (true) {
    const next = it.next()

    if (next.done === true || next.value.length === 0) {
      break
    }

    headers.push(next.value.toString())

    offset += next.value.length + delim.length
  }

  offset += delim.length

  const body = input.slice(offset, input.length)

  return { initialLine, headers, body }
}

/**
 * Parses an array of header strings into a key-value record. Handles duplicate
 * headers by converting values to arrays. Special handling for 'set-cookie'
 * which is always stored as an array.
 *
 * @param headers - Array of raw header strings (e.g., "Content-Type: application/json")
 * @param sep - The separator between header name and value (defaults to ":")
 * @returns A record mapping header names to their values (string or string[] for duplicates)
 */
export function parseHeadersArray(
  headers: string[],
  sep = ':'
): Record<string, string | string[]> {
  const convertedHeaders: Record<string, string | string[]> = {}

  for (let header of Array.from(headers)) {
    // @note convert non-string inputs to strings to handle numbers, null, undefined
    header = String(header)

    const index = header.indexOf(sep)

    let name: string
    let value: string

    if (index > 0) {
      name = header.slice(0, index).toString()
      value = header.slice(index + 1, header.length).toString()
    } else {
      name = header.toString()
      value = ''
    }

    name = name.trim()
    // @note use trim() instead of replace(/^\s+/, '') to remove both leading and trailing whitespace
    value = value.trim()

    if (convertedHeaders[name]) {
      if (!Array.isArray(convertedHeaders[name])) {
        convertedHeaders[name] = [convertedHeaders[name] as string]
      }

      ;(convertedHeaders[name] as string[]).push(value)
    } else {
      if (name.toLowerCase() === 'set-cookie') {
        convertedHeaders[name] = [value]
      } else {
        convertedHeaders[name] = value
      }
    }
  }

  return convertedHeaders
}

/**
 * Represents a valid header value that can be converted to a string.
 */
export type HeaderValue = string | number | boolean | null | undefined

/**
 * Input type for header records with flexible value types.
 */
export type HeadersInput = Record<string, HeaderValue | HeaderValue[]>

/**
 * Builds a formatted header string from a headers record. Array values are
 * expanded into multiple header lines with the same name.
 *
 * @param headers - The headers record to convert
 * @param delim - The line delimiter (defaults to CRLF)
 * @param sep - The separator between header name and value (defaults to ":")
 * @returns A formatted header string with each header on its own line
 */
export function buildHeadersArray(
  headers: HeadersInput,
  delim = '\r\n',
  sep = ':'
): string {
  // @note return empty string for empty headers object instead of adding delimiter
  if (!headers || Object.keys(headers).length === 0) {
    return ''
  }

  const convertedHeaderLines: string[] = []

  for (const name in headers) {
    const value = headers[name]

    if (Array.isArray(value)) {
      for (const item of Array.from(value)) {
        convertedHeaderLines.push(`${name}${sep} ${item || ''}`)
      }
    } else {
      convertedHeaderLines.push(`${name}${sep} ${value || ''}`)
    }
  }

  let convertedHeaders = convertedHeaderLines.join(delim)

  if (convertedHeaders.length > 0) {
    convertedHeaders = convertedHeaders + delim
  }

  return convertedHeaders
}

/**
 * Parses a raw headers string into a key-value record.
 *
 * @param input - The raw headers string to parse
 * @param delim - The line delimiter (defaults to CRLF)
 * @param sep - The separator between header name and value (defaults to ":")
 * @returns A record mapping header names to their values
 */
export function parseHeaders(
  input: string,
  delim = '\r\n',
  sep = ':'
): Record<string, string | string[]> {
  const it = split(input, delim)

  const headers: string[] = []

  while (true) {
    const next = it.next()

    if (next.done === true || next.value.length === 0) {
      break
    }

    headers.push(next.value)
  }

  return parseHeadersArray(headers, sep)
}

/**
 * Builds a formatted header string from a headers record.
 * Alias for buildHeadersArray.
 *
 * @param headers - The headers record to convert
 * @param delim - The line delimiter (defaults to CRLF)
 * @param sep - The separator between header name and value (defaults to ":")
 * @returns A formatted header string
 */
export function buildHeaders(
  headers: HeadersInput,
  delim = '\r\n',
  sep = ':'
): string {
  return buildHeadersArray(headers, delim, sep)
}

/**
 * Represents an HTTP request with method, URI, version, headers, and optional
 * body.
 */
export interface Request {
  method?: string
  uri: string
  version?: string
  headers?: Record<string, string | string[]>
  body?: string
}

/**
 * Alias for Request - represents an unnormalized HTTP request before processing
 * by normalizeRequest.
 */
export type UnnormalizedRequest = Request

/**
 * Parses a raw HTTP request string into a structured Request object. Also
 * handles plain URLs by treating them as GET requests.
 *
 * @param input - The raw HTTP request string or URL to parse
 * @param delim - The line delimiter (defaults to CRLF)
 * @returns The parsed Request object
 */
export function parseRequest(input: string, delim = '\r\n'): Request {
  if (/^https?:\/\//i.test(input)) {
    return {
      method: 'GET',
      uri: input,
      version: 'HTTP/1.0',
      headers: {},
    }
  }

  const parsed = parseMessage(input, delim)

  const [method = '', uri = '', version = ''] = (
    parsed.initialLine.match(/^(.*?)\s(.*?)(HTTP\/[\d.]+)?$/i) || []
  ).slice(1)

  return {
    method: method.trim(),
    uri: uri.trim(),
    version: version.trim(),
    headers: parseHeadersArray(parsed.headers),
    body: parsed.body,
  }
}

/**
 * Builds a raw HTTP request string from a Request object.
 *
 * @param req - The Request object to serialize
 * @param delim - The line delimiter (defaults to CRLF)
 * @returns The formatted HTTP request string
 */
export function buildRequest(req: Request, delim = '\r\n'): string {
  const method = req.method || 'GET'
  const { uri } = req
  const version = req.version || 'HTTP/1.1'
  const headers = buildHeadersArray(req.headers || {}, delim)
  const body = Buffer.from(req.body || '')

  return `${method} ${uri} ${version}${delim}${headers}${delim}${body.toString()}`
}

/**
 * Builds a raw HTTP request as a Buffer from a Request object. Useful for
 * binary-safe request handling.
 *
 * @param req - The Request object to serialize
 * @param delim - The line delimiter (defaults to CRLF)
 * @returns The formatted HTTP request as a Buffer
 */
export function buildRequestRaw(req: Request, delim = '\r\n'): Buffer {
  const method = req.method || 'GET'
  const { uri } = req
  const version = req.version || 'HTTP/1.1'
  const headers = buildHeadersArray(req.headers || {}, delim)
  const body = Buffer.from(req.body || '')

  return Buffer.concat([
    Buffer.from(`${method} ${uri} ${version}${delim}${headers}${delim}`),
    body,
  ])
}

/**
 * Represents an HTTP response with version, status code, message, headers, and
 * body
 */
interface Response {
  responseVersion: string
  responseCode: number
  responseMessage?: string
  responseHeaders: Record<string, string | string[]>
  responseBody: string
}

/**
 * Parses a raw HTTP response string into a structured Response object.
 *
 * @param input - The raw HTTP response string to parse
 * @param delim - The line delimiter (defaults to CRLF)
 * @returns The parsed Response object
 */
export function parseResponse(input: string, delim = '\r\n'): Response {
  const parsed = parseMessage(input, delim)

  // @note split by space but rejoin all parts after code as the complete message
  const parts = Array.from(parsed.initialLine.split(' '))
  const version = parts[0] || ''
  const code = parts[1] || '0'
  const message = parts.slice(2).join(' ') || undefined

  return {
    responseVersion: version,
    responseCode: parseInt(code, 10),
    responseMessage: message,
    responseHeaders: parseHeadersArray(parsed.headers),
    responseBody: parsed.body,
  }
}

/**
 * Builds a raw HTTP response string from a Response object.
 *
 * @param res - The Response object to serialize
 * @param delim - The line delimiter (defaults to CRLF)
 * @returns The formatted HTTP response string
 */
export function buildResponse(res: Response, delim = '\r\n'): string {
  const version = res.responseVersion || 'HTTP/1.1'
  const code = res.responseCode
  const message = res.responseMessage || ''
  const headers = buildHeadersArray(res.responseHeaders, delim)
  const body = Buffer.from(res.responseBody || '')

  return `${version} ${code} ${message}${delim}${headers}${delim}${body.toString()}`
}

/**
 * Builds a raw HTTP response as a Buffer from a Response object. Useful for
 * binary-safe response handling.
 *
 * @param res - The Response object to serialize
 * @param delim - The line delimiter (defaults to CRLF)
 * @returns The formatted HTTP response as a Buffer
 */
export function buildResponseRaw(res: Response, delim = '\r\n'): Buffer {
  const version = res.responseVersion || 'HTTP/1.1'
  const code = res.responseCode
  const message = res.responseMessage || ''
  const headers = buildHeadersArray(res.responseHeaders, delim)
  const body = Buffer.from(res.responseBody || '')

  return Buffer.concat([
    Buffer.from(`${version} ${code} ${message}${delim}${headers}${delim}`),
    body,
  ])
}

/**
 * Detects the line delimiter used in an HTTP message. Prefers CRLF when both
 * delimiters are present, defaults to LF.
 *
 * @param input - The HTTP message string to analyze
 * @returns The detected line delimiter ('\r\n' or '\n')
 */
export function detectLineDelimiter(input: string): string {
  const n = '\n'
  const rn = '\r\n'

  const nIndex = input.indexOf(n)
  const rnIndex = input.indexOf(rn)

  // @note prefer CRLF when both delimiters are present, default to LF when neither found
  if (rnIndex >= 0 && (nIndex < 0 || rnIndex <= nIndex)) {
    return rn
  } else {
    return n
  }
}

/**
 * Normalizes an HTTP method to uppercase. Defaults to 'GET' if the method is
 * empty or not provided.
 *
 * @param method - The HTTP method to normalize
 * @returns The normalized uppercase HTTP method
 */
export function normalizeMethod(method: string | null | undefined): string {
  method = method || ''

  return method.toUpperCase().trim() || 'GET'
}

/**
 * Normalizes an HTTP version string to uppercase. Defaults to 'HTTP/1.1' if the
 * version is empty or not provided.
 *
 * @param version - The HTTP version to normalize
 * @returns The normalized uppercase HTTP version
 */
export function normalizeVersion(version: string | null | undefined): string {
  version = version || ''

  return version.toUpperCase().trim() || 'HTTP/1.1'
}

/**
 * Normalizes a URI by trimming whitespace.
 *
 * @param uri - The URI to normalize
 * @returns The normalized URI
 */
export function normalizeUri(uri: string): string {
  uri = uri || ''

  // @todo add code here

  return uri.trim()
}

/** Normalized headers with lowercase keys and string values */
export type NormalizedHeaders = Record<string, string | string[]>

/**
 * Normalizes headers by converting keys to lowercase and values to trimmed
 * strings. Filters out null and undefined values.
 *
 * @param headers - The headers to normalize
 * @returns Normalized headers with lowercase keys
 */
export function normalizeHeaders(
  headers: HeadersInput | null | undefined
): NormalizedHeaders {
  headers = headers || {}

  const normalizedHeaders: Record<string, string | string[]> = {}

  for (let name in headers) {
    const value = headers[name]

    name = name.trim().toLowerCase()

    if (Array.isArray(value)) {
      const filtered = value
        .filter(
          (v): v is NonNullable<HeaderValue> =>
            v != null && v !== '' && v !== false
        )
        .map((v) => v.toString().trim())

      if (filtered.length > 0) {
        normalizedHeaders[name] = filtered
      }
    } else if (value != null && value !== '' && value !== false) {
      normalizedHeaders[name] = value.toString().trim()
    }
  }

  return normalizedHeaders
}

/**
 * A fully normalized HTTP request with all required fields
 */
export interface NormalizedRequest {
  method: string
  uri: string
  version: string
  headers: Record<string, string | string[]>
  body?: string
}

/**
 * Normalizes an HTTP request by standardizing method, URI, version, and
 * headers. Removes body-related headers for HEAD and GET requests.
 *
 * @param req - The Request object to normalize
 * @returns The normalized request with standardized fields
 */
export function normalizeRequest(req: Request): NormalizedRequest {
  const { method, uri, version, headers } = req

  let { body } = req

  const normalizedMethod = normalizeMethod(method)
  const normalizedUri = normalizeUri(uri)
  const normalizedVersion = normalizeVersion(version)
  const normalizedHeaders = normalizeHeaders(headers)

  if (['HEAD', 'GET'].includes(normalizedMethod)) {
    body = undefined
  }

  if (!body) {
    delete normalizedHeaders['content-type']
    delete normalizedHeaders['content-length']
    delete normalizedHeaders['transport-encoding']
  }

  return {
    method: normalizedMethod,
    uri: normalizedUri,
    version: normalizedVersion,
    headers: normalizedHeaders,
    body,
  }
}

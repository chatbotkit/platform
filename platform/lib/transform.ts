import { html2text } from '@chatbotkit-dev/file-html/parse'

import debug from '@/lib/debug'
import matchJmespath from '@/lib/jmespath'
import { parse as parseJson } from '@/lib/json'
import matchJsonpath from '@/lib/jsonpath'
import { resolveMarkers } from '@/lib/object'
import { rerank as rerankDocuments } from '@/lib/rerank'
import { joinTrimmedNotEmpty } from '@/lib/string'
import { recordRerankTokenUsage } from '@/lib/usage.record'

import { encode as encodeToon } from '@toon-format/toon'

import { parseStringPromise as parseXml, processors } from 'xml2js'

const { stripPrefix } = processors

// ============================================================================
// Types
// ============================================================================

/**
 * Supported content formats for parsing and output
 */
export type ContentFormat =
  | 'text'
  | 'markdown'
  | 'html'
  | 'xml'
  | 'rss'
  | 'atom'
  | 'feed'
  | 'json'
  | 'ndjson'
  | 'toon'
  | 'raw'

/**
 * Type-safe record of all content formats.
 * If ContentFormat is extended, TypeScript will error here until the new format is added.
 */
const CONTENT_FORMATS: Record<ContentFormat, true> = {
  text: true,
  markdown: true,
  html: true,
  xml: true,
  rss: true,
  atom: true,
  feed: true,
  json: true,
  ndjson: true,
  toon: true,
  raw: true,
}

/**
 * Checks if a string is a valid ContentFormat
 */
export function isContentFormat(value: string): value is ContentFormat {
  return value in CONTENT_FORMATS
}

/**
 * Map of detected formats to target formats for automatic conversion. Use
 * 'auto' to apply the default map.
 */
export type FormatMap = 'auto' | Partial<Record<ContentFormat, ContentFormat>>

/**
 * Default format conversion map. HTML and XML are converted to text by default.
 */
export const DEFAULT_FORMAT_MAP: Record<string, ContentFormat> = {
  html: 'text',
  xml: 'text',
}

/**
 * Target format for nested string transformation
 */
export type NestedStringTarget = 'text' | 'json' | 'toon'

/**
 * Options for transforming nested string values within objects/arrays.
 * Each key specifies a source format to detect, and the value specifies
 * the target format to convert to.
 */
export interface TransformNestedStringsOptions {
  // parse JSON strings - true for objects, 'toon' to encode as toon format
  json?: boolean | 'toon'

  // convert HTML strings to text, JSON, or toon
  html?: NestedStringTarget

  // convert XML strings to text, JSON, or toon
  xml?: NestedStringTarget
}

/**
 * Options for content parsing phase
 */
export interface ParseOptions {
  // inferred from content-type header or explicit format
  contentType?: string

  // explicit format overrides content-type detection
  format?: ContentFormat | string

  // css selectors for html/xml extraction
  selectors?: string

  // base url for relative link resolution in html
  url?: string
}

/**
 * Default number of results to return when reranking
 */
export const DEFAULT_RERANK_TOP_N = 10

/**
 * Options for content transformation phase
 */
export interface TransformOptions {
  // jsonpath expression to extract data
  jsonpath?: string

  // jmespath expression to extract data
  jmespath?: string

  // rerank query to reorder results by relevance
  rerank?: string

  // when provided, rerank usage is recorded against this user
  user?: { id: string }

  // custom marker transformations (e.g. $epochToDateTime)
  markers?: Record<string, (value: unknown) => unknown>

  // transform nested string values (JSON, HTML, XML) within objects/arrays
  transformNestedStrings?: TransformNestedStringsOptions
}

/**
 * Options for error detection phase
 */
export interface ErrorDetectionOptions {
  // jsonpath to detect errors in response
  errorJsonpath?: string

  // jmespath to detect errors in response
  errorJmespath?: string
}

/**
 * Combined options for full transform pipeline
 */
export interface TransformPipelineOptions
  extends ParseOptions,
    TransformOptions,
    ErrorDetectionOptions {
  // format conversion map - 'auto' uses DEFAULT_FORMAT_MAP
  formatMap?: FormatMap
}

/**
 * Result of a transform operation
 */
export interface TransformResult<T = unknown> {
  data: T
  error?: string
  format?: ContentFormat
}

// ============================================================================
// Content Type Detection
// ============================================================================

/**
 * Determines if content type indicates NDJSON format
 */
export function isNdjsonContentType(contentType: string): boolean {
  return (
    contentType.includes('x-ndjson') ||
    contentType.includes('application/jsonl')
  )
}

/**
 * Determines if content type indicates JSON format
 */
export function isJsonContentType(contentType: string): boolean {
  return contentType.includes('json') && !isNdjsonContentType(contentType)
}

/**
 * Determines if content type indicates HTML format
 */
export function isHtmlContentType(contentType: string): boolean {
  return contentType.includes('html')
}

/**
 * Determines if content type indicates XML format
 */
export function isXmlContentType(contentType: string): boolean {
  return (
    contentType.includes('xml') &&
    !contentType.includes('html') &&
    !contentType.includes('rss') &&
    !contentType.includes('atom')
  )
}

/**
 * Determines if content type indicates RSS format
 */
export function isRssContentType(contentType: string): boolean {
  return (
    contentType.includes('application/rss') ||
    contentType.includes('text/rss') ||
    contentType.includes('application/rss+xml')
  )
}

/**
 * Determines if content type indicates Atom format
 */
export function isAtomContentType(contentType: string): boolean {
  return (
    contentType.includes('application/atom') ||
    contentType.includes('text/atom') ||
    contentType.includes('application/atom+xml')
  )
}

/**
 * Determines if content type indicates any feed format (RSS or Atom)
 */
export function isFeedContentType(contentType: string): boolean {
  return isRssContentType(contentType) || isAtomContentType(contentType)
}

/**
 * Determines if content string appears to be JSON
 */
export function isJsonContent(content: string): boolean {
  const trimmed = content.trim()

  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

/**
 * Determines if content string appears to be HTML
 */
/**
 * Common HTML element tags that indicate HTML fragment content.
 * These are tags commonly found in RSS/Atom feed CDATA sections and rich text.
 */
const HTML_FRAGMENT_TAGS = [
  'p',
  'div',
  'span',
  'a',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'tr',
  'td',
  'th',
  'img',
  'article',
  'section',
  'nav',
  'header',
  'footer',
  'main',
  'aside',
  'figure',
  'figcaption',
  'blockquote',
  'pre',
  'code',
]

export function isHtmlContent(content: string): boolean {
  let trimmed = content.trim().toLowerCase()

  // skip HTML comments at the start

  while (trimmed.startsWith('<!--')) {
    const endComment = trimmed.indexOf('-->')

    if (endComment === -1) {
      break
    }

    trimmed = trimmed.slice(endComment + 3).trim()
  }

  // check for full HTML document markers

  if (
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head') ||
    trimmed.startsWith('<body')
  ) {
    return true
  }

  // check for HTML fragment tags (common in RSS/Atom CDATA)

  for (const tag of HTML_FRAGMENT_TAGS) {
    if (trimmed.startsWith(`<${tag}>`) || trimmed.startsWith(`<${tag} `)) {
      return true
    }
  }

  return false
}

/**
 * Determines if content string appears to be XML (but not HTML, RSS, or Atom)
 */
export function isXmlContent(content: string): boolean {
  const trimmed = content.trim()

  // exclude HTML content - check for HTML markers first

  if (isHtmlContent(content)) {
    return false
  }

  // exclude RSS and Atom feeds

  if (isRssContent(content) || isAtomContent(content)) {
    return false
  }

  return trimmed.startsWith('<?xml') || trimmed.startsWith('<')
}

/**
 * Determines if content string appears to be RSS feed
 */
export function isRssContent(content: string): boolean {
  const trimmed = content.trim().toLowerCase()

  // check for <rss tag (with or without XML declaration)

  return trimmed.includes('<rss') && trimmed.includes('<channel')
}

/**
 * Determines if content string appears to be Atom feed
 */
export function isAtomContent(content: string): boolean {
  const trimmed = content.trim().toLowerCase()

  // check for Atom namespace or feed element

  return (
    (trimmed.includes('<feed') && trimmed.includes('xmlns')) ||
    trimmed.includes('atom+xml') ||
    trimmed.includes('http://www.w3.org/2005/atom')
  )
}

/**
 * Determines if content string appears to be any feed format (RSS or Atom)
 */
export function isFeedContent(content: string): boolean {
  return isRssContent(content) || isAtomContent(content)
}

/**
 * Options for format detection
 */
export interface DetectFormatOptions {
  // content-type header value
  contentType?: string

  // explicit format requested by user
  format?: string

  // content string for inspection when content-type is not informative
  content?: string
}

/**
 * Determines the effective format based on content type, explicit format, and content inspection
 */
export function detectFormat(options: DetectFormatOptions): ContentFormat {
  const { contentType = '', format: explicitFormat, content } = options

  // explicit format takes precedence

  if (explicitFormat && isContentFormat(explicitFormat)) {
    return explicitFormat
  }

  // detect from content type

  if (isNdjsonContentType(contentType)) {
    return 'ndjson'
  }

  if (isJsonContentType(contentType)) {
    return 'json'
  }

  if (isHtmlContentType(contentType)) {
    return 'html'
  }

  if (isRssContentType(contentType)) {
    return 'rss'
  }

  if (isAtomContentType(contentType)) {
    return 'atom'
  }

  if (isXmlContentType(contentType)) {
    return 'xml'
  }

  // fallback to content inspection when content-type is not informative

  if (content) {
    if (isJsonContent(content)) {
      return 'json'
    }

    if (isHtmlContent(content)) {
      return 'html'
    }

    if (isRssContent(content)) {
      return 'rss'
    }

    if (isAtomContent(content)) {
      return 'atom'
    }

    if (isXmlContent(content)) {
      return 'xml'
    }
  }

  return 'raw'
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parses NDJSON (newline-delimited JSON) content into an array
 */
export function parseNdjson(value: string): unknown[] {
  return value
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => parseJson(line))
}

/**
 * Recursively parses string values that contain valid JSON into objects/arrays.
 * Useful for APIs that return stringified JSON within response fields.
 */
export function parseNestedJsonStrings(value: unknown): unknown {
  if (typeof value === 'string') {
    if (isJsonContent(value)) {
      try {
        const parsed = parseJson(value)

        return parseNestedJsonStrings(parsed)
      } catch {
        return value
      }
    }

    return value
  }

  if (Array.isArray(value)) {
    return value.map(parseNestedJsonStrings)
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = parseNestedJsonStrings(val)
    }

    return result
  }

  return value
}

/**
 * Recursively transforms nested string values based on detected format.
 * Supports JSON parsing/toon, HTML-to-text/JSON/toon, and XML-to-text/JSON/toon.
 */
export async function transformNestedStrings(
  value: unknown,
  options: TransformNestedStringsOptions
): Promise<unknown> {
  if (typeof value === 'string') {
    const trimmed = value.trim()

    // check for JSON first (highest priority)

    if (options.json && isJsonContent(trimmed)) {
      try {
        const parsed = parseJson(value)

        if (options.json === 'toon') {
          return encodeToon(parsed)
        }

        return transformNestedStrings(parsed, options)
      } catch {
        // not valid JSON, continue to other checks
      }
    }

    // check for HTML

    if (options.html && isHtmlContent(trimmed)) {
      try {
        if (options.html === 'text') {
          // wrap HTML fragments in body tag for html2text to find content
          // html2text uses selectors like 'article,main,body' to find content

          const isFragment =
            !trimmed.toLowerCase().startsWith('<!doctype') &&
            !trimmed.toLowerCase().startsWith('<html') &&
            !trimmed.toLowerCase().startsWith('<body')

          const htmlToConvert = isFragment ? `<body>${value}</body>` : value

          return html2text(htmlToConvert, {
            selectors: 'article,main,body,html,div,p',
          })
        } else if (options.html === 'json' || options.html === 'toon') {
          const parsed = await parseXml(value, {
            explicitArray: false,
            ignoreAttrs: false,
            mergeAttrs: true,
            tagNameProcessors: [stripPrefix],
            attrNameProcessors: [stripPrefix],
          })

          const cleaned = stripXmlnsAttributes(parsed)

          if (options.html === 'toon') {
            return encodeToon(cleaned)
          }

          return transformNestedStrings(cleaned, options)
        }
      } catch {
        // conversion failed, return original

        return value
      }
    }

    // check for XML (after HTML since isXmlContent excludes HTML)

    if (options.xml && isXmlContent(trimmed)) {
      try {
        if (options.xml === 'text') {
          // use wildcard selector for generic XML since html2text needs a selector
          return html2text(value, { selectors: '*' })
        } else if (options.xml === 'json' || options.xml === 'toon') {
          const parsed = await parseXml(value, {
            explicitArray: false,
            ignoreAttrs: false,
            mergeAttrs: true,
            tagNameProcessors: [stripPrefix],
            attrNameProcessors: [stripPrefix],
          })

          const cleaned = stripXmlnsAttributes(parsed)

          if (options.xml === 'toon') {
            return encodeToon(cleaned)
          }

          return transformNestedStrings(cleaned, options)
        }
      } catch {
        // conversion failed, return original

        return value
      }
    }

    return value
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item) => transformNestedStrings(item, options))
    )
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    const entries = Object.entries(value as Record<string, unknown>)

    for (const [key, val] of entries) {
      result[key] = await transformNestedStrings(val, options)
    }

    return result
  }

  return value
}

/**
 * Recursively removes xmlns namespace attributes from parsed XML objects.
 * These are not useful in the output and add noise.
 */
export function stripXmlnsAttributes(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripXmlnsAttributes(item))
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    const entries = Object.entries(value as Record<string, unknown>)

    for (const [key, val] of entries) {
      // skip xmlns attributes and namespace declarations

      if (
        key === 'xmlns' ||
        key.startsWith('xmlns:') ||
        key.startsWith('xmlns$')
      ) {
        continue
      }

      result[key] = stripXmlnsAttributes(val)
    }

    return result
  }

  return value
}

/**
 * Fields in RSS/Atom feeds that commonly contain HTML content
 */
const FEED_HTML_FIELDS = [
  'description',
  'content',
  'encoded', // content:encoded after namespace stripping
  'summary',
  'subtitle',
]

/**
 * Helper to convert HTML string to text, handling fragments
 */
function htmlToText(html: string): string {
  const trimmed = html.trim().toLowerCase()

  // check if it's a fragment (no document wrapper)

  const isFragment =
    !trimmed.startsWith('<!doctype') &&
    !trimmed.startsWith('<html') &&
    !trimmed.startsWith('<body')

  const htmlToConvert = isFragment ? `<body>${html}</body>` : html

  return html2text(htmlToConvert, {
    selectors: 'article,main,div,p,body,html',
  })
}

/**
 * Recursively strips HTML from common feed content fields (description, content, etc.)
 */
export async function stripFeedHtml(value: unknown): Promise<unknown> {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => stripFeedHtml(item)))
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    const entries = Object.entries(value as Record<string, unknown>)

    for (const [key, val] of entries) {
      // check if this is a field that typically contains HTML

      if (FEED_HTML_FIELDS.includes(key.toLowerCase())) {
        // handle direct string value

        if (typeof val === 'string' && isHtmlContent(val)) {
          result[key] = htmlToText(val)
        }
        // handle xml2js object with _ for text content (e.g., <content type="html">...</content>)
        else if (
          val !== null &&
          typeof val === 'object' &&
          '_' in val &&
          typeof (val as Record<string, unknown>)._ === 'string'
        ) {
          const obj = val as Record<string, unknown>
          const textContent = obj._ as string

          // check if type attribute indicates HTML, or if content looks like HTML

          const isHtml =
            obj.type === 'html' ||
            obj.type === 'text/html' ||
            isHtmlContent(textContent)

          if (isHtml) {
            result[key] = {
              ...obj,
              _: htmlToText(textContent),
            }
          } else {
            result[key] = await stripFeedHtml(val)
          }
        } else {
          result[key] = await stripFeedHtml(val)
        }
      } else {
        result[key] = await stripFeedHtml(val)
      }
    }

    return result
  }

  return value
}

/**
 * Parses content based on format and content type
 */
export async function parseContent(
  content: string,
  options: ParseOptions = {}
): Promise<TransformResult> {
  const { contentType = '', format, selectors, url } = options

  const effectiveFormat = detectFormat({ contentType, format, content })

  debug(`parseContent`, { effectiveFormat, contentType, format }).log(
    'transform.parseContent'
  )

  try {
    switch (effectiveFormat) {
      case 'text':
      case 'markdown': {
        // if content is HTML/XML, convert to text

        if (isHtmlContent(content) || isXmlContent(content)) {
          const text = html2text(content, {
            url,
            selectors: joinTrimmedNotEmpty(
              [selectors, 'article', 'main', 'body', 'html'],
              ','
            ),
          })

          return { data: text }
        }

        return { data: content }
      }

      case 'html': {
        const text = html2text(content, {
          url,
          selectors: joinTrimmedNotEmpty(
            [selectors, 'article', 'main', 'body', 'html'],
            ','
          ),
        })

        return { data: text }
      }

      case 'xml': {
        // convert XML to text by default

        const text = html2text(content, {
          url,
          selectors: joinTrimmedNotEmpty([selectors], ','),
        })

        return { data: text }
      }

      case 'rss':
      case 'atom':
      case 'feed': {
        // parse feed XML to JSON and strip HTML from content fields

        const parsed = await parseXml(content, {
          explicitArray: false,
          ignoreAttrs: false,
          mergeAttrs: true,
          tagNameProcessors: [stripPrefix],
          attrNameProcessors: [stripPrefix],
        })

        // strip xmlns attributes and HTML from common feed content fields

        const cleaned = stripXmlnsAttributes(parsed)
        const result = await stripFeedHtml(cleaned)

        return { data: result }
      }

      case 'ndjson': {
        const parsed = parseNdjson(content)

        return { data: parsed }
      }

      case 'json':
      case 'toon': {
        // toon format should still respect ndjson content-type since toon is
        // an output encoding, not an input format
        if (isNdjsonContentType(contentType)) {
          const parsed = parseNdjson(content)

          return { data: parsed }
        }

        // if content looks like RSS/Atom, parse as feed with HTML stripping

        if (isFeedContent(content) && !isJsonContent(content)) {
          debug(`converting feed to JSON`).log('transform.parseContent')

          const parsed = await parseXml(content, {
            explicitArray: false,
            ignoreAttrs: false,
            mergeAttrs: true,
            tagNameProcessors: [stripPrefix],
            attrNameProcessors: [stripPrefix],
          })

          const cleaned = stripXmlnsAttributes(parsed)
          const result = await stripFeedHtml(cleaned)

          return { data: result }
        }

        // if content looks like HTML, convert it to JSON via XML parser

        if (isHtmlContent(content) && !isJsonContent(content)) {
          debug(`converting HTML to JSON`).log('transform.parseContent')

          const parsed = await parseXml(content, {
            explicitArray: false,
            ignoreAttrs: false,
            mergeAttrs: true,
            tagNameProcessors: [stripPrefix],
            attrNameProcessors: [stripPrefix],
          })

          return { data: stripXmlnsAttributes(parsed) }
        }

        // if content looks like XML, convert it to JSON first

        if (isXmlContent(content) && !isJsonContent(content)) {
          debug(`converting XML to JSON`).log('transform.parseContent')

          const parsed = await parseXml(content, {
            explicitArray: false,
            ignoreAttrs: false,
            mergeAttrs: true,
            tagNameProcessors: [stripPrefix],
            attrNameProcessors: [stripPrefix],
          })

          return { data: stripXmlnsAttributes(parsed) }
        }

        // toon format requires json parsing first

        const parsed = parseJson(content)

        return { data: parsed }
      }

      case 'raw':
      default: {
        // try to auto-detect parseable content

        if (isNdjsonContentType(contentType)) {
          const parsed = parseNdjson(content)

          return { data: parsed }
        }

        if (isJsonContentType(contentType)) {
          try {
            const parsed = parseJson(content)

            return { data: parsed }
          } catch {
            return { data: content }
          }
        }

        return { data: content }
      }
    }
  } catch (e) {
    debug(`parseContent failed`, { e }).log('transform.parseContent')

    return {
      data: content,
      error: `Parse failed: ${(e as Error).message || String(e)}`,
    }
  }
}

// ============================================================================
// Error Detection
// ============================================================================

/**
 * Evaluates whether a path query result indicates an error.
 * Semantics:
 * - Arrays: non-empty arrays indicate errors
 * - Booleans: false indicates error (Slack API pattern)
 * - Strings: non-empty strings indicate errors
 * - Numbers: non-zero numbers indicate errors
 * - Objects: non-null objects indicate errors
 */
export function isErrorValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === 'boolean') {
    return !value
  }

  if (typeof value === 'string') {
    return value.length > 0 && value.trim() !== ''
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  if (value !== null && value !== undefined) {
    return true
  }

  return false
}

/**
 * Detects errors in parsed data using jsonpath or jmespath expressions
 */
export function detectError(
  data: unknown,
  options: ErrorDetectionOptions
): string | undefined {
  const { errorJsonpath, errorJmespath } = options

  if (!errorJsonpath && !errorJmespath) {
    return undefined
  }

  // data must be an object or array for path queries

  if (data === null || typeof data !== 'object') {
    return undefined
  }

  debug(`detectError`, { errorJsonpath, errorJmespath }).log(
    'transform.detectError'
  )

  if (errorJsonpath) {
    try {
      const result = matchJsonpath(
        errorJsonpath,
        data as Record<string, unknown> | unknown[]
      )

      if (isErrorValue(result)) {
        debug(`error detected via jsonpath`, { errorJsonpath, result }).log(
          'transform.detectError'
        )

        return `Error detected via JSONPath ${errorJsonpath}: ${JSON.stringify(result)}`
      }
    } catch (e) {
      debug(`error detection jsonpath failed`, { e }).log(
        'transform.detectError'
      )
    }
  }

  if (errorJmespath) {
    try {
      const result = matchJmespath(
        errorJmespath,
        data as Record<string, unknown> | unknown[]
      )

      if (isErrorValue(result)) {
        debug(`error detected via jmespath`, { errorJmespath, result }).log(
          'transform.detectError'
        )

        return `Error detected via JMESPath ${errorJmespath}: ${JSON.stringify(result)}`
      }
    } catch (e) {
      debug(`error detection jmespath failed`, { e }).log(
        'transform.detectError'
      )
    }
  }

  return undefined
}

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Applies jsonpath extraction to data
 */
export function applyJsonpath(
  data: unknown,
  jsonpath: string
): TransformResult {
  debug(`applyJsonpath`, { jsonpath }).log('transform.applyJsonpath')

  try {
    const result = matchJsonpath(
      jsonpath,
      data as Record<string, unknown> | unknown[]
    )

    return { data: result }
  } catch (e) {
    debug(`applyJsonpath failed`, { e }).log('transform.applyJsonpath')

    return {
      data,
      error: `JSONPath transformation failed: ${(e as Error).message || String(e)}`,
    }
  }
}

/**
 * Applies jmespath extraction to data
 */
export function applyJmespath(
  data: unknown,
  jmespath: string
): TransformResult {
  debug(`applyJmespath`, { jmespath }).log('transform.applyJmespath')

  try {
    const result = matchJmespath(
      jmespath,
      data as Record<string, unknown> | unknown[]
    )

    return { data: result }
  } catch (e) {
    debug(`applyJmespath failed`, { e }).log('transform.applyJmespath')

    return {
      data,
      error: `JMESPath transformation failed: ${(e as Error).message || String(e)}`,
    }
  }
}

/**
 * Applies marker transformations to data
 */
export function applyMarkers(
  data: unknown,
  markers: Record<string, (value: unknown) => unknown>
): TransformResult {
  debug(`applyMarkers`).log('transform.applyMarkers')

  try {
    const result = resolveMarkers(data, markers)

    return { data: result }
  } catch (e) {
    debug(`applyMarkers failed`, { e }).log('transform.applyMarkers')

    return {
      data,
      error: `Marker transformation failed: ${(e as Error).message || String(e)}`,
    }
  }
}

/**
 * Applies toon encoding to data for token optimization
 */
export function applyToon(data: unknown): TransformResult {
  debug(`applyToon`).log('transform.applyToon')

  try {
    if (data === null || typeof data !== 'object') {
      return { data }
    }

    const result = encodeToon(data, { keyFolding: 'safe' })

    return { data: result }
  } catch (e) {
    debug(`applyToon failed`, { e }).log('transform.applyToon')

    // keep original on failure

    return { data }
  }
}

/**
 * Reranks array data based on a query using the BGE V2/V3 model. Looks for
 * arrays directly or under common keys (results, items, documents, etc.)
 */
export async function applyRerank(
  data: unknown,
  query: string,
  options: { user?: { id: string } } = {}
): Promise<TransformResult> {
  debug(`applyRerank`, { query }).log('transform.applyRerank')

  try {
    let root: unknown[] | undefined

    // check if data is directly an array

    if (Array.isArray(data)) {
      root = data
    }

    // check for common array properties in objects

    if (!root && data && typeof data === 'object') {
      const dataObj = data as Record<string, unknown>

      root =
        (dataObj.results as unknown[]) ||
        (dataObj.items as unknown[]) ||
        (dataObj.documents as unknown[]) ||
        (dataObj.files as unknown[]) ||
        (dataObj.records as unknown[]) ||
        (dataObj.data as unknown[])
    }

    // if no array found, return data unchanged

    if (!Array.isArray(root)) {
      return { data }
    }

    // flatten nested arrays

    root = root.flat()

    // convert items to reranker format

    const chunks = root.map((item, index) => ({
      id: `${index}`,
      text: JSON.stringify(item),
    }))

    const { documents: ranked, usage } = await rerankDocuments(query, chunks, {
      topN: DEFAULT_RERANK_TOP_N,
    })

    if (options.user) {
      // @note usage recording is best-effort; isolate it so a recording failure
      // does not discard the successfully reranked result via the outer catch.
      // recordRerankTokenUsage no-ops on a zero count, so we do not gate on
      // usage.outputTokens - that is the recording layer's decision.
      try {
        await recordRerankTokenUsage({
          user: options.user,
          count: usage.outputTokens,
          model: usage.model,
        })
      } catch (e) {
        debug(`failed to record rerank usage`, { e }).log(
          'transform.applyRerank'
        )
      }
    }

    // map ranked results back to original items

    const documents = ranked
      .map(({ id }) => {
        const chunk = chunks.find((chunk) => chunk.id === id)

        return chunk?.text || ''
      })
      .filter(Boolean)
      .map((text) => JSON.parse(text))

    return { data: documents }
  } catch (e) {
    debug(`applyRerank failed`, { e }).log('transform.applyRerank')

    return {
      data,
      error: `Rerank transformation failed: ${(e as Error).message || String(e)}`,
    }
  }
}

/**
 * Applies transformations to parsed data
 */
export async function transformData(
  data: unknown,
  options: TransformOptions & { toon?: boolean }
): Promise<TransformResult> {
  const {
    jsonpath,
    jmespath,

    rerank,

    user,

    markers,

    transformNestedStrings: transformNestedStringsOptions,

    toon,
  } = options

  let result = data
  let error: string | undefined

  debug(`transformData`, {
    jsonpath,
    jmespath,

    rerank,

    transformNestedStrings: transformNestedStringsOptions,

    toon,
  }).log('transform.transformData')

  // apply jsonpath extraction

  if (jsonpath) {
    const jsonpathResult = applyJsonpath(result, jsonpath)

    result = jsonpathResult.data

    if (jsonpathResult.error) {
      return { data: result, error: jsonpathResult.error }
    }
  }

  // apply jmespath extraction

  if (jmespath) {
    const jmespathResult = applyJmespath(result, jmespath)

    result = jmespathResult.data

    if (jmespathResult.error) {
      return { data: result, error: jmespathResult.error }
    }
  }

  // apply rerank transformation

  if (rerank) {
    const rerankResult = await applyRerank(result, rerank, { user })

    result = rerankResult.data

    if (rerankResult.error) {
      return { data: result, error: rerankResult.error }
    }
  }

  // apply marker transformations

  if (markers && Object.keys(markers).length > 0) {
    const markersResult = applyMarkers(result, markers)

    result = markersResult.data

    if (markersResult.error) {
      error = markersResult.error
    }
  }

  // transform nested strings

  if (
    transformNestedStringsOptions &&
    result !== null &&
    typeof result === 'object'
  ) {
    try {
      result = await transformNestedStrings(
        result,
        transformNestedStringsOptions
      )
    } catch (e) {
      debug(`transformNestedStrings failed`, { e }).log(
        'transform.transformData'
      )
    }
  }

  // apply toon encoding

  if (toon) {
    const toonResult = applyToon(result)

    result = toonResult.data
  }

  return { data: result, error }
}

// ============================================================================
// Pipeline Function
// ============================================================================

/**
 * Executes the full transform pipeline:
 * 1. Parse content based on format/content-type
 * 2. Detect errors using errorJsonpath/errorJmespath
 * 3. Apply transformations (jsonpath, jmespath, markers, etc.)
 */
export async function transform(
  content: string,
  options: TransformPipelineOptions = {}
): Promise<TransformResult> {
  const {
    contentType,
    format,
    selectors,
    url,
    jsonpath,
    jmespath,
    errorJsonpath,
    errorJmespath,
    rerank,
    user,
    markers,
    transformNestedStrings: transformNestedStringsOptions,
    formatMap = 'auto',
  } = options

  debug(`transform pipeline starting`, { options }).log('transform.transform')

  // Phase 0: Detect format and apply format map
  const preliminaryFormat = detectFormat({ contentType, format, content })

  // resolve the effective format from the format map

  const resolvedFormatMap =
    formatMap === 'auto'
      ? DEFAULT_FORMAT_MAP
      : { ...DEFAULT_FORMAT_MAP, ...formatMap }

  // if jsonpath/jmespath provided and content is XML/HTML, override to JSON

  const needsStructuredData = !!(jsonpath || jmespath)
  const shouldConvertToJson =
    needsStructuredData &&
    !format &&
    (preliminaryFormat === 'xml' || preliminaryFormat === 'html')

  // priority: explicit format > jsonpath/jmespath inference > formatMap > detected

  let effectiveFormat: ContentFormat | string | undefined = format

  if (!effectiveFormat && shouldConvertToJson) {
    effectiveFormat = 'json'
  } else if (!effectiveFormat && resolvedFormatMap[preliminaryFormat]) {
    effectiveFormat = resolvedFormatMap[preliminaryFormat]
  }

  // we use effectiveFormat for parsing but return preliminaryFormat so the
  // result shows what was detected, not what it was converted to

  debug(`detected format`, {
    preliminaryFormat,
    effectiveFormat,
    needsStructuredData,
    shouldConvertToJson,
  }).log('transform.transform')

  // Phase 1: Parse content
  const parseResult = await parseContent(content, {
    contentType,
    format: effectiveFormat,
    selectors,
    url,
  })

  if (parseResult.error) {
    return { ...parseResult, format: preliminaryFormat }
  }

  const data = parseResult.data

  // Phase 2: Error detection (before transformations)
  const detectedError = detectError(data, { errorJsonpath, errorJmespath })

  if (detectedError) {
    return { data, error: detectedError, format: preliminaryFormat }
  }

  // Phase 3: Apply transformations
  const transformResult = await transformData(data, {
    jsonpath,
    jmespath,

    rerank,

    user,

    markers,

    transformNestedStrings: transformNestedStringsOptions,

    toon: format === 'toon',
  })

  debug(`transform pipeline complete`, { result: transformResult }).log(
    'transform.transform'
  )

  return { ...transformResult, format: preliminaryFormat }
}

// ============================================================================
// Convenience Exports
// ============================================================================

export default transform

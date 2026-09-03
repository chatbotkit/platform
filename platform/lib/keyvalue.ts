/**
 * A flexible key-value parser that supports multiple common formats.
 *
 * Supported formats:
 * - YAML style: `key: value` (colon + space)
 * - Compact YAML: `key:value` (colon without space, if key looks like identifier)
 * - Properties/INI style: `key=value`
 * - JSON object: `{ "key": "value" }`
 *
 * @example
 * // YAML style
 * parseKeyValue('username: john\npassword: secret')
 * // => { username: 'john', password: 'secret' }
 *
 * @example
 * // Properties style
 * parseKeyValue('username=john\npassword=secret')
 * // => { username: 'john', password: 'secret' }
 *
 * @example
 * // Mixed styles
 * parseKeyValue('username: john\npassword=secret')
 * // => { username: 'john', password: 'secret' }
 *
 * @example
 * // JSON object
 * parseKeyValue('{"username": "john", "password": "secret"}')
 * // => { username: 'john', password: 'secret' }
 */

export interface ParseKeyValueOptions {
  /**
   * Keys to recognize when parsing. If provided, only these keys will be
   * extracted. Useful for distinguishing between `user:pass` format and
   * `username:value` format.
   */
  recognizedKeys?: string[]

  /**
   * Whether to trim whitespace from values.
   * @default true
   */
  trimValues?: boolean

  /**
   * Whether to strip quotes from values (single or double).
   * @default true
   */
  stripQuotes?: boolean

  /**
   * Whether key matching should be case-insensitive.
   * @default true
   */
  caseInsensitive?: boolean
}

export interface ParseKeyValueResult {
  /**
   * The parsed key-value pairs.
   */
  data: Record<string, string>

  /**
   * Whether parsing was successful (at least one key-value pair found).
   */
  success: boolean

  /**
   * The format that was detected/used for parsing.
   */
  format: 'json' | 'yaml' | 'properties' | 'mixed' | 'none'
}

/**
 * Parse a string containing key-value pairs in various formats.
 */
export function parseKeyValue(
  input: string,
  options: ParseKeyValueOptions = {}
): ParseKeyValueResult {
  const {
    recognizedKeys,
    trimValues = true,
    stripQuotes = true,
    caseInsensitive = true,
  } = options

  const trimmed = input.trim()

  if (!trimmed) {
    return { data: {}, success: false, format: 'none' }
  }

  // @note try JSON first if it looks like an object

  if (trimmed.startsWith('{')) {
    const jsonResult = tryParseJson(trimmed, {
      trimValues,
      stripQuotes,
      caseInsensitive,
      recognizedKeys,
    })

    if (jsonResult) {
      return jsonResult
    }
  }

  // @note parse line by line for YAML/properties formats

  return parseLines(trimmed, {
    recognizedKeys,
    trimValues,
    stripQuotes,
    caseInsensitive,
  })
}

function tryParseJson(
  input: string,
  options: Required<
    Pick<ParseKeyValueOptions, 'trimValues' | 'stripQuotes' | 'caseInsensitive'>
  > &
    Pick<ParseKeyValueOptions, 'recognizedKeys'>
): ParseKeyValueResult | null {
  try {
    const parsed = JSON.parse(input)

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null
    }

    const data: Record<string, string> = {}

    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') {
        continue
      }

      const normalizedKey = options.caseInsensitive ? key.toLowerCase() : key

      if (options.recognizedKeys) {
        const recognized = options.recognizedKeys.some((k) =>
          options.caseInsensitive
            ? k.toLowerCase() === normalizedKey
            : k === key
        )

        if (!recognized) {
          continue
        }
      }

      let processedValue = value

      if (options.trimValues) {
        processedValue = processedValue.trim()
      }

      if (options.stripQuotes) {
        processedValue = maybeStripQuotes(processedValue)
      }

      data[key] = processedValue
    }

    if (Object.keys(data).length === 0) {
      return null
    }

    return { data, success: true, format: 'json' }
  } catch {
    return null
  }
}

function parseLines(
  input: string,
  options: Required<
    Pick<ParseKeyValueOptions, 'trimValues' | 'stripQuotes' | 'caseInsensitive'>
  > &
    Pick<ParseKeyValueOptions, 'recognizedKeys'>
): ParseKeyValueResult {
  const lines = input.split(/\r?\n/)
  const data: Record<string, string> = {}

  let yamlCount = 0
  let propertiesCount = 0

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      // @note skip empty lines and comments
      continue
    }

    const result = parseLine(trimmedLine, options)

    if (result) {
      data[result.key] = result.value

      if (result.separator === ':') {
        yamlCount++
      } else {
        propertiesCount++
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return { data: {}, success: false, format: 'none' }
  }

  let format: ParseKeyValueResult['format']

  if (yamlCount > 0 && propertiesCount > 0) {
    format = 'mixed'
  } else if (yamlCount > 0) {
    format = 'yaml'
  } else {
    format = 'properties'
  }

  return { data, success: true, format }
}

function parseLine(
  line: string,
  options: Required<
    Pick<ParseKeyValueOptions, 'trimValues' | 'stripQuotes' | 'caseInsensitive'>
  > &
    Pick<ParseKeyValueOptions, 'recognizedKeys'>
): { key: string; value: string; separator: ':' | '=' } | null {
  // @note try properties style first (key=value) as it's unambiguous

  const equalsMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)$/)

  if (equalsMatch) {
    const [, key, rawValue] = equalsMatch

    if (isKeyRecognized(key, options)) {
      return {
        key,
        value: processValue(rawValue, options),
        separator: '=',
      }
    }
  }

  // @note try YAML style (key: value) with space after colon

  const yamlMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s+(.*)$/)

  if (yamlMatch) {
    const [, key, rawValue] = yamlMatch

    if (isKeyRecognized(key, options)) {
      return {
        key,
        value: processValue(rawValue, options),
        separator: ':',
      }
    }
  }

  // @note try compact YAML style (key:value) without space, only if key is recognized

  const compactMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):(.+)$/)

  if (compactMatch) {
    const [, key, rawValue] = compactMatch

    // @note only parse compact style if we have recognized keys and this is one

    if (options.recognizedKeys && isKeyRecognized(key, options)) {
      return {
        key,
        value: processValue(rawValue, options),
        separator: ':',
      }
    }
  }

  return null
}

function isKeyRecognized(
  key: string,
  options: Pick<ParseKeyValueOptions, 'recognizedKeys' | 'caseInsensitive'>
): boolean {
  if (!options.recognizedKeys) {
    return true
  }

  const normalizedKey = options.caseInsensitive ? key.toLowerCase() : key

  return options.recognizedKeys.some((k) =>
    options.caseInsensitive ? k.toLowerCase() === normalizedKey : k === key
  )
}

function processValue(
  value: string,
  options: Pick<ParseKeyValueOptions, 'trimValues' | 'stripQuotes'>
): string {
  let result = value

  if (options.trimValues) {
    result = result.trim()
  }

  if (options.stripQuotes) {
    result = maybeStripQuotes(result)
  }

  return result
}

function maybeStripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

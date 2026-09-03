import jsYaml from 'js-yaml'

// @note these mirror js-yaml's own option types. `jsYaml.SchemaOptions` stood
// here previously and has never existed in @types/js-yaml at any version - the
// real type is the `Schema` class. It went unnoticed because this package
// declared `js-yaml` but not `@types/js-yaml`, and js-yaml ships no typings of
// its own, so the import silently degraded to `any` and nothing was checked.

interface ParseOptions {
  schema: jsYaml.Schema
}

interface StringifyOptions {
  schema?: jsYaml.Schema
  lineWidth?: number
  forceQuotes?: boolean
  quotingType?: "'" | '"'
  json?: boolean
}

/**
 * Parses a YAML string and returns the parsed object
 */
export function parse(input: string, options?: ParseOptions): unknown {
  return jsYaml.load(input, options)
}

/**
 * Attempts to parse a YAML string, returning null if parsing fails
 */
export function tryParse(input: string, options?: ParseOptions): unknown {
  try {
    return parse(input, options)
  } catch {
    return null
  }
}

/**
 * Converts an object to a YAML string
 */
export function stringify(input: unknown, options?: StringifyOptions): string {
  return jsYaml.dump(input, {
    ...options,

    schema: options?.schema,
    lineWidth: options?.lineWidth ?? -1,
    forceQuotes: options?.forceQuotes,
    quotingType: options?.quotingType,
  })
}

/**
 * Attempts to convert an object to a YAML string, returning empty string if conversion fails
 */
export function tryStringify(
  input: unknown,
  options?: StringifyOptions
): string {
  try {
    return stringify(input, options)
  } catch {
    return ''
  }
}

/**
 * Checks if a string can be parsed as valid YAML
 */
export function isParsable(input: string): boolean {
  try {
    parse(input)

    return true
  } catch {
    return false
  }
}

export default {
  parse,
  tryParse,
  stringify,
  tryStringify,
}

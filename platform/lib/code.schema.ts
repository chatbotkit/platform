import { UserInputError } from '@/lib/error'
import { tryParse } from '@/lib/json'
import type { JsonSchema } from '@/lib/jsonschema'

/**
 * Marker that precedes an embedded input-schema block in a code function.
 *
 * The schema is declared inside a comment/docstring so it can be read straight
 * out of the source string without executing the code, identically for
 * JavaScript and Python. The block itself is plain JSON; only the surrounding
 * comment syntax differs between languages:
 *
 * JavaScript (line comments):
 *
 *     // @schema
 *     // { "type": "object", "required": ["prompt"],
 *     //   "properties": { "prompt": { "type": "string" } } }
 *
 * Python (hash comments):
 *
 *     # @schema
 *     # { "type": "object", "required": ["prompt"],
 *     #   "properties": { "prompt": { "type": "string" } } }
 */
export const SCHEMA_MARKER = '@schema'

/**
 * Strips a single leading line-comment prefix (`//`, `#`, or `*`) from each
 * line. Only the prefix at the start of a line is removed, so comment
 * characters that appear inside JSON string values are preserved.
 */
function stripCommentPrefixes(block: string): string {
  return block
    .split('\n')
    .map((line) => line.replace(/^\s*(\/\/|#|\*)\s?/, ''))
    .join('\n')
}

/**
 * Finds the balanced `{ ... }` object that begins at `start`, tracking string
 * state so that braces inside string values are ignored. Returns the index of
 * the matching close brace (inclusive), or -1 when it is unbalanced.
 *
 * @note this runs over the raw source with comment prefixes still present;
 * those characters are neither braces nor quotes, so they do not affect the
 * scan. They are removed afterwards by {@link stripCommentPrefixes}.
 */
function findBalancedObjectEnd(input: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < input.length; i++) {
    const char = input[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--

      if (depth === 0) {
        return i
      }
    }
  }

  return -1
}

/**
 * Extracts the raw JSON text of the `@schema` block from a code string, with
 * comment prefixes stripped. Returns null when there is no `@schema` marker or
 * no balanced object follows it.
 */
export function extractSchemaSource(code: string): string | null {
  const markerIndex = code.indexOf(SCHEMA_MARKER)

  if (markerIndex === -1) {
    return null
  }

  const afterMarker = markerIndex + SCHEMA_MARKER.length
  const start = code.indexOf('{', afterMarker)

  if (start === -1) {
    return null
  }

  // @note only whitespace and comment characters may sit between the marker and
  // the opening brace. Otherwise the brace belongs to the code body (e.g. a
  // function block) rather than to a schema block.

  if (!/^[\s*#/]*$/.test(code.slice(afterMarker, start))) {
    return null
  }

  const end = findBalancedObjectEnd(code, start)

  if (end === -1) {
    return null
  }

  return stripCommentPrefixes(code.slice(start, end + 1))
}

/**
 * Extracts the declared input schema from a code function.
 *
 * The schema is read from an embedded `@schema { ... }` block (see
 * {@link SCHEMA_MARKER}) without executing the code. Returns null when no
 * schema is declared; throws when a marker is present but its block is not a
 * valid JSON object, so authors get feedback on a malformed declaration.
 *
 * @throws {UserInputError} When an `@schema` block is present but unparseable.
 */
export function extractCodeSchema(code: string): JsonSchema | null {
  const source = extractSchemaSource(code)

  if (source === null) {
    // @note a bare marker with no readable object is treated as a mistake
    // rather than "no schema", so the author is told their block is broken.

    if (code.includes(SCHEMA_MARKER)) {
      throw new UserInputError(
        `Found a ${SCHEMA_MARKER} marker but could not read a JSON object after it`
      )
    }

    return null
  }

  // @note strict parse: a schema is a validation/contract boundary, so a
  // malformed block is reported rather than silently repaired into something
  // the author did not intend.

  const parsed = tryParse(source)

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new UserInputError(
      `The ${SCHEMA_MARKER} block is not a valid JSON object`
    )
  }

  return parsed as JsonSchema
}

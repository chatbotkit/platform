import { JSONPath } from 'jsonpath-plus'

/**
 * Evaluates a JSONPath expression against a JSON object
 */
export function jsonpath(
  path: string,
  json: Record<string, unknown> | unknown[]
): unknown {
  return JSONPath({ path, json, wrap: false })
}

export default jsonpath

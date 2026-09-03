import _jmespath from 'jmespath'

/**
 * Evaluates a JMESPath expression against a JSON object
 */
export function jmespath(
  path: string,
  json: Record<string, unknown> | unknown[]
): unknown {
  return _jmespath.search(json, path)
}

export default jmespath

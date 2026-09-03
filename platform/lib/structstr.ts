import { omit } from '@/lib/object'
import { throwBadRequest } from '@/lib/response'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Config = Record<string, any>

export interface ParseResult {
  name: string
  config: Config
}

/**
 * Escapes forward slashes in input string
 */
export function escape(input: string): string {
  return input.toString().replace(/\//gi, '%2F')
}

/**
 * Unescapes forward slashes in input string
 */
export function unescape(input: string): string {
  return input.toString().replace(/%2F/gi, '/')
}

/**
 * Parses structured string into name and config object
 */
export function parse(input: string, defaultInput?: string): ParseResult {
  input = input || defaultInput || ''

  let name: string
  let config: Config

  if (input.startsWith('{')) {
    try {
      const { name: _name, config: _config, ...rest } = JSON.parse(input)

      name = _name
      config = omit({ ...rest, ..._config }, [''], Infinity)
    } catch {
      return throwBadRequest(`Invalid syntax`)
    }
  } else if (input.indexOf('/') > 0) {
    const [_name, ...props] = input.split('/')

    name = unescape(_name)
    config = {}

    for (const prop of props) {
      const [_propName = '', ..._propValues] = prop.split('=')

      const propName = unescape(_propName)
      const propValue = unescape(_propValues.join('='))

      if (!propName) {
        continue
      }

      switch (true) {
        case propValue && propValue && !isNaN(Number(propValue)):
          config[propName] = parseFloat(propValue)

          break

        case propValue === 'true':
          config[propName] = true

          break

        case propValue === 'false':
          config[propName] = false

          break

        default:
          config[propName] = propValue

          break
      }
    }
  } else {
    name = input
    config = {}
  }

  return {
    name: name,

    config: {
      ...config,
    },
  }
}

/**
 * Builds structured string from name and config
 */
export function build(
  name: string,
  config: Config,
  defaultConfig?: Config
): string {
  const parts: string[] = []

  for (const [name, value] of Object.entries(config).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    if (value || value === false || !isNaN(Number(value))) {
      // deliberately use != instead of !==

      if (defaultConfig?.[name] != value) {
        parts.push(`${escape(name)}=${escape(value)}`)
      }
    }
  }

  if (parts.length) {
    return `${escape(name)}/${parts.join('/')}`
  } else {
    return `${escape(name)}`
  }
}

import { ActionName } from '@/lib/action.name'
import { assert } from '@/lib/debug'
import { BracketType, stringifyField } from '@/lib/field'
import { splitTextByTopLevelBlockTypes } from '@/lib/md.split'
import { replace } from '@/lib/object'
import { getRandomId } from '@/lib/string'
import { stringify as stringifyYaml } from '@/lib/yaml'

export type ParsedParams = Record<string, string | number | boolean>

export interface ParsedAction {
  name: ActionName
  params: Record<string, unknown>
  text: string
}

export interface ParsedText {
  stripped: string
  actions: ParsedAction[]
  original: string
}

export interface ActionField {
  type: 'string' | 'number' | 'boolean'
  name: string
  description: string
  required?: boolean
  enum?: string[]
  default?: unknown
  placeholder?: boolean
}

export interface ActionStaticValue {
  $static: string | number | boolean
}

export type ActionFieldValue =
  | string
  | number
  | boolean
  | { $field: ActionField }
  | ActionStaticValue
  | Record<string, unknown>

export interface ActionToStringify {
  name: ActionName
  params: Record<string, unknown> | null | undefined
  text: string | Record<string, ActionFieldValue>
}

export function escape(input: string | number | boolean): string {
  return input.toString().replace(/\//gi, '%2F')
}

export function unescape(input: string | number | boolean): string {
  return input.toString().replace(/%2F/gi, '/')
}

export function parseParams(input: string): ParsedParams {
  const [...props] = input.split('/')

  const params: ParsedParams = {}

  for (const prop of props) {
    const [_propName = '', ..._propValues] = prop.split('=')

    const propName = unescape(_propName)
    const propValue = unescape(_propValues.join('='))

    if (!propName) {
      continue
    }

    switch (true) {
      case propValue && propValue && !isNaN(propValue as unknown as number):
        params[propName] = parseFloat(propValue)

        break

      case propValue === 'true':
        params[propName] = true

        break

      case propValue === 'false':
        params[propName] = false

        break

      default:
        params[propName] = propValue

        break
    }
  }

  return params
}

export function parseText(
  input: string,
  additionalTypes?: ActionName[]
): ParsedText {
  const regex = new RegExp(
    '(^\\s*```(?<type>' +
      Object.values(ActionName)
        .concat(additionalTypes || [])
        .join('|') +
      ')(?:/(?<params>.+))?(?<text>[\\s\\S]*?)(```\\s*$|$))'
  )

  const stripped: string[] = []
  const actions: ParsedAction[] = []

  for (const block of splitTextByTopLevelBlockTypes(input)) {
    if (block.type === 'code') {
      const match = regex.exec(block.block)

      if (match && match.groups) {
        actions.push({
          name: match.groups.type as ActionName,
          params: parseParams(match.groups.params || ''),
          text: match.groups.text.trim(),
        })
      } else {
        stripped.push(block.block)
      }
    } else {
      stripped.push(block.block)
    }
  }

  return {
    stripped: stripped
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n\n')
      .trim(),
    actions: actions,
    original: input,
  }
}

export function stringifyAction(action: ActionToStringify): string {
  const params = Object.entries(action.params || {})
    .map(([key, value]) =>
      value ? `${escape(key)}=${escape(value as string)}` : `${escape(key)}`
    )
    .join('/')

  let text: string

  if (typeof action.text === 'string') {
    text = action.text
  } else {
    // @note collect field placeholders and their stringified representations

    const fieldReplacements: Map<string, string> = new Map()

    // @note collect static value placeholders and their literal values

    const staticReplacements: Map<string, string> = new Map()

    let textWithPlaceholders = replace(
      action.text,
      (value: unknown): boolean => {
        return typeof value === 'object' && value !== null && '$field' in value
      },
      (value: { $field: ActionField }): string => {
        assert(!!value.$field, 'Expected $field property to exist')
        assert(!!value.$field.name, 'Expected $field.name property to exist')

        const placeholderId = getRandomId('__field_')

        // @note use ys operand for strings to properly stringify for YAML
        // @note only include type for non-string types since string is the default

        const operand = [
          value.$field.type !== 'string' ? value.$field.type : '',
          value.$field.type === 'string' ? 'ys' : '',
          value.$field.enum ? `enum<${value.$field.enum.join(',')}>` : '',
          value.$field.default !== undefined
            ? `default<${value.$field.default}>`
            : '',
        ]
          .filter(Boolean)
          .join(' ')

        const stringifiedField = stringifyField({
          type: value.$field.placeholder
            ? BracketType.round
            : BracketType.square,
          name: value.$field.name,
          description: value.$field.description,
          required: value.$field.required ?? false,
          operand,
        })

        fieldReplacements.set(placeholderId, stringifiedField)

        return placeholderId
      }
    )

    // @note replace $static markers with placeholders for post-yaml replacement

    textWithPlaceholders = replace(
      textWithPlaceholders,
      (value: unknown): boolean => {
        return typeof value === 'object' && value !== null && '$static' in value
      },
      (value: { $static: string | number | boolean }): string => {
        const placeholderId = getRandomId('__static_')

        staticReplacements.set(placeholderId, String(value.$static))

        return placeholderId
      }
    )

    // @note stringify the object with placeholders using YAML for readability

    let yamlText = stringifyYaml(textWithPlaceholders, {
      forceQuotes: true,
      quotingType: '"',
    }).trim()

    // @note replace quoted placeholders with unquoted stringified fields

    for (const [placeholderId, stringifiedField] of fieldReplacements) {
      yamlText = yamlText.replace(`"${placeholderId}"`, stringifiedField)
    }

    // @note replace quoted static placeholders with unquoted literal values

    for (const [placeholderId, staticValue] of staticReplacements) {
      yamlText = yamlText.replace(`"${placeholderId}"`, staticValue)
    }

    text = yamlText
  }

  return `\`\`\`${action.name}${params ? '/' + params : ''}\n${text}\n\`\`\``
}

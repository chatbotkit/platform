// @ts-check
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { UserInputError } from '@/lib/error'
import {
  tryParse as tryParseJson,
  tryStringify as tryStringifyJson,
} from '@/lib/json'
import { repair } from '@/lib/json.repair'

// @note you cannot use //g on these regexes because the g flag will make them
// stateful and they will not work as expected when used to test things

export const CURLY_REGEX = /(\$\{|\{\{)([^|:}]+)[|:]?\s*([^}]+)?(\}\}?)/
export const SQUARE_REGEX = /(\$\[|\[\[)([^|:\]]+)[|:]?\s*([^\]]+)?(\]\]?)/
export const ROUND_REGEX = /(\$\(|\(\()([^|:\)]+)[|:]?\s*([^\)]+)?(\)\)?)/

/**
 * Bracket type enum
 *
 * @enum {'curly'|'square'|'round'|'all'}
 */
export const BracketType = {
  curly: /** @type {'curly'} */ ('curly'),
  square: /** @type {'square'} */ ('square'),
  round: /** @type {'round'} */ ('round'),
  all: /** @type {'all'} */ ('all'),
}

/**
 * @typedef {(typeof BracketType)[keyof typeof BracketType]} BracketTypeValue
 */

/**
 * @type {Record<'euc'|'j'|'js'|'y'|'ys'|'dq'|'edq'|'sq'|'esq'|'rn'|'trim', (value: any, field?: Field) => string>}
 */
export const operands = {
  // encode uri component
  euc: (i) => encodeURIComponent(i ?? ''),

  // parse as json
  j: (i) => tryStringifyJson(tryParseJson(repair(i || '{}'))) || '{}',

  // json stringify
  js: (i) => (tryStringifyJson(i) || '""').trim(), // @note if we don't trim it may add new line

  // parse as yaml
  y: (i) => tryStringifyJson(tryParseJson(repair(i || '{}'))) || '{}',

  // yaml stringify
  ys: (i) => (tryStringifyJson(i) || '""').trim(), // @note yaml string can expand to multiple lines so we need to process them as json strings

  // double quote
  dq: (i) => `"${(i ?? '').toString().replace(/"/g, '\\"')}"`,

  // escape double quotes
  edq: (i) => (i ?? '').toString().replace(/"/g, '\\"'),

  // single quote
  sq: (i) => `'${(i ?? '').toString().replace(/'/g, "\\'")}'`,

  // escape single quotes
  esq: (i) => (i ?? '').toString().replace(/'/g, "\\'"),

  // remove new lines
  rn: (i) => (i ?? '').toString().replace(/\n+/g, ' '),

  // trim whitespace
  trim: (i) => (i ?? '').toString().trim(),
}

/**
 * @typedef {{
 *   type: BracketTypeValue,
 *   exact: string,
 *   name: string,
 *   title: string?,
 *   description: string?,
 *   operand: string?,
 *   required: boolean
 * }} Field
 */

/**
 * @param {string} input
 * @param {{bracketType?: BracketTypeValue}} [options]
 * @returns {boolean}
 */
export function isField(input, options) {
  const type = options?.bracketType || BracketType.all

  const matchWholeLine = (regex, input) =>
    new RegExp(`^${regex.source}$`).test(input)

  switch (type) {
    case BracketType.curly: {
      return matchWholeLine(CURLY_REGEX, input)
    }

    case BracketType.square: {
      return matchWholeLine(SQUARE_REGEX, input)
    }

    case BracketType.round: {
      return matchWholeLine(ROUND_REGEX, input)
    }

    case BracketType.all: {
      return (
        matchWholeLine(CURLY_REGEX, input) ||
        matchWholeLine(SQUARE_REGEX, input) ||
        matchWholeLine(ROUND_REGEX, input)
      )
    }
  }

  return false
}

/**
 * @param {string} input
 * @returns {Field}
 */
export function parseField(input) {
  const [field] = extractFields(isField(input) ? input : `{{${input}}}`, {
    bracketType: BracketType.all,
  })

  return field
}

/**
 * @param {Omit<Field,'type'|'title'|'description'|'operand'|'exact'> & {
 *   type: Exclude<BracketTypeValue,'all'> | 'none',
 *   description?: string?,
 *   operand?: string?
 * }} field
 * @return {string}
 */
export function stringifyField(field) {
  let name = field.name

  if (field.required) {
    name = `!${name}`
  }

  if (field.operand) {
    name = `${name} ${field.operand}`
  }

  if (field.description) {
    name = `${name}|${field.description}`
  }

  switch (field.type) {
    case BracketType.curly: {
      name = `\${${name}}`

      break
    }

    case BracketType.square: {
      name = `$[${name}]`

      break
    }

    case BracketType.round: {
      name = `((${name}))`

      break
    }

    case 'none': {
      break
    }

    default: {
      assertUnreachable(field.type)
    }
  }

  return name
}

/**
 * Extracts fields from a string. Fields are defined in multiple formats. The
 * most common format is the double curly braces format: {{FIELD_NAME}}. The
 * other format is the double curly braces format: ${FIELD_NAME}. Fields can
 * also have a description: {{FIELD_NAME:DESCRIPTION}}. The description is
 * optional. The description is used to provide additional information about
 * the field. The field can be required by adding an exclamation mark before
 * or after the field name: {{!FIELD_NAME}} or {{FIELD_NAME!}}. The field can
 * have an operand by adding a qualifier after the field name.
 *
 * @param {string} input
 * @param {{
 *   bracketType?: BracketTypeValue,
 *   sort?: boolean,
 *   unique?: boolean
 * }} [options]
 * @returns {Field[]}
 */
export function extractFields(input, options) {
  if (options?.bracketType === BracketType.all) {
    const fields = []

    for (const bracketType of Object.values(BracketType)) {
      if (bracketType === BracketType.all) {
        continue
      }

      const extractedFields = extractFields(input, { ...options, bracketType })

      fields.push(...extractedFields)

      for (const field of extractedFields) {
        input = input.replace(field.exact, '')
      }
    }

    return fields
  }

  const type = options?.bracketType || BracketType.curly

  const regex = {
    [BracketType.curly]: new RegExp(CURLY_REGEX.source, 'g'),
    [BracketType.square]: new RegExp(SQUARE_REGEX.source, 'g'),
    [BracketType.round]: new RegExp(ROUND_REGEX.source, 'g'),
  }[type]

  let fields = []

  while (true) {
    const match = regex.exec(input)

    if (!match) {
      break
    }

    let [naming, ...qualifiers] = (match[2]?.trim() || '').split(' ')

    const qualifier = qualifiers
      .map((q) => q.trim())
      .filter(Boolean)
      .join(' ')

    const exact = match[0]

    const name = naming.replace(/^[!?]+|[!?]+$/g, '')

    const title = match[3]?.trim() || null
    const description = match[3]?.trim() || null

    const operand = qualifier?.trim() || null

    const required = /^!|!$/.test(naming)

    if (name) {
      fields.push({ type, exact, name, title, description, operand, required })
    }
  }

  if (options?.sort) {
    // we sort the fields with description to be first in the list

    fields.sort((a, b) => {
      if (a.description && !b.description) {
        return -1
      }

      if (!a.description && b.description) {
        return 1
      }

      return 0
    })
  }

  if (options?.unique) {
    // we remove duplicates

    fields = fields.filter((field, index, self) => {
      return self.findIndex((f) => f.name === field.name) === index
    })
  }

  return fields
}

/**
 * Substitutes fields in a string. Fields are defined in multiple formats. For
 * more information see the extractFields function.
 *
 * @param {string} input
 * @param {Record<string,any>} substitutions
 * @param {{
 *   bracketType?: BracketTypeValue,
 *   sort?: boolean,
 *   defaults?: boolean,
 *   validate?: boolean,
 *   op?: (value: string, field: Field) => string
 * }} [options]
 * @returns {string}
 * @throws {UserInputError}
 */
export function substituteFields(input, substitutions, options) {
  // @note do NOT use unique:true - we need all field occurrences to process
  // each one individually with its specific operands applied

  const fields = extractFields(input, options)

  for (const field of fields) {
    if (substitutions.hasOwnProperty(field.name)) {
      let replacement = substitutions[field.name]

      if (typeof replacement === 'function') {
        replacement = replacement(field, {
          input,
          substitutions,
          options,
          fields,
        })
      }

      if (options?.defaults) {
        replacement = replacement ?? getFieldValueDefault(field) ?? undefined
      }

      if (options?.validate) {
        if (field.required && replacement === undefined) {
          throw new UserInputError(
            `Required field "${field.name}" missing in the input.`
          )
        }
      }

      const specialOperands = ['enum', 'sanitize'] // @note must appear first in the operands list in the same order as in this array

      const parsedOperands = (field.operand || '')
        .split(/(\w+\<.+?\>)|(\w+\[.+?\])|(\w+\{.+?\})|(\w+\(.+?\))|\s+|>+|,+/)
        .map((o) => o?.trim?.())
        .filter(Boolean)
        .sort((a, b) => {
          const aName = a?.split(/\W/)[0]?.trim()
          const bName = b?.split(/\W/)[0]?.trim()

          const aIndex = specialOperands.indexOf(aName)
          const bIndex = specialOperands.indexOf(bName)

          if (aIndex !== -1 && bIndex !== -1) {
            // both are special operands, sort by their order in specialOperands

            return aIndex - bIndex
          } else if (aIndex !== -1) {
            // a is special, b is not

            return -1
          } else if (bIndex !== -1) {
            // b is special, a is not

            return 1
          } else {
            // neither is special, preserve original order

            return 0
          }
        })

      for (let operand of parsedOperands) {
        let optional

        {
          if (operand.startsWith('?')) {
            optional = true
            operand = operand.slice(1)
          } else if (operand.endsWith('?')) {
            optional = true
            operand = operand.slice(0, -1)
          } else {
            optional = false
          }
        }

        const niceOperandName = operand.split(/\W/)[0]?.trim()

        if (specialOperands.includes(niceOperandName)) {
          const specialOp =
            {
              enum: (i, field) => {
                if (options?.validate) {
                  if (i !== undefined) {
                    const values = getFieldValueEnum(field)

                    if (values?.length) {
                      if (!values.includes(i)) {
                        throw new UserInputError(
                          `Value "${i}" is not in the enum for field "${field.name}".`
                        )
                      }
                    }
                  }
                }

                return i
              },

              sanitize: (i, field) => {
                if (i === undefined || i === null) {
                  return i
                }

                const regexPattern = getFieldSanitizePattern(field)

                if (regexPattern) {
                  try {
                    const regex = new RegExp(regexPattern, 'g')

                    return i.toString().replace(regex, '')
                  } catch {
                    // @note invalid regex pattern - return original value

                    return i
                  }
                }

                return i
              },
            }[operand.split(/\W/)[0]?.trim()] || ((i) => i ?? '')

          replacement = specialOp(replacement, field)
        }

        const op = options?.op || operands[operand] || ((i) => i ?? '')

        if (optional) {
          if (replacement) {
            replacement = op(replacement, field)
          } else {
            replacement = ''
          }
        } else {
          replacement = op(replacement, field)
        }
      }

      // @note replace one occurrence at a time - extractFields returns each
      // field instance individually (not deduplicated by default), so we
      // process them in order with their specific operands applied

      input = input.replace(field.exact, replacement ?? '')
    }
  }

  return input
}

/**
 * Simplifies the fields by keeping only the field names and removing operands
 * and descriptions.
 *
 * @param {string} input
 * @param {{
 *   bracketType?: BracketTypeValue
 * }} [options]
 * @returns {string}
 */
export function simplifyFields(input, options) {
  const fields = extractFields(input, options)

  const substitutions = Object.fromEntries(
    fields.map(({ name }) => [name, `{${name}}`])
  )

  return substituteFields(input, substitutions, options)
}

/**
 * @param {Partial<Field>} field
 * @returns {boolean}
 */
export function isLocalField(field) {
  switch (true) {
    case /\blocal\b/i.test(field.operand || ''): {
      return true
    }

    default: {
      return false
    }
  }
}

/**
 * @param {Partial<Field>} field
 * @returns {'boolean'|'number'|'string'}
 */
export function getFieldValueType(field) {
  switch (true) {
    case /\bbool(?:ean)?\b/i.test(field.operand || ''): {
      return 'boolean'
    }

    case /\bnum(?:ber)?\b/i.test(field.operand || ''): {
      return 'number'
    }

    default: {
      return 'string'
    }
  }
}

/**
 * @param {Partial<Field>} field
 * @returns {any[]|undefined}
 */
export function getFieldValueEnum(field) {
  const match = field.operand?.match(
    /(?:^|\s)enum(\{.*?\}|\[.*?\]|\(.*?\)|\<.*?\>)(?:\s|$)/
  )

  if (match) {
    const type = getFieldValueType(field)
    const value = match[1].slice(1, -1)

    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => {
        switch (type) {
          case 'boolean': {
            return item === 'true'
          }

          case 'number': {
            return parseFloat(item)
          }

          case 'string': {
            return item
          }

          default: {
            assertUnreachable(type)
          }
        }
      })
  }
}

/**
 * @param {Partial<Field>} field
 * @returns {number|undefined}
 */
export function getFieldValueMin(field) {
  const match = field.operand?.match(
    /(?:^|\s)min(\{.*?\}|\[.*?\]|\(.*?\)|\<.*?\>)(?:\s|$)/
  )

  if (match) {
    const value = match[1].slice(1, -1)

    return parseFloat(value)
  }
}

/**
 * @param {Partial<Field>} field
 * @returns {number|undefined}
 */
export function getFieldValueMax(field) {
  const match = field.operand?.match(
    /(?:^|\s)max(\{.*?\}|\[.*?\]|\(.*?\)|\<.*?\>)(?:\s|$)/
  )

  if (match) {
    const value = match[1].slice(1, -1)

    return parseFloat(value)
  }
}

/**
 * @param {Partial<Field>} field
 * @returns {any}
 */
export function getFieldValueDefault(field) {
  const match = field.operand?.match(
    /(?:^|\s)default(\{.*?\}|\[.*?\]|\(.*?\)|\<.*?\>)(?:\s|$)/
  )

  if (match) {
    const type = getFieldValueType(field)
    const value = match[1].slice(1, -1)

    switch (type) {
      case 'boolean': {
        return value === 'true'
      }

      case 'number': {
        return parseFloat(value)
      }

      case 'string': {
        return value
      }

      default: {
        assertUnreachable(type)
      }
    }
  }
}

/**
 * @param {Partial<Field>} field
 * @returns {any}
 */
export function getFieldFormatDefault(field) {
  const match = field.operand?.match(
    /(?:^|\s)format(\{.*?\}|\[.*?\]|\(.*?\)|\<.*?\>)(?:\s|$)/
  )

  if (match) {
    const value = match[1].slice(1, -1)

    return value
  }
}

/**
 * @param {Partial<Field>} field
 * @returns {string|undefined}
 */
export function getFieldSanitizePattern(field) {
  const match = field.operand?.match(
    /(?:^|\s)sanitize(\{.*?\}|\[.*?\]|\(.*?\)|\<.*?\>)(?:\s|$)/
  )

  if (match) {
    const value = match[1].slice(1, -1)

    return value
  }
}

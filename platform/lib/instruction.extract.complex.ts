import { isSpecialField } from '@/lib/ability.fields'
import debug from '@/lib/debug'
import {
  BracketType,
  extractFields,
  getFieldValueDefault,
  getFieldValueEnum,
  getFieldValueType,
  substituteFields,
} from '@/lib/field'

interface ExtractedField {
  type: 'curly' | 'square' | 'round'
  exact: string
  name: string
  title: string | null
  description: string | null
  operand: string | null
  required: boolean
}

export interface FieldSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'reference'
  description?: string
  required?: boolean
  default?: unknown
  enum?: unknown[]
  placeholder?: boolean
  items?: FieldSchema
  properties?: Record<string, FieldSchema>
  min?: number
  max?: number
  local?: boolean
}

/**
 * Extracts parameter fields from a complex instruction and returns them as
 * JSON Schema compatible definitions.
 *
 * Complex instructions use the same bracket notation as simple instructions:
 * - Square brackets ($[field], [[field]]) - AI-populated fields
 * - Curly brackets (${field}, {{field}}) - Reference fields (secrets, metadata)
 * - Round brackets (((field))) - Placeholder fields (template parameters)
 *
 * Special fields (SECRET_, USER_, EARTH_, etc.) in curly brackets are
 * excluded as they are resolved at action execution time.
 */
export function extractComplexInstructionFields(
  instruction: string
): FieldSchema[] {
  debug(`extracting fields from complex instruction`, { instruction }).log(
    'instruction.complex.extractComplexInstructionFields'
  )

  const rawFields = extractFields(instruction, { bracketType: BracketType.all })

  // @note filter out special fields in curly brackets - they are resolved at action execution time

  const fields = rawFields
    .filter(({ type, name }) => {
      if (type === BracketType.curly) {
        return !isSpecialField(name)
      }

      return true
    })
    .map((field: ExtractedField) => {
      // @note get the type from operand if specified

      const valueType = getFieldValueType(field)

      const schema: FieldSchema = {
        name: field.name,
        type: valueType,
      }

      // @note set description from field definition

      if (field.description) {
        schema.description = field.description
      }

      // @note set required flag

      if (field.required) {
        schema.required = true
      }

      // @note set default value if specified in operand

      const defaultValue = getFieldValueDefault(field)

      if (defaultValue !== undefined) {
        schema.default = defaultValue
      }

      // @note set enum values if specified in operand

      const enumValues = getFieldValueEnum(field)

      if (enumValues) {
        schema.enum = enumValues
      }

      // @note set placeholder flag for round bracket fields (template parameters)

      if (field.type === BracketType.round) {
        schema.placeholder = true
      }

      // @note set reference flag for curly bracket fields (should have been filtered already, but just in case)

      if (field.type === BracketType.curly) {
        if (isSpecialField(field.name)) {
          schema.type = 'reference'
        }
      }

      return schema
    })

  debug(`extracted fields from complex instruction`, { fields }).log(
    'instruction.complex.extractComplexInstructionFields'
  )

  return fields
}

/**
 * Substitutes field values into a complex instruction string.
 *
 * Uses bracket-based substitution to replace field placeholders with their
 * resolved values.
 *
 * @param instruction - The instruction string to substitute into
 * @param fieldValues - Map of field names to their resolved values
 * @returns The instruction with field values substituted
 */
export function substituteComplexInstructionFields(
  instruction: string,
  fieldValues: Record<string, unknown>
): string {
  debug(`substituting fields in complex instruction`, {
    instruction,
    fieldValues,
  }).log('instruction.complex.substituteComplexInstructionFields')

  const result = substituteFields(
    instruction,
    fieldValues as Record<string, string>,
    {
      bracketType: BracketType.round,
      validate: false,
      defaults: true,
    }
  )

  debug(`substituted fields in complex instruction`, { result }).log(
    'instruction.complex.substituteComplexInstructionFields'
  )

  return result
}

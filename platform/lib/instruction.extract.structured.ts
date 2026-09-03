import {
  extractFields,
  substituteFields as substituteActionFields,
} from '@/lib/action.tags'
import { debug } from '@/lib/debug'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any

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
 * Infers the type of a nested field from its structure when type is not set.
 * This is used for items in arrays and properties in objects, which don't
 * have explicit YAML tags.
 */
function inferNestedFieldType(
  field: unknown
): 'string' | 'number' | 'boolean' | 'array' | 'object' {
  // @note infer type from structure

  if (typeof field === 'object' && field !== null && 'items' in field) {
    return 'array'
  }

  if (typeof field === 'object' && field !== null && 'properties' in field) {
    return 'object'
  }

  // @note infer from default value type

  if (
    typeof field === 'object' &&
    field !== null &&
    'default' in field &&
    typeof (field as { default: unknown }).default === 'boolean'
  ) {
    return 'boolean'
  }

  if (
    typeof field === 'object' &&
    field !== null &&
    'default' in field &&
    typeof (field as { default: unknown }).default === 'number'
  ) {
    return 'number'
  }

  // @note default to string

  return 'string'
}

/**
 * Converts a raw field from extractFields into a FieldSchema.
 */
function convertField(field: Any): FieldSchema {
  // @note use explicit type if provided (from YAML tag), otherwise infer for nested fields

  const type = field.type || inferNestedFieldType(field)

  const schema: FieldSchema = {
    name: field.name,
    type,
  }

  // @note set description from field definition

  if (field.description) {
    schema.description = field.description
  }

  // @note fields are required by default (optional: false), so we set
  // required: true when the field is not explicitly marked as optional

  if (!field.optional) {
    schema.required = true
  }

  // @note set default value if provided

  if (field.default !== undefined) {
    schema.default = field.default
  }

  // @note set enum values if provided

  if ('enum' in field && field.enum) {
    schema.enum = field.enum
  }

  // @note set min and max for number type if provided

  if (field.min !== undefined) {
    schema.min = field.min
  }

  if (field.max !== undefined) {
    schema.max = field.max
  }

  // @note set placeholder flag if provided

  if (field.placeholder) {
    schema.placeholder = true
  }

  // @note recursively convert items for array fields

  if ('items' in field && field.items) {
    schema.items = convertField(field.items)
  }

  // @note recursively convert properties for object fields

  if ('properties' in field && field.properties) {
    const properties: Record<string, FieldSchema> = {}

    for (const [key, value] of Object.entries(field.properties)) {
      properties[key] = convertField(value)
    }

    schema.properties = properties
  }

  return schema
}

/**
 * Extracts parameter fields from a structured instruction and returns them as
 * JSON Schema compatible definitions.
 *
 * Structured instructions use YAML tags to define fields with rich metadata:
 * - !string, !number, !boolean - Primitive field types with name, description, etc.
 * - !array - Array fields with items schema
 * - !object - Object fields with properties schema
 * - !reference - Reference fields (e.g., secrets, metadata) with type: 'reference'
 */
export function extractStructuredInstructionFields(
  instruction: string
): FieldSchema[] {
  debug(`extracting fields from structured instruction`, { instruction }).log(
    'instruction.structured.extractStructuredInstructionFields'
  )

  const rawFields = extractFields(instruction)

  const fields = rawFields.map((field) => convertField(field))

  debug(`extracted fields from structured instruction`, { fields }).log(
    'instruction.structured.extractStructuredInstructionFields'
  )

  return fields
}

/**
 * Substitutes field values into a structured instruction string.
 *
 * Uses YAML tag-based substitution to replace field tags (!string, !number, etc.)
 * with their resolved values.
 *
 * @param instruction - The instruction string to substitute into
 * @param fieldValues - Map of field names to their resolved values
 * @returns The instruction with field values substituted
 */
export function substituteStructuredInstructionFields(
  instruction: string,
  fieldValues: Record<string, unknown>
): string {
  debug(`substituting fields in structured instruction`, {
    instruction,
    fieldValues,
  }).log('instruction.structured.substituteStructuredInstructionFields')

  const result = substituteActionFields(instruction, fieldValues, {})

  debug(`substituted fields in structured instruction`, { result }).log(
    'instruction.structured.substituteStructuredInstructionFields'
  )

  return result
}

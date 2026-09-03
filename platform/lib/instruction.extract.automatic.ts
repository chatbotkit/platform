import debug from '@/lib/debug'

/**
 * JSON Schema compatible field definition.
 */
export type FieldSchema = {
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
 * Extracts parameter fields from an automatic instruction and returns them as
 * JSON Schema compatible definitions.
 *
 * @note Returns an empty array as automatic instructions do not support field extraction yet.
 */
export function extractAutomaticInstructionFields(
  instruction: string
): FieldSchema[] {
  debug(`extracting fields from automatic instruction`, { instruction }).log(
    'instruction.automatic.extractAutomaticInstructionFields'
  )

  return []
}

/**
 * Substitutes field values into an automatic instruction string.
 *
 * @note Returns the instruction unchanged as automatic instructions
 * do not support field substitution yet.
 *
 * @param instruction - The instruction string to substitute into
 * @param fieldValues - Map of field names to their resolved values
 * @returns The instruction unchanged
 */
export function substituteAutomaticInstructionFields(
  instruction: string,
  fieldValues: Record<string, unknown>
): string {
  debug(`substituting fields in automatic instruction`, {
    instruction,
    fieldValues,
  }).log('instruction.automatic.substituteAutomaticInstructionFields')

  // @note automatic instructions don't support substitution yet
  return instruction
}

// @todo add @manual documentation for automatic instructions once this instruction type is fully implemented

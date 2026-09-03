import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import debug from '@/lib/debug'
import {
  extractAutomaticInstructionFields,
  substituteAutomaticInstructionFields,
} from '@/lib/instruction.extract.automatic'
import {
  extractComplexInstructionFields,
  substituteComplexInstructionFields,
} from '@/lib/instruction.extract.complex'
import {
  extractSimpleInstructionFields,
  substituteSimpleInstructionFields,
} from '@/lib/instruction.extract.simple'
import {
  extractStructuredInstructionFields,
  substituteStructuredInstructionFields,
} from '@/lib/instruction.extract.structured'
import {
  extractTemplateInstructionFields,
  substituteTemplateInstructionFields,
} from '@/lib/instruction.extract.template'
import type { InstructionType } from '@/lib/instruction.type'
import { getInstructionType } from '@/lib/instruction.type'

/**
 * JSON Schema compatible field definition extracted from an instruction.
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
 * Extracts parameter fields from an instruction and returns them as
 * JSON Schema compatible definitions.
 *
 * This function automatically detects the instruction type (simple, complex,
 * template, or automatic) and delegates to the appropriate extraction function.
 *
 * Field types by bracket notation:
 * - Square brackets ($[field], [[field]]) - AI-populated fields
 * - Curly brackets (${field}, {{field}}) - Reference fields (secrets, metadata)
 * - Round brackets (((field))) - Placeholder fields (template parameters)
 *
 * Special fields (SECRET_, USER_, EARTH_, etc.) in curly brackets are
 * excluded as they are resolved at action execution time.
 *
 * @param instruction - The instruction string to extract fields from
 * @returns Array of field definitions with JSON Schema compatible properties
 */
export function extractInstructionFields(instruction: string): FieldSchema[] {
  if (!instruction) {
    return []
  }

  const instructionType = getInstructionType(instruction)

  debug(`extracting fields from instruction`, {
    instruction,
    instructionType,
  }).log('instruction.extract.extractInstructionFields')

  return extractInstructionFieldsByType(instruction, instructionType)
}

/**
 * Extracts parameter fields from an instruction given an explicit instruction type.
 *
 * Use this function when you already know the instruction type and want to
 * avoid the overhead of type detection.
 *
 * @param instruction - The instruction string to extract fields from
 * @param instructionType - The type of instruction (simple, complex, template, automatic)
 * @returns Array of field definitions with JSON Schema compatible properties
 */
export function extractInstructionFieldsByType(
  instruction: string,
  instructionType: InstructionType
): FieldSchema[] {
  debug(`extracting fields by type`, { instruction, instructionType }).log(
    'instruction.extract.extractInstructionFieldsByType'
  )

  switch (instructionType) {
    case 'template': {
      return extractTemplateInstructionFields(instruction)
    }

    case 'structured': {
      return extractStructuredInstructionFields(instruction)
    }

    case 'simple': {
      return extractSimpleInstructionFields(instruction)
    }

    case 'complex': {
      return extractComplexInstructionFields(instruction)
    }

    case 'automatic': {
      return extractAutomaticInstructionFields(instruction)
    }

    default: {
      assertUnreachable(instructionType)
    }
  }
}

/**
 * Substitutes field values into an instruction string.
 *
 * This function automatically detects the instruction type (simple, complex,
 * template, structured, or automatic) and delegates to the appropriate
 * substitution function.
 *
 * @param instruction - The instruction string to substitute into
 * @param fieldValues - Map of field names to their resolved values
 * @returns The instruction with field values substituted
 */
export function substituteInstructionFields(
  instruction: string,
  fieldValues: Record<string, unknown>
): string {
  const instructionType = getInstructionType(instruction)

  debug(`substituting fields in instruction`, {
    instruction,
    instructionType,
    fieldValues,
  }).log('instruction.field.substituteInstructionFields')

  return substituteInstructionFieldsByType(
    instruction,
    instructionType,
    fieldValues
  )
}

/**
 * Substitutes field values into an instruction given an explicit instruction type.
 *
 * Use this function when you already know the instruction type and want to
 * avoid the overhead of type detection.
 *
 * @param instruction - The instruction string to substitute into
 * @param instructionType - The type of instruction (simple, complex, template, structured, automatic)
 * @param fieldValues - Map of field names to their resolved values
 * @returns The instruction with field values substituted
 */
export function substituteInstructionFieldsByType(
  instruction: string,
  instructionType: InstructionType,
  fieldValues: Record<string, unknown>
): string {
  debug(`substituting fields by type`, {
    instruction,
    instructionType,
    fieldValues,
  }).log('instruction.field.substituteInstructionFieldsByType')

  switch (instructionType) {
    case 'template': {
      return substituteTemplateInstructionFields(instruction, fieldValues)
    }

    case 'structured': {
      return substituteStructuredInstructionFields(instruction, fieldValues)
    }

    case 'simple': {
      return substituteSimpleInstructionFields(instruction, fieldValues)
    }

    case 'complex': {
      return substituteComplexInstructionFields(instruction, fieldValues)
    }

    case 'automatic': {
      return substituteAutomaticInstructionFields(instruction, fieldValues)
    }

    default: {
      assertUnreachable(instructionType)
    }
  }
}

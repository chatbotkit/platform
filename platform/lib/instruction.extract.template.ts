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
  isTemplateField,
  parseTemplateInstruction,
} from '@/lib/instruction.template.parse'
import { unpackTemplateInstruction } from '@/lib/instruction.template.unpack'
import { getInstructionType } from '@/lib/instruction.type'

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
 * Extracts parameter fields from a template instruction and returns them as
 * JSON Schema compatible definitions.
 *
 * This function:
 * 1. Parses the template reference and parameters
 * 2. Unpacks the underlying instruction from the template catalog
 * 3. Recursively extracts fields from the underlying instruction
 * 4. Filters out fields that are already filled by template parameters
 */
export function extractTemplateInstructionFields(
  instruction: string
): FieldSchema[] {
  debug(`extracting fields from template instruction`, { instruction }).log(
    'instruction.template.extractTemplateInstructionFields'
  )

  const { template, parameters } = parseTemplateInstruction(instruction)

  debug(`parsed template instruction`, {
    instruction,
    template,
    parameters,
  }).log('instruction.template.extractTemplateInstructionFields')

  const templateInstance = unpackTemplateInstruction(template)

  debug(`unpacked template instruction`, {
    template,
    templateInstance,
  }).log('instruction.template.extractTemplateInstructionFields')

  if (!templateInstance) {
    debug(`template not found: ${template}`).log(
      'instruction.template.extractTemplateInstructionFields'
    )

    return []
  }

  const underlyingInstruction = templateInstance.instruction

  // @note get the type of the underlying instruction to use the appropriate extractor

  const instructionType = getInstructionType(underlyingInstruction)

  debug(`underlying instruction type`, { instructionType }).log(
    'instruction.template.extractTemplateInstructionFields'
  )

  let fields: FieldSchema[] = []

  switch (instructionType) {
    case 'template': {
      fields = extractTemplateInstructionFields(underlyingInstruction)

      break
    }

    case 'complex': {
      fields = extractComplexInstructionFields(underlyingInstruction)

      break
    }

    case 'simple': {
      fields = extractSimpleInstructionFields(underlyingInstruction)

      break
    }

    case 'structured': {
      fields = extractStructuredInstructionFields(underlyingInstruction)

      break
    }

    case 'automatic': {
      fields = extractAutomaticInstructionFields(underlyingInstruction)

      break
    }

    default: {
      assertUnreachable(instructionType)
    }
  }

  // @note filter out fields that are already provided by template parameters
  // A parameter is considered "filled" if:
  // - It has a non-empty, non-null, non-undefined value
  // - It is NOT itself a field definition (field definitions get passed through)

  const filledParamNames = Object.entries(parameters)
    .filter(
      ([, value]) =>
        value !== '' &&
        value !== null &&
        value !== undefined &&
        !isTemplateField(value)
    )
    .map(([key]) => key)

  const filteredFields = fields.filter(
    (field) => !filledParamNames.includes(field.name)
  )

  debug(`extracted fields from template instruction`, {
    allFields: fields,
    filledParamNames,
    filteredFields,
  }).log('instruction.template.extractTemplateInstructionFields')

  return filteredFields
}

/**
 * Substitutes field values into a template instruction string.
 *
 * This function:
 * 1. Parses the template reference and parameters
 * 2. Unpacks the underlying instruction from the template catalog
 * 3. Uses the appropriate substitute function based on the underlying instruction type
 *
 * @param instruction - The template instruction string to substitute into
 * @param fieldValues - Map of field names to their resolved values
 * @returns The template instruction with field values substituted
 */
export function substituteTemplateInstructionFields(
  instruction: string,
  fieldValues: Record<string, unknown>
): string {
  debug(`substituting fields in template instruction`, {
    instruction,
    fieldValues,
  }).log('instruction.template.substituteTemplateInstructionFields')

  const { template, parameters } = parseTemplateInstruction(instruction)

  debug(`parsed template instruction`, {
    instruction,
    template,
    parameters,
  }).log('instruction.template.substituteTemplateInstructionFields')

  const templateInstance = unpackTemplateInstruction(template)

  debug(`unpacked template instruction`, {
    template,
    templateInstance,
  }).log('instruction.template.substituteTemplateInstructionFields')

  if (!templateInstance) {
    debug(`template not found: ${template}`).log(
      'instruction.template.substituteTemplateInstructionFields'
    )

    return instruction
  }

  const underlyingInstruction = templateInstance.instruction

  const instructionType = getInstructionType(underlyingInstruction)

  debug(`underlying instruction type`, { instructionType }).log(
    'instruction.template.substituteTemplateInstructionFields'
  )

  // @note template parameters take precedence over field values

  const mergedValues = { ...fieldValues }

  for (const [key, value] of Object.entries(parameters)) {
    if (
      value !== '' &&
      value !== null &&
      value !== undefined &&
      !isTemplateField(value)
    ) {
      mergedValues[key] = value
    }
  }

  let result: string

  switch (instructionType) {
    case 'template': {
      result = substituteTemplateInstructionFields(
        underlyingInstruction,
        mergedValues
      )

      break
    }

    case 'complex': {
      result = substituteComplexInstructionFields(
        underlyingInstruction,
        mergedValues
      )

      break
    }

    case 'simple': {
      result = substituteSimpleInstructionFields(
        underlyingInstruction,
        mergedValues
      )

      break
    }

    case 'structured': {
      result = substituteStructuredInstructionFields(
        underlyingInstruction,
        mergedValues
      )

      break
    }

    case 'automatic': {
      result = substituteAutomaticInstructionFields(
        underlyingInstruction,
        mergedValues
      )

      break
    }

    default: {
      assertUnreachable(instructionType)
    }
  }

  debug(`substituted fields in template instruction`, { result }).log(
    'instruction.template.substituteTemplateInstructionFields'
  )

  return result
}

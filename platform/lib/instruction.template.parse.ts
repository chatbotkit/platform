import {
  ACTION_TAGS_SCHEMA,
  BaseField,
  type TagFieldValue,
} from '@/lib/action.tags'
import debug from '@/lib/debug'
import { isField } from '@/lib/field'
import {
  stringify as stringifyYaml,
  tryParse as tryParseYaml,
} from '@/lib/yaml'

/**
 * Re-export BaseField and TagFieldValue for use in type annotations
 */
export { BaseField, type TagFieldValue }

/**
 * Types and functions for parsing and building template instructions
 */
interface TemplateInstruction {
  template: string
  parameters: Record<string, unknown>
}

/**
 * The interface represents the possible structure of a parsed YAML instruction.
 */
interface ParsedYAMLInstruction {
  template?: unknown

  properties?: unknown
  props?: unknown

  parameters?: unknown
  params?: unknown

  _?: unknown
}

/**
 * The function parses a template instruction by extracting the template and the
 * parameters from the instruction. The instruction can be a single line
 * instruction or a yaml document.
 */
export function parseTemplateInstruction(
  instruction: string
): TemplateInstruction {
  debug(`parse template instruction`, { instruction })

  instruction = instruction.trim()

  if (instruction.startsWith('@') && instruction.indexOf('\n') === -1) {
    return { template: instruction.slice(1).trim(), parameters: {} }
  }

  const parsed = (tryParseYaml(instruction, {
    // @note use ACTION_TAGS_SCHEMA to support field tags
    schema: ACTION_TAGS_SCHEMA,
  }) || {}) as ParsedYAMLInstruction

  const {
    template: _template = '',

    properties: _properties = {},
    props: _props = _properties,

    parameters: _parameters = {},
    params: _params = _parameters,

    _: _parameters_final = _params || _props || {},
  } = parsed

  const template = typeof _template === 'string' ? _template : ''

  const parameters =
    typeof _parameters_final === 'object' && _parameters_final !== null
      ? (_parameters_final as Record<string, unknown>)
      : {}

  return { template, parameters }
}

interface TemplateConfig {
  template: string

  params?: Record<string, unknown>
}

/**
 * The opposite of parseTemplateInstruction. The function takes a template and
 * a set of parameters and returns a string representation of the instruction.
 */
export function buildTemplateInstruction(template: TemplateConfig): string {
  return stringifyYaml(template, {
    // @note use ACTION_TAGS_SCHEMA to properly serialize field instances back to yaml tags
    schema: ACTION_TAGS_SCHEMA,
  })
}

/**
 * Checks if a given value is a bracket field (e.g., ((fieldName)))
 * Acts as a type guard narrowing to string
 */
export function isBracketField(value: unknown): value is string {
  return typeof value === 'string' && isField(value)
}

/**
 * Checks if a given value is a tag field (e.g., !string, !number, etc.)
 * Acts as a type guard narrowing to BaseField<TagFieldValue>
 */
export function isTagField(value: unknown): value is BaseField<TagFieldValue> {
  return value instanceof BaseField
}

/**
 * Checks if a given parameter value is a field (either regular or action tag)
 */
export function isTemplateField(value: unknown): boolean {
  return isBracketField(value) || isTagField(value)
}

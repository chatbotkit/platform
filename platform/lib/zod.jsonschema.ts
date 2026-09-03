import type { JsonSchema, JsonSchemaObject } from '@/lib/jsonschema'

import type { ZodSchema } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

export type { JsonSchema, JsonSchemaObject } from '@/lib/jsonschema'

/**
 * Options for converting Zod schema to JSON Schema.
 */
export interface ToJsonSchemaOptions {
  /**
   * Fields to exclude from the output schema.
   */
  excludeFields?: string[]
}

/**
 * Convert a Zod schema to a clean JSON Schema suitable for function parameters.
 *
 * @param schema - The Zod schema to convert
 * @param options - Conversion options
 * @returns A clean JSON Schema object
 */
export function toJsonSchema(
  schema: ZodSchema,
  options: ToJsonSchemaOptions = {}
): JsonSchemaObject {
  const { excludeFields = [] } = options

  const result = zodToJsonSchema(schema) as {
    properties?: Record<string, unknown>
    [key: string]: unknown
  }

  const properties: Record<string, JsonSchema> = {}

  if (result.properties) {
    for (const [key, value] of Object.entries(result.properties)) {
      // @note skip excluded fields
      if (excludeFields.includes(key)) {
        continue
      }

      // @note use loose typing for raw zod-to-json-schema output
      const prop = value as Record<string, unknown>

      // @note handle anyOf by merging with first option
      let processedProp = { ...prop }

      if (Array.isArray(processedProp.anyOf)) {
        const firstOption = processedProp.anyOf[0] as Record<string, unknown>

        processedProp = {
          ...processedProp,
          ...firstOption,
        }

        delete processedProp.anyOf
      }

      properties[key] = processedProp as unknown as JsonSchema
    }
  }

  return {
    type: 'object',
    properties,
  }
}

/**
 * Extract just the properties from a Zod schema as a flat record.
 *
 * This is useful when you need to iterate over schema fields without the full
 * JSON Schema wrapper.
 *
 * @param schema - The Zod schema to extract properties from
 * @param options - Conversion options
 * @returns A record of property definitions
 */
export function extractProperties(
  schema: ZodSchema,
  options: ToJsonSchemaOptions = {}
): Record<string, JsonSchema> {
  return toJsonSchema(schema, options).properties || {}
}

/**
 * JSON Schema type definitions based on JSON Schema Draft 7 specification.
 *
 * These types represent the subset of JSON Schema used throughout the platform
 * for defining ability function parameters and other structured data.
 */

/**
 * Base JSON Schema type that all schema types extend from.
 */
export interface JsonSchemaBase {
  /**
   * Human-readable description of the schema.
   */
  description?: string

  /**
   * Default value for the schema.
   */
  default?: unknown

  /**
   * Title of the schema.
   */
  title?: string
}

/**
 * JSON Schema for string types.
 */
export interface JsonSchemaString extends JsonSchemaBase {
  type: 'string'
  enum?: string[]
}

/**
 * JSON Schema for number types.
 */
export interface JsonSchemaNumber extends JsonSchemaBase {
  type: 'number'
  enum?: number[]
}

/**
 * JSON Schema for boolean types.
 */
export interface JsonSchemaBoolean extends JsonSchemaBase {
  type: 'boolean'
}

/**
 * JSON Schema for array types.
 */
export interface JsonSchemaArray extends JsonSchemaBase {
  type: 'array'
  /**
   * Schema for items in the array.
   *
   * @note this is a single schema object, not an array of schemas
   */
  items?: JsonSchema
}

/**
 * JSON Schema for object types.
 */
export interface JsonSchemaObject extends JsonSchemaBase {
  type: 'object'
  /**
   * Schema definitions for object properties.
   */
  properties?: Record<string, JsonSchema>
  /**
   * List of required property names.
   */
  required?: string[]
  /**
   * Whether additional properties beyond those defined are allowed.
   */
  additionalProperties?: boolean
}

/**
 * Union type representing any valid JSON Schema.
 */
export type JsonSchema =
  | JsonSchemaString
  | JsonSchemaNumber
  | JsonSchemaBoolean
  | JsonSchemaArray
  | JsonSchemaObject

/**
 * Type guard to check if a schema is a string schema.
 */
export function isStringSchema(schema: JsonSchema): schema is JsonSchemaString {
  return schema.type === 'string'
}

/**
 * Type guard to check if a schema is a number schema.
 */
export function isNumberSchema(schema: JsonSchema): schema is JsonSchemaNumber {
  return schema.type === 'number'
}

/**
 * Type guard to check if a schema is a boolean schema.
 */
export function isBooleanSchema(
  schema: JsonSchema
): schema is JsonSchemaBoolean {
  return schema.type === 'boolean'
}

/**
 * Type guard to check if a schema is an array schema.
 */
export function isArraySchema(schema: JsonSchema): schema is JsonSchemaArray {
  return schema.type === 'array'
}

/**
 * Type guard to check if a schema is an object schema.
 */
export function isObjectSchema(schema: JsonSchema): schema is JsonSchemaObject {
  return schema.type === 'object'
}

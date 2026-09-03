/**
 * OpenAPI parsing and schema extraction utilities.
 */
import {
  getParamsTypeName,
  getRequestTypeName,
  getResponseTypeName,
  getStreamTypeName,
} from './naming'

import SwaggerClient from 'swagger-client'

const { resolve: resolveSpec } = SwaggerClient

export interface ExtractedSchema {
  name: string
  schema: Record<string, unknown>
}

export interface ParsedOpenAPI {
  schemas: ExtractedSchema[]
  componentSchemas: ExtractedSchema[]
}

interface OpenAPIParameter {
  name: string
  in: 'query' | 'path' | 'header' | 'cookie'
  required?: boolean
  schema?: Record<string, unknown>
}

interface OpenAPIOperation {
  operationId?: string
  parameters?: OpenAPIParameter[]
  requestBody?: {
    content?: {
      'application/json'?: {
        schema?: Record<string, unknown>
      }
    }
  }
  responses?: {
    [statusCode: string]: {
      content?: {
        'application/json'?: {
          schema?: Record<string, unknown>
        }
        'application/jsonl'?: {
          schema?: Record<string, unknown>
        }
      }
    }
  }
}

interface OpenAPISpec {
  paths?: {
    [path: string]: {
      [method: string]: OpenAPIOperation
    }
  }
  components?: {
    schemas?: {
      [name: string]: Record<string, unknown>
    }
  }
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

/**
 * Parses an OpenAPI spec file and resolves all $ref references.
 */
export async function parseOpenAPISpec(
  specContent: string
): Promise<OpenAPISpec> {
  const spec = JSON.parse(specContent)
  const { spec: resolved } = await resolveSpec({ spec })

  return resolved as OpenAPISpec
}

/**
 * Extracts path and query parameters from an operation and combines them into a single schema.
 */
function extractParamsSchema(
  parameters: OpenAPIParameter[] | undefined
): Record<string, unknown> | null {
  if (!parameters || parameters.length === 0) {
    return null
  }

  const pathAndQueryParams = parameters.filter(
    (p) => p.in === 'path' || p.in === 'query'
  )

  if (pathAndQueryParams.length === 0) {
    return null
  }

  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const param of pathAndQueryParams) {
    properties[param.name] = param.schema || { type: 'string' }

    if (param.required) {
      required.push(param.name)
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

/**
 * Extracts all route-level schemas from a parsed OpenAPI spec.
 */
export function extractRouteSchemas(spec: OpenAPISpec): ExtractedSchema[] {
  const schemas: ExtractedSchema[] = []

  if (!spec.paths) {
    return schemas
  }

  for (const [_path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number])) {
        continue
      }

      const op = operation as OpenAPIOperation

      // Skip operations without operationId
      if (!op.operationId) {
        continue
      }

      const operationId = op.operationId

      // Extract params (path + query combined)
      const paramsSchema = extractParamsSchema(op.parameters)

      if (paramsSchema) {
        schemas.push({
          name: getParamsTypeName(operationId),
          schema: paramsSchema,
        })
      }

      // Extract request body
      const requestSchema =
        op.requestBody?.content?.['application/json']?.schema

      if (requestSchema) {
        schemas.push({
          name: getRequestTypeName(operationId),
          schema: requestSchema,
        })
      }

      // Extract 200 response
      const responseSchema =
        op.responses?.['200']?.content?.['application/json']?.schema

      if (responseSchema) {
        schemas.push({
          name: getResponseTypeName(operationId),
          schema: responseSchema,
        })
      }

      // Extract JSONL stream response item
      const streamSchema =
        op.responses?.['200']?.content?.['application/jsonl']?.schema

      if (streamSchema) {
        schemas.push({
          name: getStreamTypeName(operationId),
          schema: streamSchema,
        })
      }
    }
  }

  return schemas
}

/**
 * Extracts component schemas from a parsed OpenAPI spec.
 */
export function extractComponentSchemas(spec: OpenAPISpec): ExtractedSchema[] {
  const schemas: ExtractedSchema[] = []

  if (!spec.components?.schemas) {
    return schemas
  }

  for (const [name, schema] of Object.entries(spec.components.schemas)) {
    schemas.push({ name, schema })
  }

  return schemas
}

/**
 * Main parsing function that extracts all schemas from an OpenAPI spec.
 */
export async function parseAndExtract(
  specContent: string
): Promise<ParsedOpenAPI> {
  const spec = await parseOpenAPISpec(specContent)

  return {
    schemas: extractRouteSchemas(spec),
    componentSchemas: extractComponentSchemas(spec),
  }
}

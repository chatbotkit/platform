import type { GeneratorOptions} from './generator';
import { generateTypes } from './generator'
import { parseAndExtract } from './parser'

/**
 * OpenAPI Types Generator
 *
 * Generates typed interfaces for multiple programming languages from an OpenAPI
 * specification, focusing on route-level types (request/response) rather than
 * just shared component schemas.
 */

export {
  parseAndExtract,
  parseOpenAPISpec,
  extractRouteSchemas,
  extractComponentSchemas,
} from './parser'
export type { ExtractedSchema, ParsedOpenAPI } from './parser'

export {
  generateTypes,
  getSupportedLanguages,
  isSupportedLanguage,
} from './generator'
export type { GeneratorOptions, SupportedLanguage } from './generator'

export {
  operationIdToTypeName,
  getRequestTypeName,
  getResponseTypeName,
  getStreamTypeName,
  getParamsTypeName,
} from './naming'

export interface GenerateFromOpenAPIOptions extends GeneratorOptions {
  includeComponents?: boolean
}

/**
 * Main function to generate types from an OpenAPI spec string.
 */
export async function generateFromOpenAPI(
  specContent: string,
  options: GenerateFromOpenAPIOptions
): Promise<string> {
  const { schemas, componentSchemas } = await parseAndExtract(specContent)

  const allSchemas = options.includeComponents
    ? [...schemas, ...componentSchemas]
    : schemas

  if (allSchemas.length === 0) {
    return '// No schemas found in OpenAPI spec'
  }

  return generateTypes(allSchemas, options)
}

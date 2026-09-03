/**
 * Type generation using quicktype-core.
 */
import type { ExtractedSchema } from './parser'

import {
  FetchingJSONSchemaStore,
  InputData,
  JSONSchemaInput,
  quicktype,
} from 'quicktype-core'

// @note marker prefix used to make identical enums unique for quicktype
const ENUM_MARKER_PREFIX = '__qtmarker_'

// @note quicktype expects specific language string literals
export type SupportedLanguage =
  | 'go'
  | 'python'
  | 'rust'
  | 'java'
  | 'kotlin'
  | 'swift'
  | 'csharp'
  | 'typescript'
  | 'ruby'
  | 'cpp'

const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'go',
  'python',
  'rust',
  'java',
  'kotlin',
  'swift',
  'csharp',
  'typescript',
  'ruby',
  'cpp',
]

export interface GeneratorOptions {
  language: SupportedLanguage
  packageName?: string
}

/**
 * Adds a unique marker value to enum schemas to prevent quicktype from
 * deduplicating identical enums. The marker is stripped after generation.
 */
function addEnumMarkers(schemas: ExtractedSchema[]): {
  schemas: ExtractedSchema[]
  markerPattern: RegExp
} {
  const markedSchemas = schemas.map(({ name, schema }) => {
    const modifiedSchema = addMarkerToSchema(schema, name)

    return { name, schema: modifiedSchema }
  })

  // @note pattern matches the marker constant lines in generated code
  // Go examples:
  //   `QtmarkerSomeType SomeType = "__qtmarker_SomeType__"` (Qtmarker at start)
  //   `SomeTypeQtmarkerSomeType SomeType = "__qtmarker_SomeType__"` (Qtmarker in middle)
  const markerPattern = new RegExp(
    `^\\s*\\w*Qtmarker\\w+\\s+\\w+\\s*=\\s*"${ENUM_MARKER_PREFIX}\\w+__"\\s*$`,
    'gm'
  )

  return { schemas: markedSchemas, markerPattern }
}

/**
 * Recursively adds marker to enum properties in a schema.
 */
function addMarkerToSchema(
  schema: Record<string, unknown>,
  typeName: string
): Record<string, unknown> {
  const result = { ...schema }

  // @note add marker to top-level enum
  if (Array.isArray(result.enum)) {
    result.enum = [...result.enum, `${ENUM_MARKER_PREFIX}${typeName}__`]
  }

  // @note recursively process nested properties
  if (result.properties && typeof result.properties === 'object') {
    const props = result.properties as Record<string, Record<string, unknown>>

    result.properties = Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        addMarkerToSchema(value, `${typeName}_${key}`),
      ])
    )
  }

  // @note process items for arrays
  if (result.items && typeof result.items === 'object') {
    result.items = addMarkerToSchema(
      result.items as Record<string, unknown>,
      `${typeName}_item`
    )
  }

  // @note process allOf, anyOf, oneOf
  for (const combiner of ['allOf', 'anyOf', 'oneOf']) {
    if (Array.isArray(result[combiner])) {
      result[combiner] = (result[combiner] as Record<string, unknown>[]).map(
        (item, i) => addMarkerToSchema(item, `${typeName}_${combiner}${i}`)
      )
    }
  }

  return result
}

/**
 * Strips marker constants from generated code.
 */
function stripEnumMarkers(code: string, markerPattern: RegExp): string {
  return code
    .replace(markerPattern, '')
    .split('\n')
    .filter((line) => !line.includes(ENUM_MARKER_PREFIX))
    .join('\n')
}

/**
 * Generates typed code from a collection of JSON schemas using quicktype.
 */
export async function generateTypes(
  schemas: ExtractedSchema[],
  options: GeneratorOptions
): Promise<string> {
  // @note add markers to make identical enums unique
  const { schemas: markedSchemas, markerPattern } = addEnumMarkers(schemas)

  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore())

  for (const { name, schema } of markedSchemas) {
    await schemaInput.addSource({
      name,
      schema: JSON.stringify(schema),
    })
  }

  const inputData = new InputData()

  inputData.addInput(schemaInput)

  const result = await quicktype({
    inputData,
    lang: options.language,
    rendererOptions: {
      package: options.packageName || 'types',
    },
  })

  const code = result.lines.join('\n')

  // @note strip the marker constants from generated code
  return stripEnumMarkers(code, markerPattern)
}

/**
 * Returns a list of supported target languages.
 */
export function getSupportedLanguages(): SupportedLanguage[] {
  return SUPPORTED_LANGUAGES
}

/**
 * Type guard to check if a string is a supported language.
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)
}

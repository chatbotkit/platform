/**
 * Widget Manifest Type Definition
 *
 * Each widget includes a manifest.ts that defines its metadata and props schema.
 * The manifest is converted to JSON Schema at build time.
 */

import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

/**
 * Framework type for the widget
 */
export type ComponentFramework = 'web-component' | 'react'

/**
 * Widget category for organization
 */
export type ComponentCategory = 'data-display' | 'feedback' | 'input' | 'layout' | 'navigation' | 'other'

/**
 * Base manifest metadata (without the props schema)
 */
export interface ManifestMetadata {
  /** Widget name (same as directory name, kebab-case) */
  name: string
  /** Human-readable display name */
  displayName: string
  /** Widget description */
  description: string
  /** Version of the widget */
  version: string
  /** Custom element tag name (must include hyphen) */
  tagName: string
  /** Whether the widget uses React or is a pure Web Component */
  framework: ComponentFramework
  /** Widget category for organization */
  category?: ComponentCategory
  /** Keywords for searchability */
  keywords?: string[]
  /** Author information */
  author?: string
  /** Props schema (JSON Schema format when fetched from manifest.json) */
  propsSchema?: Record<string, unknown>
}

/**
 * Full widget manifest with Zod props schema (used at build time)
 *
 * This extends ManifestMetadata but overrides propsSchema with a Zod type.
 * At build time, the Zod schema is converted to JSON Schema.
 */
export interface WidgetManifest<T extends z.ZodTypeAny = z.ZodTypeAny>
  extends Omit<ManifestMetadata, 'propsSchema'> {
  /** Zod schema for widget props - used for validation and JSON Schema generation */
  propsSchema: T
}

/**
 * Helper to define a widget manifest with type inference
 */
export function defineManifest<T extends z.ZodTypeAny>(
  manifest: WidgetManifest<T>
): WidgetManifest<T> {
  return manifest
}

/**
 * Convert a Zod schema to JSON Schema for the manifest output
 */
export function propsSchemaToJsonSchema(schema: z.ZodTypeAny): object {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return zodToJsonSchema(schema as any, {
    $refStrategy: 'none',
    target: 'jsonSchema7',
  })
}

/**
 * Generate the JSON manifest from a TypeScript manifest
 * This is used by the build script to create the .manifest.json files
 */
export function generateJsonManifest(manifest: WidgetManifest): object {
  const { propsSchema, ...metadata } = manifest
  return {
    ...metadata,
    propsSchema: propsSchemaToJsonSchema(propsSchema),
  }
}

/**
 * Validate props against a manifest's schema (throws on invalid)
 *
 * Use this when you want to ensure props are valid before rendering.
 * Throws ZodError if validation fails.
 *
 * @example
 * ```ts
 * import { validateProps } from 'mcp-widgets'
 * import { manifest } from 'mcp-widgets/widgets/data-card'
 *
 * try {
 *   const validProps = validateProps(manifest, userInput)
 *   // validProps is typed and guaranteed valid
 * } catch (err) {
 *   console.error('Invalid props:', err.issues)
 * }
 * ```
 */
export function validateProps<T extends z.ZodTypeAny>(
  manifest: WidgetManifest<T>,
  props: unknown
): z.infer<T> {
  return manifest.propsSchema.parse(props)
}

/**
 * Safely validate props without throwing
 *
 * Returns a result object with `success` boolean and either `data` or `error`.
 * Use this for graceful error handling.
 *
 * @example
 * ```ts
 * import { safeValidateProps } from 'mcp-widgets'
 * import { manifest } from 'mcp-widgets/widgets/data-card'
 *
 * const result = safeValidateProps(manifest, userInput)
 * if (result.success) {
 *   render(result.data) // typed and valid
 * } else {
 *   console.warn('Invalid props:', result.error.issues)
 *   renderFallback() // graceful degradation
 * }
 * ```
 */
export function safeValidateProps<T extends z.ZodTypeAny>(
  manifest: WidgetManifest<T>,
  props: unknown
) {
  return manifest.propsSchema.safeParse(props)
}

/**
 * Parse and validate props directly from a schema
 *
 * Simpler alternative when you have the schema but not the full manifest.
 *
 * @example
 * ```ts
 * import { parseProps } from 'mcp-widgets'
 * import { propsSchema } from 'mcp-widgets/widgets/data-card'
 *
 * // Returns validated props or undefined on error
 * const props = parseProps(propsSchema, userInput)
 * if (props) {
 *   // props is typed as DataCardProps
 * }
 * ```
 */
export function parseProps<T extends z.ZodTypeAny>(
  schema: T,
  props: unknown
): z.infer<T> | undefined {
  const result = schema.safeParse(props)
  return result.success ? result.data : undefined
}

// Re-export zod for convenience
export { z }

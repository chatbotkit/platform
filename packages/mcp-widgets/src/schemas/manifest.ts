/**
 * Zod Schemas for Manifest Validation
 *
 * These schemas provide runtime validation for widget manifests.
 * Import from 'mcp-widgets/schemas' to use validation.
 *
 * @example
 * ```ts
 * import { ManifestMetadataSchema } from 'mcp-widgets/schemas'
 *
 * const result = ManifestMetadataSchema.safeParse(data)
 * if (result.success) {
 *   // result.data is typed as ManifestMetadata
 * }
 * ```
 */

import { z } from 'zod'

import type {
  ManifestMetadata,
  ComponentFramework,
  ComponentCategory,
} from '../types/manifest'

// @note type helper to ensure Zod schema matches TypeScript interface
// if these types diverge, we get a compile error here
type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false

/**
 * Framework type schema
 */
export const ComponentFrameworkSchema = z.enum(['web-component', 'react'])

// @note compile-time check: schema must produce exact ComponentFramework type
type _CheckFramework =
  AssertEqual<
    z.infer<typeof ComponentFrameworkSchema>,
    ComponentFramework
  > extends true
    ? true
    : never
const _frameworkCheck: _CheckFramework = true
void _frameworkCheck

/**
 * Widget category schema
 */
export const ComponentCategorySchema = z.enum([
  'data-display',
  'feedback',
  'input',
  'layout',
  'navigation',
  'other',
])

// @note compile-time check: schema must produce exact ComponentCategory type
type _CheckCategory =
  AssertEqual<
    z.infer<typeof ComponentCategorySchema>,
    ComponentCategory
  > extends true
    ? true
    : never
const _categoryCheck: _CheckCategory = true
void _categoryCheck

/**
 * Manifest metadata schema for runtime validation
 *
 * Use this to validate manifests fetched from external sources.
 */
export const ManifestMetadataSchema = z.object({
  /** Widget name (same as directory name, kebab-case) */
  name: z.string().min(1),

  /** Human-readable display name */
  displayName: z.string().min(1),

  /** Widget description */
  description: z.string(),

  /** Version of the widget */
  version: z.string(),

  /** Custom element tag name (must include hyphen) */
  tagName: z
    .string()
    .min(1)
    .refine((tag) => tag.includes('-'), {
      message: 'Custom element tag name must include a hyphen',
    }),

  /** Whether the widget uses React or is a pure Web Component */
  framework: ComponentFrameworkSchema,

  /** Widget category for organization */
  category: ComponentCategorySchema.optional(),

  /** Keywords for searchability */
  keywords: z.array(z.string()).optional(),

  /** Author information */
  author: z.string().optional(),

  /** Props schema (JSON Schema format when fetched from manifest.json) */
  propsSchema: z.record(z.unknown()).optional(),
})

// @note compile-time check: schema must produce exact ManifestMetadata type
// if the interface changes but the schema doesn't (or vice versa), this fails
type _CheckManifest =
  AssertEqual<
    z.infer<typeof ManifestMetadataSchema>,
    ManifestMetadata
  > extends true
    ? true
    : never
const _manifestCheck: _CheckManifest = true
void _manifestCheck

/**
 * Validate a manifest and return typed result
 *
 * @param data - The data to validate
 * @returns Parsed manifest or null if invalid
 */
export function parseManifest(data: unknown): ManifestMetadata | null {
  const result = ManifestMetadataSchema.safeParse(data)
  return result.success ? result.data : null
}

/**
 * Validate a manifest and throw on error
 *
 * @param data - The data to validate
 * @returns Parsed manifest
 * @throws ZodError if validation fails
 */
export function validateManifest(data: unknown): ManifestMetadata {
  return ManifestMetadataSchema.parse(data)
}

// Re-export zod for convenience
export { z } from 'zod'

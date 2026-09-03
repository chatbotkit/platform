/**
 * CDN entry point for rich-data-card widget
 *
 * This file is bundled by esbuild into a self-contained IIFE
 * that includes React and registers a web component wrapper.
 *
 * Demonstrates optional runtime validation using the propsSchema.
 */

import { RichDataCard, type RichDataCardProps } from './RichDataCard'
import { registerComponent } from '../../utils/register'
import { propsSchema } from './manifest'
import './styles.css'

/**
 * Parse and validate props, logging warnings for invalid input
 */
function validateAndTransform(
  attrs: Record<string, string | null>
): RichDataCardProps {
  // Parse raw attributes
  const rawProps = {
    title: attrs.title ?? undefined,
    description: attrs.description ?? undefined,
    icon: attrs.icon ?? undefined,
    data: attrs.data ? safeJsonParse(attrs.data) : undefined,
    sections: attrs.sections ? safeJsonParse(attrs.sections) : undefined,
    footer: attrs.footer ?? undefined,
    status: attrs.status ?? undefined,
  }

  // Validate against schema
  const result = propsSchema.safeParse(rawProps)

  if (!result.success) {
    // Log validation errors for debugging (visible in browser console)
    console.warn('[mcp-rich-data-card] Invalid props:', result.error.issues)
    // Return raw props anyway for graceful degradation
    return rawProps as RichDataCardProps
  }

  return result.data
}

/**
 * Safely parse JSON, returning undefined on error
 */
function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    console.warn('[mcp-rich-data-card] Invalid JSON:', value)
    return undefined
  }
}

// Register as a web component
registerComponent<RichDataCardProps>(RichDataCard, {
  tagName: 'mcp-rich-data-card',
  observedAttributes: [
    'title',
    'description',
    'icon',
    'data',
    'sections',
    'footer',
    'status',
  ],
  // Transform and validate string attributes to props
  attributeToProps: validateAndTransform,
})

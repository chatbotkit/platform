import { siteHostname, staticHostname, widgetHostname } from '@/config/site'

import debug from '@/lib/debug'
import standardFetch from '@/lib/egress.fetch'
import { withNextCache } from '@/lib/fetch'
import {
  getExternalFrontendHost,
  getExternalStaticHost,
  getExternalWidgetHost,
} from '@/lib/host'

import type { ManifestMetadata } from 'mcp-widgets/src'
import { ManifestMetadataSchema } from 'mcp-widgets/src/schemas'
import { z } from 'zod'

export type { ManifestMetadata as WidgetManifest } from 'mcp-widgets/src'

/**
 * Base URL for built-in mcp-widgets on CDN
 */
const MCP_WIDGETS_CDN_BASE = 'https://unpkg.com/mcp-widgets@latest/cdn/widgets'

/**
 * Allowed widget manifest domains for security. The public registries are
 * trusted everywhere; the deployment's own site, static, and widget hosts
 * are appended so self-hosted widgets can be served from the deployment
 * itself.
 */
const ALLOWED_WIDGET_DOMAINS = [
  'unpkg.com',
  'cdn.jsdelivr.net',

  siteHostname,
  staticHostname,
  widgetHostname,
]

/**
 * Gets the widget manifest domains allowed for the current runtime context.
 * The constant above remains the deployment baseline; dynamic additions are
 * resolved when the policy is used so future brand selection is not frozen at
 * module load.
 */
export function getAllowedWidgetDomains(): Set<string> {
  return new Set([
    ...ALLOWED_WIDGET_DOMAINS,

    getExternalFrontendHost(),
    getExternalStaticHost(),
    getExternalWidgetHost(),
  ])
}

/**
 * Fetch function with Next.js caching
 */
const fetch = withNextCache(standardFetch, { tags: ['mcp-widgets'], ttl: 300 })

/**
 * Zod schema for widget UI configuration object
 */
export const WidgetUiConfigSchema = z.object({
  /**
   * Widget name (shortcut) or full manifest URL
   */
  widget: z.string(),

  /**
   * Status text shown while the tool is running (≤64 chars)
   */
  invokingText: z.string().max(64).optional(),

  /**
   * Status text shown after the tool completes (≤64 chars)
   */
  invokedText: z.string().max(64).optional(),

  /**
   * Description shown to the model to reduce redundant narration
   */
  description: z.string().optional(),

  /**
   * Whether the widget should render with a border
   */
  prefersBorder: z.boolean().optional(),
})

/**
 * Zod schema for widget UI value - can be a simple string or a configuration object
 */
export const WidgetUiValueSchema = z.union([z.string(), WidgetUiConfigSchema])

/**
 * Widget UI configuration object type (inferred from Zod schema)
 */
export type WidgetUiConfig = z.infer<typeof WidgetUiConfigSchema>

/**
 * Widget UI value type (inferred from Zod schema)
 */
export type WidgetUiValue = z.infer<typeof WidgetUiValueSchema>

/**
 * Parse and validate a widget UI value from user input
 *
 * @param value - Raw value from ability meta
 * @returns Validated WidgetUiValue or null if validation fails
 */
export function parseWidgetUiValue(value: unknown): WidgetUiValue | null {
  const result = WidgetUiValueSchema.safeParse(value)

  if (!result.success) {
    debug(`invalid widget UI value`, {
      value,
      errors: result.error.errors,
    }).log('mcp.widget.parseWidgetUiValue')

    return null
  }

  return result.data
}

/**
 * Type guard to check if a value is a WidgetUiConfig object
 */
export function isWidgetUiConfig(
  value: WidgetUiValue
): value is WidgetUiConfig {
  return typeof value === 'object' && value !== null && 'widget' in value
}

/**
 * Normalize a WidgetUiValue to a WidgetUiConfig object
 *
 * Converts string values to the object format for consistent handling.
 */
export function normalizeWidgetUiValue(value: WidgetUiValue): WidgetUiConfig {
  if (isWidgetUiConfig(value)) {
    return value
  }

  return { widget: value }
}

/**
 * Cache for fetched manifests to avoid repeated network requests
 */
const manifestCache = new Map<string, ManifestMetadata>()

/**
 * Validate that a manifest URL is from an allowed domain
 *
 * @param url - URL to validate
 * @returns True if from allowed domain, false otherwise
 */
export function isAllowedWidgetUrl(url: string): boolean {
  try {
    const parsed = new URL(url)

    return [...getAllowedWidgetDomains()].some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

/**
 * Fetch a widget manifest from a URL
 *
 * @param manifestUrl - URL to the widget's manifest.json
 * @returns The parsed manifest or null if fetch fails
 */
export async function fetchWidgetManifest(
  manifestUrl: string
): Promise<ManifestMetadata | null> {
  // @note validate URL is from allowed domain to prevent SSRF attacks

  if (!isAllowedWidgetUrl(manifestUrl)) {
    debug(`widget manifest URL not from allowed domain`, {
      manifestUrl,
      allowedDomains: getAllowedWidgetDomains(),
    }).log('mcp.widget.fetchWidgetManifest')

    return null
  }

  const cached = manifestCache.get(manifestUrl)

  if (cached) {
    return cached
  }

  try {
    debug(`fetching widget manifest`, { manifestUrl }).log(
      'mcp.widget.fetchWidgetManifest'
    )

    const response = await fetch(manifestUrl, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      debug(`failed to fetch widget manifest`, {
        manifestUrl,
        status: response.status,
      }).log('mcp.widget.fetchWidgetManifest')

      return null
    }

    const data = await response.json()

    const result = ManifestMetadataSchema.safeParse(data)

    if (!result.success) {
      debug(`invalid widget manifest`, {
        manifestUrl,
        errors: result.error.errors,
      }).log('mcp.widget.fetchWidgetManifest')

      return null
    }

    const manifest = result.data

    manifestCache.set(manifestUrl, manifest)

    return manifest
  } catch (err) {
    debug(`error fetching widget manifest`, { manifestUrl, err }).log(
      'mcp.widget.fetchWidgetManifest'
    )

    return null
  }
}

/**
 * Resolve a widget UI value to a full manifest URL
 *
 * Supports both full URLs and shortcut names for built-in widgets:
 * - Full URL: "https://example.com/widgets/my-widget.manifest.json" → unchanged
 * - Shortcut: "data-card" → "https://unpkg.com/mcp-widgets@latest/cdn/widgets/data-card.manifest.json"
 *
 * @param ui - Widget UI value (full URL or shortcut name)
 * @returns Full manifest URL
 */
export function resolveWidgetManifestUrl(ui: string): string {
  if (ui.includes('://')) {
    return ui
  }

  return `${MCP_WIDGETS_CDN_BASE}/${ui}.manifest.json`
}

/**
 * Get the CDN bundle URL from a manifest URL
 *
 * Converts: .../data-card.manifest.json → .../data-card.js
 */
export function getCdnBundleUrl(manifestUrl: string): string {
  return manifestUrl.replace(/\.manifest\.json$/, '.js')
}

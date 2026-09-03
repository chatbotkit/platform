import { isUnmanagedBlueprintField } from '@/lib/blueprint.fields'
import type { BlueprintResourceDocument } from '@/lib/blueprint.import'

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Export sensitivity. `public` strips credential/token fields so they never
 * leave the platform; `internal` keeps the data as-read for trusted in-process
 * consumers.
 */
export type ExportSensitivity = 'public' | 'internal'

/**
 * The resource buckets produced by `getBlueprintAndCloneableResources`.
 */
export type ExportBucket =
  | 'basic'
  | 'object'
  | 'compliance'
  | 'oauth'
  | 'integration'

type ResourceItem = Record<string, unknown> & { id: string }

type ResourceBucket = Record<string, ResourceItem[]>
export type GroupedBlueprintResources = Partial<
  Record<ExportBucket, ResourceBucket>
>

// ── Bucket selections ────────────────────────────────────────────────────────

// @note bucket selections preserve each consumer's existing behavior:
//  - JSON export omits oauth (reference-only credentials)
//  - terraform historically omits oauth
//  - clone needs policy resources but keeps oauth connections reference-only
export const JSON_EXPORT_BUCKETS: ExportBucket[] = [
  'basic',
  'object',
  'compliance',
  'integration',
]

export const TERRAFORM_EXPORT_BUCKETS: ExportBucket[] = [
  'basic',
  'object',
  'compliance',
  'integration',
]

export const FULL_EXPORT_BUCKETS: ExportBucket[] = [
  'basic',
  'object',
  'compliance',
  'oauth',
  'integration',
]

// @note clone re-materializes through the import engine, which has no
// `oAuthConnection` category (oauth tokens are reference-only and not copied -
// notably never lifted from another user's hub blueprint).
export const CLONE_EXPORT_BUCKETS: ExportBucket[] = [
  'basic',
  'object',
  'compliance',
  'integration',
]

// ── Document construction ────────────────────────────────────────────────────

/**
 * Strips sensitive (unmanaged) fields so they never leak into a transportable
 * document. A no-op under `internal` sensitivity.
 */
export function stripSensitiveFields(
  data: Record<string, unknown>,
  sensitivity: ExportSensitivity,
  category?: string
): Record<string, unknown> {
  if (sensitivity === 'internal') {
    return { ...data }
  }

  return Object.fromEntries(
    Object.entries(data).filter(
      ([key]) => !isUnmanagedBlueprintField(key, category)
    )
  )
}

/**
 * The export category name for a bucket entry - integration categories gain the
 * `Integration` suffix (`slack` → `slackIntegration`); others are used as-is.
 */
function exportCategoryName(bucket: ExportBucket, category: string): string {
  return bucket === 'integration' ? `${category}Integration` : category
}

/**
 * Produces the category-grouped resource map (`{ bot: [{ id, … }], … }`) - the
 * shape the JSON export returns and the import route's `parseCategoryArrayResources`
 * consumes. Items keep their real `id`; cross-references stay as real ids, which
 * the import engine re-wires (real id serves as the wiring id).
 */
export function exportResourceCategoryMap({
  resources,
  sensitivity,
  buckets,
}: {
  resources: GroupedBlueprintResources
  sensitivity: ExportSensitivity
  buckets: ExportBucket[]
}): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {}

  for (const bucket of buckets) {
    const group = resources[bucket]

    if (!group) {
      continue
    }

    for (const [category, items] of Object.entries(group)) {
      const exportCategory = exportCategoryName(bucket, category)

      out[exportCategory] = items.map((item) =>
        stripSensitiveFields(item, sensitivity, exportCategory)
      )
    }
  }

  return out
}

/**
 * Produces the token-keyed portable document (`{ '#type:::id': { type, data } }`)
 * - the shape consumed by terraform generation. The `id` becomes the token key;
 * `data` carries the remaining (sensitivity-filtered) fields with references left
 * as real ids.
 */
export function exportResourceDocument({
  resources,
  sensitivity,
  buckets,
}: {
  resources: GroupedBlueprintResources
  sensitivity: ExportSensitivity
  buckets: ExportBucket[]
}): BlueprintResourceDocument {
  const out: BlueprintResourceDocument['resources'] = {}

  for (const bucket of buckets) {
    const group = resources[bucket]

    if (!group) {
      continue
    }

    for (const [category, items] of Object.entries(group)) {
      const type = exportCategoryName(bucket, category)

      for (const item of items) {
        const { id, ...data } = item

        out[`#${type}:::${id}`] = {
          type,
          data: stripSensitiveFields(data, sensitivity, type),
        }
      }
    }
  }

  return { resources: out }
}

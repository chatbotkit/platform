import { omit } from '@/lib/object'

/**
 * Here we define common meta data structure to avoid problems in the future.
 *
 * @note keep in mind that some customers rely on the meta data to make
 * decisions and to provide feedback to the user so changing the structure of
 * the meta data may break their systems
 */

export interface DatasetMeta {
  dataset: {
    id: string
    action: {
      name: string
      input: unknown
      result: {
        records: {
          id: string
        }[]
      }
    }
  }
}

export interface SkillsetMeta {
  skillset: {
    id: string
    action: {
      name: string
      input: unknown
      justification?: string
    }
  }
}

/**
 * Meta keys reserved for platform-internal use - anything starting with a
 * non-word character or an underscore, such as `_internal`, `#secret` or the
 * `$update` directive.
 */
export const INTERNAL_META_KEY_PATTERN = /^[\W_]/

export function getMeta(
  meta: Record<string, unknown>,
  previousMeta?: Record<string, unknown>
): Record<string, unknown> {
  if (meta && '$update' in meta) {
    meta = omit(meta.$update, [INTERNAL_META_KEY_PATTERN])

    return {
      ...previousMeta,
      ...meta,
    }
  } else {
    meta = omit(meta, [INTERNAL_META_KEY_PATTERN])

    return meta
  }
}

/**
 * Strips the platform-internal keys from a meta object so it is safe to hand
 * back to the client.
 *
 * @note the read-side counterpart of `getMeta` - because these keys are never
 * persisted through a write, they must not be served through a read either
 */
export function getPublicMeta<T>(meta: T): T {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return meta
  }

  return omit(meta, [INTERNAL_META_KEY_PATTERN]) as T
}

/**
 * @manual Metadata
 * @description Metadata provides a flexible way to attach custom information to platform resources, enabling integrations, tracking, and custom workflows without modifying core data structures.
 * @category API
 * @tags metadata, custom-data, meta, merging
 * @index 15
 *
 * Metadata is a powerful feature that allows you to attach arbitrary custom
 * data to platform resources such as bots, datasets, conversations, and more.
 * This extensibility mechanism enables you to store integration-specific
 * information, tracking data, or custom properties without requiring changes
 * to the platform's core data model.
 *
 * The metadata system is particularly valuable for building integrations and
 * custom workflows. You can use metadata to store external system identifiers,
 * track the source of data, maintain audit trails, or attach any other
 * information your application needs. Many customers rely on metadata to make
 * decisions and provide feedback to users in their systems.
 *
 * ## How Metadata Merging Works
 *
 * When updating resources, the platform provides two distinct approaches for
 * managing metadata: full replacement and incremental updates. Understanding
 * these patterns is essential for correctly managing custom data throughout
 * your resource lifecycle.
 *
 * **Full Replacement Mode** replaces the entire metadata object with new data.
 * When you provide a metadata object directly without the special `$update`
 * key, the system completely replaces any existing metadata with your new
 * values. This approach is useful when you want to reset metadata or when
 * you're managing the complete metadata state in your application.
 *
 * ```http
 * POST /api/v1/bot/{botId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Support Bot",
 *   "meta": {
 *     "departmentId": "sales-dept-001",
 *     "version": "2.0",
 *     "customField": "value"
 *   }
 * }
 * ```
 *
 * In full replacement mode, any previous metadata keys not included in the
 * update request are removed. This gives you complete control over the
 * metadata state but requires you to provide all desired fields on each update.
 *
 * **Incremental Update Mode** merges new metadata with existing data,
 * preserving fields not included in the update. This mode is activated by
 * wrapping your metadata updates in a special `$update` object. The platform
 * merges your new values with existing metadata, only overwriting the specific
 * fields you provide while preserving all other existing metadata.
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer FAQs",
 *   "meta": {
 *     "$update": {
 *       "lastSyncedAt": "2025-01-11T20:00:00Z",
 *       "recordCount": 150
 *     }
 *   }
 * }
 * ```
 *
 * With incremental updates, if the resource previously had metadata like
 * `{"departmentId": "support", "version": "1.0"}`, the result after the update
 * would be `{"departmentId": "support", "version": "1.0", "lastSyncedAt": "2025-01-11T20:00:00Z", "recordCount": 150}`.
 * The existing `departmentId` and `version` fields are preserved, while new
 * fields are added and matching fields are updated.
 *
 * ## Metadata Key Filtering
 *
 * The metadata system automatically filters out keys that begin with non-word
 * characters such as underscores, hyphens, or special symbols. This filtering
 * applies in both full replacement and incremental update modes, ensuring that
 * internal or temporary keys are not persisted to the database.
 *
 * ```http
 * POST /api/v1/bot/{botId}/update
 * Content-Type: application/json
 *
 * {
 *   "meta": {
 *     "validKey": "will be saved",
 *     "_internalKey": "will be filtered out",
 *     "-tempKey": "will be filtered out",
 *     "anotherValid": "will be saved"
 *   }
 * }
 * ```
 *
 * After processing, only `validKey` and `anotherValid` will be stored in the
 * resource's metadata. Keys starting with `_`, `-`, or other non-word
 * characters are automatically removed. This behavior protects against
 * accidentally persisting temporary or internal data that should not be part
 * of the permanent metadata record.
 *
 * ## Important Considerations
 *
 * **Backward Compatibility Warning**: Many customers rely on specific metadata
 * structures to make decisions and provide feedback in their integrated
 * systems. Changes to metadata structure or the merging behavior could break
 * existing integrations. Always maintain backward compatibility when adding new
 * features or modifying how metadata is processed.
 *
 * **Performance and Size**: While metadata is flexible, be mindful of the size
 * of data you store. Large metadata objects can impact query performance and
 * increase storage costs. Consider storing references to external data rather
 * than embedding large datasets directly in metadata.
 *
 * **Data Privacy**: Metadata is subject to the same access controls as the
 * resource it's attached to. However, ensure you're not storing sensitive
 * information in metadata unless it's properly protected and your security
 * requirements are met.
 *
 * **Use Cases**: Common metadata use cases include storing external system IDs
 * for integration purposes, tracking data lineage and provenance, maintaining
 * custom workflow states, attaching version information, storing UI
 * preferences, and tracking last synchronization times for external data
 * sources.
 */

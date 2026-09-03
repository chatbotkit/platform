// @ts-check
import schema from '@/lib/joi.schema'

/**
 * Schema for validating a SpaceSite slug.
 *
 * This validates the input shape before the DNS-label and reserved-name policy
 * in `@/lib/space.site` is applied.
 *
 * @example
 * - `acme`
 * - `product-docs`
 */
export default schema.string().trim().lowercase().max(63)

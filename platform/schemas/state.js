// @ts-check
import { ResourceState } from '@/prisma/types'

import schema from '@/lib/joi.schema'

/**
 * Schema for validating a resource lifecycle `state` field.
 *
 * Resources that support it (currently abilities and skillsets) can be toggled
 * on and off without being deleted:
 *
 * - `enabled` (default) - active and usable
 * - `disabled` - kept and configured, but not exposed at runtime
 *
 * Omitting the field on update leaves the existing state unchanged; omitting it
 * on create falls back to the database default (`enabled`).
 *
 * @see ResourceState
 */
export default schema.string().valid(...Object.keys(ResourceState))

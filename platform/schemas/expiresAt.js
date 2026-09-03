// @ts-check
import schema from '@/lib/joi.schema'

// @note an absolute expiry as an epoch-millisecond timestamp - matching how
// dates are returned everywhere (makeJsonSafe serializes Date -> getTime()) and
// the existing conversation `expiresAt` input. `null` clears any existing
// expiry. Handlers convert the number to a Date.
export default schema.number().integer().allow(null)

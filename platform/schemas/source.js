// @ts-check
import schema from '@/lib/joi.schema'

export default schema.string().allow(null, '').maxByteLength(896)

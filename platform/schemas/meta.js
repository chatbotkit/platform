// @ts-check
import schema from '@/lib/joi.schema'

export default schema.object().pattern(/^[^_]/, schema.any()).allow(null)

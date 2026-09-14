// @ts-check
import { MAX_DB_SOURCE_URL_BYTES_LENGTH } from '@/prisma/constraints'

import schema from '@/lib/joi.schema'

/**
 * A source URL - a sitemap or crawl entry point - which the schema stores in
 * a wider column than a plain db string.
 */
export default schema
  .string()
  .allow(null, '')
  .maxByteLength(MAX_DB_SOURCE_URL_BYTES_LENGTH)

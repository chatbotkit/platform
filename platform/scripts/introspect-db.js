import 'dotenv/config'

import { Prisma } from '@/prisma/client'

import { log, runScript } from '@/lib/script'

/**
 * Introspect the Prisma database schema.
 *
 * Usage:
 * ```bash
 * pnpm script:introspect-db  # No options required
 * ```
 *
 * This script outputs the Prisma DMMF (Data Model Meta Format) which
 * describes all models, fields, and relationships in the database schema.
 */
runScript({
  name: 'introspect-db',
  description: 'Introspect the Prisma database schema',
  options: {},
  handler: async () => {
    log(`db`, {
      models: Prisma.dmmf.datamodel.models,
    })
  },
})

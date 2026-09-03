import { log, runScript } from '@/lib/script'

import { generateKey } from '@chatbotkit-dev/cloak'

/**
 * Generate an encryption key - 32 random bytes in the k1.aesgcm256 format
 * both PRISMA_FIELD_ENCRYPTION_KEY and CLOAK_ENCRYPTION_KEY use.
 *
 * Usage:
 * ```bash
 * pnpm script:generate-encryption-key
 * ```
 *
 * To rotate the field encryption key, prepend the new key to the existing
 * comma-separated value, run `pnpm script:backfill-database-encryption`, then remove
 * the old key - see docs/configuration.md, "Encryption at rest".
 */
runScript({
  name: 'generate-encryption-key',
  description: 'Generate a CLOAK_ENCRYPTION_KEY',
  options: {},
  handler: async () => {
    log(generateKey())
  },
})

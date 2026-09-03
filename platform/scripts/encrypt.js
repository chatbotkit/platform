import 'dotenv/config'

import { encrypt } from '@/lib/cloak'
import { log, runScript } from '@/lib/script'

/**
 * Encrypt a value using the platform cloak encryption.
 *
 * Usage:
 * ```bash
 * pnpm script:encrypt                    # Interactive mode (recommended for sensitive data)
 * pnpm script:encrypt --value "secret"   # CLI mode
 * ```
 */
runScript({
  name: 'encrypt',
  description: 'Encrypt a value using cloak encryption',
  options: {
    value: {
      type: 'string',
      short: 'v',
      description: 'Value to encrypt',
      message: 'What do you want to encrypt?',
      required: true,
    },
  },
  handler: async ({ value }) => {
    log(await encrypt(value))
  },
})

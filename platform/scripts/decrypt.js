import 'dotenv/config'

import { decrypt } from '@/lib/cloak'
import { log, runScript } from '@/lib/script'

/**
 * Decrypt a value that was encrypted using the platform cloak encryption.
 *
 * Usage:
 * ```bash
 * pnpm script:decrypt                    # Interactive mode
 * pnpm script:decrypt --value "encrypted-value"   # CLI mode
 * ```
 */
runScript({
  name: 'decrypt',
  description: 'Decrypt a value using cloak encryption',
  options: {
    value: {
      type: 'string',
      short: 'v',
      description: 'Value to decrypt',
      message: 'What do you want to decrypt?',
      required: true,
    },
  },
  handler: async ({ value }) => {
    log(await decrypt(value))
  },
})

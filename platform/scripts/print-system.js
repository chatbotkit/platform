import 'dotenv/config'

import { log, runScript } from '@/lib/script'

import os from 'os'

/**
 * Print system information for debugging.
 *
 * Usage:
 * ```bash
 * pnpm script:print-system  # No options required
 * ```
 *
 * This script prints CPU and memory information about the current system.
 */
runScript({
  name: 'print-system',
  description: 'Print system information for debugging',
  options: {},
  handler: async () => {
    for (const [cpu, index] of os.cpus().map((cpu, index) => [cpu, index])) {
      log(`cpu${index}: ${cpu.model}, speed: ${cpu.speed}`)
    }

    log(`totalmem: ${os.totalmem()}`)
    log(`freemem: ${os.freemem()}`)
  },
})

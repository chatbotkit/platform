// @ts-check
import 'dotenv/config'

import queue from '@/lib/queue'
import { log, runScript } from '@/lib/script'

/**
 * Trigger the clock10 system event.
 *
 * Usage:
 * ```bash
 * pnpm script:trigger-clock-10  # No options required
 * ```
 *
 * This script manually triggers the clock10 event which runs
 * scheduled system tasks.
 */
runScript({
  name: 'trigger-clock-10',
  description: 'Trigger the clock10 system event',
  options: {},
  handler: async () => {
    log(`triggering clock10 event`)

    /** @type {import('@/pages/api/system/clock/queue').Clock10Event} */
    const queueData = {
      type: 'clock10',
      payload: {},
    }

    await queue(`/api/system/clock/queue`, queueData)

    log(`done`)
  },
})

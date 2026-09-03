// @ts-check
import 'dotenv/config'

import queue from '@/lib/queue'
import { log, runScript } from '@/lib/script'

/**
 * Trigger the dataset cleanup event.
 *
 * Usage:
 * ```bash
 * pnpm script:trigger-dataset-cleanup  # No options required
 * ```
 *
 * This script manually triggers the dataset cleanup event which
 * removes orphaned or expired dataset records.
 */
runScript({
  name: 'trigger-dataset-cleanup',
  description: 'Trigger the dataset cleanup event',
  options: {},
  handler: async () => {
    log(`triggering dataset cleanup event`)

    /** @type {import('@/pages/api/v1/dataset/queue').CleanupEvent} */
    const queueData = {
      type: 'cleanup',
      payload: {},
    }

    await queue(`/api/v1/dataset/queue`, queueData)

    log(`done`)
  },
})

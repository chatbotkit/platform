// @ts-check
import 'dotenv/config'

import { SECRETS } from '@/config/queue'

import fetch from '@/lib/fetch'
import { log, runScript } from '@/lib/script'

/**
 * Trigger the task stalled event.
 *
 * Usage:
 * ```bash
 * pnpm script:trigger-task-stalled  # No options required
 * ```
 *
 * This script manually triggers the task stalled event which
 * handles tasks that have become stuck. Requires local server on port 8080.
 */
runScript({
  name: 'trigger-task-stalled',
  description: 'Trigger the task stalled event',
  options: {},
  handler: async () => {
    log(`triggering task stalled event`)

    /** @type {import('@/pages/api/v1/task/queue').StalledEvent} */
    const queueData = {
      type: 'stalled',
      payload: {},
    }

    const response = await fetch(
      `http://localhost:8080/api/v1/task/queue?secret=${SECRETS[0]}`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(queueData),
      }
    )

    log(`response`, {
      status: response.status,
      statusText: response.statusText,
      body: await response.text(),
    })
  },
})

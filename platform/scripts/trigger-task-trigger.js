// @ts-check
import 'dotenv/config'

import { SECRETS } from '@/config/queue'

import fetch from '@/lib/fetch'
import { log, runScript } from '@/lib/script'

/**
 * Trigger the task trigger event.
 *
 * Usage:
 * ```bash
 * pnpm script:trigger-task-trigger  # No options required
 * ```
 *
 * This script manually triggers the task trigger event which
 * processes triggered tasks. Requires local server on port 8080.
 */
runScript({
  name: 'trigger-task-trigger',
  description: 'Trigger the task trigger event',
  options: {},
  handler: async () => {
    log(`triggering task trigger event`)

    /** @type {import('@/pages/api/v1/task/queue').TriggerEvent} */
    const queueData = {
      type: 'trigger',
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

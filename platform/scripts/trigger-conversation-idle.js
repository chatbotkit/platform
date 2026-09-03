// @ts-check
import 'dotenv/config'

import { SECRETS } from '@/config/queue'

import fetch from '@/lib/fetch'
import { log, runScript } from '@/lib/script'

/**
 * Trigger a conversation idle event.
 *
 * Usage:
 * ```bash
 * pnpm script:trigger-conversation-idle                             # Interactive mode
 * pnpm script:trigger-conversation-idle --conversationId conv123    # CLI mode
 * ```
 *
 * Note: This requires the local server to be running on port 8080.
 */
runScript({
  name: 'trigger-conversation-idle',
  description: 'Trigger a conversation idle event',
  options: {
    conversationId: {
      type: 'string',
      short: 'c',
      description: 'Conversation ID',
      message:
        'What is the ID of the conversation that will trigger idle event?',
      required: true,
    },
  },
  handler: async ({ conversationId }) => {
    /** @type {import('@/pages/api/v1/conversation/[conversationId]/queue').IdleEvent} */
    const queueData = {
      type: 'idle',
      payload: {},
    }

    const response = await fetch(
      `http://localhost:8080/api/v1/conversation/${conversationId}/queue?secret=${SECRETS[0]}`,
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

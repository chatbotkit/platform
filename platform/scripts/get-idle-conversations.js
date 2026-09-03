import 'dotenv/config'

import { getIdleConversations } from '@/lib/conversation.idle'
import { log, runScript } from '@/lib/script'

/**
 * Find idle conversations that may need attention.
 *
 * Usage:
 * ```bash
 * pnpm script:get-idle-conversations  # No options required
 * ```
 *
 * This script retrieves conversations that have been idle and may
 * need cleanup or follow-up actions.
 */
runScript({
  name: 'get-idle-conversations',
  description: 'Find idle conversations',
  options: {},
  handler: async () => {
    const conversations = await getIdleConversations()

    log(`found ${conversations.length} idle conversations`, {
      conversations,
    })
  },
})

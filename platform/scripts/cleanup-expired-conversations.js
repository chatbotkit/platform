import 'dotenv/config'

import prisma from '@/prisma/client'

import { deleteConversation } from '@/lib/conversation.delete'
import { error } from '@/lib/debug'
import { confirm, log, runScript } from '@/lib/script'

/**
 * Delete expired conversations.
 *
 * Usage:
 * ```bash
 * pnpm script:cleanup-expired-conversations  # Always interactive (confirmation required)
 * ```
 *
 * Warning: This is a destructive operation that cannot be undone.
 */
runScript({
  name: 'cleanup-expired-conversations',
  description: 'Delete expired conversations',
  options: {},
  handler: async () => {
    const query = {
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    }

    const count = await prisma.conversation.count(query)

    if (count) {
      log(`${count} expired conversations found`)
    } else {
      log(`expired conversations not found`)

      return
    }

    const confirmed = await confirm(
      `Do you really want to delete ${count} expired conversations?`
    )

    if (!confirmed) {
      log(`aborted`)

      return
    }

    log(`retrieving expired conversations`)

    const conversations = await prisma.conversation.findMany({
      ...query,

      select: {
        id: true,
        datasetId: true,
      },
    })

    for (const conversation of conversations) {
      log(`deleting expired conversation ${conversation.id}`)

      try {
        await deleteConversation(conversation.id)
      } catch (e) {
        error(`cannot delete conversation`, e)
      }
    }
  },
})

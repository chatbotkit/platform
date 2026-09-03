import prisma from '@/prisma/client'

import { untrackIdlingConversations } from '@/lib/conversation.idle'
import { deleteObjects } from '@/lib/storage'

/**
 * Deletes a conversation and its associated data from the database and S3 storage
 */
export async function deleteConversation(
  conversationId: string
): Promise<void> {
  // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
  await prisma.conversation.delete({
    where: {
      id: conversationId,
    },
  })

  await untrackIdlingConversations([conversationId])

  await deleteObjects('conversation', conversationId)
}

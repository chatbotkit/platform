import prisma from '@/prisma/client'

export async function hasConversation(
  conversationId: string
): Promise<boolean> {
  const conversation = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
    },
  })

  return !!conversation
}

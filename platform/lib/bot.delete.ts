import prisma from '@/prisma/client'
import type { Bot } from '@/prisma/types'

export async function deleteBot(bot: Pick<Bot, 'id'>) {
  // @note because of the bot<>conversation relationship we need to set null to
  // many conversations and this operation could and would timeout - as a result
  // we need to perform a safe batch update over the list of conversations
  // separately and delete accordingly

  await prisma.$transaction(async (tx) => {
    await tx.conversation.updateMany({
      where: { botId: bot.id },
      data: { botId: null },
    })
    // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
    await tx.bot.delete({
      where: { id: bot.id },
    })
  })

  // @todo record audit log
}

export async function deleteManyBots(bots: Pick<Bot, 'id'>[]) {
  if (bots.length === 0) {
    return
  }

  const botIds = bots.map((bot) => bot.id)

  await prisma.$transaction(async (tx) => {
    await tx.conversation.updateMany({
      where: { botId: { in: botIds } },
      data: { botId: null },
    })
    // eslint-disable-next-line custom-eslint-rules/require-safe-prisma-delete
    await tx.bot.deleteMany({
      where: { id: { in: botIds } },
    })
  })

  // @todo record audit log
}

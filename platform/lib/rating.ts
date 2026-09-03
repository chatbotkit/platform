import { slidingWindow } from '@/lib/ratelimit'

export async function ratingLimitOK({
  ipAddress,
  userId,
  botId,
  conversationId,
  messageId,
}: {
  ipAddress?: string | null
  userId: string
  botId?: string | null
  conversationId?: string | null
  messageId?: string | null
}): Promise<boolean> {
  const suffix = Object.entries({
    ip: ipAddress,
    user: userId,
    bot: botId,
    conversation: conversationId,
    message: messageId,
  })
    .filter(([, value]) => !!value)
    .map(([name, value]) => `${name}-${value}`)
    .join('-')

  const { success } = await slidingWindow(`rating-${suffix}`, 1, '60 m') // @todo make this configurable

  return success
}

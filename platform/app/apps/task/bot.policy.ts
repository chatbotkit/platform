import { throwBadRequest } from '@/lib/response'

type TaskBotConfig = {
  bots?: Array<string | { id: string }>
}

export function getAllowedBotIds(config: TaskBotConfig): string[] | null {
  if (!config.bots) {
    return null
  }

  return config.bots.map((bot) => (typeof bot === 'string' ? bot : bot.id))
}

export function assertAllowedBotId(
  allowedBotIds: string[] | null,
  botId?: string
) {
  if (!botId || !allowedBotIds) {
    return
  }

  if (!allowedBotIds.includes(botId)) {
    throwBadRequest(`Bot ${botId} is not allowed for this app`)
  }
}

import debug from '@/lib/debug'
import { SystemError } from '@/lib/error'
import fetch from '@/lib/fetch'
import { CONFLICT_CODE, statusToCodeMap } from '@/lib/response'

interface DiscordIntegration {
  botToken: string
}

interface DiscordErrorResponse {
  message?: string
  code?: number
}

export async function fetchAPI(
  discordIntegration: DiscordIntegration,
  method: string,
  api: string,
  data?: Record<string, unknown>
): Promise<void | Record<string, unknown> | Record<string, unknown>[]> {
  const url = `https://discord.com/api/v10/${api}`

  debug(`fetch api`, { method, url })

  const headers: Record<string, string> = {
    Authorization: `Bot ${discordIntegration.botToken}`,
  }

  let body: string | undefined

  if (['POST', 'PATCH'].includes(method)) {
    headers['Content-Type'] = 'application/json'

    body = JSON.stringify(data)
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  })

  if (!response.ok) {
    const text = await response.text()

    let json: DiscordErrorResponse

    try {
      json = JSON.parse(text)
    } catch {
      throw new SystemError(`Cannot parse Discord API response`, CONFLICT_CODE)
    }

    const discordMessage =
      json.message?.split(':').slice(1).join(':') || json.message || '-'

    const discordCode =
      statusToCodeMap[json.code as keyof typeof statusToCodeMap] ||
      statusToCodeMap[parseInt(json.message?.split(':')[0] || '0')] ||
      CONFLICT_CODE

    const message = `Unexpected Discord API response: ${discordMessage}`

    const code = discordCode

    throw new SystemError(message, code)
  }

  if (['GET', 'POST'].includes(method)) {
    return await response.json()
  }
}

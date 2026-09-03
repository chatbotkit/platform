import { parse as parseStructStr } from '@/lib/structstr'

type TwilioVoiceOptions = {
  language?: string
  voice?: string
  provider?: string
}

export function parseTwilioVoiceOptions(
  voice: string | null | undefined
): TwilioVoiceOptions {
  if (!voice) {
    return {}
  }

  const { name, config } = parseStructStr(voice)

  return {
    provider: name,
    language: config.language ? String(config.language) : undefined,
    voice: config.voice ? String(config.voice) : undefined,
  }
}

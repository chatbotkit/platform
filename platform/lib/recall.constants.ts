export const DEFAULT_RECALL_REGION = 'us-east-1'

export const RECALL_REGIONS = [
  'us-west-2',
  'us-east-1',
  'eu-central-1',
  'ap-northeast-1',
] as const

export type RecallRegion = (typeof RECALL_REGIONS)[number]

export const RECALL_REGION_LABELS: Record<RecallRegion, string> = {
  'us-west-2': 'US West',
  'us-east-1': 'US East',
  'eu-central-1': 'EU',
  'ap-northeast-1': 'Asia Pacific',
}

export const RECALL_SEND_AVATAR_MESSAGE_FUNCTION_NAME = 'sendAvatarMessage'

// @note recall uses this diarization speaker id for audio output by the bot
export const RECALL_BOT_OUTPUT_SPEAKER_ID = 2147483647

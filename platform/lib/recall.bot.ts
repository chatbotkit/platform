import relay from '@chatbotkit-dev/relay'

import cuid from '@/lib/cuid'
import { fetch } from '@/lib/fetch'
import { getExternalFrontendHostURL } from '@/lib/host'
import {
  DEFAULT_RECALL_REGION,
  RECALL_REGIONS,
  type RecallRegion,
} from '@/lib/recall.constants'
import {
  RECALL_REALTIME_EVENT_TYPES,
  RecallApiErrorSchema,
  RecallBotSchema,
  RecallCreateBotRequestSchema,
  RecallOutputMediaRequestSchema,
  RecallSendChatMessageRequestSchema,
  RecallStopOutputMediaRequestSchema,
} from '@/lib/recall.schemas'
import type { RecallBot } from '@/lib/recall.schemas'
import {
  createRecallMeetingSession,
  deleteRecallMeetingSession,
  updateRecallMeetingSession,
} from '@/lib/recall.session'

export {
  DEFAULT_RECALL_REGION,
  RECALL_BOT_OUTPUT_SPEAKER_ID,
  RECALL_REGION_LABELS,
  RECALL_REGIONS,
} from '@/lib/recall.constants'

export function normalizeRecallRegion(region?: string | null): RecallRegion {
  return RECALL_REGIONS.includes(region as RecallRegion)
    ? (region as RecallRegion)
    : DEFAULT_RECALL_REGION
}

export function getRecallRegionStorageValue(region?: string | null) {
  const recallRegion = normalizeRecallRegion(region)

  return recallRegion === DEFAULT_RECALL_REGION ? null : recallRegion
}

export function createRecallApiUrl(
  region: string | null | undefined,
  pathname: string
) {
  const recallRegion = normalizeRecallRegion(region)

  return new URL(pathname, `https://${recallRegion}.recall.ai`).toString()
}

export const RECALL_BOT_CREATE_URL = createRecallApiUrl(
  DEFAULT_RECALL_REGION,
  '/api/v1/bot/'
)

export const RECALL_REALTIME_EVENTS = [...RECALL_REALTIME_EVENT_TYPES]

export interface RecallMeetingSeed {
  mode: 'unknown' | 'single' | 'team'
  participantCount: number
  confidence: 'unknown' | 'snapshot'
  participants: { id: string }[]
}

export async function parseRecallResponse<T = unknown>(
  response: Response
): Promise<T | string | null> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function formatRecallError(data: unknown, status: number) {
  const error = RecallApiErrorSchema.safeParse(data)

  if (error.success) {
    if (error.data.detail !== undefined) {
      return String(error.data.detail)
    }

    if (error.data.message !== undefined) {
      return String(error.data.message)
    }
  }

  if (typeof data === 'string') {
    return data
  }

  if (typeof data === 'object' && data) {
    return JSON.stringify(data)
  }

  return `Recall bot creation failed with status ${status}`
}

export function createRecallRelayChannelUrl(
  channelId: string,
  side: string,
  options: { events?: boolean } = {}
) {
  return relay.channelUrl(channelId, side, options)
}

export function createRecallCameraUrl({
  recallIntegrationId,
  sessionId,
}: {
  recallIntegrationId: string
  sessionId: string
}) {
  const url = new URL(
    `/integrations/recall/${recallIntegrationId}/camera`,
    getExternalFrontendHostURL('/')
  )

  url.searchParams.set('sessionId', sessionId)

  return url.toString()
}

export function createRecallScreenshareUrl({
  recallIntegrationId,
  url: screenshareUrl,
}: {
  recallIntegrationId: string
  url: string
}): string {
  const url = new URL(
    `/integrations/recall/${recallIntegrationId}/screenshare`,
    getExternalFrontendHostURL('/')
  )

  url.searchParams.set('url', screenshareUrl)

  return url.toString()
}

export async function startRecallScreenshare({
  apiKey,
  recallBotId,
  recallIntegrationId,
  region,
  url,
}: {
  apiKey: string
  recallBotId: string
  recallIntegrationId: string
  region?: string | null
  url: string
}): Promise<{
  data: RecallBot | string | null
  url: string
}> {
  const screenshare = createRecallScreenshareUrl({
    recallIntegrationId,
    url,
  })
  const payload = RecallOutputMediaRequestSchema.parse({
    screenshare: {
      kind: 'webpage',
      config: {
        url: screenshare,
      },
    },
  })

  const response = await fetch(
    createRecallApiUrl(
      region,
      `/api/v1/bot/${encodeURIComponent(recallBotId)}/output_media/`
    ),
    {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await parseRecallResponse<RecallBot>(response)

  if (!response.ok) {
    throw new Error(formatRecallError(data, response.status))
  }

  return {
    data,
    url: screenshare,
  }
}

export async function stopRecallScreenshare({
  apiKey,
  recallBotId,
  region,
}: {
  apiKey: string
  recallBotId: string
  region?: string | null
}): Promise<unknown> {
  const payload = RecallStopOutputMediaRequestSchema.parse({
    screenshare: true,
  })

  const response = await fetch(
    createRecallApiUrl(
      region,
      `/api/v1/bot/${encodeURIComponent(recallBotId)}/output_media/`
    ),
    {
      method: 'DELETE',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await parseRecallResponse(response)

  if (!response.ok) {
    throw new Error(formatRecallError(data, response.status))
  }

  return data
}

export async function pauseRecallRecording({
  apiKey,
  recallBotId,
  region,
}: {
  apiKey: string
  recallBotId: string
  region?: string | null
}) {
  const response = await fetch(
    createRecallApiUrl(
      region,
      `/api/v1/bot/${encodeURIComponent(recallBotId)}/pause_recording/`
    ),
    {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    }
  )

  const data = await parseRecallResponse(response)

  if (!response.ok) {
    throw new Error(formatRecallError(data, response.status))
  }

  return data
}

export async function resumeRecallRecording({
  apiKey,
  recallBotId,
  region,
}: {
  apiKey: string
  recallBotId: string
  region?: string | null
}) {
  const response = await fetch(
    createRecallApiUrl(
      region,
      `/api/v1/bot/${encodeURIComponent(recallBotId)}/resume_recording/`
    ),
    {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    }
  )

  const data = await parseRecallResponse(response)

  if (!response.ok) {
    throw new Error(formatRecallError(data, response.status))
  }

  return data
}

export async function leaveRecallMeeting({
  apiKey,
  recallBotId,
  region,
}: {
  apiKey: string
  recallBotId: string
  region?: string | null
}) {
  const response = await fetch(
    createRecallApiUrl(
      region,
      `/api/v1/bot/${encodeURIComponent(recallBotId)}/leave_call/`
    ),
    {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({}),
    }
  )

  const data = await parseRecallResponse(response)

  if (!response.ok) {
    throw new Error(formatRecallError(data, response.status))
  }

  return data
}

export async function sendRecallChatMessage({
  apiKey,
  message,
  recallBotId,
  region,
  to = 'everyone',
}: {
  apiKey: string
  message: string
  recallBotId: string
  region?: string | null
  to?: string
}) {
  const payload = RecallSendChatMessageRequestSchema.parse({
    to,
    message,
  })

  const response = await fetch(
    createRecallApiUrl(
      region,
      `/api/v1/bot/${encodeURIComponent(recallBotId)}/send_chat_message/`
    ),
    {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await parseRecallResponse(response)

  if (!response.ok) {
    throw new Error(formatRecallError(data, response.status))
  }

  return data
}

export async function getRecallMeetingSeed({
  recallBotId,
}: {
  apiKey: string
  recallBotId?: string | null
  region?: string | null
}): Promise<RecallMeetingSeed> {
  // @note Recall does not expose a reliable live participant snapshot when a
  // bot joins an already-running call. Participant download artifacts are
  // produced later and are often unavailable while the recording is processing,
  // so the camera frame builds live participant state from realtime events.
  void recallBotId

  return {
    mode: 'unknown',
    participantCount: 0,
    confidence: 'unknown',
    participants: [],
  }
}

export async function joinMeeting({
  recallIntegration,
  meetingUrl,
  text,
  botName,
  joinAt,
}: {
  recallIntegration: {
    id: string
    apiKey: string
    region?: string | null
    userId: string
  }
  meetingUrl: string
  text: string
  botName?: string | null
  joinAt?: string | null
}): Promise<RecallBot> {
  const channelId = `recall-${cuid()}-${cuid()}`

  const recallRelayUrl = createRecallRelayChannelUrl(channelId, 'recall')
  const pageRelayUrl = createRecallRelayChannelUrl(channelId, 'page', {
    events: true,
  })

  const recallSession = await createRecallMeetingSession({
    recallIntegrationId: recallIntegration.id,
    userId: recallIntegration.userId,
    pageRelayUrl,
    text,
    botName,
  })

  const camera = createRecallCameraUrl({
    recallIntegrationId: recallIntegration.id,
    sessionId: recallSession.id,
  })

  const payload = RecallCreateBotRequestSchema.parse({
    meeting_url: meetingUrl,
    ...(botName ? { bot_name: botName } : null),
    ...(joinAt ? { join_at: joinAt } : null),
    // Recall echoes `metadata` back on every bot status webhook event under
    // `bot.metadata`, so the webhook receiver can identify which integration
    // and session the event belongs to without a separate lookup table.
    metadata: {
      recallIntegrationId: recallIntegration.id,
      sessionId: recallSession.id,
    },
    variant: {
      zoom: 'web_4_core',
      google_meet: 'web_4_core',
      microsoft_teams: 'web_4_core',
    },
    recording_config: {
      video_mixed_mp4: {},
      audio_mixed_mp3: {},
      include_bot_in_recording: {
        audio: true,
      },
      realtime_endpoints: [
        {
          type: 'websocket',
          url: recallRelayUrl,
          events: RECALL_REALTIME_EVENTS,
        },
      ],
      transcript: {
        provider: {
          recallai_streaming: {
            mode: 'prioritize_low_latency',
            language_code: 'en',
          },
        },
        diarization: {
          use_separate_streams_when_available: true,
        },
      },
    },
    output_media: {
      camera: {
        kind: 'webpage',
        config: {
          url: camera,
        },
      },
    },
  })

  const response = await fetch(
    createRecallApiUrl(recallIntegration.region, '/api/v1/bot/'),
    {
      method: 'POST',
      headers: {
        Authorization: recallIntegration.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )

  const data = await parseRecallResponse(response)

  if (!response.ok) {
    await deleteRecallMeetingSession(recallSession.id)

    throw new Error(formatRecallError(data, response.status))
  }

  const bot = RecallBotSchema.safeParse(data)

  if (!bot.success) {
    await deleteRecallMeetingSession(recallSession.id)

    throw new Error('Recall bot creation returned an unexpected response')
  }

  const updatedSession = await updateRecallMeetingSession(recallSession.id, {
    recallBotId: bot.data.id,
  })

  if (!updatedSession) {
    throw new Error('Recall session expired before bot creation completed')
  }

  return bot.data
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import fetch from '@/lib/fetch'
import {
  RECALL_BOT_OUTPUT_SPEAKER_ID,
  RECALL_SEND_AVATAR_MESSAGE_FUNCTION_NAME,
} from '@/lib/recall.constants'
import {
  RECALL_CHAT_MESSAGE_EVENT_TYPE,
  RECALL_PARTICIPANT_EVENT_TYPES,
  RECALL_PARTICIPANT_LEAVE_EVENT_TYPE,
  RECALL_TRANSCRIPT_DATA_EVENT_TYPE,
  RECALL_TRANSCRIPT_EVENT_TYPES,
  RecallChatMessageEventDataSchema,
  RecallParticipantEventDataSchema,
  RecallTranscriptEventDataSchema,
} from '@/lib/recall.schemas'
import type {
  RecallChatMessageEventData,
  RecallParticipant,
  RecallParticipantEventData,
  RecallTranscriptEventData,
} from '@/lib/recall.schemas'
import { getRecallMeetingSession } from '@/lib/recall.session'
import { makeJsonSafe } from '@/lib/struct'

import useAvatarTransport from '@/hooks/useAvatarTransport'
import useConversationManager from '@/hooks/useConversationManager'
import useEventChannel from '@/hooks/useEventChannel'
import type { EventChannel } from '@/hooks/useEventChannel'

// --- Constants ---

const MEETING_MODE_UNKNOWN = 'unknown'
const MEETING_MODE_SINGLE = 'single'
const MEETING_MODE_TEAM = 'team'

const RECALL_EVENT_PARTICIPANT = 'recall-participant'
const RECALL_EVENT_TRANSCRIPT = 'recall-transcript'
const RECALL_EVENT_MESSAGE = 'recall-message'
const MEETING_EVENT_SEED = 'meeting-seed'
const MEETING_EVENT_SPEAKER_CHANGE = 'speaker-change'
const MEETING_EVENT_TURN = 'meeting-turn'

const MEETING_TURN_IDLE_MS = 1200

const VIDEO_BACKGROUND_URL_PATTERN = /\.(mp4|m4v|mov|ogv|webm)(?:[?#].*)?$/i

// --- Meeting types ---

type MeetingMode =
  | typeof MEETING_MODE_UNKNOWN
  | typeof MEETING_MODE_SINGLE
  | typeof MEETING_MODE_TEAM

type MeetingParticipant = Omit<RecallParticipant, 'id'> & {
  // Single internal participant shape. Recall's realtime events use integer IDs
  // while the seed (from `/session/create`, sourced from calendar attendees /
  // manual entry) uses string IDs - both are coerced to string at the boundary
  // via `toMeetingParticipant` so downstream code only ever sees `id: string`.
  id: string
  isBot?: boolean
}

type MeetingTurnSource = 'voice' | 'chat'

type VoiceTurn = {
  participant: MeetingParticipant | null
  parts: string[]
}

type ChatTurn = {
  participant: MeetingParticipant | null
  text: string
}

// --- Tool types ---

type ToolFunction = {
  name: string
  description: string
  parameters: Record<string, unknown>
  handler: (args?: Record<string, unknown>) => Promise<Record<string, unknown>>
}

// --- Recall realtime envelope (wire shape) ---
//
// The realtime relay WebSocket wraps every Recall payload in this envelope
// before it reaches the channel. `type` is Recall's event-type string
// (e.g. `transcript.data`); `message` is the full Recall payload object whose
// inner `data.data` field is the payload modelled by the Zod schemas.

type RecallEnvelopeEventType =
  | (typeof RECALL_PARTICIPANT_EVENT_TYPES)[number]
  | typeof RECALL_CHAT_MESSAGE_EVENT_TYPE
  | (typeof RECALL_TRANSCRIPT_EVENT_TYPES)[number]
  | 'unknown'

type RecallRealtimeEnvelope = {
  type: RecallEnvelopeEventType
  message?: Record<string, unknown>
  raw?: unknown
  text?: string
}

type RecallParticipantEnvelope = RecallRealtimeEnvelope & {
  type: (typeof RECALL_PARTICIPANT_EVENT_TYPES)[number]
}

type RecallChatMessageEnvelope = RecallRealtimeEnvelope & {
  type: typeof RECALL_CHAT_MESSAGE_EVENT_TYPE
}

type RecallTranscriptEnvelope = RecallRealtimeEnvelope & {
  type: (typeof RECALL_TRANSCRIPT_EVENT_TYPES)[number]
}

// --- Channel events (discriminated union) ---

// `RecallFrameEvent` is the discriminated union flowing through the in-page
// `EventChannel`. Three variants wrap a Recall envelope plus its pre-parsed
// `payload`, so downstream subscribers don't each re-run the Zod parse.

type RecallParticipantChannelEvent = {
  type: typeof RECALL_EVENT_PARTICIPANT
  envelope: RecallParticipantEnvelope
  payload: RecallParticipantEventData | null
}

type RecallTranscriptChannelEvent = {
  type: typeof RECALL_EVENT_TRANSCRIPT
  envelope: RecallTranscriptEnvelope
  payload: RecallTranscriptEventData | null
}

type RecallChatMessageChannelEvent = {
  type: typeof RECALL_EVENT_MESSAGE
  envelope: RecallChatMessageEnvelope
  payload: RecallChatMessageEventData | null
}

type MeetingSeedChannelEvent = {
  type: typeof MEETING_EVENT_SEED
  meeting?: {
    participants?: MeetingParticipant[]
  }
}

type MeetingSpeakerChangeChannelEvent = {
  type: typeof MEETING_EVENT_SPEAKER_CHANGE
  participantId: string
  previousParticipantId: string
  transcriptEventType: string
  isBotSpeaker: boolean
}

type MeetingTurnChannelEvent = {
  type: typeof MEETING_EVENT_TURN
  source: MeetingTurnSource
  text: string
  participant: MeetingParticipant | null
}

type RecallFrameEvent =
  | RecallParticipantChannelEvent
  | RecallTranscriptChannelEvent
  | RecallChatMessageChannelEvent
  | MeetingSeedChannelEvent
  | MeetingSpeakerChangeChannelEvent
  | MeetingTurnChannelEvent

// --- Hook option shapes ---

type RecallHookOptions = {
  disabled?: boolean
  recallIntegrationId?: string
  sessionId?: string
}

type MeetingEventsOptions = {
  disabled?: boolean
  meetingEvents?: EventChannel<RecallFrameEvent>
}

// --- Meeting helpers ---

/**
 * Coerce any raw participant (Recall integer-id or seed string-id) into the
 * internal `MeetingParticipant` shape with `id: string`.
 */
function toMeetingParticipant<T extends { id: string | number }>(
  participant: T
): Omit<T, 'id'> & { id: string } {
  return { ...participant, id: String(participant.id) }
}

function createMeetingBotParticipant(botName?: string | null) {
  return {
    id: String(RECALL_BOT_OUTPUT_SPEAKER_ID),
    isBot: true,
    name: botName || null,
  }
}

function createMeetingParticipantsWithBot(botName?: string | null) {
  const botParticipant = createMeetingBotParticipant(botName)

  return new Map<string, MeetingParticipant>([
    [botParticipant.id, botParticipant],
  ])
}

function normalizeMeetingParticipant(
  participant: MeetingParticipant,
  botName?: string | null
): MeetingParticipant {
  if (
    participant.id === String(RECALL_BOT_OUTPUT_SPEAKER_ID) ||
    participant.isBot === true
  ) {
    const botParticipant = createMeetingBotParticipant(botName)

    return {
      ...botParticipant,
      name: participant.name || botParticipant.name,
    }
  }

  return participant
}

/**
 * Format a participant name for display in the meeting agent prompt.
 */
function getMeetingParticipantName(
  participant?: {
    id?: string
    name?: string | null
    isBot?: boolean
  } | null
) {
  const participantName =
    typeof participant?.name === 'string' ? participant.name.trim() : ''

  if (participantName) {
    return participantName
  }

  const unknownParticipantName =
    participant?.isBot === true ? 'unknown bot' : 'unknown user'

  return participant?.id
    ? `${unknownParticipantName} - ${participant.id}`
    : unknownParticipantName
}

// --- Transcript helpers ---

function getRecallTranscriptText(payload: RecallTranscriptEventData | null) {
  return (payload?.words || [])
    .map((word) => word?.text)
    .filter(Boolean)
    .join(' ')
    .trim()
}

// --- Event helpers ---

const PARTICIPANT_EVENT_TYPE_SET: ReadonlySet<string> = new Set(
  RECALL_PARTICIPANT_EVENT_TYPES
)
const TRANSCRIPT_EVENT_TYPE_SET: ReadonlySet<string> = new Set(
  RECALL_TRANSCRIPT_EVENT_TYPES
)

function normalizeRecallEnvelopeType(value: string): RecallEnvelopeEventType {
  if (
    PARTICIPANT_EVENT_TYPE_SET.has(value) ||
    TRANSCRIPT_EVENT_TYPE_SET.has(value) ||
    value === RECALL_CHAT_MESSAGE_EVENT_TYPE
  ) {
    return value as RecallEnvelopeEventType
  }

  return 'unknown'
}

function isParticipantEnvelope(
  envelope: RecallRealtimeEnvelope
): envelope is RecallParticipantEnvelope {
  return PARTICIPANT_EVENT_TYPE_SET.has(envelope.type)
}

function isTranscriptEnvelope(
  envelope: RecallRealtimeEnvelope
): envelope is RecallTranscriptEnvelope {
  return TRANSCRIPT_EVENT_TYPE_SET.has(envelope.type)
}

function isChatMessageEnvelope(
  envelope: RecallRealtimeEnvelope
): envelope is RecallChatMessageEnvelope {
  return envelope.type === RECALL_CHAT_MESSAGE_EVENT_TYPE
}

function getRecallEnvelopeInnerData(envelope: RecallRealtimeEnvelope) {
  const outer = envelope.message?.data

  if (!outer || typeof outer !== 'object' || Array.isArray(outer)) {
    return undefined
  }

  return (outer as Record<string, unknown>).data
}

// --- Tools ---

export function useBackground({
  disabled = false,
}: { disabled?: boolean } = {}) {
  const [background, setBackground] = useState<{
    type: 'image' | 'video' | 'color'
    value: string
  } | null>(null)

  const functions = useMemo<ToolFunction[]>(
    () =>
      disabled
        ? []
        : [
            {
              name: 'setMeetingBackground',
              description:
                'Change the meeting background. Use either an image/video URL or a CSS color value.',
              parameters: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description:
                      'Image or video URL to use as the meeting background.',
                  },
                  color: {
                    type: 'string',
                    description:
                      'CSS color value to use as the meeting background, for example #0f172a.',
                  },
                },
              },
              handler: async (args = {}) => {
                const url = typeof args.url === 'string' ? args.url.trim() : ''

                const color =
                  typeof args.color === 'string' ? args.color.trim() : ''

                if (url) {
                  const type = VIDEO_BACKGROUND_URL_PATTERN.test(url)
                    ? 'video'
                    : 'image'

                  debug(`setting meeting background ${type}`, {
                    hasUrl: true,
                  }).log('integration.recall.camera.background')

                  setBackground({
                    type,
                    value: url,
                  })

                  return {
                    changed: true,
                    type,
                  }
                }

                if (color) {
                  debug('setting meeting background color', {
                    color,
                  }).log('integration.recall.camera.background')

                  setBackground({
                    type: 'color',
                    value: color,
                  })

                  return {
                    changed: true,
                    type: 'color',
                  }
                }

                return {
                  changed: false,
                }
              },
            },
          ],
    [disabled]
  )

  const render = disabled ? null : (
    <div
      className="fixed inset-0 h-full w-full"
      style={{
        backgroundColor:
          background?.type === 'color' ? background.value : '#000000',
      }}
    >
      {background?.type === 'image' ? (
        <img
          alt=""
          className="h-full w-full object-cover"
          src={background.value}
        />
      ) : null}

      {background?.type === 'video' ? (
        <video
          autoPlay
          className="h-full w-full object-cover"
          loop
          muted
          playsInline
          src={background.value}
        />
      ) : null}
    </div>
  )

  return {
    functions,
    render,
  }
}

export function useSound({ disabled = false }: { disabled?: boolean } = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(
    () => () => {
      audioRef.current?.pause()
      audioRef.current = null
    },
    []
  )

  const functions = useMemo<ToolFunction[]>(
    () =>
      disabled
        ? []
        : [
            {
              name: 'playSound',
              description:
                'Play a sound in the meeting from an audio file URL.',
              parameters: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description:
                      'The URL of the audio file to play in the meeting.',
                  },
                },
                required: ['url'],
              },
              handler: async (args = {}) => {
                const url = typeof args.url === 'string' ? args.url.trim() : ''

                if (!url) {
                  debug('skipping sound playback - missing url').log(
                    'integration.recall.camera.sound'
                  )

                  return {
                    played: false,
                  }
                }

                audioRef.current?.pause()

                const audio = new Audio(url)

                audioRef.current = audio

                try {
                  await audio.play()

                  return {
                    played: true,
                  }
                } catch (error) {
                  debug('failed to play sound', {
                    message:
                      error instanceof Error
                        ? error.message
                        : 'Unknown playback error',
                  }).log('integration.recall.camera.sound')

                  return {
                    played: false,
                    message:
                      error instanceof Error
                        ? error.message
                        : 'Failed to play sound',
                  }
                }
              },
            },
          ],
    [disabled]
  )

  return {
    functions,
  }
}

export function useScreenshare({
  disabled = false,

  recallIntegrationId,

  sessionId,
}: RecallHookOptions = {}) {
  const functions = useMemo<ToolFunction[]>(() => {
    const ready = recallIntegrationId && sessionId

    const startUrl = ready
      ? `/api/v1/integration/recall/${recallIntegrationId}/session/${sessionId}/screenshare/start`
      : ''

    const stopUrl = ready
      ? `/api/v1/integration/recall/${recallIntegrationId}/session/${sessionId}/screenshare/stop`
      : ''

    return disabled
      ? []
      : [
          {
            name: 'startScreenshare',
            description:
              'Start sharing the meeting assistant screen into the meeting.',
            parameters: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description:
                    'The URL to load inside the meeting screenshare.',
                },
              },
              required: ['url'],
            },
            handler: async (args = {}) => {
              if (!startUrl) {
                debug('skipping screenshare start - missing url').log(
                  'integration.recall.camera.screenshare'
                )

                return {
                  started: false,
                }
              }

              const url = typeof args.url === 'string' ? args.url.trim() : ''

              if (!url) {
                debug('skipping screenshare start - missing target url').log(
                  'integration.recall.camera.screenshare'
                )

                return {
                  started: false,
                }
              }

              const response = await fetch(startUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  url,
                }),
              })

              if (!response.ok) {
                const error = await response.json().catch(() => ({}))

                debug('failed to start screenshare', {
                  status: response.status,
                  message: error.message,
                }).log('integration.recall.camera.screenshare')

                return {
                  started: false,
                  message: error.message || 'Failed to start screenshare',
                }
              }

              return {
                started: true,
              }
            },
          },
          {
            name: 'stopScreenshare',
            description:
              'Stop sharing the meeting assistant screen into the meeting.',
            parameters: {
              type: 'object',
              properties: {},
            },
            handler: async () => {
              if (!stopUrl) {
                debug('skipping screenshare stop - missing url').log(
                  'integration.recall.camera.screenshare'
                )

                return {
                  stopped: false,
                }
              }

              const response = await fetch(stopUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              })

              if (!response.ok) {
                const error = await response.json().catch(() => ({}))

                debug('failed to stop screenshare', {
                  status: response.status,
                  message: error.message,
                }).log('integration.recall.camera.screenshare')

                return {
                  stopped: false,
                  message: error.message || 'Failed to stop screenshare',
                }
              }

              return {
                stopped: true,
              }
            },
          },
        ]
  }, [disabled, recallIntegrationId, sessionId])

  return {
    functions,
  }
}

export function useRecording({
  disabled = false,

  recallIntegrationId,

  sessionId,
}: RecallHookOptions = {}) {
  const functions = useMemo<ToolFunction[]>(() => {
    const ready = recallIntegrationId && sessionId

    const pauseUrl = ready
      ? `/api/v1/integration/recall/${recallIntegrationId}/session/${sessionId}/recording/pause`
      : ''

    const resumeUrl = ready
      ? `/api/v1/integration/recall/${recallIntegrationId}/session/${sessionId}/recording/resume`
      : ''

    return disabled
      ? []
      : [
          {
            name: 'pauseRecording',
            description: 'Pause the meeting recording.',
            parameters: {
              type: 'object',
              properties: {},
            },
            handler: async () => {
              if (!pauseUrl) {
                debug('skipping recording pause - missing url').log(
                  'integration.recall.camera.recording'
                )

                return {
                  paused: false,
                }
              }

              const response = await fetch(pauseUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              })

              if (!response.ok) {
                const error = await response.json().catch(() => ({}))

                debug('failed to pause recording', {
                  status: response.status,
                  message: error.message,
                }).log('integration.recall.camera.recording')

                return {
                  paused: false,
                  message: error.message || 'Failed to pause recording',
                }
              }

              return {
                paused: true,
              }
            },
          },
          {
            name: 'resumeRecording',
            description: 'Resume the meeting recording.',
            parameters: {
              type: 'object',
              properties: {},
            },
            handler: async () => {
              if (!resumeUrl) {
                debug('skipping recording resume - missing url').log(
                  'integration.recall.camera.recording'
                )

                return {
                  resumed: false,
                }
              }

              const response = await fetch(resumeUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              })

              if (!response.ok) {
                const error = await response.json().catch(() => ({}))

                debug('failed to resume recording', {
                  status: response.status,
                  message: error.message,
                }).log('integration.recall.camera.recording')

                return {
                  resumed: false,
                  message: error.message || 'Failed to resume recording',
                }
              }

              return {
                resumed: true,
              }
            },
          },
        ]
  }, [disabled, recallIntegrationId, sessionId])

  return {
    functions,
  }
}

export function useLeave({
  disabled = false,

  recallIntegrationId,

  sessionId,
}: RecallHookOptions = {}) {
  const functions = useMemo<ToolFunction[]>(() => {
    const leaveUrl =
      recallIntegrationId && sessionId
        ? `/api/v1/integration/recall/${recallIntegrationId}/session/${sessionId}/leave`
        : ''

    return disabled
      ? []
      : [
          {
            name: 'leaveMeeting',
            description: 'Leave the meeting.',
            parameters: {
              type: 'object',
              properties: {},
            },
            handler: async () => {
              if (!leaveUrl) {
                debug('skipping meeting leave - missing url').log(
                  'integration.recall.camera.leave'
                )

                return {
                  left: false,
                }
              }

              const response = await fetch(leaveUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
              })

              if (!response.ok) {
                const error = await response.json().catch(() => ({}))

                debug('failed to leave meeting', {
                  status: response.status,
                  message: error.message,
                }).log('integration.recall.camera.leave')

                return {
                  left: false,
                  message: error.message || 'Failed to leave meeting',
                }
              }

              return {
                left: true,
              }
            },
          },
        ]
  }, [disabled, recallIntegrationId, sessionId])

  return {
    functions,
  }
}

export function useMessage({
  disabled = false,

  recallIntegrationId,

  sessionId,
}: RecallHookOptions = {}) {
  const functions = useMemo<ToolFunction[]>(() => {
    const sendUrl =
      recallIntegrationId && sessionId
        ? `/api/v1/integration/recall/${recallIntegrationId}/session/${sessionId}/message/send`
        : ''

    return disabled
      ? []
      : [
          {
            name: 'sendChatMessage',
            description: 'Send a chat message to the meeting.',
            parameters: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'The chat message to send.',
                },
                to: {
                  type: 'string',
                  description:
                    'Optional recipient. Defaults to everyone in the meeting.',
                },
              },
              required: ['message'],
            },
            handler: async (args = {}) => {
              if (!sendUrl) {
                debug('skipping chat message - missing url').log(
                  'integration.recall.camera.chat'
                )

                return {
                  sent: false,
                }
              }

              const message =
                typeof args.message === 'string' ? args.message.trim() : ''

              const to = typeof args.to === 'string' ? args.to.trim() : ''

              if (!message) {
                debug('skipping chat message - missing message').log(
                  'integration.recall.camera.chat'
                )

                return {
                  sent: false,
                }
              }

              const response = await fetch(sendUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message,
                  ...(to ? { to } : null),
                }),
              })

              if (!response.ok) {
                const error = await response.json().catch(() => ({}))

                debug('failed to send chat message', {
                  status: response.status,
                  message: error.message,
                }).log('integration.recall.camera.chat')

                return {
                  sent: false,
                  message: error.message || 'Failed to send chat message',
                }
              }

              return {
                sent: true,
              }
            },
          },
        ]
  }, [disabled, recallIntegrationId, sessionId])

  return {
    functions,
  }
}

export function useAvatar({
  disabled = false,

  meetingEvents,

  meetingMode = MEETING_MODE_UNKNOWN,
}: MeetingEventsOptions & { meetingMode?: MeetingMode } = {}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const [avatarUrl, setAvatarUrl] = useState('')

  const targetOrigin = useMemo(() => {
    if (!avatarUrl) {
      return '*'
    }

    try {
      return new URL(avatarUrl, window.location.href).origin
    } catch {
      return '*'
    }
  }, [avatarUrl])

  const getTargetWindow = useCallback(
    () =>
      disabled || !avatarUrl ? null : iframeRef.current?.contentWindow || null,
    [avatarUrl, disabled]
  )

  const avatarTransport = useAvatarTransport({
    disabled,
    source: 'recall-frame',
    targetOrigin,
    targetWindow: getTargetWindow,
  })

  const functions = useMemo<ToolFunction[]>(() => {
    if (disabled) {
      return []
    }

    const functions: ToolFunction[] = [
      {
        name: 'loadAvatarUrl',
        description:
          'Load a fullscreen avatar (AI agent) iframe on top of the meeting background.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description:
                'URL of the avatar (AI agent) page to load in the iframe.',
            },
          },
          required: ['url'],
        },
        handler: async (args = {}) => {
          const url = typeof args.url === 'string' ? args.url.trim() : ''

          if (!url) {
            debug('skipping avatar load - missing url').log(
              'integration.recall.camera.avatar'
            )

            return {
              loaded: false,
            }
          }

          debug('loading avatar url', { url }).log(
            'integration.recall.camera.avatar'
          )

          setAvatarUrl(url)

          return {
            loaded: true,
          }
        },
      },
      {
        name: 'unloadAvatarUrl',
        description:
          'Unload the fullscreen avatar (AI agent) iframe from the meeting.',
        parameters: {
          type: 'object',
          properties: {},
        },
        handler: async () => {
          debug('unloading avatar url').log('integration.recall.camera.avatar')

          setAvatarUrl('')

          return {
            unloaded: true,
          }
        },
      },
    ]

    if (meetingMode === MEETING_MODE_TEAM) {
      functions.push({
        name: RECALL_SEND_AVATAR_MESSAGE_FUNCTION_NAME,
        description:
          'Send a user message to the loaded meeting avatar (AI agent) when it should respond to a participant.',
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description:
                'The exact user message the avatar (AI agent) should respond to.',
            },
            participantName: {
              type: 'string',
              description:
                'Optional name of the participant who asked the avatar (AI agent).',
            },
          },
          required: ['text'],
        },
        handler: async (args = {}) => {
          const text = typeof args.text === 'string' ? args.text.trim() : ''

          const participantName =
            typeof args.participantName === 'string'
              ? args.participantName.trim()
              : ''

          if (!text) {
            debug('skipping avatar message - missing text', {
              hasParticipantName: !!participantName,
            }).log('integration.recall.camera.avatar')

            return {
              sent: false,
            }
          }

          return {
            sent: avatarTransport.sendUserMessage({
              text,
              participantName,
            }),
          }
        },
      })
    }

    return functions
  }, [avatarTransport, disabled, meetingMode])

  useEffect(() => {
    const muted = meetingMode === MEETING_MODE_TEAM

    function sendMicControl() {
      avatarTransport.sendMicControl({
        muted,
      })
    }

    sendMicControl()

    const interval = setInterval(sendMicControl, 500)

    return () => {
      clearInterval(interval)
    }
  }, [avatarTransport, meetingMode])

  useEffect(() => {
    if (!meetingEvents) {
      return
    }

    return meetingEvents.subscribe((event) => {
      if (event?.type !== MEETING_EVENT_SPEAKER_CHANGE || event.isBotSpeaker) {
        return
      }

      debug('sending avatar interrupt', {
        participantId: event.participantId,
        previousParticipantId: event.previousParticipantId,
        type: event.transcriptEventType,
      }).log('integration.recall.camera.team')

      avatarTransport.sendInterrupt({
        reason: 'meeting-turn-changed',
        participantId: event.participantId,
        previousParticipantId: event.previousParticipantId,
      })
    })
  }, [avatarTransport, meetingEvents])

  const render =
    !disabled && avatarUrl ? (
      <iframe
        ref={iframeRef}
        className="fixed inset-0 z-10 w-screen h-screen"
        src={avatarUrl}
        allow="autoplay; camera; microphone; fullscreen"
        title="Meeting Avatar (AI Agent)"
      />
    ) : null

  return {
    functions,
    render,
  }
}

// --- Hooks ---

export function useMeetingAgent({
  functions,
  initialPrompt,
  meetingEvents,
}: {
  functions: ToolFunction[]
  initialPrompt?: string
  meetingEvents?: EventChannel<RecallFrameEvent>
}) {
  const didInitiateRef = useRef(false)

  const {
    conversationId,
    setConversationId,

    token,
    setToken,

    setFunctions,

    initiateMessage,

    abort,
  } = useConversationManager({
    stream: true,

    functions,
  })

  useEffect(() => {
    setFunctions(functions)
  }, [functions, setFunctions])

  const sendTurn = useCallback(
    async ({
      source,
      text,
      participant,
    }: {
      source: MeetingTurnSource
      text: string
      participant?: MeetingParticipant | null
    }) => {
      if (!conversationId || !token || !text) {
        debug('skipping meeting turn send', {
          hasConversationId: !!conversationId,
          hasToken: !!token,
          hasText: !!text,
        }).log('integration.recall.camera.team')

        return
      }

      const isBotParticipant = participant?.isBot === true

      const participantName = getMeetingParticipantName(participant)

      debug('sending meeting turn to conversation', {
        conversationId,
        source,
        text,
        participantName,
        isBotParticipant,
      }).log('integration.recall.camera.team')

      const inputLabel =
        source === 'voice'
          ? isBotParticipant
            ? `An AI agent (${participantName}) just said the following in a multi-person meeting:`
            : `A meeting participant (${participantName}) just said the following in a multi-person meeting:`
          : isBotParticipant
            ? `An AI agent (${participantName}) just sent the following chat message in a multi-person meeting:`
            : `A meeting participant (${participantName}) just sent the following chat message in a multi-person meeting:`

      await initiateMessage({
        textToUse: [inputLabel, text].filter(Boolean).join('\n\n'),
      })
    },
    [conversationId, initiateMessage, token]
  )

  useEffect(() => {
    if (!meetingEvents) {
      return
    }

    return meetingEvents.subscribe(async (event) => {
      if (event?.type !== MEETING_EVENT_TURN) {
        return
      }

      try {
        if (!event.text) {
          return
        }

        await sendTurn({
          source: event.source,
          text: event.text,
          participant: event.participant,
        })
      } catch (error) {
        debug('meeting turn send failed', {
          error: error instanceof Error ? error.message : String(error),
        }).log('integration.recall.camera.team')
      }
    })
  }, [meetingEvents, sendTurn])

  useEffect(() => {
    if (!conversationId || !token || didInitiateRef.current) {
      debug('skipping initial recall frame message', {
        hasConversationId: !!conversationId,
        hasToken: !!token,
        didInitiate: didInitiateRef.current,
      }).log('integration.recall.camera.session')

      return
    }

    if (!initialPrompt) {
      debug('skipping initial recall frame message - missing text').log(
        'integration.recall.camera.session'
      )

      return
    }

    didInitiateRef.current = true

    const prompt = initialPrompt

    async function sendInitialMessage() {
      try {
        debug('sending initial recall frame message', {
          conversationId,
          textLength: prompt.length,
        }).log('integration.recall.camera.session')

        await initiateMessage({
          textToUse: prompt,
        })
      } catch (error) {
        debug('initial recall frame message failed', {
          error: error instanceof Error ? error.message : String(error),
        }).log('integration.recall.camera.session')
      }
    }

    void sendInitialMessage()
  }, [initialPrompt, conversationId, token, initiateMessage])

  return {
    abort,
    setConversationId,
    setToken,
  }
}

export function useRecallRealtimeEvents({
  relayUrl,
  meetingEvents,
}: {
  relayUrl?: string
  meetingEvents?: EventChannel<RecallFrameEvent>
}) {
  const eventsRef = useRef<(RecallRealtimeEnvelope & { receivedAt: string })[]>(
    []
  )

  const handleEvent = useCallback((envelope: RecallRealtimeEnvelope) => {
    eventsRef.current.push({
      ...envelope,

      receivedAt: new Date().toISOString(),
    })

    debug('stored realtime event', {
      type: envelope.type,
      eventCount: eventsRef.current.length,
    }).log('integration.recall.camera.realtime')
  }, [])

  const emitEvent = useCallback(
    (envelope: RecallRealtimeEnvelope) => {
      handleEvent(envelope)

      const inner = getRecallEnvelopeInnerData(envelope)

      if (isTranscriptEnvelope(envelope)) {
        const result = RecallTranscriptEventDataSchema.safeParse(inner)

        if (!result.success) {
          debug('failed to parse transcript event payload', {
            type: envelope.type,
            issues: result.error.issues,
          }).log('integration.recall.camera.realtime')
        }

        meetingEvents?.emit({
          type: RECALL_EVENT_TRANSCRIPT,
          envelope,
          payload: result.success ? result.data : null,
        })
      } else if (isChatMessageEnvelope(envelope)) {
        const result = RecallChatMessageEventDataSchema.safeParse(inner)

        if (!result.success) {
          debug('failed to parse chat message event payload', {
            type: envelope.type,
            issues: result.error.issues,
          }).log('integration.recall.camera.realtime')
        }

        meetingEvents?.emit({
          type: RECALL_EVENT_MESSAGE,
          envelope,
          payload: result.success ? result.data : null,
        })
      } else if (isParticipantEnvelope(envelope)) {
        const result = RecallParticipantEventDataSchema.safeParse(inner)

        if (!result.success) {
          debug('failed to parse participant event payload', {
            type: envelope.type,
            issues: result.error.issues,
          }).log('integration.recall.camera.realtime')
        }

        meetingEvents?.emit({
          type: RECALL_EVENT_PARTICIPANT,
          envelope,
          payload: result.success ? result.data : null,
        })
      }
    },
    [handleEvent, meetingEvents]
  )

  useEffect(() => {
    if (!relayUrl) {
      return
    }

    let canceled = false

    let websocket: WebSocket | null = null

    const timeout = setTimeout(() => {
      if (canceled) {
        return
      }

      debug('connecting realtime relay', {
        relayUrl,
      }).log('integration.recall.camera.realtime')

      websocket = new WebSocket(relayUrl)

      websocket.onopen = () => {
        debug('realtime relay connected').log(
          'integration.recall.camera.realtime'
        )
      }

      websocket.onerror = () => {
        debug('realtime relay error').log('integration.recall.camera.realtime')
      }

      websocket.onclose = (event) => {
        debug('realtime relay closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        }).log('integration.recall.camera.realtime')
      }

      websocket.onmessage = (event) => {
        let data: Record<string, unknown>

        try {
          data = JSON.parse(event.data)
        } catch {
          debug('received unknown realtime payload', {
            rawLength:
              typeof event.data === 'string' ? event.data.length : undefined,
          }).log('integration.recall.camera.realtime')

          emitEvent({
            raw: event.data,
            type: 'unknown',
          })

          return
        }

        const rawType =
          typeof data.event === 'string'
            ? data.event
            : typeof data.type === 'string'
              ? data.type
              : 'unknown'
        const type = normalizeRecallEnvelopeType(rawType)

        const probe: RecallRealtimeEnvelope = {
          message: data,
          type,
        }

        const inner = getRecallEnvelopeInnerData(probe)
        const transcriptResult =
          RecallTranscriptEventDataSchema.safeParse(inner)
        const messageResult = RecallChatMessageEventDataSchema.safeParse(inner)

        const text =
          (transcriptResult.success
            ? getRecallTranscriptText(transcriptResult.data)
            : '') ||
          (messageResult.success ? messageResult.data.data.text : '') ||
          ''

        debug('received realtime event', {
          type,
          hasTranscript: transcriptResult.success,
          textLength: text.length,
        }).log('verbose:integration.recall.camera.realtime')

        emitEvent({
          message: data,
          raw: event.data,
          text,
          type,
        })
      }
    }, 0)

    return () => {
      canceled = true

      clearTimeout(timeout)

      if (!websocket) {
        return
      }

      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close()
      } else if (websocket.readyState === WebSocket.CONNECTING) {
        const socket = websocket

        socket.onopen = () => socket.close()
      }
    }
  }, [emitEvent, relayUrl])
}

export function useRecallMeetingMode({
  botName,

  meetingEvents,
}: {
  botName?: string | null

  meetingEvents?: EventChannel<RecallFrameEvent>
}) {
  const initialBotParticipant = useMemo(
    () => createMeetingBotParticipant(botName),
    [botName]
  )
  const participantsRef = useRef(createMeetingParticipantsWithBot(botName))

  const [state, setState] = useState({
    mode: MEETING_MODE_SINGLE as MeetingMode,

    participantCount: 1,

    participants: [
      {
        id: initialBotParticipant.id,
        name: getMeetingParticipantName(initialBotParticipant),
      },
    ] as { id: string; name: string }[],
  })

  const getMode = useCallback((participantCount: number): MeetingMode => {
    if (participantCount === 0) {
      return MEETING_MODE_UNKNOWN
    }

    if (participantCount > 2) {
      return MEETING_MODE_TEAM
    }

    return MEETING_MODE_SINGLE
  }, [])

  const updateState = useCallback(
    (participants: Map<string, MeetingParticipant>) => {
      const participantCount = participants.size

      const mode = getMode(participantCount)

      const participantSummaries = Array.from(participants.entries())
        .map(([id, participant]) => ({
          id,
          name: getMeetingParticipantName(participant),
        }))
        .sort((a, b) => {
          const botParticipantId = String(RECALL_BOT_OUTPUT_SPEAKER_ID)

          if (a.id === botParticipantId) {
            return -1
          }

          if (b.id === botParticipantId) {
            return 1
          }

          return a.id.localeCompare(b.id)
        })

      setState((state) => {
        if (
          state.mode === mode &&
          state.participantCount === participantCount &&
          JSON.stringify(state.participants) ===
            JSON.stringify(participantSummaries)
        ) {
          return state
        }

        return {
          mode,
          participantCount,
          participants: participantSummaries,
        }
      })
    },
    [getMode]
  )

  const handleParticipantEvent = useCallback(
    (event: RecallParticipantChannelEvent) => {
      const rawParticipant = event.payload?.participant
      const participant = rawParticipant?.id
        ? normalizeMeetingParticipant(
            toMeetingParticipant(rawParticipant),
            botName
          )
        : null
      const participantId = participant?.id ?? ''

      if (!participantId || !participant) {
        debug('skipping participant event - missing participant id', {
          type: event.envelope.type,
        }).log('integration.recall.camera.meeting')

        return
      }

      const participants = new Map(participantsRef.current)

      if (
        event.envelope.type === RECALL_PARTICIPANT_LEAVE_EVENT_TYPE &&
        participantId !== String(RECALL_BOT_OUTPUT_SPEAKER_ID)
      ) {
        participants.delete(participantId)

        debug('removed meeting participant', {
          type: event.envelope.type,
          participantId,
          participantCount: participants.size,
        }).log('integration.recall.camera.meeting')
      } else {
        participants.set(participantId, participant)

        debug('upserted meeting participant', {
          type: event.envelope.type,
          participantId,
          participantCount: participants.size,
        }).log('integration.recall.camera.meeting')
      }

      participantsRef.current = participants

      debug('updated meeting participants', {
        participantCount: participants.size,
      }).log('integration.recall.camera.meeting')

      updateState(participants)
    },
    [botName, updateState]
  )

  const handleSeenParticipantEvent = useCallback(
    (event: RecallTranscriptChannelEvent | RecallChatMessageChannelEvent) => {
      const rawParticipant = event.payload?.participant

      const participant = rawParticipant?.id
        ? normalizeMeetingParticipant(
            toMeetingParticipant(rawParticipant),
            botName
          )
        : null

      const participantId = participant?.id ?? ''

      if (!participantId || !participant) {
        return
      }

      const participants = new Map(participantsRef.current)
      const existingParticipant = participants.get(participantId)

      participants.set(participantId, {
        ...existingParticipant,
        ...participant,
      })

      participantsRef.current = participants

      if (!existingParticipant) {
        debug('tracked seen meeting participant', {
          type: event.envelope.type,
          participantId,
          participantCount: participants.size,
        }).log('integration.recall.camera.meeting')
      }

      updateState(participants)
    },
    [botName, updateState]
  )

  const seedMeeting = useCallback(
    (meeting: { participants?: MeetingParticipant[] } | undefined) => {
      const participants = createMeetingParticipantsWithBot(botName)

      if (Array.isArray(meeting?.participants)) {
        for (const participant of meeting.participants) {
          if (participant?.id) {
            const normalizedParticipant = normalizeMeetingParticipant(
              toMeetingParticipant(participant),
              botName
            )

            participants.set(normalizedParticipant.id, normalizedParticipant)
          }
        }
      }

      participantsRef.current = participants

      debug('seeded meeting participants', {
        participantCount: participants.size,
      }).log('integration.recall.camera.meeting')

      updateState(participants)
    },
    [botName, updateState]
  )

  useEffect(() => {
    if (!meetingEvents) {
      return
    }

    return meetingEvents.subscribe((event) => {
      switch (event.type) {
        case RECALL_EVENT_PARTICIPANT: {
          handleParticipantEvent(event)

          break
        }

        case RECALL_EVENT_TRANSCRIPT:
        case RECALL_EVENT_MESSAGE: {
          handleSeenParticipantEvent(event)

          break
        }

        case MEETING_EVENT_SEED: {
          seedMeeting(event.meeting)

          break
        }
      }
    })
  }, [
    handleParticipantEvent,
    handleSeenParticipantEvent,
    meetingEvents,
    seedMeeting,
  ])

  return state
}

export function useMeetingController({
  disabled = false,
  meetingEvents,
}: MeetingEventsOptions = {}) {
  // In-flight voice turns, keyed by participant id. Each turn accumulates
  // transcript fragments until an idle window elapses and `flushVoiceTurn`
  // emits the consolidated text.

  const voiceTurnsByParticipantRef = useRef(new Map<string, VoiceTurn>())

  // Per-participant idle timers backing `voiceTurnsByParticipantRef`.

  const voiceTurnTimeoutsRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  )

  // Queue of chat messages awaiting flush. Held back until voice turns drain
  // so chat-driven replies don't race ahead of in-progress speech.

  const chatTurnsRef = useRef<ChatTurn[]>([])

  // Per-participant idle timers backing `chatTurnsRef`.

  const chatFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Latest-closure ref: breaks the cycle between `scheduleChatFlush` (which
  // needs to call `flushChatTurns`) and `flushChatTurns` (which can re-arm
  // itself via `scheduleChatFlush`). Lets `scheduleChatFlush` keep `[]` deps
  // so its identity stays stable across renders.

  const flushChatTurnsRef = useRef(() => {})

  // Tracks the speaker of the most recent voice (transcript) event - used to
  // detect speaker changes and to gate chat flushes against active speech.

  const activeVoiceSpeakerIdRef = useRef('')

  // Timestamp of the most recent transcript event, used to detect when active
  // speakers have gone idle.

  const lastTranscriptAtRef = useRef(0)

  const scheduleChatFlush = useCallback((delay = MEETING_TURN_IDLE_MS) => {
    if (chatFlushTimeoutRef.current) {
      clearTimeout(chatFlushTimeoutRef.current)
    }

    chatFlushTimeoutRef.current = setTimeout(() => {
      chatFlushTimeoutRef.current = null
      flushChatTurnsRef.current()
    }, delay)
  }, [])

  const flushChatTurns = useCallback(() => {
    if (chatFlushTimeoutRef.current) {
      clearTimeout(chatFlushTimeoutRef.current)
      chatFlushTimeoutRef.current = null
    }

    if (voiceTurnsByParticipantRef.current.size > 0) {
      scheduleChatFlush()

      return
    }

    const lastTranscriptAt = lastTranscriptAtRef.current
    const transcriptIdleFor = lastTranscriptAt
      ? Date.now() - lastTranscriptAt
      : 0

    if (
      activeVoiceSpeakerIdRef.current &&
      lastTranscriptAt &&
      transcriptIdleFor < MEETING_TURN_IDLE_MS
    ) {
      scheduleChatFlush(MEETING_TURN_IDLE_MS - transcriptIdleFor)

      return
    }

    const chatTurns = chatTurnsRef.current

    chatTurnsRef.current = []

    for (const chatTurn of chatTurns) {
      debug('flushing chat message turn', {
        participantId: chatTurn.participant?.id || 'unknown',
        textLength: chatTurn.text.length,
        hasParticipant: !!chatTurn.participant,
      }).log('integration.recall.camera.team')

      meetingEvents?.emit({
        type: MEETING_EVENT_TURN,
        source: 'chat',
        text: chatTurn.text,
        participant: chatTurn.participant,
      })
    }
  }, [meetingEvents, scheduleChatFlush])

  useEffect(() => {
    flushChatTurnsRef.current = flushChatTurns
  }, [flushChatTurns])

  const flushVoiceTurn = useCallback(
    (participantId: string) => {
      const turn = voiceTurnsByParticipantRef.current.get(participantId)

      if (!turn) {
        return
      }

      voiceTurnsByParticipantRef.current.delete(participantId)

      const timeout = voiceTurnTimeoutsRef.current.get(participantId)

      if (timeout) {
        clearTimeout(timeout)
        voiceTurnTimeoutsRef.current.delete(participantId)
      }

      const text = turn.parts.join(' ').replace(/\s+/g, ' ').trim()

      if (!text) {
        debug('skipping voice turn flush - empty text', {
          participantId,
        }).log('integration.recall.camera.team')

        return
      }

      debug('flushing voice turn', {
        participantId,
        textLength: text.length,
        hasParticipant: !!turn.participant,
      }).log('integration.recall.camera.team')

      meetingEvents?.emit({
        type: MEETING_EVENT_TURN,
        source: 'voice',
        text,
        participant: turn.participant,
      })

      flushChatTurns()
    },
    [flushChatTurns, meetingEvents]
  )

  const handleTranscriptEvent = useCallback(
    (event: RecallTranscriptChannelEvent) => {
      if (disabled) {
        return
      }

      const rawParticipant = event.payload?.participant ?? null

      const isBotSpeaker = rawParticipant?.id === RECALL_BOT_OUTPUT_SPEAKER_ID

      const text = (
        getRecallTranscriptText(event.payload) ||
        event.envelope.text ||
        ''
      ).trim()

      if (!text) {
        debug('skipping transcript event - empty text', {
          type: event.envelope.type,
        }).log('integration.recall.camera.team')

        return
      }

      lastTranscriptAtRef.current = Date.now()

      const participant: MeetingParticipant | null = isBotSpeaker
        ? {
            ...(rawParticipant || {}),
            id: `recall-bot-speaker-${RECALL_BOT_OUTPUT_SPEAKER_ID}`,
            isBot: true,
          }
        : rawParticipant
          ? toMeetingParticipant(rawParticipant)
          : null

      const participantId = participant?.id || 'unknown'

      if (participantId !== activeVoiceSpeakerIdRef.current) {
        const previousParticipantId = activeVoiceSpeakerIdRef.current

        activeVoiceSpeakerIdRef.current = participantId

        debug('detected transcript speaker change', {
          type: event.envelope.type,
          participantId,
          previousParticipantId,
          isBotSpeaker,
        }).log('integration.recall.camera.team')

        meetingEvents?.emit({
          type: MEETING_EVENT_SPEAKER_CHANGE,
          participantId,
          previousParticipantId,
          transcriptEventType: event.envelope.type,
          isBotSpeaker,
        })
      }

      if (event.envelope.type !== RECALL_TRANSCRIPT_DATA_EVENT_TYPE) {
        return
      }

      const existingTurn = voiceTurnsByParticipantRef.current.get(participantId)

      voiceTurnsByParticipantRef.current.set(participantId, {
        participant,
        parts: [...(existingTurn?.parts || []), text],
      })

      debug('buffered voice turn', {
        participantId,
        isBotSpeaker,
        partCount: (existingTurn?.parts || []).length + 1,
        textLength: text.length,
      }).log('integration.recall.camera.team')

      const timeout = voiceTurnTimeoutsRef.current.get(participantId)

      if (timeout) {
        clearTimeout(timeout)
      }

      voiceTurnTimeoutsRef.current.set(
        participantId,
        setTimeout(() => {
          flushVoiceTurn(participantId)
        }, MEETING_TURN_IDLE_MS)
      )
    },
    [disabled, flushVoiceTurn, meetingEvents]
  )

  const handleChatMessageEvent = useCallback(
    (event: RecallChatMessageChannelEvent) => {
      if (disabled) {
        return
      }

      const text = event.payload?.data.text.trim() || ''

      if (!text) {
        debug('skipping chat message event - empty text').log(
          'integration.recall.camera.team'
        )

        return
      }

      const rawParticipant = event.payload?.participant
      const participant: MeetingParticipant | null = rawParticipant
        ? toMeetingParticipant(rawParticipant)
        : null
      const participantId = participant?.id || 'unknown'

      debug('queued chat message turn', {
        participantId,
        textLength: text.length,
        hasParticipant: !!participant,
      }).log('integration.recall.camera.team')

      chatTurnsRef.current.push({
        text,
        participant,
      })

      flushChatTurns()
    },
    [disabled, flushChatTurns]
  )

  // Reset all buffered turns and timers when the controller is disabled mid-
  // session - keeps stale state from leaking back in if it re-enables later.
  useEffect(() => {
    if (!disabled) {
      return
    }

    voiceTurnsByParticipantRef.current.clear()

    for (const timeout of voiceTurnTimeoutsRef.current.values()) {
      clearTimeout(timeout)
    }

    voiceTurnTimeoutsRef.current.clear()

    chatTurnsRef.current = []

    if (chatFlushTimeoutRef.current) {
      clearTimeout(chatFlushTimeoutRef.current)
      chatFlushTimeoutRef.current = null
    }

    activeVoiceSpeakerIdRef.current = ''
    lastTranscriptAtRef.current = 0
  }, [disabled])

  // Clear any in-flight idle timers on unmount so they don't fire after the
  // component is gone (the timer callbacks would touch stale refs).
  useEffect(() => {
    const timeouts = voiceTurnTimeoutsRef.current

    return () => {
      for (const timeout of timeouts.values()) {
        clearTimeout(timeout)
      }

      if (chatFlushTimeoutRef.current) {
        clearTimeout(chatFlushTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!meetingEvents) {
      return
    }

    return meetingEvents.subscribe((event) => {
      if (event.type === RECALL_EVENT_TRANSCRIPT) {
        handleTranscriptEvent(event)
      } else if (event.type === RECALL_EVENT_MESSAGE) {
        handleChatMessageEvent(event)
      }
    })
  }, [handleChatMessageEvent, handleTranscriptEvent, meetingEvents])
}

export function useRecallFrameSession({
  setConversationId,
  setToken,

  meetingEvents,

  sessionCreateUrl,
  sessionId,

  abort,
}): void {
  const sessionCreateRef = useRef<{
    key: string

    promise: Promise<{
      conversationId: string

      // Wire shape from the `/session/create` API - `id` can be string or
      // number depending on source (calendar string ids vs. Recall integer
      // ids). Normalised via `toMeetingParticipant` before emit.
      meeting?: {
        participants?: { id: string | number; name?: string | null }[]
      }

      token: string
    }>
  } | null>(null)

  useEffect(() => {
    let canceled = false

    async function start() {
      if (!sessionId) {
        debug('skipping recall frame session - missing sessionId', {
          sessionCreateUrl,
        }).log('integration.recall.camera.session')

        return
      }

      try {
        const sessionCreateKey = JSON.stringify([sessionCreateUrl, sessionId])

        if (sessionCreateRef.current?.key !== sessionCreateKey) {
          sessionCreateRef.current = null
        }

        if (!sessionCreateRef.current) {
          debug('creating recall frame session', {
            sessionCreateUrl,
            sessionId,
          }).log('integration.recall.camera.session')

          const promise = (async () => {
            const response = await fetch(sessionCreateUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sessionId,
              }),
            })

            if (!response.ok) {
              const error = await response.json().catch(() => ({}))

              debug('recall frame session create failed', {
                status: response.status,
                message: error.message,
              }).log('integration.recall.camera.session')

              throw new Error(
                error.message || 'Failed to create Recall session'
              )
            }

            return response.json()
          })()

          sessionCreateRef.current = {
            key: sessionCreateKey,
            promise: promise,
          }

          promise.catch(() => {
            if (sessionCreateRef.current?.promise === promise) {
              sessionCreateRef.current = null
            }
          })
        } else {
          debug('joining pending recall frame session create', {
            sessionCreateUrl,
            sessionId,
          }).log('integration.recall.camera.session')
        }

        const promise = sessionCreateRef.current.promise

        const { conversationId, meeting, token } = await promise

        if (canceled) {
          debug('discarding recall frame session after cancel', {
            conversationId,
          }).log('integration.recall.camera.session')

          return
        }

        const seedParticipants: MeetingParticipant[] | undefined =
          Array.isArray(meeting?.participants)
            ? meeting.participants
                .filter(
                  (p): p is { id: string | number; name?: string | null } =>
                    p != null &&
                    (typeof p.id === 'string' || typeof p.id === 'number')
                )
                .map(toMeetingParticipant)
            : undefined

        meetingEvents.emit({
          type: MEETING_EVENT_SEED,
          meeting: meeting ? { participants: seedParticipants } : undefined,
        })

        setConversationId(conversationId)
        setToken(token)

        debug('created recall frame session', {
          conversationId,
          hasToken: !!token,
          participantCount: seedParticipants?.length ?? 0,
        }).log('integration.recall.camera.session')
      } catch (error) {
        debug('recall frame session start failed', {
          error: error instanceof Error ? error.message : String(error),
        }).log('integration.recall.camera.session')
      }
    }

    void start()

    return () => {
      canceled = true

      debug('unmounting recall frame session', {
        sessionCreateUrl,
        sessionId,
      }).log('integration.recall.camera.session')

      abort({ reason: 'Recall frame unmounted' })
    }
  }, [
    abort,
    meetingEvents,
    sessionId,
    sessionCreateUrl,
    setConversationId,
    setToken,
  ])
}

// --- Frame ---

export default function Frame({
  integration,
  relayUrl,
  sessionId,
  text,
  botName,
}) {
  const sessionCreateUrl = `/api/v1/integration/recall/${integration.id}/session/create`

  const meetingEvents = useEventChannel<RecallFrameEvent>()

  // setup realtime events connection

  useRecallRealtimeEvents({
    meetingEvents,

    relayUrl,
  })

  // meeting mode and participants tracking

  const { mode: meetingMode } = useRecallMeetingMode({
    botName,

    meetingEvents,
  })

  // tools

  const { functions: backgroundFunctions, render: background } = useBackground()

  const { functions: soundFunctions } = useSound()

  const { functions: screenshareFunctions } = useScreenshare({
    recallIntegrationId: integration.id,

    sessionId,
  })

  const { functions: recordingFunctions } = useRecording({
    recallIntegrationId: integration.id,

    sessionId,
  })

  const { functions: leaveFunctions } = useLeave({
    recallIntegrationId: integration.id,

    sessionId,
  })

  const { functions: messageFunctions } = useMessage({
    recallIntegrationId: integration.id,

    sessionId,
  })

  const { functions: avatarFunctions, render: avatar } = useAvatar({
    meetingEvents,

    meetingMode,
  })

  const functions = useMemo(
    () => [
      ...backgroundFunctions,
      ...screenshareFunctions,
      ...recordingFunctions,
      ...leaveFunctions,
      ...messageFunctions,
      ...soundFunctions,
      ...avatarFunctions,
    ],
    [
      avatarFunctions,
      backgroundFunctions,
      messageFunctions,
      leaveFunctions,
      recordingFunctions,
      screenshareFunctions,
      soundFunctions,
    ]
  )

  // setup meeting controller

  useMeetingController({ meetingEvents })

  // setup meeting agent conversation and handlers

  const { setConversationId, setToken, abort } = useMeetingAgent({
    functions,

    initialPrompt: text,

    meetingEvents,
  })

  // create session on load and cleanup on unload

  useRecallFrameSession({
    sessionId,
    sessionCreateUrl,

    setConversationId,
    setToken,

    abort,

    meetingEvents,
  })

  // render

  return (
    <main className="w-screen h-screen overflow-hidden">
      {background}
      {avatar}
    </main>
  )
}

Frame.theme = 'dark'

Frame.getLayout = function (children) {
  return children
}

export async function getServerSideProps(context) {
  const sessionId =
    typeof context.query.sessionId === 'string' ? context.query.sessionId : ''

  if (!sessionId) {
    return {
      notFound: true,
    }
  }

  const recallSession = await getRecallMeetingSession(sessionId)

  if (!recallSession) {
    return {
      notFound: true,
    }
  }

  const integration = await prisma.recallIntegration.findUnique({
    where: {
      id: context.query.recallIntegrationId,
    },

    select: {
      id: true,
      apiKey: true,
      botId: true,
      userId: true,
    },
  })

  if (!integration) {
    return {
      notFound: true,
    }
  }

  if (
    recallSession.recallIntegrationId !== integration.id ||
    recallSession.userId !== integration.userId ||
    !recallSession.pageRelayUrl
  ) {
    return {
      notFound: true,
    }
  }

  if (!integration.apiKey || !integration.botId) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      integration: {
        id: integration.id,
      },

      sessionId,
      relayUrl: recallSession.pageRelayUrl,

      text: recallSession.text,

      botName: recallSession.botName || null,
    }),
  }
}

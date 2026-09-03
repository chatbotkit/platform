// @ts-check
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
//
// Building blocks shared across realtime events, bot resources, and requests.
// Recall response objects use `.passthrough()` so forward-compatible fields
// are preserved when the API adds them.

const RecallMetadataSchema = z.record(z.unknown())

const RecallArtifactSchema = z
  .object({
    id: z.string(),
    metadata: RecallMetadataSchema,
  })
  .passthrough()

// `absolute` is an ISO 8601 string but Recall sends timezone offsets (e.g.
// `+00:00`) rather than the strict `Z` form zod's `.datetime()` accepts by
// default - leave it as a plain string so parses don't reject every event.
export const RecallTimestampSchema = z
  .object({
    absolute: z.string(),
    relative: z.number(),
  })
  .passthrough()

// Every nominally-nullable field on the participant is `.nullish()` (nullable
// + optional) because Recall is inconsistent about whether absent values come
// across as `null` or are omitted entirely. The docs type some of these as
// non-nullable, but in practice we've seen them missing on early
// `participant_events.update` payloads (and `email` missing on chat events).
export const RecallParticipantSchema = z
  .object({
    id: z.number().int(),
    name: z.string().nullish(),
    is_host: z.boolean().nullish(),
    platform: z.string().nullish(),
    extra_data: z.record(z.unknown()).nullish(),
    email: z.string().nullish(),
  })
  .passthrough()

export const RecallApiErrorSchema = z
  .object({
    detail: z.unknown().optional(),
    message: z.unknown().optional(),
  })
  .passthrough()

// ---------------------------------------------------------------------------
// Realtime event types
// ---------------------------------------------------------------------------
//
// String constants and enum schemas for the events we subscribe to via the
// realtime endpoint. Recall exposes additional media stream events
// (audio_*/video_*) that we do not subscribe to and so do not model here.

export const RECALL_PARTICIPANT_JOIN_EVENT_TYPE = 'participant_events.join'
export const RECALL_PARTICIPANT_LEAVE_EVENT_TYPE = 'participant_events.leave'
export const RECALL_PARTICIPANT_UPDATE_EVENT_TYPE = 'participant_events.update'
export const RECALL_PARTICIPANT_SPEECH_ON_EVENT_TYPE =
  'participant_events.speech_on'
export const RECALL_PARTICIPANT_SPEECH_OFF_EVENT_TYPE =
  'participant_events.speech_off'
export const RECALL_PARTICIPANT_WEBCAM_ON_EVENT_TYPE =
  'participant_events.webcam_on'
export const RECALL_PARTICIPANT_WEBCAM_OFF_EVENT_TYPE =
  'participant_events.webcam_off'
export const RECALL_PARTICIPANT_SCREENSHARE_ON_EVENT_TYPE =
  'participant_events.screenshare_on'
export const RECALL_PARTICIPANT_SCREENSHARE_OFF_EVENT_TYPE =
  'participant_events.screenshare_off'

export const RECALL_CHAT_MESSAGE_EVENT_TYPE = 'participant_events.chat_message'

export const RECALL_TRANSCRIPT_DATA_EVENT_TYPE = 'transcript.data'
export const RECALL_TRANSCRIPT_PARTIAL_DATA_EVENT_TYPE =
  'transcript.partial_data'
export const RECALL_TRANSCRIPT_PROVIDER_EVENT_TYPE = 'transcript.provider_data'

export const RECALL_PARTICIPANT_EVENT_TYPES = [
  RECALL_PARTICIPANT_JOIN_EVENT_TYPE,
  RECALL_PARTICIPANT_LEAVE_EVENT_TYPE,
  RECALL_PARTICIPANT_UPDATE_EVENT_TYPE,
  RECALL_PARTICIPANT_SPEECH_ON_EVENT_TYPE,
  RECALL_PARTICIPANT_SPEECH_OFF_EVENT_TYPE,
  RECALL_PARTICIPANT_WEBCAM_ON_EVENT_TYPE,
  RECALL_PARTICIPANT_WEBCAM_OFF_EVENT_TYPE,
  RECALL_PARTICIPANT_SCREENSHARE_ON_EVENT_TYPE,
  RECALL_PARTICIPANT_SCREENSHARE_OFF_EVENT_TYPE,
] as const

export const RECALL_TRANSCRIPT_EVENT_TYPES = [
  RECALL_TRANSCRIPT_DATA_EVENT_TYPE,
  RECALL_TRANSCRIPT_PARTIAL_DATA_EVENT_TYPE,
] as const

export const RECALL_REALTIME_EVENT_TYPES = [
  ...RECALL_PARTICIPANT_EVENT_TYPES,
  RECALL_CHAT_MESSAGE_EVENT_TYPE,
  ...RECALL_TRANSCRIPT_EVENT_TYPES,
  RECALL_TRANSCRIPT_PROVIDER_EVENT_TYPE,
] as const

export const RecallParticipantEventTypeSchema = z.enum(
  RECALL_PARTICIPANT_EVENT_TYPES
)

export const RecallChatMessageEventTypeSchema = z.literal(
  RECALL_CHAT_MESSAGE_EVENT_TYPE
)

export const RecallTranscriptEventTypeSchema = z.enum(
  RECALL_TRANSCRIPT_EVENT_TYPES
)

export const RecallTranscriptProviderEventTypeSchema = z.literal(
  RECALL_TRANSCRIPT_PROVIDER_EVENT_TYPE
)

// ---------------------------------------------------------------------------
// Realtime event payloads
// ---------------------------------------------------------------------------
//
// Every realtime delivery has two nesting levels:
//
//   { event, data: <envelope { data: <payload>, ...artifacts }> }
//
// `Recall*EventDataSchema` describes the inner payload (`data.data`).
// `Recall*EventSchema` describes the full envelope including artifact refs.

const RecallRealtimeArtifactsSchema = z
  .object({
    realtime_endpoint: RecallArtifactSchema,
    recording: RecallArtifactSchema,
    bot: RecallArtifactSchema,
  })
  .passthrough()

// Participant events (join, leave, update, speech_*, webcam_*, screenshare_*)
// all share this payload shape with `data: null`.
export const RecallParticipantEventDataSchema = z
  .object({
    participant: RecallParticipantSchema,
    timestamp: RecallTimestampSchema,
    data: z.null(),
  })
  .passthrough()

export const RecallParticipantEventSchema = z
  .object({
    event: RecallParticipantEventTypeSchema,
    data: RecallRealtimeArtifactsSchema.extend({
      data: RecallParticipantEventDataSchema,
      participant_events: RecallArtifactSchema,
    }),
  })
  .passthrough()

// Chat messages
export const RecallChatMessageDataSchema = z
  .object({
    text: z.string(),
    to: z.string(),
  })
  .passthrough()

export const RecallChatMessageEventDataSchema = z
  .object({
    participant: RecallParticipantSchema,
    timestamp: RecallTimestampSchema,
    data: RecallChatMessageDataSchema,
  })
  .passthrough()

export const RecallChatMessageEventSchema = z
  .object({
    event: RecallChatMessageEventTypeSchema,
    data: RecallRealtimeArtifactsSchema.extend({
      data: RecallChatMessageEventDataSchema,
      participant_events: RecallArtifactSchema,
    }),
  })
  .passthrough()

// Transcript events (final + partial). Word timestamps only document `relative`
// per the docs - kept separate from the full `RecallTimestampSchema` rather
// than reused to reflect that contract.
const RecallTranscriptWordTimestampSchema = z
  .object({
    relative: z.number(),
  })
  .passthrough()

export const RecallTranscriptWordSchema = z
  .object({
    text: z.string(),
    start_timestamp: RecallTranscriptWordTimestampSchema,
    end_timestamp: RecallTranscriptWordTimestampSchema.nullable(),
  })
  .passthrough()

export const RecallTranscriptEventDataSchema = z
  .object({
    words: z.array(RecallTranscriptWordSchema),
    language_code: z.string().optional(),
    participant: RecallParticipantSchema,
  })
  .passthrough()

export const RecallTranscriptEventSchema = z
  .object({
    event: RecallTranscriptEventTypeSchema,
    data: RecallRealtimeArtifactsSchema.extend({
      data: RecallTranscriptEventDataSchema,
      transcript: RecallArtifactSchema,
    }),
  })
  .passthrough()

// Provider-specific transcript passthrough. The inner payload shape is
// provider-defined; treat as unknown rather than failing parse.
export const RecallTranscriptProviderEventSchema = z
  .object({
    event: RecallTranscriptProviderEventTypeSchema,
    data: RecallRealtimeArtifactsSchema.extend({
      data: z.unknown(),
      transcript: RecallArtifactSchema,
    }),
  })
  .passthrough()

export const RecallRealtimeEventSchema = z.union([
  RecallParticipantEventSchema,
  RecallChatMessageEventSchema,
  RecallTranscriptEventSchema,
  RecallTranscriptProviderEventSchema,
])

// ---------------------------------------------------------------------------
// Bot resource
// ---------------------------------------------------------------------------
//
// Only `id` is consumed downstream; the rest of the bot response is preserved
// via passthrough so callers reading additional fields don't need a schema
// change here.

export const RecallBotSchema = z
  .object({
    id: z.string(),
  })
  .passthrough()

// ---------------------------------------------------------------------------
// Bot request payloads
// ---------------------------------------------------------------------------

export const RecallOutputMediaWebpageRequestSchema = z
  .object({
    kind: z.literal('webpage'),
    config: z
      .object({
        url: z.string().url(),
      })
      .passthrough(),
  })
  .passthrough()

export const RecallOutputMediaRequestSchema = z
  .object({
    camera: RecallOutputMediaWebpageRequestSchema.optional(),
    screenshare: RecallOutputMediaWebpageRequestSchema.optional(),
  })
  .passthrough()

export const RecallStopOutputMediaRequestSchema = z
  .object({
    camera: z.boolean().optional(),
    screenshare: z.boolean().optional(),
  })
  .passthrough()

export const RecallSendChatMessageRequestSchema = z
  .object({
    to: z.string().min(1).optional(),
    message: z.string().min(1).max(4096),
    pin: z.boolean().optional(),
  })
  .passthrough()

export const RecallCreateBotRequestSchema = z
  .object({
    meeting_url: z.string().url(),
    bot_name: z.string().min(1).max(100).optional(),
    join_at: z.string().datetime().optional().nullable(),
    // Sub-objects are kept opaque on purpose: Recall's create-bot surface is
    // wide (recording_config alone exposes ~10 nested objects + enums), and we
    // pass through whatever the caller assembles. Validate at call sites if
    // stricter checks are needed.
    recording_config: z.object({}).passthrough().optional().nullable(),
    output_media: RecallOutputMediaRequestSchema.optional().nullable(),
    automatic_video_output: z.object({}).passthrough().optional().nullable(),
    automatic_audio_output: z.object({}).passthrough().optional().nullable(),
    chat: z.object({}).passthrough().optional().nullable(),
    automatic_leave: z.object({}).passthrough().optional().nullable(),
    variant: z.record(z.string()).optional().nullable(),
    zoom: z.object({}).passthrough().optional().nullable(),
    google_meet: z.object({}).passthrough().optional().nullable(),
    webex: z.object({}).passthrough().optional().nullable(),
    breakout_room: z.object({}).passthrough().optional().nullable(),
    // Recall requires metadata values to be strings.
    metadata: z.record(z.string()).optional(),
  })
  .passthrough()

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type RecallApiError = z.infer<typeof RecallApiErrorSchema>
export type RecallArtifact = z.infer<typeof RecallArtifactSchema>
export type RecallParticipant = z.infer<typeof RecallParticipantSchema>
export type RecallTimestamp = z.infer<typeof RecallTimestampSchema>

export type RecallParticipantEventType = z.infer<
  typeof RecallParticipantEventTypeSchema
>
export type RecallChatMessageEventType = z.infer<
  typeof RecallChatMessageEventTypeSchema
>
export type RecallTranscriptEventType = z.infer<
  typeof RecallTranscriptEventTypeSchema
>
export type RecallTranscriptProviderEventType = z.infer<
  typeof RecallTranscriptProviderEventTypeSchema
>

export type RecallParticipantEventData = z.infer<
  typeof RecallParticipantEventDataSchema
>
export type RecallParticipantEvent = z.infer<
  typeof RecallParticipantEventSchema
>

export type RecallChatMessageData = z.infer<typeof RecallChatMessageDataSchema>
export type RecallChatMessageEventData = z.infer<
  typeof RecallChatMessageEventDataSchema
>
export type RecallChatMessageEvent = z.infer<
  typeof RecallChatMessageEventSchema
>

export type RecallTranscriptWord = z.infer<typeof RecallTranscriptWordSchema>
export type RecallTranscriptEventData = z.infer<
  typeof RecallTranscriptEventDataSchema
>
export type RecallTranscriptEvent = z.infer<typeof RecallTranscriptEventSchema>
export type RecallTranscriptProviderEvent = z.infer<
  typeof RecallTranscriptProviderEventSchema
>

export type RecallRealtimeEvent = z.infer<typeof RecallRealtimeEventSchema>

export type RecallBot = z.infer<typeof RecallBotSchema>

export type RecallOutputMediaWebpageRequest = z.infer<
  typeof RecallOutputMediaWebpageRequestSchema
>
export type RecallOutputMediaRequest = z.infer<
  typeof RecallOutputMediaRequestSchema
>
export type RecallStopOutputMediaRequest = z.infer<
  typeof RecallStopOutputMediaRequestSchema
>
export type RecallSendChatMessageRequest = z.infer<
  typeof RecallSendChatMessageRequestSchema
>
export type RecallCreateBotRequest = z.infer<
  typeof RecallCreateBotRequestSchema
>

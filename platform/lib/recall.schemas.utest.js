import {
  RECALL_CHAT_MESSAGE_EVENT_TYPE,
  RECALL_PARTICIPANT_JOIN_EVENT_TYPE,
  RECALL_PARTICIPANT_LEAVE_EVENT_TYPE,
  RECALL_PARTICIPANT_SCREENSHARE_OFF_EVENT_TYPE,
  RECALL_PARTICIPANT_SCREENSHARE_ON_EVENT_TYPE,
  RECALL_PARTICIPANT_SPEECH_OFF_EVENT_TYPE,
  RECALL_PARTICIPANT_SPEECH_ON_EVENT_TYPE,
  RECALL_PARTICIPANT_UPDATE_EVENT_TYPE,
  RECALL_PARTICIPANT_WEBCAM_OFF_EVENT_TYPE,
  RECALL_PARTICIPANT_WEBCAM_ON_EVENT_TYPE,
  RECALL_TRANSCRIPT_DATA_EVENT_TYPE,
  RECALL_TRANSCRIPT_PARTIAL_DATA_EVENT_TYPE,
  RECALL_TRANSCRIPT_PROVIDER_EVENT_TYPE,
  RecallBotSchema,
  RecallChatMessageEventSchema,
  RecallCreateBotRequestSchema,
  RecallOutputMediaRequestSchema,
  RecallParticipantEventSchema,
  RecallParticipantSchema,
  RecallRealtimeEventSchema,
  RecallSendChatMessageRequestSchema,
  RecallStopOutputMediaRequestSchema,
  RecallTimestampSchema,
  RecallTranscriptEventSchema,
  RecallTranscriptProviderEventSchema,
} from './recall.schemas'

// ---------------------------------------------------------------------------
// Shared fixture factories
// ---------------------------------------------------------------------------

function makeArtifact(overrides = {}) {
  return { id: 'artifact-1', metadata: {}, ...overrides }
}

function makeTimestamp(overrides = {}) {
  return { absolute: '2024-01-01T00:00:00+00:00', relative: 0, ...overrides }
}

function makeParticipant(overrides = {}) {
  return { id: 1, name: 'Alice', is_host: false, ...overrides }
}

function makeArtifacts(overrides = {}) {
  return {
    realtime_endpoint: makeArtifact(),
    recording: makeArtifact(),
    bot: makeArtifact(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// RecallTimestampSchema
// ---------------------------------------------------------------------------

describe('RecallTimestampSchema', () => {
  it('accepts a valid timestamp', () => {
    const ts = makeTimestamp()

    expect(() => RecallTimestampSchema.parse(ts)).not.toThrow()
  })

  it('preserves unknown fields via passthrough', () => {
    const ts = makeTimestamp({ extra: 'value' })

    expect(RecallTimestampSchema.parse(ts)).toMatchObject({ extra: 'value' })
  })

  it('rejects a timestamp missing absolute', () => {
    const { success } = RecallTimestampSchema.safeParse({ relative: 0 })

    expect(success).toBe(false)
  })

  it('rejects a timestamp missing relative', () => {
    const { success } = RecallTimestampSchema.safeParse({
      absolute: '2024-01-01T00:00:00+00:00',
    })

    expect(success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RecallParticipantSchema
// ---------------------------------------------------------------------------

describe('RecallParticipantSchema', () => {
  it('accepts a participant with required id only', () => {
    const result = RecallParticipantSchema.safeParse({ id: 42 })

    expect(result.success).toBe(true)
    expect(result.data.id).toBe(42)
  })

  it('accepts a fully populated participant', () => {
    const result = RecallParticipantSchema.safeParse(makeParticipant())

    expect(result.success).toBe(true)
  })

  it('accepts null for nullable fields', () => {
    const result = RecallParticipantSchema.safeParse({
      id: 1,
      name: null,
      is_host: null,
      email: null,
    })

    expect(result.success).toBe(true)
  })

  it('accepts a participant where optional fields are absent', () => {
    // name, email, etc. are .nullish() - both null and undefined are fine
    const result = RecallParticipantSchema.safeParse({ id: 7 })

    expect(result.success).toBe(true)
  })

  it('rejects a participant missing id', () => {
    const { success } = RecallParticipantSchema.safeParse({ name: 'Bob' })

    expect(success).toBe(false)
  })

  it('rejects a participant where id is not a number', () => {
    const { success } = RecallParticipantSchema.safeParse({ id: 'abc' })

    expect(success).toBe(false)
  })

  it('preserves unknown fields via passthrough', () => {
    const result = RecallParticipantSchema.safeParse({
      id: 1,
      custom_field: 'unknown',
    })

    expect(result.success).toBe(true)
    expect(result.data.custom_field).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// RecallParticipantEventSchema
// ---------------------------------------------------------------------------

function makeParticipantEventPayload(eventType) {
  return {
    event: eventType,
    data: {
      ...makeArtifacts(),
      participant_events: makeArtifact(),
      data: {
        participant: makeParticipant(),
        timestamp: makeTimestamp(),
        data: null,
      },
    },
  }
}

describe('RecallParticipantEventSchema', () => {
  const allParticipantEventTypes = [
    RECALL_PARTICIPANT_JOIN_EVENT_TYPE,
    RECALL_PARTICIPANT_LEAVE_EVENT_TYPE,
    RECALL_PARTICIPANT_UPDATE_EVENT_TYPE,
    RECALL_PARTICIPANT_SPEECH_ON_EVENT_TYPE,
    RECALL_PARTICIPANT_SPEECH_OFF_EVENT_TYPE,
    RECALL_PARTICIPANT_WEBCAM_ON_EVENT_TYPE,
    RECALL_PARTICIPANT_WEBCAM_OFF_EVENT_TYPE,
    RECALL_PARTICIPANT_SCREENSHARE_ON_EVENT_TYPE,
    RECALL_PARTICIPANT_SCREENSHARE_OFF_EVENT_TYPE,
  ]

  it.each(allParticipantEventTypes)('accepts event type %s', (eventType) => {
    const result = RecallParticipantEventSchema.safeParse(
      makeParticipantEventPayload(eventType)
    )

    expect(result.success).toBe(true)
  })

  it('rejects an unknown event type', () => {
    const { success } = RecallParticipantEventSchema.safeParse(
      makeParticipantEventPayload('participant_events.unknown')
    )

    expect(success).toBe(false)
  })

  it('rejects a payload where inner data is not null', () => {
    const payload = makeParticipantEventPayload(
      RECALL_PARTICIPANT_JOIN_EVENT_TYPE
    )

    payload.data.data.data = { unexpected: true }

    const { success } = RecallParticipantEventSchema.safeParse(payload)

    expect(success).toBe(false)
  })

  it('preserves unknown top-level fields', () => {
    const payload = {
      ...makeParticipantEventPayload(RECALL_PARTICIPANT_JOIN_EVENT_TYPE),
      extra: 'preserved',
    }
    const result = RecallParticipantEventSchema.safeParse(payload)

    expect(result.success).toBe(true)
    expect(result.data.extra).toBe('preserved')
  })
})

// ---------------------------------------------------------------------------
// RecallChatMessageEventSchema
// ---------------------------------------------------------------------------

function makeChatMessageEventPayload() {
  return {
    event: RECALL_CHAT_MESSAGE_EVENT_TYPE,
    data: {
      ...makeArtifacts(),
      participant_events: makeArtifact(),
      data: {
        participant: makeParticipant(),
        timestamp: makeTimestamp(),
        data: {
          text: 'Hello from chat',
          to: 'everyone',
        },
      },
    },
  }
}

describe('RecallChatMessageEventSchema', () => {
  it('accepts a valid chat message event', () => {
    const result = RecallChatMessageEventSchema.safeParse(
      makeChatMessageEventPayload()
    )

    expect(result.success).toBe(true)
  })

  it('rejects a chat message event with the wrong event type', () => {
    const payload = makeChatMessageEventPayload()

    payload.event = RECALL_PARTICIPANT_JOIN_EVENT_TYPE

    const { success } = RecallChatMessageEventSchema.safeParse(payload)

    expect(success).toBe(false)
  })

  it('rejects a chat message event with missing text', () => {
    const payload = makeChatMessageEventPayload()

    delete payload.data.data.data.text

    const { success } = RecallChatMessageEventSchema.safeParse(payload)

    expect(success).toBe(false)
  })

  it('preserves extra fields in the inner data payload', () => {
    const payload = makeChatMessageEventPayload()

    payload.data.data.data.custom = 'extra'

    const result = RecallChatMessageEventSchema.safeParse(payload)

    expect(result.success).toBe(true)
    expect(result.data.data.data.data.custom).toBe('extra')
  })
})

// ---------------------------------------------------------------------------
// RecallTranscriptEventSchema
// ---------------------------------------------------------------------------

function makeTranscriptEventPayload(
  eventType = RECALL_TRANSCRIPT_DATA_EVENT_TYPE
) {
  return {
    event: eventType,
    data: {
      ...makeArtifacts(),
      transcript: makeArtifact(),
      data: {
        words: [
          {
            text: 'Hello',
            start_timestamp: { relative: 0.0 },
            end_timestamp: { relative: 0.5 },
          },
        ],
        language_code: 'en-US',
        participant: makeParticipant(),
      },
    },
  }
}

describe('RecallTranscriptEventSchema', () => {
  it('accepts a transcript.data event', () => {
    const result = RecallTranscriptEventSchema.safeParse(
      makeTranscriptEventPayload(RECALL_TRANSCRIPT_DATA_EVENT_TYPE)
    )

    expect(result.success).toBe(true)
  })

  it('accepts a transcript.partial_data event', () => {
    const result = RecallTranscriptEventSchema.safeParse(
      makeTranscriptEventPayload(RECALL_TRANSCRIPT_PARTIAL_DATA_EVENT_TYPE)
    )

    expect(result.success).toBe(true)
  })

  it('accepts a transcript event where language_code is absent', () => {
    const payload = makeTranscriptEventPayload()

    delete payload.data.data.language_code

    const { success } = RecallTranscriptEventSchema.safeParse(payload)

    expect(success).toBe(true)
  })

  it('accepts a word with null end_timestamp', () => {
    const payload = makeTranscriptEventPayload()

    payload.data.data.words[0].end_timestamp = null

    const { success } = RecallTranscriptEventSchema.safeParse(payload)

    expect(success).toBe(true)
  })

  it('rejects a transcript event with an unknown event type', () => {
    const { success } = RecallTranscriptEventSchema.safeParse(
      makeTranscriptEventPayload('transcript.unknown')
    )

    expect(success).toBe(false)
  })

  it('rejects a transcript event missing the words array', () => {
    const payload = makeTranscriptEventPayload()

    delete payload.data.data.words

    const { success } = RecallTranscriptEventSchema.safeParse(payload)

    expect(success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RecallTranscriptProviderEventSchema
// ---------------------------------------------------------------------------

describe('RecallTranscriptProviderEventSchema', () => {
  it('accepts a transcript.provider_data event with arbitrary inner data', () => {
    const payload = {
      event: RECALL_TRANSCRIPT_PROVIDER_EVENT_TYPE,
      data: {
        ...makeArtifacts(),
        transcript: makeArtifact(),
        data: { anything: 'provider-specific', nested: { ok: true } },
      },
    }
    const result = RecallTranscriptProviderEventSchema.safeParse(payload)

    expect(result.success).toBe(true)
  })

  it('rejects if the event type is wrong', () => {
    const { success } = RecallTranscriptProviderEventSchema.safeParse({
      event: RECALL_TRANSCRIPT_DATA_EVENT_TYPE,
      data: {
        ...makeArtifacts(),
        transcript: makeArtifact(),
        data: {},
      },
    })

    expect(success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RecallRealtimeEventSchema (union discriminator)
// ---------------------------------------------------------------------------

describe('RecallRealtimeEventSchema', () => {
  it('routes a participant event through the union', () => {
    const result = RecallRealtimeEventSchema.safeParse(
      makeParticipantEventPayload(RECALL_PARTICIPANT_JOIN_EVENT_TYPE)
    )

    expect(result.success).toBe(true)
  })

  it('routes a chat message event through the union', () => {
    const result = RecallRealtimeEventSchema.safeParse(
      makeChatMessageEventPayload()
    )

    expect(result.success).toBe(true)
  })

  it('routes a transcript event through the union', () => {
    const result = RecallRealtimeEventSchema.safeParse(
      makeTranscriptEventPayload()
    )

    expect(result.success).toBe(true)
  })

  it('routes a provider transcript event through the union', () => {
    const payload = {
      event: RECALL_TRANSCRIPT_PROVIDER_EVENT_TYPE,
      data: {
        ...makeArtifacts(),
        transcript: makeArtifact(),
        data: { provider: 'deepgram' },
      },
    }

    expect(RecallRealtimeEventSchema.safeParse(payload).success).toBe(true)
  })

  it('rejects a payload with an unrecognised event type', () => {
    const payload = {
      event: 'media.audio_raw',
      data: { ...makeArtifacts(), data: {} },
    }

    expect(RecallRealtimeEventSchema.safeParse(payload).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RecallBotSchema
// ---------------------------------------------------------------------------

describe('RecallBotSchema', () => {
  it('accepts a bot with id only', () => {
    const result = RecallBotSchema.safeParse({ id: 'bot-abc' })

    expect(result.success).toBe(true)
    expect(result.data.id).toBe('bot-abc')
  })

  it('preserves additional fields via passthrough', () => {
    const result = RecallBotSchema.safeParse({
      id: 'bot-xyz',
      status: 'in_meeting',
    })

    expect(result.success).toBe(true)
    expect(result.data.status).toBe('in_meeting')
  })

  it('rejects a bot without an id', () => {
    expect(RecallBotSchema.safeParse({ status: 'created' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RecallCreateBotRequestSchema
// ---------------------------------------------------------------------------

describe('RecallCreateBotRequestSchema', () => {
  it('accepts the minimal required payload', () => {
    const result = RecallCreateBotRequestSchema.safeParse({
      meeting_url: 'https://zoom.us/j/1234567890',
    })

    expect(result.success).toBe(true)
  })

  it('accepts a fully populated payload', () => {
    const result = RecallCreateBotRequestSchema.safeParse({
      meeting_url: 'https://zoom.us/j/1234567890',
      bot_name: 'Meeting Bot',
      join_at: '2024-06-01T12:00:00Z',
      recording_config: { video_mixed_layout: 'speaker' },
      metadata: { conversationId: 'conv-1' },
    })

    expect(result.success).toBe(true)
  })

  it('rejects a request with an invalid meeting_url', () => {
    const { success } = RecallCreateBotRequestSchema.safeParse({
      meeting_url: 'not-a-url',
    })

    expect(success).toBe(false)
  })

  it('rejects a request where bot_name exceeds 100 characters', () => {
    const { success } = RecallCreateBotRequestSchema.safeParse({
      meeting_url: 'https://zoom.us/j/1',
      bot_name: 'a'.repeat(101),
    })

    expect(success).toBe(false)
  })

  it('rejects a request where bot_name is empty string', () => {
    const { success } = RecallCreateBotRequestSchema.safeParse({
      meeting_url: 'https://zoom.us/j/1',
      bot_name: '',
    })

    expect(success).toBe(false)
  })

  it('rejects a request where metadata values are not strings', () => {
    const { success } = RecallCreateBotRequestSchema.safeParse({
      meeting_url: 'https://zoom.us/j/1',
      metadata: { key: 123 },
    })

    expect(success).toBe(false)
  })

  it('accepts null for nullable fields', () => {
    const { success } = RecallCreateBotRequestSchema.safeParse({
      meeting_url: 'https://zoom.us/j/1',
      join_at: null,
      recording_config: null,
      output_media: null,
    })

    expect(success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// RecallSendChatMessageRequestSchema
// ---------------------------------------------------------------------------

describe('RecallSendChatMessageRequestSchema', () => {
  it('accepts a valid chat message request', () => {
    const result = RecallSendChatMessageRequestSchema.safeParse({
      message: 'Hello everyone',
    })

    expect(result.success).toBe(true)
  })

  it('rejects an empty message', () => {
    const { success } = RecallSendChatMessageRequestSchema.safeParse({
      message: '',
    })

    expect(success).toBe(false)
  })

  it('rejects a message exceeding 4096 characters', () => {
    const { success } = RecallSendChatMessageRequestSchema.safeParse({
      message: 'x'.repeat(4097),
    })

    expect(success).toBe(false)
  })

  it('accepts a message at the 4096 character limit', () => {
    const { success } = RecallSendChatMessageRequestSchema.safeParse({
      message: 'x'.repeat(4096),
    })

    expect(success).toBe(true)
  })

  it('rejects an empty to field', () => {
    const { success } = RecallSendChatMessageRequestSchema.safeParse({
      to: '',
      message: 'Hi',
    })

    expect(success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// RecallOutputMediaRequestSchema / RecallStopOutputMediaRequestSchema
// ---------------------------------------------------------------------------

describe('RecallOutputMediaRequestSchema', () => {
  it('accepts an empty object', () => {
    expect(RecallOutputMediaRequestSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a valid screenshare entry', () => {
    const result = RecallOutputMediaRequestSchema.safeParse({
      screenshare: {
        kind: 'webpage',
        config: { url: 'https://slides.example.com/deck' },
      },
    })

    expect(result.success).toBe(true)
  })

  it('rejects a screenshare config with a non-URL url', () => {
    const { success } = RecallOutputMediaRequestSchema.safeParse({
      screenshare: { kind: 'webpage', config: { url: 'not-a-url' } },
    })

    expect(success).toBe(false)
  })
})

describe('RecallStopOutputMediaRequestSchema', () => {
  it('accepts an empty object', () => {
    expect(RecallStopOutputMediaRequestSchema.safeParse({}).success).toBe(true)
  })

  it('accepts camera and screenshare flags', () => {
    const result = RecallStopOutputMediaRequestSchema.safeParse({
      camera: true,
      screenshare: false,
    })

    expect(result.success).toBe(true)
  })

  it('rejects non-boolean screenshare', () => {
    const { success } = RecallStopOutputMediaRequestSchema.safeParse({
      screenshare: 'yes',
    })

    expect(success).toBe(false)
  })
})

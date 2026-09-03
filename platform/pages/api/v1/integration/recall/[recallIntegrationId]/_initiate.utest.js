/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './initiate'

jest.mock('@/lib/cuid', () => ({
  __esModule: true,
  default: jest.fn(() => 'generated-channel-id'),
}))

jest.mock('@chatbotkit-dev/relay', () => ({
  __esModule: true,
  default: {
    channelUrl: jest.fn((channelId, side, options = {}) => {
      const url = new URL(
        `/channel/${encodeURIComponent(channelId)}`,
        'https://relay.example.com'
      )

      url.protocol = 'wss:'
      url.searchParams.set('side', side)

      if (options.events) {
        url.searchParams.set('events', '1')
      }

      return url.toString()
    }),
  },
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    recallIntegration: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStream: (fn) => fn,
}))

jest.mock('@/lib/host', () => ({
  getExternalFrontendHostURL: jest.fn(
    (path) => `https://chatbotkit.test${path}`
  ),
}))

jest.mock('@/lib/recall.session', () => ({
  createRecallMeetingSession: jest.fn(
    async ({ recallIntegrationId, userId }) => ({
      id: 'generated-session-id',
      recallIntegrationId,
      userId,
    })
  ),
  updateRecallMeetingSession: jest.fn(async (sessionId, patch) => ({
    id: sessionId,
    ...patch,
  })),
  deleteRecallMeetingSession: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  throwBadRequest: jest.fn((message) => {
    throw new Error(message)
  }),
  throwNotAuthorized: jest.fn(() => ({ status: 403 })),
  throwNotFound: jest.fn(() => ({ status: 404 })),
}))

describe('POST /api/v1/integration/recall/{recallIntegrationId}/initiate', () => {
  const session = {
    user: {
      id: 'user-1',
    },
  }

  const makeStream = () => ({
    result: jest.fn(),
  })

  beforeEach(() => {
    jest.clearAllMocks()

    global.fetch = jest.fn()
  })

  it('should accept initiate body fields', () => {
    const validBodies = [
      {
        meetingUrl: 'https://zoom.us/j/123?pwd=456',
        text: 'Introduce yourself to the room',
        botName: 'CBK Agent',
      },
      {
        meetingUrl: 'https://zoom.us/j/123?pwd=456',
        text: 'Introduce yourself to the room',
        botName: null,
      },
      {
        meetingUrl: 'https://zoom.us/j/123?pwd=456',
        text: 'Introduce yourself to the room',
        botName: '',
      },
      {
        meetingUrl: 'https://zoom.us/j/123?pwd=456',
        text: 'Introduce yourself to the room',
      },
    ]

    for (const body of validBodies) {
      const { error } = bodySchema.validate(body)

      expect(error).toBeUndefined()
    }
  })

  it('should reject invalid initiate body fields', () => {
    const invalidBodies = [
      {
        meetingUrl: 'not-a-url',
        text: 'Introduce yourself to the room',
      },
      {
        meetingUrl: 'https://zoom.us/j/123?pwd=456',
        text: '   ',
      },
    ]

    for (const body of invalidBodies) {
      const { error } = bodySchema.validate(body)

      expect(error).toBeDefined()
    }
  })

  it('should create a Recall bot with webpage output media', async () => {
    const stream = makeStream()

    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-1',
      botId: 'bot-1',
      bot: {
        name: 'Linked Bot',
      },
      apiKey: 'recall-api-key',
      userId: 'user-1',
    })

    global.fetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 'recall-bot-1' }), { status: 201 })
    )

    await handler(
      {
        query: {
          recallIntegrationId: 'recall-1',
        },
      },
      stream,
      session,
      {
        meetingUrl: 'https://zoom.us/j/123?pwd=456',
        text: 'Introduce yourself to the room',
        botName: 'CBK Agent',
      }
    )

    expect(
      prisma.recallIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'recall-1', {
      include: {
        bot: {
          select: {
            name: true,
          },
        },
      },
    })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://us-east-1.recall.ai/api/v1/bot/',
      {
        method: 'POST',
        headers: {
          Authorization: 'recall-api-key',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          meeting_url: 'https://zoom.us/j/123?pwd=456',
          bot_name: 'CBK Agent',
          recording_config: {
            video_mixed_mp4: {},
            audio_mixed_mp3: {},
            include_bot_in_recording: {
              audio: true,
            },
            realtime_endpoints: [
              {
                type: 'websocket',
                url: 'wss://relay.example.com/channel/recall-generated-channel-id-generated-channel-id?side=recall',
                events: [
                  'participant_events.join',
                  'participant_events.leave',
                  'participant_events.update',
                  'participant_events.speech_on',
                  'participant_events.speech_off',
                  'participant_events.webcam_on',
                  'participant_events.webcam_off',
                  'participant_events.screenshare_on',
                  'participant_events.screenshare_off',
                  'participant_events.chat_message',
                  'transcript.data',
                  'transcript.partial_data',
                  'transcript.provider_data',
                ],
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
                url: 'https://chatbotkit.test/integrations/recall/recall-1/camera?sessionId=generated-session-id',
              },
            },
          },
          variant: {
            zoom: 'web_4_core',
            google_meet: 'web_4_core',
            microsoft_teams: 'web_4_core',
          },
          metadata: {
            recallIntegrationId: 'recall-1',
            sessionId: 'generated-session-id',
          },
        }),
      }
    )
    expect(stream.result).toHaveBeenCalledWith({
      id: 'recall-1',
      bot: {
        id: 'recall-bot-1',
      },
    })
  })

  it('should use the linked bot name when botName is not provided', async () => {
    const stream = makeStream()

    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-1',
      botId: 'bot-1',
      bot: {
        name: 'Linked Bot',
      },
      apiKey: 'recall-api-key',
      userId: 'user-1',
    })

    global.fetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 'recall-bot-1' }), { status: 201 })
    )

    await handler(
      {
        query: {
          recallIntegrationId: 'recall-1',
        },
      },
      stream,
      session,
      {
        meetingUrl: 'https://zoom.us/j/123?pwd=456',
        text: 'Introduce yourself to the room',
      }
    )

    const [, options] = global.fetch.mock.calls[0]

    expect(JSON.parse(options.body)).toMatchObject({
      bot_name: 'Linked Bot',
    })
  })

  it('should use the linked bot name when botName is empty', async () => {
    const stream = makeStream()

    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-1',
      botId: 'bot-1',
      bot: {
        name: 'Linked Bot',
      },
      apiKey: 'recall-api-key',
      userId: 'user-1',
    })

    global.fetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 'recall-bot-1' }), { status: 201 })
    )

    await handler(
      {
        query: {
          recallIntegrationId: 'recall-1',
        },
      },
      stream,
      session,
      {
        meetingUrl: 'https://zoom.us/j/123?pwd=456',
        text: 'Introduce yourself to the room',
        botName: '',
      }
    )

    const [, options] = global.fetch.mock.calls[0]

    expect(JSON.parse(options.body)).toMatchObject({
      bot_name: 'Linked Bot',
    })
  })

  it('should use the configured Recall region', async () => {
    const stream = makeStream()

    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-1',
      botId: 'bot-1',
      bot: {
        name: 'Linked Bot',
      },
      apiKey: 'recall-api-key',
      region: 'eu-central-1',
      userId: 'user-1',
    })

    global.fetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 'recall-bot-1' }), { status: 201 })
    )

    await handler(
      {
        query: {
          recallIntegrationId: 'recall-1',
        },
      },
      stream,
      session,
      {
        meetingUrl: 'https://zoom.us/j/123?pwd=456',
        text: 'Introduce yourself to the room',
      }
    )

    expect(global.fetch.mock.calls[0][0]).toBe(
      'https://eu-central-1.recall.ai/api/v1/bot/'
    )
  })

  it('should return not found when integration is missing', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(
      {
        query: {
          recallIntegrationId: 'missing',
        },
      },
      makeStream(),
      session,
      {
        meetingUrl: 'https://zoom.us/j/123?pwd=456',
        text: 'Introduce yourself to the room',
      }
    )

    expect(result).toEqual({ status: 404 })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should return not authorized when user does not own integration', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-1',
      userId: 'other-user',
    })

    const result = await handler(
      {
        query: {
          recallIntegrationId: 'recall-1',
        },
      },
      makeStream(),
      session,
      {
        meetingUrl: 'https://zoom.us/j/123?pwd=456',
        text: 'Introduce yourself to the room',
      }
    )

    expect(result).toEqual({ status: 403 })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should return bad request when bot is not configured', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-1',
      botId: null,
      apiKey: 'recall-api-key',
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            recallIntegrationId: 'recall-1',
          },
        },
        makeStream(),
        session,
        {
          meetingUrl: 'https://zoom.us/j/123?pwd=456',
          text: 'Introduce yourself to the room',
        }
      )
    ).rejects.toThrow('Recall integration does not have a bot configured')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should return bad request when API key is not configured', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-1',
      botId: 'bot-1',
      apiKey: null,
      userId: 'user-1',
    })

    await expect(
      handler(
        {
          query: {
            recallIntegrationId: 'recall-1',
          },
        },
        makeStream(),
        session,
        {
          meetingUrl: 'https://zoom.us/j/123?pwd=456',
          text: 'Introduce yourself to the room',
        }
      )
    ).rejects.toThrow('Recall integration does not have an API key configured')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should return bad request when Recall bot creation fails', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-1',
      botId: 'bot-1',
      apiKey: 'recall-api-key',
      userId: 'user-1',
    })

    global.fetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Invalid meeting URL' }), {
        status: 400,
      })
    )

    await expect(
      handler(
        {
          query: {
            recallIntegrationId: 'recall-1',
          },
        },
        makeStream(),
        session,
        {
          meetingUrl: 'https://zoom.us/j/123?pwd=456',
          text: 'Introduce yourself to the room',
        }
      )
    ).rejects.toThrow('Invalid meeting URL')
  })

  it('should return Recall validation details when bot creation fails', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-1',
      botId: 'bot-1',
      apiKey: 'recall-api-key',
      userId: 'user-1',
    })

    global.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          recording_config: {
            transcript: ['Provider is required.'],
          },
        }),
        {
          status: 400,
        }
      )
    )

    await expect(
      handler(
        {
          query: {
            recallIntegrationId: 'recall-1',
          },
        },
        makeStream(),
        session,
        {
          meetingUrl: 'https://zoom.us/j/123?pwd=456',
          text: 'Introduce yourself to the room',
        }
      )
    ).rejects.toThrow(
      '{"recording_config":{"transcript":["Provider is required."]}}'
    )
  })
})

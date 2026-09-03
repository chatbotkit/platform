/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { UserInputError } from '@/lib/error'
import { fetch } from '@/lib/fetch'
import { createRecallMeetingSession } from '@/lib/recall.session'

import handler from './recall'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@prisma/client', () => ({}))

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

jest.mock('@/lib/fetch', () => ({
  fetch: jest.fn(),
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

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlers) => {
    const fn = () => handlers

    fn.handlers = handlers

    return fn
  }),
}))

describe('auxiliary/skillset/ability/chatbotkit/integration/recall/meeting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)
  })

  describe('handler structure', () => {
    it('exports a multi-handler with joinMeeting', () => {
      expect(handler).toBeDefined()
      expect(handler.handlers).toBeDefined()
      expect(handler.handlers.joinMeeting).toBeDefined()
      expect(handler.handlers.joinMeeting.schema).toBeDefined()
      expect(handler.handlers.joinMeeting.fn).toBeDefined()
      expect(typeof handler.handlers.joinMeeting.fn).toBe('function')
    })
  })

  describe('joinMeeting', () => {
    const mockSession = {
      user: {
        id: 'user123',
      },
    }

    const mockHeaders = new Headers()
    const joinMeetingFn = handler.handlers.joinMeeting.fn

    it('joins a meeting successfully', async () => {
      prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'recall123',
        userId: 'user123',
        botId: 'bot123',
        bot: {
          name: 'Linked Bot',
        },
        apiKey: 'recall-api-key',
      })

      fetch.mockResolvedValue(
        new Response(JSON.stringify({ id: 'recall-bot-1' }), { status: 201 })
      )

      const result = await joinMeetingFn(
        mockSession,
        {
          recallIntegrationId: 'recall123',
          meetingUrl: 'https://zoom.us/j/123?pwd=456',
          text: 'Join and introduce yourself',
          botName: 'Meeting Agent',
          joinAt: '2026-06-01T12:00:00Z',
        },
        mockHeaders
      )

      expect(
        prisma.recallIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'recall123', {
        include: {
          bot: {
            select: {
              name: true,
            },
          },
        },
      })

      const [url, options] = fetch.mock.calls[0]

      expect(url).toBe('https://us-east-1.recall.ai/api/v1/bot/')
      expect(options).toMatchObject({
        method: 'POST',
        headers: {
          Authorization: 'recall-api-key',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })
      expect(JSON.parse(options.body)).toEqual({
        meeting_url: 'https://zoom.us/j/123?pwd=456',
        bot_name: 'Meeting Agent',
        join_at: '2026-06-01T12:00:00Z',
        metadata: {
          recallIntegrationId: 'recall123',
          sessionId: 'generated-session-id',
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
              url: 'https://chatbotkit.test/integrations/recall/recall123/camera?sessionId=generated-session-id',
            },
          },
        },
      })
      expect(createRecallMeetingSession).toHaveBeenCalledWith({
        recallIntegrationId: 'recall123',
        userId: 'user123',
        pageRelayUrl:
          'wss://relay.example.com/channel/recall-generated-channel-id-generated-channel-id?side=page&events=1',
        text: 'Join and introduce yourself',
        botName: 'Meeting Agent',
      })

      expect(result).toEqual({
        success: true,
      })
    })

    it('uses the linked bot name when botName is not provided', async () => {
      prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'recall123',
        userId: 'user123',
        botId: 'bot123',
        bot: {
          name: 'Linked Bot',
        },
        apiKey: 'recall-api-key',
      })

      fetch.mockResolvedValue(
        new Response(JSON.stringify({ id: 'recall-bot-1' }), { status: 201 })
      )

      await joinMeetingFn(
        mockSession,
        {
          recallIntegrationId: 'recall123',
          meetingUrl: 'https://zoom.us/j/123?pwd=456',
          text: 'Join and introduce yourself',
        },
        mockHeaders
      )

      const [, options] = fetch.mock.calls[0]

      expect(JSON.parse(options.body)).toMatchObject({
        bot_name: 'Linked Bot',
      })
    })

    it('throws when the integration is not found', async () => {
      prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      await expect(
        joinMeetingFn(
          mockSession,
          {
            recallIntegrationId: 'missing',
            meetingUrl: 'https://zoom.us/j/123?pwd=456',
            text: 'Join and introduce yourself',
          },
          mockHeaders
        )
      ).rejects.toThrow('Recall integration not found')

      expect(fetch).not.toHaveBeenCalled()
    })

    it('throws when the user does not own the integration', async () => {
      prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'recall123',
        userId: 'other-user',
        botId: 'bot123',
        apiKey: 'recall-api-key',
      })

      await expect(
        joinMeetingFn(
          mockSession,
          {
            recallIntegrationId: 'recall123',
            meetingUrl: 'https://zoom.us/j/123?pwd=456',
            text: 'Join and introduce yourself',
          },
          mockHeaders
        )
      ).rejects.toThrow('Not authorized to use this Recall integration')
    })

    it('throws when the integration has no bot configured', async () => {
      prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'recall123',
        userId: 'user123',
        botId: null,
        apiKey: 'recall-api-key',
      })

      await expect(
        joinMeetingFn(
          mockSession,
          {
            recallIntegrationId: 'recall123',
            meetingUrl: 'https://zoom.us/j/123?pwd=456',
            text: 'Join and introduce yourself',
          },
          mockHeaders
        )
      ).rejects.toThrow('Recall integration does not have a bot configured')
    })

    it('throws when the integration has no API key', async () => {
      prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'recall123',
        userId: 'user123',
        botId: 'bot123',
        apiKey: null,
      })

      await expect(
        joinMeetingFn(
          mockSession,
          {
            recallIntegrationId: 'recall123',
            meetingUrl: 'https://zoom.us/j/123?pwd=456',
            text: 'Join and introduce yourself',
          },
          mockHeaders
        )
      ).rejects.toThrow(
        'Recall integration does not have an API key configured'
      )
    })

    it('throws Recall validation details when bot creation fails', async () => {
      prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'recall123',
        userId: 'user123',
        botId: 'bot123',
        apiKey: 'recall-api-key',
      })

      fetch.mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Invalid meeting URL' }), {
          status: 400,
        })
      )

      await expect(
        joinMeetingFn(
          mockSession,
          {
            recallIntegrationId: 'recall123',
            meetingUrl: 'https://zoom.us/j/123?pwd=456',
            text: 'Join and introduce yourself',
          },
          mockHeaders
        )
      ).rejects.toThrow(UserInputError)
    })
  })
})

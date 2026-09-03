/* eslint-disable @typescript-eslint/no-require-imports */
import cuid from '@/lib/cuid'
import fetch from '@/lib/fetch'
import { getExternalFrontendHostURL } from '@/lib/host'

import {
  RECALL_BOT_CREATE_URL,
  createRecallRelayChannelUrl,
  formatRecallError,
  getRecallMeetingSeed,
  joinMeeting,
  parseRecallResponse,
} from './recall.bot'

jest.mock('@/lib/fetch')

jest.mock('@/lib/host', () => ({
  getExternalFrontendHostURL: jest.fn(),
}))

jest.mock('@/lib/cuid', () => ({
  __esModule: true,
  default: jest.fn(),
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

jest.mock('@/lib/recall.session', () => ({
  createRecallMeetingSession: jest.fn(async () => ({ id: 'session-id' })),
  updateRecallMeetingSession: jest.fn(async (sessionId, patch) => ({
    id: sessionId,
    ...patch,
  })),
  deleteRecallMeetingSession: jest.fn(),
}))

jest.mock('@/lib/recall.session', () => ({
  createRecallMeetingSession: jest.fn(),
  updateRecallMeetingSession: jest.fn(),
  deleteRecallMeetingSession: jest.fn(),
}))

describe('recall.bot', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    getExternalFrontendHostURL.mockImplementation((path) => {
      return `https://app.example.com${path}`
    })
  })

  describe('parseRecallResponse', () => {
    it('returns null for empty response body', async () => {
      const response = { text: async () => '' }

      const result = await parseRecallResponse(response)

      expect(result).toBeNull()
    })

    it('returns parsed JSON when body is valid JSON', async () => {
      const data = { id: 'bot-123', status: 'ready' }
      const response = { text: async () => JSON.stringify(data) }

      const result = await parseRecallResponse(response)

      expect(result).toEqual(data)
    })

    it('returns raw string when body is invalid JSON', async () => {
      const response = { text: async () => 'plain text error message' }

      const result = await parseRecallResponse(response)

      expect(result).toBe('plain text error message')
    })

    it('returns nested object from JSON', async () => {
      const data = { id: 'bot-456', meta: { key: 'value' } }
      const response = { text: async () => JSON.stringify(data) }

      const result = await parseRecallResponse(response)

      expect(result).toEqual(data)
    })
  })

  describe('formatRecallError', () => {
    it('uses detail field when present', () => {
      const result = formatRecallError({ detail: 'Invalid meeting URL' }, 400)

      expect(result).toBe('Invalid meeting URL')
    })

    it('uses message field when detail is absent', () => {
      const result = formatRecallError({ message: 'Unauthorized' }, 401)

      expect(result).toBe('Unauthorized')
    })

    it('prefers detail over message when both are present', () => {
      const result = formatRecallError(
        { detail: 'detail text', message: 'message text' },
        400
      )

      expect(result).toBe('detail text')
    })

    it('JSON-stringifies unknown object shapes', () => {
      const data = { code: 404, error: 'not_found' }
      const result = formatRecallError(data, 404)

      expect(result).toBe(JSON.stringify(data))
    })

    it('returns the string directly when data is a string', () => {
      const result = formatRecallError('Something went wrong', 500)

      expect(result).toBe('Something went wrong')
    })

    it('falls back to generic status message for null data', () => {
      const result = formatRecallError(null, 503)

      expect(result).toBe('Recall bot creation failed with status 503')
    })

    it('falls back to generic status message for undefined data', () => {
      const result = formatRecallError(undefined, 500)

      expect(result).toBe('Recall bot creation failed with status 500')
    })

    it('falls back to generic status message for numeric data', () => {
      const result = formatRecallError(42, 500)

      expect(result).toBe('Recall bot creation failed with status 500')
    })
  })

  // @note these cases used to assert the whole URL construction - the scheme
  // rewrite, the escaping, the events flag. All of that moved into whichever
  // relay module is installed, along with its own tests; what is left to check
  // here is that this function is the delegation it now claims to be. Repeating
  // the construction through this seam would be testing the module twice.

  describe('createRecallRelayChannelUrl', () => {
    it('addresses the channel for the side it was given', () => {
      const parsed = new URL(
        createRecallRelayChannelUrl('channel-abc', 'recall')
      )

      expect(parsed.pathname).toContain('channel-abc')
      expect(parsed.searchParams.get('side')).toBe('recall')
    })

    it('passes the events option through', () => {
      const withEvents = new URL(
        createRecallRelayChannelUrl('channel-abc', 'page', { events: true })
      )

      const without = new URL(
        createRecallRelayChannelUrl('channel-abc', 'page')
      )

      expect(withEvents.searchParams.get('events')).toBe('1')
      expect(without.searchParams.get('events')).toBeNull()
    })
  })

  describe('getRecallMeetingSeed', () => {
    it('returns an unknown seed when no Recall bot id is available yet', async () => {
      const result = await getRecallMeetingSeed({
        apiKey: 'Bearer recall-api-key',
        recallBotId: null,
      })

      expect(result).toEqual({
        mode: 'unknown',
        participantCount: 0,
        confidence: 'unknown',
        participants: [],
      })
      expect(fetch).not.toHaveBeenCalled()
    })

    it('returns an unknown seed even when a Recall bot id is available', async () => {
      const result = await getRecallMeetingSeed({
        apiKey: 'Bearer recall-api-key',
        recallBotId: 'bot-123',
        region: 'us-east-1',
      })

      expect(result).toEqual({
        mode: 'unknown',
        participantCount: 0,
        confidence: 'unknown',
        participants: [],
      })
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('joinMeeting', () => {
    const recallIntegration = {
      id: 'integration-123',
      apiKey: 'Bearer recall-api-key',
      userId: 'user-123',
    }

    beforeEach(() => {
      // Reset cuid mock to predictable values for each test
      cuid
        .mockReturnValueOnce('cuid-a')
        .mockReturnValueOnce('cuid-b')
        .mockReturnValue('cuid-c')

      // Mock createRecallMeetingSession to avoid real Redis calls
      const {
        createRecallMeetingSession,
        updateRecallMeetingSession,
      } = require('@/lib/recall.session')

      const mockSession = {
        id: 'session-abc',
        recallIntegrationId: recallIntegration.id,
        userId: recallIntegration.userId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      createRecallMeetingSession.mockResolvedValue(mockSession)
      updateRecallMeetingSession.mockResolvedValue({
        ...mockSession,
        updatedAt: Date.now(),
      })
    })

    it('returns bot object on successful creation', async () => {
      const bot = { id: 'bot-abc', status: 'joining' }

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(bot),
      })

      const result = await joinMeeting({
        recallIntegration,
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        text: 'Hello from bot',
      })

      expect(result).toEqual(bot)
    })

    it('calls Recall API with POST to the bot creation URL', async () => {
      const bot = { id: 'bot-xyz', status: 'joining' }

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(bot),
      })

      await joinMeeting({
        recallIntegration,
        meetingUrl: 'https://zoom.us/j/12345',
        text: 'Test',
      })

      expect(fetch).toHaveBeenCalledWith(
        RECALL_BOT_CREATE_URL,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: recallIntegration.apiKey,
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('includes meeting_url in the request payload', async () => {
      const meetingUrl = 'https://meet.google.com/abc-defg-hij'
      const bot = { id: 'bot-xyz' }

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(bot),
      })

      await joinMeeting({
        recallIntegration,
        meetingUrl,
        text: 'Test',
      })

      const callBody = JSON.parse(fetch.mock.calls[0][1].body)

      expect(callBody.meeting_url).toBe(meetingUrl)
    })

    it('includes bot_name when provided', async () => {
      const bot = { id: 'bot-xyz' }

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(bot),
      })

      await joinMeeting({
        recallIntegration,
        meetingUrl: 'https://meet.google.com/abc',
        text: 'Test',
        botName: 'My Assistant',
      })

      const callBody = JSON.parse(fetch.mock.calls[0][1].body)

      expect(callBody.bot_name).toBe('My Assistant')
    })

    it('maps joinAt to join_at when provided', async () => {
      const bot = { id: 'bot-xyz' }
      const joinAt = '2026-06-01T12:00:00Z'

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(bot),
      })

      await joinMeeting({
        recallIntegration,
        meetingUrl: 'https://meet.google.com/abc',
        text: 'Test',
        joinAt,
      })

      const callBody = JSON.parse(fetch.mock.calls[0][1].body)

      expect(callBody.join_at).toBe(joinAt)
    })

    it('omits bot_name when not provided', async () => {
      const bot = { id: 'bot-xyz' }

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(bot),
      })

      await joinMeeting({
        recallIntegration,
        meetingUrl: 'https://meet.google.com/abc',
        text: 'Test',
      })

      const callBody = JSON.parse(fetch.mock.calls[0][1].body)

      expect(callBody).not.toHaveProperty('bot_name')
    })

    it('throws when API returns non-ok response', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ detail: 'Invalid meeting URL' }),
      })

      await expect(
        joinMeeting({
          recallIntegration,
          meetingUrl: 'https://meet.google.com/invalid-url-case',
          text: 'Test',
        })
      ).rejects.toThrow('Invalid meeting URL')
    })

    it('throws with status code in message when error has no detail', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => '',
      })

      await expect(
        joinMeeting({
          recallIntegration,
          meetingUrl: 'https://meet.google.com/abc',
          text: 'Test',
        })
      ).rejects.toThrow('Recall bot creation failed with status 500')
    })

    it('throws when API returns an object without an id field', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ status: 'error', message: 'oops' }),
      })

      await expect(
        joinMeeting({
          recallIntegration,
          meetingUrl: 'https://meet.google.com/abc',
          text: 'Test',
        })
      ).rejects.toThrow('Recall bot creation returned an unexpected response')
    })

    it('throws when API returns a non-object response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '"just a string"',
      })

      await expect(
        joinMeeting({
          recallIntegration,
          meetingUrl: 'https://meet.google.com/abc',
          text: 'Test',
        })
      ).rejects.toThrow('Recall bot creation returned an unexpected response')
    })

    it('includes websocket relay URL in realtime_endpoints', async () => {
      const bot = { id: 'bot-xyz' }

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(bot),
      })

      await joinMeeting({
        recallIntegration,
        meetingUrl: 'https://meet.google.com/abc',
        text: 'Test',
      })

      const callBody = JSON.parse(fetch.mock.calls[0][1].body)
      const endpoints = callBody.recording_config?.realtime_endpoints

      expect(endpoints).toHaveLength(1)
      expect(endpoints[0].type).toBe('websocket')
      expect(endpoints[0].url).toMatch(/^wss:\/\//)
    })
  })
})

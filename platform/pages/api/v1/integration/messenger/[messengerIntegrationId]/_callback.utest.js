/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import { createHmac } from 'crypto'

import prisma from '@/prisma/client'

import { logEvent } from '@/lib/log'
import { parseRequestJson } from '@/lib/request'

import handler from '@/pages/api/v1/integration/messenger/[messengerIntegrationId]/callback'
import { sendEvent } from '@/pages/api/v1/integration/messenger/[messengerIntegrationId]/queue'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock(
  '@/pages/api/v1/integration/messenger/[messengerIntegrationId]/queue',
  () => ({
    sendEvent: jest.fn(),
  })
)

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

describe('Messenger callback API handler', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  function makeRequest(
    payload,
    {
      messengerIntegrationId = 'int-123',
      method = 'POST',
      queryParams = {},
    } = {}
  ) {
    const queryString = new URLSearchParams({
      messengerIntegrationId,
      ...queryParams,
    }).toString()
    const url = `https://example.com/api/v1/integration/messenger/${messengerIntegrationId}/callback?${queryString}`

    const body =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {})

    return new Request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' ? body : undefined,
    })
  }

  describe('integration lookup', () => {
    it('returns notFound when integration does not exist', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue(null)

      const req = makeRequest({})
      const res = await handler(req)

      expect(res.status).toBe(404)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('looks up integration by messengerIntegrationId from URL', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-456',
        userId: 'user-1',
        verifyToken: 'test-token',
      })
      parseRequestJson.mockResolvedValue({})

      const req = makeRequest({}, { messengerIntegrationId: 'int-456' })

      await handler(req)

      expect(prisma.messengerIntegration.findUnique).toHaveBeenCalledWith({
        where: { id: 'int-456' },
      })
    })
  })

  describe('webhook subscription verification', () => {
    it('returns challenge when verify token matches', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'my-verify-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const req = makeRequest(
        {},
        {
          method: 'GET',
          queryParams: {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'my-verify-token',
            'hub.challenge': 'challenge123',
          },
        }
      )

      const res = await handler(req)

      expect(res.status).toBe(200)

      const text = await res.text()

      expect(text).toBe('challenge123')

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.messenger.callback.subscribe',
          meta: expect.objectContaining({
            status: 200,
            reason: 'OK',
          }),
        })
      )
    })

    it('returns notAuthorized when verify token does not match', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'my-verify-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const req = makeRequest(
        {},
        {
          method: 'GET',
          queryParams: {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'wrong-token',
            'hub.challenge': 'challenge123',
          },
        }
      )

      const res = await handler(req)

      expect(res.status).toBe(403)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.messenger.callback.subscribe',
          meta: expect.objectContaining({
            status: 403,
            reason: 'Verification token does not match.',
          }),
        })
      )
    })

    it('logs event with correct relations on successful subscription', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'my-verify-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const req = makeRequest(
        {},
        {
          method: 'GET',
          queryParams: {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'my-verify-token',
            'hub.challenge': 'challenge123',
          },
        }
      )

      await handler(req)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'user-1' },
          type: 'integration.messenger.callback.subscribe',
          relations: {
            blueprintId: 'bp-1',
            botId: 'bot-1',
            messengerIntegrationId: 'int-123',
          },
        })
      )
    })

    it('logs event with correct relations on failed subscription', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'my-verify-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const req = makeRequest(
        {},
        {
          method: 'GET',
          queryParams: {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'wrong-token',
            'hub.challenge': 'challenge123',
          },
        }
      )

      await handler(req)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'user-1' },
          type: 'integration.messenger.callback.subscribe',
          relations: {
            blueprintId: 'bp-1',
            botId: 'bot-1',
            messengerIntegrationId: 'int-123',
          },
        })
      )
    })
  })

  describe('message entry processing', () => {
    it('sends interact event for incoming messages', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const messagePayload = {
        entry: [
          {
            messaging: [
              {
                sender: { id: '1234567890' },
                recipient: { id: 'page-123' },
                timestamp: 1234567890,
                message: {
                  mid: 'msg-1',
                  text: 'Hello',
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(messagePayload)

      const req = makeRequest(messagePayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.messenger.callback.notification',
        })
      )
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: messagePayload.entry[0].messaging[0],
      })
    })

    it('processes multiple entries and messaging items', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const messagePayload = {
        entry: [
          {
            messaging: [
              {
                sender: { id: '111' },
                recipient: { id: 'page-123' },
                timestamp: 1234567890,
                message: { mid: 'msg-1', text: 'First' },
              },
              {
                sender: { id: '222' },
                recipient: { id: 'page-123' },
                timestamp: 1234567891,
                message: { mid: 'msg-2', text: 'Second' },
              },
            ],
          },
          {
            messaging: [
              {
                sender: { id: '333' },
                recipient: { id: 'page-123' },
                timestamp: 1234567892,
                message: { mid: 'msg-3', text: 'Third' },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(messagePayload)

      const req = makeRequest(messagePayload)

      await handler(req)

      expect(sendEvent).toHaveBeenCalledTimes(3)
    })

    it('handles entries without messaging array gracefully', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })

      const payload = {
        entry: [
          {
            // no messaging array
          },
        ],
      }

      parseRequestJson.mockResolvedValue(payload)

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('handles empty messaging array', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })

      const payload = {
        entry: [
          {
            messaging: [],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(payload)

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('logs notification event with correct relations', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const messagePayload = {
        entry: [
          {
            messaging: [
              {
                sender: { id: '1234567890' },
                recipient: { id: 'page-123' },
                timestamp: 1234567890,
                message: {
                  mid: 'msg-1',
                  text: 'Hello',
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(messagePayload)

      const req = makeRequest(messagePayload)

      await handler(req)

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: 'user-1' },
          type: 'integration.messenger.callback.notification',
          relations: {
            blueprintId: 'bp-1',
            botId: 'bot-1',
            messengerIntegrationId: 'int-123',
          },
        })
      )
    })

    it('processes postback messages', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const postbackPayload = {
        entry: [
          {
            messaging: [
              {
                sender: { id: '1234567890' },
                recipient: { id: 'page-123' },
                timestamp: 1234567890,
                postback: {
                  title: 'Get Started',
                  payload: 'GET_STARTED',
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(postbackPayload)

      const req = makeRequest(postbackPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: postbackPayload.entry[0].messaging[0],
      })
    })

    it('processes message with attachments', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const attachmentPayload = {
        entry: [
          {
            messaging: [
              {
                sender: { id: '1234567890' },
                recipient: { id: 'page-123' },
                timestamp: 1234567890,
                message: {
                  mid: 'msg-1',
                  attachments: [
                    {
                      type: 'image',
                      payload: {
                        url: 'https://example.com/image.jpg',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(attachmentPayload)

      const req = makeRequest(attachmentPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: attachmentPayload.entry[0].messaging[0],
      })
    })
  })

  describe('message filtering', () => {
    it('skips echo messages to prevent processing loops', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      // This is what Meta sends when YOUR bot sends a message
      const echoPayload = {
        object: 'page',
        entry: [
          {
            id: '111222333444555',
            time: 1569262486134,
            messaging: [
              {
                sender: { id: '111222333444555' },
                recipient: { id: '1234567890123456' },
                timestamp: 1569262485349,
                message: {
                  mid: 'm_AG5Hz7zBv...',
                  text: 'Hello from bot',
                  is_echo: true, // This indicates the message was sent BY the bot
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(echoPayload)

      const req = makeRequest(echoPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('skips deleted messages', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const deletedPayload = {
        object: 'page',
        entry: [
          {
            id: '111222333444555',
            time: 1569262486134,
            messaging: [
              {
                sender: { id: '1234567890123456' },
                recipient: { id: '111222333444555' },
                timestamp: 1569262485349,
                message: {
                  mid: 'm_AG5Hz7zBv...',
                  is_deleted: true,
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(deletedPayload)

      const req = makeRequest(deletedPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('skips unsupported message types', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      // Stickers and GIFs can trigger this
      const unsupportedPayload = {
        object: 'page',
        entry: [
          {
            id: '111222333444555',
            time: 1569262486134,
            messaging: [
              {
                sender: { id: '1234567890123456' },
                recipient: { id: '111222333444555' },
                timestamp: 1569262485349,
                message: {
                  mid: 'm_AG5Hz7zBv...',
                  is_unsupported: true,
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(unsupportedPayload)

      const req = makeRequest(unsupportedPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('processes normal messages but skips echo in same batch', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      // Mixed batch with both user message and echo
      const mixedPayload = {
        object: 'page',
        entry: [
          {
            id: '111222333444555',
            time: 1569262486134,
            messaging: [
              {
                sender: { id: '1234567890123456' },
                recipient: { id: '111222333444555' },
                timestamp: 1569262485349,
                message: {
                  mid: 'm_user_message',
                  text: 'Hello from user',
                },
              },
              {
                sender: { id: '111222333444555' },
                recipient: { id: '1234567890123456' },
                timestamp: 1569262485350,
                message: {
                  mid: 'm_bot_echo',
                  text: 'Response from bot',
                  is_echo: true,
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(mixedPayload)

      const req = makeRequest(mixedPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledTimes(1)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: mixedPayload.entry[0].messaging[0], // Only the user message
      })
    })

    it('still processes postback messages (not affected by echo check)', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      // Postbacks don't have is_echo field
      const postbackPayload = {
        object: 'page',
        entry: [
          {
            id: '111222333444555',
            time: 1569262486134,
            messaging: [
              {
                sender: { id: '1234567890123456' },
                recipient: { id: '111222333444555' },
                timestamp: 1569262485349,
                postback: {
                  mid: 'm_AG5Hz7zBv...',
                  title: 'Get Started',
                  payload: 'GET_STARTED',
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(postbackPayload)

      const req = makeRequest(postbackPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledTimes(1)
    })
  })

  describe('realistic Meta webhook payloads', () => {
    it('processes quick reply selection', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const quickReplyPayload = {
        object: 'page',
        entry: [
          {
            id: '111222333444555',
            time: 1569262486134,
            messaging: [
              {
                sender: { id: '1234567890123456' },
                recipient: { id: '111222333444555' },
                timestamp: 1569262485349,
                message: {
                  mid: 'm_AG5Hz7zBv...',
                  text: 'Yes',
                  quick_reply: {
                    payload: 'USER_CONFIRMED_YES',
                  },
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(quickReplyPayload)

      const req = makeRequest(quickReplyPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: quickReplyPayload.entry[0].messaging[0],
      })
    })

    it('ignores reaction event (unsupported queue payload shape)', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      // Reactions have a different structure - no message field
      const reactionPayload = {
        object: 'page',
        entry: [
          {
            id: '111222333444555',
            time: 1569262486134,
            messaging: [
              {
                sender: { id: '1234567890123456' },
                recipient: { id: '111222333444555' },
                timestamp: 1569262485349,
                reaction: {
                  mid: 'm_AG5Hz7zBv...',
                  action: 'react',
                  reaction: 'love',
                  emoji: '\u2764\uFE0F',
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(reactionPayload)

      const req = makeRequest(reactionPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('ignores m.me link referral without message/postback', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      // User clicked m.me link with ref parameter
      const referralPayload = {
        object: 'page',
        entry: [
          {
            id: '111222333444555',
            time: 1569262486134,
            messaging: [
              {
                sender: { id: '1234567890123456' },
                recipient: { id: '111222333444555' },
                timestamp: 1569262485349,
                referral: {
                  ref: 'launch_summer_2024',
                  source: 'SHORTLINK',
                  type: 'OPEN_THREAD',
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(referralPayload)

      const req = makeRequest(referralPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('processes Click To Messenger (CTM) ad message', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const ctmAdPayload = {
        object: 'page',
        entry: [
          {
            id: '111222333444555',
            time: 1569262486134,
            messaging: [
              {
                sender: { id: '1234567890123456' },
                recipient: { id: '111222333444555' },
                timestamp: 1569262485349,
                message: {
                  mid: 'm_AG5Hz7zBv...',
                  text: 'I saw your ad!',
                  referral: {
                    ref: 'ad_campaign_summer_2024',
                    ad_id: 23847283947234,
                    source: 'ADS',
                    type: 'OPEN_THREAD',
                    ads_context_data: {
                      ad_title: 'Summer Sale',
                      photo_url: 'https://example.com/ad.jpg',
                    },
                  },
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(ctmAdPayload)

      const req = makeRequest(ctmAdPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: ctmAdPayload.entry[0].messaging[0],
      })
    })

    it('processes inline reply to previous message', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
        blueprintId: 'bp-1',
        botId: 'bot-1',
      })

      const inlineReplyPayload = {
        object: 'page',
        entry: [
          {
            id: '111222333444555',
            time: 1569262486134,
            messaging: [
              {
                sender: { id: '1234567890123456' },
                recipient: { id: '111222333444555' },
                timestamp: 1569262485349,
                message: {
                  mid: 'm_newmessage...',
                  text: 'Replying to your question',
                  reply_to: {
                    mid: 'm_previousmessage...',
                  },
                },
              },
            ],
          },
        ],
      }

      parseRequestJson.mockResolvedValue(inlineReplyPayload)

      const req = makeRequest(inlineReplyPayload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: inlineReplyPayload.entry[0].messaging[0],
      })
    })
  })

  describe('default handler', () => {
    it('returns ok for empty POST body', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })
      parseRequestJson.mockResolvedValue({})

      const req = makeRequest({})
      const res = await handler(req)

      expect(res.status).toBe(200)
    })

    it('returns ok for GET request without subscription params', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })

      const req = makeRequest({}, { method: 'GET' })
      const res = await handler(req)

      expect(res.status).toBe(200)
    })

    it('returns ok when entry is not an array', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })
      parseRequestJson.mockResolvedValue({ entry: 'not-an-array' })

      const req = makeRequest({ entry: 'not-an-array' })
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('returns ok when entry is null', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })
      parseRequestJson.mockResolvedValue({ entry: null })

      const req = makeRequest({ entry: null })
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('returns ok when body is null', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'test-token',
      })
      parseRequestJson.mockResolvedValue(null)

      const req = makeRequest(null)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('signature verification', () => {
    // @note real HMACs, computed with node's crypto rather than the verifier
    // under test, so the handler is exercised end to end: raw body in,
    // X-Hub-Signature-256 checked, then the normal processing
    const appSecret = 'meta-app-secret'

    // @note deliberately NOT canonical JSON. Meta signs the bytes on the wire,
    // and a handler that parsed and re-serialised the body would still
    // produce valid JSON - just different bytes - so a canonical fixture
    // could not tell the two apart. The whitespace here makes sure a
    // re-serialising handler fails this suite.
    const rawBody = '{ "object" : "page",\n  "entry" : [ ] }'

    const sign = (body, secret = appSecret) =>
      'sha256=' + createHmac('sha256', secret).update(body).digest('hex')

    function signedRequest(body, signature) {
      return new Request(
        'https://example.com/api/v1/integration/messenger/int-123/callback?messengerIntegrationId=int-123',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(signature ? { 'X-Hub-Signature-256': signature } : {}),
          },
          body,
        }
      )
    }

    it('accepts a correctly signed callback when the app secret is set', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'vt',
        appSecret,
      })

      const res = await handler(signedRequest(rawBody, sign(rawBody)))

      expect(res.status).toBe(200)
      expect(logEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.messenger.configuration.error',
        })
      )
    })

    it('rejects a tampered body with 403 and records a configuration error', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'vt',
        appSecret,
      })

      // signed over the original, delivered with a different body
      const res = await handler(
        signedRequest(rawBody.replace('page', 'evil'), sign(rawBody))
      )

      expect(res.status).toBe(403)
      expect(sendEvent).not.toHaveBeenCalled()
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.messenger.configuration.error',
        })
      )
    })

    it('rejects a signature from a different secret', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'vt',
        appSecret,
      })

      const res = await handler(
        signedRequest(rawBody, sign(rawBody, 'someone-elses-secret'))
      )

      expect(res.status).toBe(403)
    })

    it('rejects a callback with no signature header when the app secret is set', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'vt',
        appSecret,
      })

      const res = await handler(signedRequest(rawBody, undefined))

      expect(res.status).toBe(403)
    })

    it('accepts, logged, when no app secret is configured (the documented bypass)', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'vt',
      })

      // no header at all - an integration from before the secret existed
      const res = await handler(signedRequest(rawBody, undefined))

      expect(res.status).toBe(200)
      expect(logEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'integration.messenger.configuration.error',
        })
      )
    })

    it('does not gate the subscription handshake (GET carries no body)', async () => {
      prisma.messengerIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        verifyToken: 'vt',
        appSecret,
      })

      const res = await handler(
        makeRequest(undefined, {
          method: 'GET',
          queryParams: {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'vt',
            'hub.challenge': 'challenge-1',
          },
        })
      )

      expect(res.status).toBe(200)
      expect(await res.text()).toBe('challenge-1')
    })
  })
})

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { logEvent } from '@/lib/log'

import handler, {
  INTERACTION_TYPE_APPLICATION_COMMAND,
  INTERACTION_TYPE_PING,
  RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  RESPONSE_TYPE_PONG,
} from '@/pages/api/v1/integration/discord/[discordIntegrationId]/interact'
import { sendEvent } from '@/pages/api/v1/integration/discord/[discordIntegrationId]/queue'

import tweetnacl from 'tweetnacl'

jest.mock('@/lib/method', () => ({
  withAny: (fn) => fn,
}))

jest.mock('@/prisma/client', () => ({
  discordIntegration: {
    findUnique: jest.fn(),
  },
}))

jest.mock(
  '@/pages/api/v1/integration/discord/[discordIntegrationId]/queue',
  () => ({
    sendEvent: jest.fn(),
  })
)

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('tweetnacl', () => ({
  sign: {
    detached: {
      verify: jest.fn(),
    },
  },
}))

describe('Discord interact API handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // @note mock signature verification to pass by default
    tweetnacl.sign.detached.verify.mockReturnValue(true)
  })

  function makeRequest(
    payload,
    {
      discordIntegrationId = 'int-123',
      signature = 'abcd1234',
      timestamp = '1640995200',
    } = {}
  ) {
    const url = `https://example.com/api/v1/integration/discord/${discordIntegrationId}/interact?discordIntegrationId=${discordIntegrationId}`

    const body =
      typeof payload === 'string' ? payload : JSON.stringify(payload ?? {})

    return new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
      },
      body: body,
    })
  }

  it('returns notAuthorized when signature header is missing', async () => {
    const url = `https://example.com/api/v1/integration/discord/int-123/interact?discordIntegrationId=int-123`
    const req = new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature-timestamp': '1640995200',
      },
      body: JSON.stringify({}),
    })

    const res = await handler(req)

    expect(res.status).toBe(403)
  })

  it('returns notAuthorized when timestamp header is missing', async () => {
    const url = `https://example.com/api/v1/integration/discord/int-123/interact?discordIntegrationId=int-123`
    const req = new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature-ed25519': 'abcd1234',
      },
      body: JSON.stringify({}),
    })

    const res = await handler(req)

    expect(res.status).toBe(403)
  })

  it('returns notFound when integration is not found', async () => {
    prisma.discordIntegration.findUnique.mockResolvedValue(null)

    const req = makeRequest({})
    const res = await handler(req)

    expect(res.status).toBe(404)
    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('returns conflict when public key is missing', async () => {
    prisma.discordIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
      publicKey: null,
      ephemeral: false,
    })

    const req = makeRequest({})
    const res = await handler(req)

    expect(res.status).toBe(409)
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration.discord.configuration.error',
        meta: expect.objectContaining({
          reason: 'The public key is missing.',
        }),
      })
    )
  })

  it('returns notAuthorized when signature verification throws', async () => {
    prisma.discordIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
      publicKey: 'valid-public-key',
      ephemeral: false,
    })

    tweetnacl.sign.detached.verify.mockImplementation(() => {
      throw new Error('Invalid signature format')
    })

    const req = makeRequest({})
    const res = await handler(req)

    expect(res.status).toBe(403)
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration.discord.configuration.error',
        meta: expect.objectContaining({
          reason: 'There is a signature verification error.',
        }),
      })
    )
  })

  it('returns notAuthorized when signature verification fails', async () => {
    prisma.discordIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
      publicKey: 'valid-public-key',
      ephemeral: false,
    })

    tweetnacl.sign.detached.verify.mockReturnValue(false)

    const req = makeRequest({})
    const res = await handler(req)

    expect(res.status).toBe(403)
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration.discord.configuration.error',
        meta: expect.objectContaining({
          reason: 'The signature fails verification.',
        }),
      })
    )
  })

  it('returns notAuthorized and triggers setup on malformed JSON body', async () => {
    prisma.discordIntegration.findUnique.mockResolvedValue({
      id: 'int-123',
      userId: 'user-1',
      publicKey: 'valid-public-key',
      ephemeral: false,
    })

    const req = makeRequest('not-json')
    const res = await handler(req)

    expect(res.status).toBe(403)
    expect(sendEvent).toHaveBeenCalledWith('int-123', {
      type: 'setup',
      payload: {},
    })
  })

  describe('PING interactions', () => {
    it('responds with PONG for PING interaction', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        publicKey: 'valid-public-key',
        ephemeral: false,
      })

      const payload = {
        type: INTERACTION_TYPE_PING,
      }

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(200)

      const json = await res.json()

      expect(json).toEqual({ type: RESPONSE_TYPE_PONG })
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('APPLICATION_COMMAND interactions', () => {
    it('queues interact event and returns deferred response', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        publicKey: 'valid-public-key',
        ephemeral: false,
      })

      const payload = {
        type: INTERACTION_TYPE_APPLICATION_COMMAND,
        id: 'interaction-1',
        application_id: 'app-123',
        member: {
          user: {
            id: 'discord-user-1',
          },
        },
        token: 'interaction-token',
        data: {
          options: [{ name: 'message', value: 'Hello bot!' }],
        },
      }

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(200)

      const json = await res.json()

      expect(json).toEqual({
        type: RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {},
      })

      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: {
          interactionId: 'interaction-1',
          applicationId: 'app-123',
          userId: 'discord-user-1',
          token: 'interaction-token',
          message: 'Hello bot!',
        },
      })
    })

    it('returns deferred response with ephemeral flag when ephemeral is true', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        publicKey: 'valid-public-key',
        ephemeral: true,
      })

      const payload = {
        type: INTERACTION_TYPE_APPLICATION_COMMAND,
        id: 'interaction-1',
        application_id: 'app-123',
        member: {
          user: {
            id: 'discord-user-1',
          },
        },
        token: 'interaction-token',
        data: {
          options: [{ name: 'message', value: 'Hello bot!' }],
        },
      }

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(200)

      const json = await res.json()

      expect(json).toEqual({
        type: RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: 1 << 6, // ephemeral flag
        },
      })
    })

    it('returns badRequest when interaction is missing required fields', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        publicKey: 'valid-public-key',
        ephemeral: false,
      })

      const payload = {
        type: INTERACTION_TYPE_APPLICATION_COMMAND,
        id: 'interaction-1',
        // Missing application_id, member, token, data.options
        data: {
          options: [],
        },
      }

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(400)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('returns badRequest when message option is missing', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        publicKey: 'valid-public-key',
        ephemeral: false,
      })

      const payload = {
        type: INTERACTION_TYPE_APPLICATION_COMMAND,
        id: 'interaction-1',
        application_id: 'app-123',
        member: {
          user: {
            id: 'discord-user-1',
          },
        },
        token: 'interaction-token',
        data: {
          options: [{ name: 'other_option', value: 'value' }],
        },
      }

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(400)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('returns badRequest when member is missing', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        publicKey: 'valid-public-key',
        ephemeral: false,
      })

      const payload = {
        type: INTERACTION_TYPE_APPLICATION_COMMAND,
        id: 'interaction-1',
        application_id: 'app-123',
        token: 'interaction-token',
        data: {
          options: [{ name: 'message', value: 'Hello!' }],
        },
      }

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(400)
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('handles DM interaction where user is at root payload level', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        publicKey: 'valid-public-key',
        ephemeral: false,
      })

      // @note in DM interactions Discord sends the user at payload.user, not payload.member.user
      const payload = {
        type: INTERACTION_TYPE_APPLICATION_COMMAND,
        id: 'interaction-dm-1',
        application_id: 'app-123',
        user: {
          id: 'discord-user-dm-1',
          username: 'dm-user',
        },
        token: 'interaction-token-dm',
        data: {
          options: [{ name: 'message', value: 'Hello from DM!' }],
        },
      }

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(200)

      const json = await res.json()

      expect(json).toEqual({
        type: RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {},
      })

      expect(sendEvent).toHaveBeenCalledWith('int-123', {
        type: 'interact',
        payload: {
          interactionId: 'interaction-dm-1',
          applicationId: 'app-123',
          userId: 'discord-user-dm-1',
          username: 'dm-user',
          token: 'interaction-token-dm',
          message: 'Hello from DM!',
        },
      })
    })

    it('returns badRequest when data.options is missing', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        publicKey: 'valid-public-key',
        ephemeral: false,
      })

      const payload = {
        type: INTERACTION_TYPE_APPLICATION_COMMAND,
        id: 'interaction-1',
        application_id: 'app-123',
        member: {
          user: {
            id: 'discord-user-1',
          },
        },
        token: 'interaction-token',
        data: {},
      }

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(400)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('unknown interaction types', () => {
    it('returns ok for unknown interaction types', async () => {
      prisma.discordIntegration.findUnique.mockResolvedValue({
        id: 'int-123',
        userId: 'user-1',
        publicKey: 'valid-public-key',
        ephemeral: false,
      })

      const payload = {
        type: 999, // unknown type
      }

      const req = makeRequest(payload)
      const res = await handler(req)

      expect(res.status).toBe(200)
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })
})

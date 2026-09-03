/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    slackIntegration: {
      create: jest.fn(),
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

describe('/api/v1/integration/slack/create', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeReq = () => ({})

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful creation', () => {
    it('creates a slack integration and returns its id', async () => {
      prisma.slackIntegration.create.mockResolvedValue({ id: 'slack-int-456' })

      const body = {
        name: 'My Slack Bot',
        description: 'A test bot',
        signingSecret: 'secret-abc',
        botToken: 'xoxb-token',
      }

      const res = await handler(makeReq(), mockSession, body)

      expect(res.status).toBe(200)

      const data = await res.json()

      expect(data).toEqual({ id: 'slack-int-456' })
    })

    it('stores all provided optional fields', async () => {
      prisma.slackIntegration.create.mockResolvedValue({ id: 'slack-int-1' })

      const body = {
        name: 'Bot',
        botToken: 'xoxb-token',
        signingSecret: 'secret',
        contactCollection: true,
        sessionDuration: 3600000,
        attachments: true,
        references: true,
        ratings: false,
        visibleMessages: 5,
        autoRespond: '@all',
        allowFrom: 'U1234',
        meta: { foo: 'bar' },
      }

      await handler(makeReq(), mockSession, body)

      expect(prisma.slackIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            contactCollection: true,
            sessionDuration: 3600000,
            attachments: true,
            references: true,
            ratings: false,
            visibleMessages: 5,
            autoRespond: '@all',
            allowFrom: 'U1234',
            meta: { foo: 'bar' },
          }),
        })
      )
    })

    it('persists the alias on the created integration', async () => {
      prisma.slackIntegration.create.mockResolvedValue({ id: 'slack-int-1' })

      await handler(makeReq(), mockSession, {
        name: 'Bot',
        alias: 'my-slack',
      })

      const callData = prisma.slackIntegration.create.mock.calls[0][0].data

      expect(callData.alias).toBe('my-slack')
    })
  })

  describe('masked credential handling', () => {
    it('strips signingSecret when submitted as masked value "********"', async () => {
      prisma.slackIntegration.create.mockResolvedValue({ id: 'slack-int-1' })

      await handler(makeReq(), mockSession, {
        signingSecret: '********',
        botToken: 'xoxb-real',
      })

      const callData = prisma.slackIntegration.create.mock.calls[0][0].data

      expect(callData.signingSecret).toBeUndefined()
      expect(callData.botToken).toBe('xoxb-real')
    })

    it('strips botToken when submitted as masked value "********"', async () => {
      prisma.slackIntegration.create.mockResolvedValue({ id: 'slack-int-1' })

      await handler(makeReq(), mockSession, {
        signingSecret: 'real-secret',
        botToken: '********',
      })

      const callData = prisma.slackIntegration.create.mock.calls[0][0].data

      expect(callData.botToken).toBeUndefined()
      expect(callData.signingSecret).toBe('real-secret')
    })

    it('strips userToken when submitted as masked value "********"', async () => {
      prisma.slackIntegration.create.mockResolvedValue({ id: 'slack-int-1' })

      await handler(makeReq(), mockSession, {
        userToken: '********',
      })

      const callData = prisma.slackIntegration.create.mock.calls[0][0].data

      expect(callData.userToken).toBeUndefined()
    })

    it('preserves real credentials that are not masked', async () => {
      prisma.slackIntegration.create.mockResolvedValue({ id: 'slack-int-1' })

      await handler(makeReq(), mockSession, {
        signingSecret: 'real-secret',
        botToken: 'xoxb-real-token',
        userToken: 'xoxp-real-user-token',
      })

      const callData = prisma.slackIntegration.create.mock.calls[0][0].data

      expect(callData.signingSecret).toBe('real-secret')
      expect(callData.botToken).toBe('xoxb-real-token')
      expect(callData.userToken).toBe('xoxp-real-user-token')
    })
  })

  describe('blueprint and bot linking', () => {
    it('resolves blueprintId from nested object', async () => {
      prisma.slackIntegration.create.mockResolvedValue({ id: 'slack-int-1' })

      await handler(makeReq(), mockSession, {
        blueprintId: { id: 'bp-123' },
      })

      const callData = prisma.slackIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-123')
    })

    it('resolves botId from nested object', async () => {
      prisma.slackIntegration.create.mockResolvedValue({ id: 'slack-int-1' })

      await handler(makeReq(), mockSession, {
        botId: { id: 'bot-456' },
      })

      const callData = prisma.slackIntegration.create.mock.calls[0][0].data

      expect(callData.botId).toBe('bot-456')
    })

    it('uses string blueprintId and botId directly', async () => {
      prisma.slackIntegration.create.mockResolvedValue({ id: 'slack-int-1' })

      await handler(makeReq(), mockSession, {
        blueprintId: 'bp-string',
        botId: 'bot-string',
      })

      const callData = prisma.slackIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-string')
      expect(callData.botId).toBe('bot-string')
    })

    it('stores user id from session on created integration', async () => {
      prisma.slackIntegration.create.mockResolvedValue({ id: 'slack-int-1' })

      await handler(makeReq(), { user: { id: 'user-xyz' } }, {})

      const callData = prisma.slackIntegration.create.mock.calls[0][0].data

      expect(callData.userId).toBe('user-xyz')
    })
  })
})

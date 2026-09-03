/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    widgetIntegration: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({
  BotVisibility: { private: 'private', public: 'public', unlisted: 'unlisted' },
  BlueprintVisibility: {
    private: 'private',
    public: 'public',
    unlisted: 'unlisted',
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

describe('/api/v1/integration/widget/create', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeReq = () => ({})

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validation', () => {
    const sessionDurationSchema = bodySchema.extract('sessionDuration')

    it.each([null, 0, 3600000])(
      'accepts the supported session duration boundary %s',
      (sessionDuration) => {
        expect(
          sessionDurationSchema.validate(sessionDuration).error
        ).toBeUndefined()
      }
    )

    it.each([3600001, 86400000])(
      'rejects an unsupported session duration of %s',
      (sessionDuration) => {
        expect(
          sessionDurationSchema.validate(sessionDuration).error
        ).toBeDefined()
      }
    )
  })

  describe('successful creation', () => {
    it('creates a widget integration with minimal fields and returns its id', async () => {
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'wgt-abc123' })

      const body = {
        name: 'My Widget',
      }

      const res = await handler(makeReq(), mockSession, body)

      expect(res.status).toBe(200)

      const data = await res.json()

      expect(data).toEqual({ id: 'wgt-abc123' })
    })

    it('passes userId from session to prisma', async () => {
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'wgt-1' })

      await handler(makeReq(), mockSession, { name: 'Widget' })

      expect(prisma.widgetIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      )
    })

    it('stores all optional fields when provided', async () => {
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'wgt-full' })

      const body = {
        name: 'Support Widget',
        description: 'Customer support chat',
        theme: { primaryColor: '#0066cc' },
        title: 'How can we help?',
        intro: 'Welcome to support!',
        initial: 'Hello, how can I help you today?',
        placeholder: 'Type your message...',
        origin: 'https://example.com',
        sessionDuration: 3600000,
        language: 'en',
        stream: true,
        verbose: false,
        tools: true,
        unfurl: true,
        math: false,
        carousel: false,
        form: true,
        attachments: true,
        autoScroll: true,
        startFirst: false,
        contactCollection: true,
        exportConversation: true,
        restartConversation: false,
        maximize: true,
        messagePeek: false,
        voiceIn: true,
        voiceOut: false,
        poweredBy: false,
        meta: { environment: 'production' },
      }

      await handler(makeReq(), mockSession, body)

      expect(prisma.widgetIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            name: 'Support Widget',
            description: 'Customer support chat',
            title: 'How can we help?',
            intro: 'Welcome to support!',
            initial: 'Hello, how can I help you today?',
            placeholder: 'Type your message...',
            origin: 'https://example.com',
            sessionDuration: 3600000,
            language: 'en',
            stream: true,
            tools: true,
            attachments: true,
            contactCollection: true,
            voiceIn: true,
            poweredBy: false,
            meta: { environment: 'production' },
          }),
        })
      )
    })

    it('resolves botId from object with id property', async () => {
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'wgt-1' })

      await handler(makeReq(), mockSession, {
        botId: { id: 'bot_456' },
      })

      expect(prisma.widgetIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: 'bot_456',
          }),
        })
      )
    })

    it('resolves botId from plain string', async () => {
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'wgt-1' })

      await handler(makeReq(), mockSession, {
        botId: 'bot_plain',
      })

      expect(prisma.widgetIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: 'bot_plain',
          }),
        })
      )
    })

    it('resolves blueprintId from object with id property', async () => {
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'wgt-1' })

      await handler(makeReq(), mockSession, {
        blueprintId: { id: 'bpt_789' },
      })

      expect(prisma.widgetIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'bpt_789',
          }),
        })
      )
    })

    it('selects only the id field from the created record', async () => {
      prisma.widgetIntegration.create.mockResolvedValue({ id: 'wgt-1' })

      await handler(makeReq(), mockSession, { name: 'Widget' })

      expect(prisma.widgetIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true },
        })
      )
    })
  })

  describe('error handling', () => {
    it('propagates prisma errors', async () => {
      const dbError = new Error('Database connection failed')

      prisma.widgetIntegration.create.mockRejectedValue(dbError)

      await expect(handler(makeReq(), mockSession, { name: 'Widget' })).rejects.toThrow(
        'Database connection failed'
      )
    })
  })
})

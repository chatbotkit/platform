/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    widgetIntegration: {
      findUniqueByIdentifier: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/schemas/blueprintId', () => {
  const { default: schema } = jest.requireActual('@/lib/joi.handler')

  return () => schema.any().allow(null, '')
})

jest.mock('@/schemas/botId', () => {
  const { default: schema } = jest.requireActual('@/lib/joi.handler')

  return () => schema.any().allow(null, '')
})

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((meta) => ({ merged: true, ...meta })),
}))

const session = { user: { id: 'user-1' } }
const req = { query: { widgetIntegrationId: 'widget-1' } }

describe('POST /api/v1/integration/widget/[widgetIntegrationId]/update', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates session duration bounds', () => {
    expect(bodySchema.validate({ sessionDuration: 0 }).error).toBeUndefined()
    expect(bodySchema.validate({ sessionDuration: -1 }).error).toBeDefined()
    expect(bodySchema.validate({ sessionDuration: 3600001 }).error).toBeDefined()
  })

  it('returns 404 when integration is missing', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(req, session, { name: 'Widget' })

    expect(response.status).toBe(404)
    expect(prisma.widgetIntegration.update).not.toHaveBeenCalled()
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'widget-1',
      userId: 'other-user',
    })

    const response = await handler(req, session, { name: 'Widget' })

    expect(response.status).toBe(403)
    expect(prisma.widgetIntegration.update).not.toHaveBeenCalled()
  })

  it('updates widget integration fields for owner and returns id', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'widget-1',
      userId: 'user-1',
      meta: { existing: true },
    })
    prisma.widgetIntegration.update.mockResolvedValue({ id: 'widget-1' })

    const response = await handler(req, session, {
      name: 'Updated Widget',
      description: 'desc',
      blueprintId: { id: 'blueprint-1' },
      botId: 'bot-1',
      theme: 'dark',
      layout: 'compact',
      title: 'Support',
      intro: 'Hello',
      initial: 'How can I help?',
      placeholder: 'Type here',
      origin: 'https://example.com',
      sessionDuration: 1800000,
      language: 'en',
      plugins: 'search',
      stream: true,
      verbose: false,
      tools: true,
      unfurl: false,
      math: true,
      carousel: false,
      form: true,
      attachments: true,
      autoScroll: false,
      startFirst: true,
      contactCollection: false,
      exportConversation: true,
      restartConversation: false,
      maximize: true,
      messagePeek: false,
      voiceIn: true,
      voiceOut: false,
      poweredBy: true,
      meta: { extra: 1 },
    })

    expect(prisma.widgetIntegration.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'widget-1'
    )
    expect(prisma.widgetIntegration.update).toHaveBeenCalledWith({
      where: { id: 'widget-1' },
      data: expect.objectContaining({
        name: 'Updated Widget',
        description: 'desc',
        blueprintId: 'blueprint-1',
        botId: 'bot-1',
        theme: 'dark',
        layout: 'compact',
        title: 'Support',
        intro: 'Hello',
        initial: 'How can I help?',
        placeholder: 'Type here',
        origin: 'https://example.com',
        sessionDuration: 1800000,
        language: 'en',
        plugins: 'search',
        stream: true,
        verbose: false,
        tools: true,
        unfurl: false,
        math: true,
        carousel: false,
        form: true,
        attachments: true,
        autoScroll: false,
        startFirst: true,
        contactCollection: false,
        exportConversation: true,
        restartConversation: false,
        maximize: true,
        messagePeek: false,
        voiceIn: true,
        voiceOut: false,
        poweredBy: true,
        meta: { merged: true, extra: 1 },
      }),
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: 'widget-1' })
  })
})

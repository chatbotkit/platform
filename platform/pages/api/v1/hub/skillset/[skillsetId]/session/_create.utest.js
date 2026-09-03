/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import { getConversationDetails } from '@/lib/bot.conversation'
import { createConversation } from '@/lib/conversation.create'
import { captureError } from '@/lib/error'

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'

import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      hubSkillsetPage: {
        findUnique: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  throwNotFound: () => ({ status: 404 }),
  respondFromError: (error) => ({
    status: 500,
    body: { message: error.message },
  }),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureError: jest.fn(),
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(),
}))

jest.mock(
  '@/pages/api/v1/conversation/[conversationId]/session/create',
  () => ({
    createConversationSessionToken: jest.fn(),
  })
)

const prisma = require('@/prisma/client').default

describe('POST /api/v1/hub/skillset/[skillsetId]/session/create', () => {
  const req = { query: { skillsetId: 'hub-skillset-1' } }
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
    getConversationDetails.mockReturnValue({ backstory: 'skillset backstory' })
    createConversation.mockResolvedValue({ id: 'conv-3' })
    createConversationSessionToken.mockResolvedValue('token-3')
  })

  it('returns 404 when hub skillset page is missing', async () => {
    prisma.hubSkillsetPage.findUnique.mockResolvedValue(null)

    const result = await handler(req, session, { backstory: 'x', model: 'm' })

    expect(result).toEqual({ status: 404 })
  })

  it('returns 404 when hub skillset page has no skillset relation', async () => {
    prisma.hubSkillsetPage.findUnique.mockResolvedValue({
      id: 'hub-skillset-1',
      skillset: null,
    })

    const result = await handler(req, session, { backstory: 'x', model: 'm' })

    expect(result).toEqual({ status: 404 })
  })

  it('passes skillset details and body options into conversation creation', async () => {
    prisma.hubSkillsetPage.findUnique.mockResolvedValue({
      id: 'hub-skillset-1',
      skillset: { id: 'skillset-1' },
    })

    const body = { backstory: 'custom backstory', model: 'gpt-test' }
    const result = await handler(req, session, body)

    expect(getConversationDetails).toHaveBeenCalledWith({
      skillsetId: 'skillset-1',
      backstory: 'custom backstory',
      model: 'gpt-test',
    })
    expect(createConversation).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        backstory: 'skillset backstory',
        meta: { app: 'hub' },
      }),
      { bpacc: true }
    )
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      id: 'conv-3',
      token: 'token-3',
      expiresAt: expect.any(Number),
    })
  })

  it('captures and returns an error when session token generation fails', async () => {
    const error = new Error('session token failed')

    prisma.hubSkillsetPage.findUnique.mockResolvedValue({
      id: 'hub-skillset-1',
      skillset: { id: 'skillset-1' },
    })
    createConversationSessionToken.mockRejectedValue(error)

    const result = await handler(req, session, { backstory: 'x', model: 'm' })

    expect(captureError).toHaveBeenCalledWith(error)
    expect(result).toEqual({
      status: 500,
      body: { message: 'session token failed' },
    })
  })
})

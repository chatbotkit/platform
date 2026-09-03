/**
 * @jest-environment node
 */
import {
  HALF_HOUR_IN_SECONDS,
  ONE_DAY_IN_MILLISECONDS,
  ONE_DAY_IN_SECONDS,
} from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { createConversation } from '@/lib/conversation.create'
import { cacheUser, fastGetUserById } from '@/lib/user.get'

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'

import handler, {
  WIDGET_CONTACT_NAMESPACE,
  bodySchema,
  withWidgetIntegration,
} from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    widgetIntegration: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn(
    (req, key) => req.params?.[key] ?? req.query?.[key]
  ),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  respondFromError: (err) => ({ status: 500, error: err }),
  throwNotFound: () => ({ status: 404 }),
}))

jest.mock('@/lib/cache', () => ({
  swrCache: jest.fn(async (_key, _ttl, fn) => fn()),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
  cacheUser: jest.fn(),
}))

jest.mock('@/lib/audience.helpers', () => ({
  isTrustedSession: jest.fn(() => false),
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(() => ({})),
}))

jest.mock('@/lib/contact.create', () => ({
  ensureTrustedContact: jest.fn(),
  ensureUntrustedContact: jest.fn(),
  createContactFingerprint: jest.fn(() => 'fingerprint'),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  getRandomId: jest.fn(() => 'random-id'),
}))

jest.mock('@/lib/cuid', () => ({
  __esModule: true,
  default: jest.fn(() => 'cuid-1'),
}))

jest.mock(
  '@/pages/api/v1/conversation/[conversationId]/session/create',
  () => ({
    createConversationSessionToken: jest.fn(),
  })
)

// ---------------------------------------------------------------------------
// WIDGET_CONTACT_NAMESPACE - must never change (fingerprinting stability)
// ---------------------------------------------------------------------------

describe('WIDGET_CONTACT_NAMESPACE', () => {
  it('has the expected fixed value', () => {
    // @note changing this value would break contact fingerprint matching for
    // all existing widget conversations
    expect(WIDGET_CONTACT_NAMESPACE).toBe(
      '11ccd8f6-b364-44c7-a3fd-8c2741dccfbb'
    )
  })
})

// ---------------------------------------------------------------------------
// bodySchema - validation rules
// ---------------------------------------------------------------------------

describe('bodySchema', () => {
  it('accepts a valid durationInSeconds within range', () => {
    const { error } = bodySchema.validate({
      durationInSeconds: ONE_HOUR_IN_SECONDS,
    })

    expect(error).toBeUndefined()
  })

  it('rejects durationInSeconds below the minimum (half hour)', () => {
    const { error } = bodySchema.validate({
      durationInSeconds: HALF_HOUR_IN_SECONDS - 1,
    })

    expect(error).toBeDefined()
  })

  it('rejects durationInSeconds above the maximum (one day)', () => {
    const { error } = bodySchema.validate({
      durationInSeconds: ONE_DAY_IN_SECONDS + 1,
    })

    expect(error).toBeDefined()
  })

  it('accepts null durationInSeconds', () => {
    const { error } = bodySchema.validate({ durationInSeconds: null })

    expect(error).toBeUndefined()
  })

  it('accepts an omitted durationInSeconds', () => {
    const { error } = bodySchema.validate({})

    expect(error).toBeUndefined()
  })

  it('accepts contact with email', () => {
    const { error } = bodySchema.validate({
      contact: { email: 'user@example.com' },
    })

    expect(error).toBeUndefined()
  })

  it('rejects contact with an invalid email format', () => {
    const { error } = bodySchema.validate({
      contact: { email: 'not-an-email' },
    })

    expect(error).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// withWidgetIntegration - middleware behaviour
// ---------------------------------------------------------------------------

describe('withWidgetIntegration', () => {
  const mockReq = { params: { widgetIntegrationId: 'wi-1' }, query: {} }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls the wrapped handler with the widget integration when found', async () => {
    const mockWidget = {
      id: 'wi-1',
      userId: 'user-1',
      sessionDuration: null,
      bot: null,
    }

    prisma.widgetIntegration.findUnique.mockResolvedValue(mockWidget)
    fastGetUserById.mockResolvedValue({ id: 'user-1' })
    cacheUser.mockResolvedValue(undefined)

    const inner = jest.fn(() => Promise.resolve({ status: 200 }))
    const wrapped = withWidgetIntegration(inner)

    await wrapped(mockReq)

    expect(inner).toHaveBeenCalled()

    // inner receives (req, pseudoSession, widgetIntegration)
    expect(inner.mock.calls[0][2]).toMatchObject({ id: 'wi-1' })
  })

  it('returns 404 when the widget integration does not exist', async () => {
    prisma.widgetIntegration.findUnique.mockResolvedValue(null)

    const inner = jest.fn()
    const wrapped = withWidgetIntegration(inner)

    const result = await wrapped(mockReq)

    expect(result.status).toBe(404)
    expect(inner).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// handler - session duration capping logic
//
// The handler is wrapped by withWidgetIntegration (from the same module), so
// tests must fully set up the prisma mock for widgetIntegration.findUnique to
// let the middleware pass through to the inner handler.
// ---------------------------------------------------------------------------

function makeWidget(sessionDuration) {
  return {
    id: 'wi-1',
    userId: 'user-1',
    sessionDuration,
    bot: null,
    initial: null,
    verbose: false,
    math: false,
    carousel: false,
    form: false,
    attachments: false,
  }
}

describe('handler session duration calculation', () => {
  // mockReq must include widgetIntegrationId so withWidgetIntegration can look
  // it up via the mocked requiredUrlParam
  const mockReq = { params: { widgetIntegrationId: 'wi-1' }, query: {} }

  beforeEach(() => {
    jest.clearAllMocks()

    createConversationSessionToken.mockResolvedValue({ token: 'test-token' })
    createConversation.mockResolvedValue({ id: 'conv-1', messages: [] })
    fastGetUserById.mockResolvedValue({ id: 'user-1' })
    cacheUser.mockResolvedValue(undefined)
  })

  it('uses ONE_DAY as the default duration when widget has no sessionDuration and dis is null', async () => {
    prisma.widgetIntegration.findUnique.mockResolvedValue(makeWidget(null))

    // handler(req, body) - withPost, withLimits, withSchema are pass-throughs
    await handler(mockReq, { durationInSeconds: null })

    expect(createConversationSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        durationInSeconds: ONE_DAY_IN_MILLISECONDS / 1000,
      })
    )
  })

  it('uses the requested durationInSeconds when less than the widget sessionDuration', async () => {
    const twoHoursMs = 2 * 60 * 60 * 1000

    prisma.widgetIntegration.findUnique.mockResolvedValue(
      makeWidget(twoHoursMs)
    )

    const requestedSeconds = ONE_HOUR_IN_SECONDS // 1 hour - less than widget's 2-hour cap

    await handler(mockReq, { durationInSeconds: requestedSeconds })

    expect(createConversationSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        durationInSeconds: requestedSeconds,
      })
    )
  })

  it('caps durationInSeconds at the widget sessionDuration when the request exceeds it', async () => {
    const oneHourMs = 60 * 60 * 1000

    prisma.widgetIntegration.findUnique.mockResolvedValue(makeWidget(oneHourMs))

    const requestedSeconds = 7200 // 2 hours - more than widget's 1-hour cap

    await handler(mockReq, { durationInSeconds: requestedSeconds })

    // should be capped at widget's sessionDuration (1 hour = 3600 seconds)
    expect(createConversationSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        durationInSeconds: oneHourMs / 1000,
      })
    )
  })

  it('uses the widget sessionDuration when durationInSeconds is null', async () => {
    const twoHoursMs = 2 * 60 * 60 * 1000

    prisma.widgetIntegration.findUnique.mockResolvedValue(
      makeWidget(twoHoursMs)
    )

    await handler(mockReq, { durationInSeconds: null })

    expect(createConversationSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        durationInSeconds: twoHoursMs / 1000,
      })
    )
  })

  it('returns ok with the correct response shape', async () => {
    prisma.widgetIntegration.findUnique.mockResolvedValue(makeWidget(null))

    const result = await handler(mockReq, { durationInSeconds: null })

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ id: 'wi-1' })
  })

  it('enables justification when widget verbosity is turned on', async () => {
    prisma.widgetIntegration.findUnique.mockResolvedValue({
      ...makeWidget(null),
      verbose: true,
    })

    await handler(mockReq, { durationInSeconds: null })

    expect(createConversationSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: expect.objectContaining({
          options: expect.objectContaining({
            engine: expect.objectContaining({
              features: expect.arrayContaining([{ name: 'justification' }]),
            }),
          }),
        }),
      })
    )
  })
})

const ONE_HOUR_IN_SECONDS = 3600

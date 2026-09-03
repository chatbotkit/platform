/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { detectContentAbuse } from '@/lib/moderation'
import { isVip } from '@/lib/user.type'

import handler from './publish'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      widgetIntegration: {
        findUniqueByIdentifier: jest.fn(),
      },
      hubWidgetPage: {
        upsert: jest.fn(),
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

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
  badRequest: (msg) => ({ status: 400, body: msg }),
}))

jest.mock('@/lib/moderation', () => ({
  detectContentAbuse: jest.fn(),
}))

jest.mock('@/lib/user.type', () => ({
  isVip: jest.fn(),
}))

jest.mock('@/lib/string', () => ({
  joinTrimmedNotEmpty: jest.fn((...args) =>
    args[0].filter(Boolean).join('\n\n')
  ),
}))

describe('/api/v1/hub/widget/[widgetId]/publish', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { widgetId: 'widget_1' } }

  const widget = {
    id: 'widget_1',
    userId: 'user_1',
    name: 'My Widget',
    description: 'An embeddable chat widget',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    detectContentAbuse.mockResolvedValue({ flagged: false, categories: [] })
    isVip.mockReturnValue(false)
  })

  it('returns 404 when widget does not exist', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.hubWidgetPage.upsert).not.toHaveBeenCalled()
  })

  it('returns 401 when widget belongs to a different user', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue({
      ...widget,
      userId: 'other_user',
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.hubWidgetPage.upsert).not.toHaveBeenCalled()
  })

  it('returns 400 when content moderation flags the content', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(widget)
    detectContentAbuse.mockResolvedValue({
      flagged: true,
      categories: ['sexual'],
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({
      status: 400,
      body: 'Improper entry violating categories: sexual',
    })
    expect(prisma.hubWidgetPage.upsert).not.toHaveBeenCalled()
  })

  it('publishes with rank 0 for a regular (non-VIP) user', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(widget)
    prisma.hubWidgetPage.upsert.mockResolvedValue({ id: 'hub_1' })
    isVip.mockReturnValue(false)

    const result = await handler(req, session, {})

    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_1', widgetId: 'widget_1' },
    })

    const upsertCall = prisma.hubWidgetPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.rank).toBe(0)
    expect(upsertCall.update.rank).toBe(0)
  })

  it('publishes with rank 1000 for a VIP user', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(widget)
    prisma.hubWidgetPage.upsert.mockResolvedValue({ id: 'hub_1' })
    isVip.mockReturnValue(true)

    const result = await handler(req, session, {})

    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_1', widgetId: 'widget_1' },
    })

    const upsertCall = prisma.hubWidgetPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.rank).toBe(1000)
    expect(upsertCall.update.rank).toBe(1000)
  })

  it('falls back to widget name and description when body fields are absent', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(widget)
    prisma.hubWidgetPage.upsert.mockResolvedValue({ id: 'hub_1' })

    await handler(req, session, {})

    const upsertCall = prisma.hubWidgetPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.name).toBe(widget.name)
    expect(upsertCall.create.description).toBe(widget.description)
    expect(upsertCall.update.name).toBe(widget.name)
    expect(upsertCall.update.description).toBe(widget.description)
  })

  it('uses body name and description when provided, overriding widget defaults', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(widget)
    prisma.hubWidgetPage.upsert.mockResolvedValue({ id: 'hub_1' })

    const body = { name: 'Branded Widget', description: 'Our support widget' }

    await handler(req, session, body)

    const upsertCall = prisma.hubWidgetPage.upsert.mock.calls[0][0]

    expect(upsertCall.create.name).toBe('Branded Widget')
    expect(upsertCall.create.description).toBe('Our support widget')
  })

  it('upserts with correct widgetId as the where condition', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(widget)
    prisma.hubWidgetPage.upsert.mockResolvedValue({ id: 'hub_1' })

    await handler(req, session, {})

    const upsertCall = prisma.hubWidgetPage.upsert.mock.calls[0][0]

    expect(upsertCall.where).toEqual({ widgetId: widget.id })
    expect(upsertCall.create.widgetId).toBe(widget.id)
    expect(upsertCall.create.userId).toBe(session.user.id)
  })

  it('propagates database lookup errors', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockRejectedValue(
      new Error('db error')
    )

    await expect(handler(req, session, {})).rejects.toThrow('db error')
  })
})

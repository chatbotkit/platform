/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler, { bodySchema } from './unpublish'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      widgetIntegration: {
        findUniqueByIdentifier: jest.fn(),
      },
      hubWidgetPage: {
        delete: jest.fn(),
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
}))

const prisma = require('@/prisma/client').default

describe('/api/v1/hub/widget/[widgetId]/unpublish', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { widgetId: 'widget_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 and deleted hub page id for owner', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'widget_1',
      userId: 'user_1',
    })
    prisma.hubWidgetPage.delete.mockResolvedValue({ id: 'hub_page_1' })

    const result = await handler(req, session, {})

    expect(
      prisma.widgetIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'widget_1')
    expect(prisma.hubWidgetPage.delete).toHaveBeenCalledWith({
      where: { widgetId: 'widget_1' },
      select: { id: true },
    })
    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_page_1', widgetId: 'widget_1' },
    })
  })

  it('returns 404 when widget integration is missing', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 404 })
    expect(prisma.hubWidgetPage.delete).not.toHaveBeenCalled()
  })

  it('returns 401 for non-owner user', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'widget_1',
      userId: 'owner_2',
    })

    const result = await handler(req, session, {})

    expect(result).toEqual({ status: 401 })
    expect(prisma.hubWidgetPage.delete).not.toHaveBeenCalled()
  })

  it('propagates prisma deletion errors', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'widget_1',
      userId: 'user_1',
    })
    prisma.hubWidgetPage.delete.mockRejectedValue(new Error('delete failed'))

    await expect(handler(req, session, {})).rejects.toThrow('delete failed')
  })

  it('validates empty body schema', () => {
    expect(bodySchema.validate({}).error).toBeUndefined()
  })
})

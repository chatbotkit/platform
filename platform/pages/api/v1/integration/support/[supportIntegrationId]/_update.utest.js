/**
 * @jest-environment node
 */
import handler, { bodySchema } from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      supportIntegration: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
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
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((meta) => ({ merged: true, ...meta })),
}))

const prisma = jest.requireMock('@/prisma/client').default

describe('POST /api/v1/integration/support/[supportIntegrationId]/update', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { supportIntegrationId: 'support-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates body schema for valid and invalid email', async () => {
    await expect(
      bodySchema.validateAsync({ name: 'n', email: 'a@b.com' })
    ).resolves.toEqual(expect.objectContaining({ name: 'n', email: 'a@b.com' }))
    await expect(
      bodySchema.validateAsync({ name: 'n', email: 'not-an-email' })
    ).rejects.toBeDefined()
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(req, session, { name: 'n' })

    expect(response.status).toBe(404)
    expect(prisma.supportIntegration.update).not.toHaveBeenCalled()
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'support-1',
      userId: 'other-user',
    })

    const response = await handler(req, session, { name: 'n' })

    expect(response.status).toBe(403)
    expect(prisma.supportIntegration.update).not.toHaveBeenCalled()
  })

  it('updates support integration for owner and returns id', async () => {
    prisma.supportIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'support-1',
      userId: 'user-1',
      meta: { existing: true },
    })
    prisma.supportIntegration.update.mockResolvedValue({ id: 'support-1' })

    const response = await handler(req, session, {
      name: 'Updated Support',
      description: 'desc',
      blueprintId: 'bp-1',
      botId: { id: 'bot-1' },
      email: 'support@example.com',
      trigger: 'manual',
      meta: { extra: 1 },
    })

    expect(prisma.supportIntegration.update).toHaveBeenCalledWith({
      where: { id: 'support-1' },
      data: expect.objectContaining({
        name: 'Updated Support',
        description: 'desc',
        blueprintId: 'bp-1',
        botId: 'bot-1',
        email: 'support@example.com',
        trigger: 'manual',
        meta: { merged: true, extra: 1 },
      }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'support-1' })
  })
})

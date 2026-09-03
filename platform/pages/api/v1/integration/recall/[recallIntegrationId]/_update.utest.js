/**
 * @jest-environment node
 */
import handler, { bodySchema } from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      recallIntegration: {
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

jest.mock('@/lib/recall.bot', () => ({
  RECALL_REGIONS: ['us-east-1', 'eu-central-1'],
  getRecallRegionStorageValue: jest.fn((region) =>
    region ? `stored-${region}` : null
  ),
}))

const prisma = jest.requireMock('@/prisma/client').default

describe('POST /api/v1/integration/recall/[recallIntegrationId]/update', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { recallIntegrationId: 'recall-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates body schema for allowed and disallowed regions', async () => {
    await expect(
      bodySchema.validateAsync({ name: 'n', region: 'eu-central-1' })
    ).resolves.toEqual(
      expect.objectContaining({ name: 'n', region: 'eu-central-1' })
    )
    await expect(
      bodySchema.validateAsync({ name: 'n', region: 'unknown-region' })
    ).rejects.toBeDefined()
  })

  it('returns 404 when integration is missing', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(req, session, { name: 'n' })

    expect(response.status).toBe(404)
    expect(prisma.recallIntegration.update).not.toHaveBeenCalled()
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-1',
      userId: 'other-user',
    })

    const response = await handler(req, session, { name: 'n' })

    expect(response.status).toBe(403)
    expect(prisma.recallIntegration.update).not.toHaveBeenCalled()
  })

  it('updates integration and returns id for owner', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-1',
      userId: 'user-1',
      meta: { existing: true },
    })
    prisma.recallIntegration.update.mockResolvedValue({ id: 'recall-1' })

    const response = await handler(req, session, {
      name: 'Updated Recall',
      description: 'desc',
      blueprintId: { id: 'bp-1' },
      botId: 'bot-1',
      apiKey: 'apikey',
      region: 'eu-central-1',
      meta: { extra: 1 },
    })

    expect(prisma.recallIntegration.update).toHaveBeenCalledWith({
      where: { id: 'recall-1' },
      data: expect.objectContaining({
        name: 'Updated Recall',
        description: 'desc',
        blueprintId: 'bp-1',
        botId: 'bot-1',
        apiKey: 'apikey',
        region: 'stored-eu-central-1',
        meta: { merged: true, extra: 1 },
      }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'recall-1' })
  })
})

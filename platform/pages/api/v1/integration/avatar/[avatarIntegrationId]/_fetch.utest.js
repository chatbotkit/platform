/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      avatarIntegration: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

describe('GET /api/v1/integration/avatar/[avatarIntegrationId]/fetch', () => {
  const req = { query: { avatarIntegrationId: 'avatar_123' } }
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 with expected data for owner and strips userId', async () => {
    prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'avatar_123',
      name: 'Avatar',
      description: '',
      userId: 'user_1',
      blueprintId: null,
      botId: 'bot_1',
      visibility: 'private',
      meta: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    })

    const res = await handler(req, session)

    expect(res.status).toBe(200)

    const data = await res.json()

    expect(data.id).toBe('avatar_123')
    expect(data.userId).toBeUndefined()
  })

  it('passes identifier and select shape to prisma', async () => {
    prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'avatar_123',
      userId: 'user_1',
      name: 'Avatar',
      description: '',
      blueprintId: null,
      botId: null,
      visibility: 'private',
      meta: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    })

    await handler(req, session)

    expect(
      prisma.avatarIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'avatar_123', {
      select: {
        id: true,
        alias: true,
        name: true,
        description: true,
        userId: true,
        blueprintId: true,
        botId: true,
        visibility: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const res = await handler(req, session)

    expect(res.status).toBe(404)
  })

  it('returns 403 for non-owner access', async () => {
    prisma.avatarIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'avatar_123',
      userId: 'other_user',
    })

    const res = await handler(req, session)

    expect(res.status).toBe(403)
  })

  it('propagates prisma errors', async () => {
    prisma.avatarIntegration.findUniqueByIdentifier.mockRejectedValue(
      new Error('db failed')
    )

    await expect(handler(req, session)).rejects.toThrow('db failed')
  })
})

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { USER_AUDIENCE } from '@/lib/audience.consts'

import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      anamIntegration: {
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

describe('GET /api/v1/integration/anam/[anamIntegrationId]/fetch', () => {
  const req = { query: { anamIntegrationId: 'anam_123' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 and strips userId for owner', async () => {
    prisma.anamIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'anam_123',
      name: 'Anam',
      description: '',
      userId: 'user_1',
      blueprintId: null,
      botId: 'bot_1',
      apiKey: 'secret-key',
      personaId: 'persona_1',
      visibility: 'private',
      meta: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    })

    const session = { user: { id: 'user_1' }, payload: { aud: USER_AUDIENCE } }
    const res = await handler(req, session)

    expect(res.status).toBe(200)

    const data = await res.json()

    expect(data.id).toBe('anam_123')
    expect(data.apiKey).toBe('secret-key')
    expect(data.userId).toBeUndefined()
  })

  it('returns 404 when integration is missing', async () => {
    prisma.anamIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const session = { user: { id: 'user_1' }, payload: { aud: USER_AUDIENCE } }
    const res = await handler(req, session)

    expect(res.status).toBe(404)
  })

  it('returns 403 when user does not own integration', async () => {
    prisma.anamIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'anam_123',
      userId: 'other_user',
    })

    const session = { user: { id: 'user_1' }, payload: { aud: USER_AUDIENCE } }
    const res = await handler(req, session)

    expect(res.status).toBe(403)
  })

  it('selects apiKey only for user audience', async () => {
    prisma.anamIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'anam_123',
      userId: 'user_1',
      name: 'Anam',
      description: '',
      blueprintId: null,
      botId: null,
      personaId: null,
      visibility: 'private',
      meta: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    })

    await handler(req, {
      user: { id: 'user_1' },
      payload: { aud: USER_AUDIENCE },
    })
    await handler(req, { user: { id: 'user_1' }, payload: { aud: 'api' } })

    const firstCall =
      prisma.anamIntegration.findUniqueByIdentifier.mock.calls[0]
    const secondCall =
      prisma.anamIntegration.findUniqueByIdentifier.mock.calls[1]

    expect(firstCall[2].select.apiKey).toBe(true)
    expect(secondCall[2].select.apiKey).toBe(false)
  })

  it('propagates database errors', async () => {
    prisma.anamIntegration.findUniqueByIdentifier.mockRejectedValue(
      new Error('db failed')
    )

    await expect(
      handler(req, { user: { id: 'user_1' }, payload: { aud: USER_AUDIENCE } })
    ).rejects.toThrow('db failed')
  })
})

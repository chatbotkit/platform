/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { USER_AUDIENCE } from '@/lib/audience.consts'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    recallIntegration: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('GET /api/v1/integration/recall/[recallIntegrationId]/fetch', () => {
  const req = { query: { recallIntegrationId: 'recall_123' } }
  const userSession = {
    user: { id: 'user_1' },
    payload: { aud: USER_AUDIENCE },
  }
  const nonUserSession = {
    user: { id: 'user_1' },
    payload: { aud: 'service' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 with expected data for owner and strips userId', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall_123',
      name: 'Recall',
      description: '',
      userId: 'user_1',
      blueprintId: null,
      botId: 'bot_1',
      apiKey: 'secret',
      region: 'us-east-1',
      meta: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    })

    const res = await handler(req, userSession)

    expect(res.status).toBe(200)

    const data = await res.json()

    expect(data.id).toBe('recall_123')
    expect(data.userId).toBeUndefined()
    expect(data.apiKey).toBe('secret')
  })

  it('passes apiKey selector as true for user audience and false otherwise', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall_123',
      userId: 'user_1',
    })

    await handler(req, userSession)
    expect(
      prisma.recallIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(
      userSession.user,
      'recall_123',
      expect.objectContaining({
        select: expect.objectContaining({ apiKey: true }),
      })
    )

    await handler(req, nonUserSession)
    expect(
      prisma.recallIntegration.findUniqueByIdentifier
    ).toHaveBeenLastCalledWith(
      nonUserSession.user,
      'recall_123',
      expect.objectContaining({
        select: expect.objectContaining({ apiKey: false }),
      })
    )
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const res = await handler(req, userSession)

    expect(res.status).toBe(404)
  })

  it('returns 403 for non-owner access', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall_123',
      userId: 'other_user',
    })

    const res = await handler(req, userSession)

    expect(res.status).toBe(403)
  })

  it('propagates prisma errors', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockRejectedValue(
      new Error('db failed')
    )

    await expect(handler(req, userSession)).rejects.toThrow('db failed')
  })
})

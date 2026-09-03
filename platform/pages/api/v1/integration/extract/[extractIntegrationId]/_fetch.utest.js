/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
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

describe('GET /api/v1/integration/extract/[extractIntegrationId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  it('returns integration for owner and strips userId', async () => {
    prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'ext-1',
      userId: 'user-123',
      name: 'Extract One',
      description: '',
      blueprintId: 'bp-1',
      botId: 'bot-1',
      schema: { fields: ['a'] },
      request: 'https://example.com/hook',
      meta: {},
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    })

    const res = await handler(
      { query: { extractIntegrationId: 'ext-1' } },
      mockSession
    )

    expect(res.status).toBe(200)

    const data = await res.json()

    expect(data.id).toBe('ext-1')
    expect(data).not.toHaveProperty('userId')
  })

  it('returns 404 when integration is missing', async () => {
    prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const res = await handler(
      { query: { extractIntegrationId: 'missing' } },
      mockSession
    )

    expect(res.status).toBe(404)
  })

  it('returns 403 for non-owner integration', async () => {
    prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'ext-2',
      userId: 'user-999',
    })

    const res = await handler(
      { query: { extractIntegrationId: 'ext-2' } },
      mockSession
    )

    expect(res.status).toBe(403)
  })

  it('passes expected select shape to prisma lookup', async () => {
    prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'ext-3',
      userId: 'user-123',
    })

    await handler({ query: { extractIntegrationId: 'ext-3' } }, mockSession)

    expect(
      prisma.extractIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(
      mockSession.user,
      'ext-3',
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          userId: true,
          name: true,
          description: true,
          blueprintId: true,
          botId: true,
          schema: true,
          request: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        }),
      })
    )
  })

  it('propagates prisma errors', async () => {
    prisma.extractIntegration.findUniqueByIdentifier.mockRejectedValue(
      new Error('db crashed')
    )

    await expect(
      handler({ query: { extractIntegrationId: 'ext-5' } }, mockSession)
    ).rejects.toThrow('db crashed')
  })
})

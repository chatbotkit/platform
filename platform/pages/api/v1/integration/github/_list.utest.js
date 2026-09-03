/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './list'

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

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => fn,
}))

jest.mock('@/lib/filter', () => ({
  getMetaQueryFilter: jest.fn(() => []),
  getBlueprintIdQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({ take: 25 })),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (obj) => obj,
}))

describe('GET /api/v1/integration/github/list', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  it('masks privateKey and reveals webhookSecret on every item', async () => {
    prisma.githubIntegration.findMany.mockResolvedValue([
      {
        id: 'gh-1',
        name: 'One',
        appId: '1',
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nabc',
        webhookSecret: 'wh-1',
      },
      {
        id: 'gh-2',
        name: 'Two',
        appId: null,
        privateKey: null,
        webhookSecret: null,
      },
    ])

    const result = await handler(null, { query: {} }, null, mockSession)

    expect(result.items).toEqual([
      {
        id: 'gh-1',
        name: 'One',
        appId: '1',
        privateKey: '********',
        webhookSecret: 'wh-1',
      },
      {
        id: 'gh-2',
        name: 'Two',
        appId: null,
        privateKey: null,
        webhookSecret: null,
      },
    ])

    expect(JSON.stringify(result)).not.toContain('BEGIN RSA PRIVATE KEY')
  })

  it('returns an empty list when the user has no integrations', async () => {
    prisma.githubIntegration.findMany.mockResolvedValue([])

    const result = await handler(null, { query: {} }, null, mockSession)

    expect(result.items).toEqual([])
  })
})

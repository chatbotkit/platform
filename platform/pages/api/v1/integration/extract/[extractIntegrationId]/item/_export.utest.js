/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './export'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: mockDeep(),
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (req, _stream, session) =>
    fn(null, req, _stream, session),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: (req, param) => req.query[param],
}))

jest.mock('@/lib/filter', () => ({
  getCursorConstraints: () => ({}),
  getTakeConstraints: () => ({ take: 100 }),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: () => {
    throw new Error('Not found')
  },
  throwNotAuthorized: () => {
    throw new Error('Not authorized')
  },
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

jest.mock('@/lib/yaml', () => ({
  __esModule: true,
  default: {
    stringify: jest.fn((obj) => JSON.stringify(obj)),
  },
}))

describe('/api/v1/integration/extract/[extractIntegrationId]/item/export', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  it('returns items and exposes yaml-backed toString on data', async () => {
    prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'extract_123',
      userId: 'user_123',
    })
    prisma.extractIntegrationItem.findMany.mockResolvedValue([
      {
        id: 'item_1',
        extractIntegrationId: 'extract_123',
        conversationId: 'conv_1',
        data: { field: 'value1' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'item_2',
        extractIntegrationId: 'extract_123',
        conversationId: 'conv_2',
        data: null,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ])

    const req = {
      query: {
        extractIntegrationId: 'extract_123',
      },
    }

    const result = await handler(req, null, mockSession)

    expect(result.items).toHaveLength(2)
    expect(String(result.items[0].data)).toBe('{"field":"value1"}')
    expect(String(result.items[1].data)).toBe('{}')
    expect(result.items[0].data.field).toBe('value1')
  })

  it('throws not found when extract integration does not exist', async () => {
    prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const req = {
      query: {
        extractIntegrationId: 'extract_123',
      },
    }

    await expect(handler(req, null, mockSession)).rejects.toThrow('Not found')
    expect(prisma.extractIntegrationItem.findMany).not.toHaveBeenCalled()
  })

  it('throws not authorized when user does not own extract integration', async () => {
    prisma.extractIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'extract_123',
      userId: 'other_user',
    })

    const req = {
      query: {
        extractIntegrationId: 'extract_123',
      },
    }

    await expect(handler(req, null, mockSession)).rejects.toThrow(
      'Not authorized'
    )
    expect(prisma.extractIntegrationItem.findMany).not.toHaveBeenCalled()
  })
})

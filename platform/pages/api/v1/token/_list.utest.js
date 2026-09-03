/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
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
  withUserSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/filter', () => ({
  getMetaQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const {
  getMetaQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('GET /api/v1/token/list', () => {
  const mockSession = {
    user: { id: 'user_123' },
  }

  beforeEach(() => {
    mockReset(prisma)
    getMetaQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  describe('basic functionality', () => {
    it('should list tokens for authenticated user', async () => {
      const mockTokens = [
        {
          id: 'token1',
          name: 'Test Token 1',
          description: 'Description 1',
          config: {},
          meta: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      prisma.token.findMany.mockResolvedValue(mockTokens)

      const result = await handler(null, {}, null, mockSession)

      expect(result).toBeDefined()
      expect(result.items).toBeDefined()
      expect(prisma.token.findMany).toHaveBeenCalled()
    })

    it('should return empty list when user has no tokens', async () => {
      prisma.token.findMany.mockResolvedValue([])

      const result = await handler(null, {}, null, mockSession)

      expect(result.items).toEqual([])
    })
  })

  describe('filtering and pagination', () => {
    it('should handle cursor parameter', async () => {
      prisma.token.findMany.mockResolvedValue([])

      getCursorConstraints.mockReturnValue({
        cursor: { id: 'token123' },
        skip: 1,
      })

      await handler('token123', {}, null, mockSession)

      expect(getCursorConstraints).toHaveBeenCalledWith({}, 'token123')
      expect(prisma.token.findMany).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle database errors', async () => {
      prisma.token.findMany.mockRejectedValue(new Error('Database error'))

      await expect(handler(null, {}, null, mockSession)).rejects.toThrow(
        'Database error'
      )
    })
  })
})

/**
 * @jest-environment node
 */

import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'
import { getApproximateTotalRecords, getApproximateTotalAbilities } from '@/lib/limit.estimate'
import { getUsage } from '@/lib/usage.get'

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

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

jest.mock('@/lib/usage.get', () => ({
  getUsage: jest.fn(),
}))

jest.mock('@/lib/limit.estimate', () => ({
  getApproximateTotalRecords: jest.fn(),
  getApproximateTotalAbilities: jest.fn(),
}))

describe('/api/v1/usage/fetch', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return usage data with correct structure', async () => {
      getUsage.mockResolvedValue({
        tokens: { value: 1500 },
        conversations: { value: 25 },
        messages: { value: 200 },
      })

      getApproximateTotalRecords.mockResolvedValue(300)
      getApproximateTotalAbilities.mockResolvedValue(15)

      prisma.dataset.count.mockResolvedValue(5)
      prisma.skillset.count.mockResolvedValue(3)
      prisma.file.count.mockResolvedValue(10)
      prisma.user.count.mockResolvedValue(2)

      const result = await handler(null, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        tokens: 1500,
        conversations: 25,
        messages: 200,
        database: {
          datasets: 5,
          records: 300,
          skillsets: 3,
          abilities: 15,
          files: 10,
          users: 2,
        },
      })
    })

    it('should fetch usage for the session user id', async () => {
      getUsage.mockResolvedValue({
        tokens: { value: 0 },
        conversations: { value: 0 },
        messages: { value: 0 },
      })

      getApproximateTotalRecords.mockResolvedValue(0)
      getApproximateTotalAbilities.mockResolvedValue(0)

      prisma.dataset.count.mockResolvedValue(0)
      prisma.skillset.count.mockResolvedValue(0)
      prisma.file.count.mockResolvedValue(0)
      prisma.user.count.mockResolvedValue(0)

      await handler(null, mockSession)

      expect(getUsage).toHaveBeenCalledWith('user_123')
    })

    it('should query prisma counts with the session user id', async () => {
      getUsage.mockResolvedValue({
        tokens: { value: 0 },
        conversations: { value: 0 },
        messages: { value: 0 },
      })

      getApproximateTotalRecords.mockResolvedValue(0)
      getApproximateTotalAbilities.mockResolvedValue(0)

      prisma.dataset.count.mockResolvedValue(0)
      prisma.skillset.count.mockResolvedValue(0)
      prisma.file.count.mockResolvedValue(0)
      prisma.user.count.mockResolvedValue(0)

      await handler(null, mockSession)

      expect(prisma.dataset.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user_123' },
        })
      )

      expect(prisma.skillset.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user_123' },
        })
      )

      expect(prisma.file.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user_123' },
        })
      )

      // @note user count queries by parentId, not userId, for user counting
      expect(prisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId: 'user_123' },
        })
      )
    })

    it('should pass session user to estimate functions', async () => {
      getUsage.mockResolvedValue({
        tokens: { value: 0 },
        conversations: { value: 0 },
        messages: { value: 0 },
      })

      getApproximateTotalRecords.mockResolvedValue(0)
      getApproximateTotalAbilities.mockResolvedValue(0)

      prisma.dataset.count.mockResolvedValue(0)
      prisma.skillset.count.mockResolvedValue(0)
      prisma.file.count.mockResolvedValue(0)
      prisma.user.count.mockResolvedValue(0)

      await handler(null, mockSession)

      expect(getApproximateTotalRecords).toHaveBeenCalledWith(mockSession.user)
      expect(getApproximateTotalAbilities).toHaveBeenCalledWith(mockSession.user)
    })
  })

  describe('data extraction', () => {
    it('should extract .value from token/conversation/message objects', async () => {
      getUsage.mockResolvedValue({
        tokens: { value: 42000 },
        conversations: { value: 100 },
        messages: { value: 800 },
      })

      getApproximateTotalRecords.mockResolvedValue(0)
      getApproximateTotalAbilities.mockResolvedValue(0)

      prisma.dataset.count.mockResolvedValue(0)
      prisma.skillset.count.mockResolvedValue(0)
      prisma.file.count.mockResolvedValue(0)
      prisma.user.count.mockResolvedValue(0)

      const result = await handler(null, mockSession)

      expect(result.body.tokens).toBe(42000)
      expect(result.body.conversations).toBe(100)
      expect(result.body.messages).toBe(800)
    })

    it('should return zero counts when user has no resources', async () => {
      getUsage.mockResolvedValue({
        tokens: { value: 0 },
        conversations: { value: 0 },
        messages: { value: 0 },
      })

      getApproximateTotalRecords.mockResolvedValue(0)
      getApproximateTotalAbilities.mockResolvedValue(0)

      prisma.dataset.count.mockResolvedValue(0)
      prisma.skillset.count.mockResolvedValue(0)
      prisma.file.count.mockResolvedValue(0)
      prisma.user.count.mockResolvedValue(0)

      const result = await handler(null, mockSession)

      expect(result.body).toEqual({
        tokens: 0,
        conversations: 0,
        messages: 0,
        database: {
          datasets: 0,
          records: 0,
          skillsets: 0,
          abilities: 0,
          files: 0,
          users: 0,
        },
      })
    })
  })

  describe('error handling', () => {
    it('should propagate getUsage errors', async () => {
      getUsage.mockRejectedValue(new Error('Redis connection failed'))

      await expect(handler(null, mockSession)).rejects.toThrow(
        'Redis connection failed'
      )
    })

    it('should propagate prisma count errors', async () => {
      getUsage.mockResolvedValue({
        tokens: { value: 0 },
        conversations: { value: 0 },
        messages: { value: 0 },
      })

      getApproximateTotalRecords.mockResolvedValue(0)
      getApproximateTotalAbilities.mockResolvedValue(0)

      prisma.dataset.count.mockRejectedValue(new Error('Database error'))

      await expect(handler(null, mockSession)).rejects.toThrow('Database error')
    })
  })
})

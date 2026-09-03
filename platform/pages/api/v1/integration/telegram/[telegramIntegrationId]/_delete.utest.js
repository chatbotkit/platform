/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404, body: { error: 'Not found' } }),
  notAuthorized: () => ({ status: 403, body: { error: 'Not authorized' } }),
}))

describe('DELETE /api/v1/integration/telegram/[telegramIntegrationId]/delete', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  const mockRequest = (telegramIntegrationId = 'telegram123') => ({
    query: { telegramIntegrationId },
  })

  const mockSession = {
    user: {
      id: 'user123',
      email: 'test@example.com',
    },
  }

  describe('successful deletion', () => {
    it('should delete telegram integration successfully', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.delete.mockResolvedValue(mockIntegration)

      const response = await handler(mockRequest(), mockSession)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ id: 'telegram123' })
      expect(prisma.telegramIntegration.delete).toHaveBeenCalledWith({
        where: { id: 'telegram123' },
      })
    })
  })

  describe('error handling', () => {
    it('should return 404 if integration not found', async () => {
      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const response = await handler(mockRequest('nonexistent'), mockSession)

      expect(response.status).toBe(404)
      expect(prisma.telegramIntegration.delete).not.toHaveBeenCalled()
    })

    it('should return 403 if user does not own integration', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'differentUser',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const response = await handler(mockRequest(), mockSession)

      expect(response.status).toBe(403)
      expect(prisma.telegramIntegration.delete).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      prisma.telegramIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      await expect(handler(mockRequest(), mockSession)).rejects.toThrow(
        'Database error'
      )
    })
  })

  describe('authorization checks', () => {
    it('should verify user ownership before deletion', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.delete.mockResolvedValue(mockIntegration)

      await handler(mockRequest(), mockSession)

      expect(
        prisma.telegramIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user123' }),
        'telegram123',
        expect.any(Object)
      )
    })
  })

  describe('edge cases', () => {
    it('should handle missing telegramIntegrationId', async () => {
      const badRequest = { query: {} }

      await expect(handler(badRequest, mockSession)).rejects.toThrow()
    })

    it('should accept empty request body', async () => {
      const mockIntegration = {
        id: 'telegram123',
        userId: 'user123',
      }

      prisma.telegramIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )
      prisma.telegramIntegration.delete.mockResolvedValue(mockIntegration)

      const response = await handler(mockRequest(), mockSession)

      expect(response.status).toBe(200)
    })
  })
})

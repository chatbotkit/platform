/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from '@/pages/api/v1/integration/googlechat/[googlechatIntegrationId]/fetch'

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

describe('GET /api/v1/integration/googlechat/[googlechatIntegrationId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should fetch googlechat integration successfully', async () => {
      const mockIntegration = {
        id: 'gc-123',
        name: 'Test Google Chat',
        description: 'Test description',
        userId: 'user-123',
        blueprintId: null,
        botId: null,
        serviceAccountKey:
          '{"type":"service_account","project_id":"my-project"}',
        projectNumber: '123456789',
        contactCollection: false,
        sessionDuration: null,
        autoRespond: null,
        allowFrom: '*',
        meta: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { googlechatIntegrationId: 'gc-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toHaveProperty('id', 'gc-123')
      expect(data).toHaveProperty('name', 'Test Google Chat')
      expect(data).toHaveProperty('serviceAccountKey', '********')
      expect(data).toHaveProperty('projectNumber', '123456789')
      expect(data).toHaveProperty('allowFrom', '*')
    })

    it('should mask serviceAccountKey in response', async () => {
      const mockIntegration = {
        id: 'gc-456',
        userId: 'user-123',
        serviceAccountKey: '{"type":"service_account","private_key":"SECRET"}',
        projectNumber: '987654321',
        allowFrom: '*',
      }

      prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { googlechatIntegrationId: 'gc-456' },
      }

      const result = await handler(req, mockSession)
      const data = await result.json()

      expect(data.serviceAccountKey).toBe('********')
      expect(data.serviceAccountKey).not.toContain('SECRET')
    })

    it('should not mask serviceAccountKey when it is null', async () => {
      const mockIntegration = {
        id: 'gc-789',
        userId: 'user-123',
        serviceAccountKey: null,
        projectNumber: null,
        allowFrom: '*',
      }

      prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { googlechatIntegrationId: 'gc-789' },
      }

      const result = await handler(req, mockSession)
      const data = await result.json()

      expect(data.serviceAccountKey).toBeNull()
    })
  })

  describe('error handling', () => {
    it('should return 404 when integration not found', async () => {
      prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue(
        null
      )

      const req = {
        query: { googlechatIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockIntegration = {
        id: 'gc-123',
        userId: 'user-123',
        serviceAccountKey: null,
        allowFrom: '*',
      }

      prisma.googlechatIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockIntegration
      )

      const req = {
        query: { googlechatIntegrationId: 'gc-123' },
      }

      await handler(req, mockSession)

      expect(
        prisma.googlechatIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'gc-123', expect.any(Object))
    })
  })
})

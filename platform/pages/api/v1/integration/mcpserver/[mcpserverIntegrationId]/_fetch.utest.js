/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    mcpserverIntegration: {
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

describe('GET /api/v1/integration/mcpserver/[mcpserverIntegrationId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
    payload: {
      aud: 'user',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should fetch mcpserver integration successfully', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        name: 'Test MCP Server',
        description: 'Test description',
        userId: 'user-123',
        blueprintId: 'blueprint-456',
        skillsetId: 'skillset-789',
        meta: { key: 'value' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).toHaveProperty('id', 'mcpserver-123')
      expect(data).toHaveProperty('name', 'Test MCP Server')
      expect(data).toHaveProperty('skillsetId', 'skillset-789')
      expect(data).not.toHaveProperty('userId')
    })

    it('should call findUniqueByIdentifier with correct parameters', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-456',
        name: 'Test MCP Server',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        skillsetId: 'skillset-789',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-456' },
      }

      await handler(req, mockSession)

      expect(
        prisma.mcpserverIntegration.findUniqueByIdentifier
      ).toHaveBeenCalledWith(mockSession.user, 'mcpserver-456', {
        select: {
          id: true,
          alias: true,
          name: true,
          description: true,
          userId: true,
          blueprintId: true,
          skillsetId: true,
          oAuthConnectionId: true,
          accessToken: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    })

    it('should remove userId from response', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        name: 'Test MCP Server',
        description: 'Test',
        userId: 'user-123',
        blueprintId: null,
        skillsetId: 'skillset-789',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data).not.toHaveProperty('userId')
    })
  })

  describe('error handling', () => {
    it('should return 404 when mcpserver integration not found', async () => {
      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const req = {
        query: { mcpserverIntegrationId: 'nonexistent' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user does not own the mcpserver integration', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        name: 'Test MCP Server',
        description: 'Test',
        userId: 'other-user-456',
        blueprintId: null,
        skillsetId: 'skillset-789',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should handle database query errors', async () => {
      prisma.mcpserverIntegration.findUniqueByIdentifier.mockRejectedValue(
        new Error('Database error')
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      await expect(handler(req, mockSession)).rejects.toThrow('Database error')
    })
  })

  describe('field handling', () => {
    it('should handle null optional fields', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        name: 'Test MCP Server',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        skillsetId: 'skillset-789',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.blueprintId).toBeNull()
    })

    it('should handle empty meta object', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        name: 'Test MCP Server',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        skillsetId: 'skillset-789',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.meta).toEqual({})
    })

    it('should handle complex meta object', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        name: 'Test MCP Server',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        skillsetId: 'skillset-789',
        meta: {
          nested: { key: 'value' },
          array: [1, 2, 3],
          boolean: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.meta).toEqual({
        nested: { key: 'value' },
        array: [1, 2, 3],
        boolean: true,
      })
    })
  })

  describe('edge cases', () => {
    it('should handle mcpserver integration with special characters in ID', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-abc_123-xyz',
        name: 'Test MCP Server',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        skillsetId: 'skillset-789',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-abc_123-xyz' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.id).toBe('mcpserver-abc_123-xyz')
    })

    it('should handle mcpserver with blueprint association', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        name: 'Blueprint MCP Server',
        description: '',
        userId: 'user-123',
        blueprintId: 'blueprint-xyz',
        skillsetId: 'skillset-789',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)

      const data = await result.json()

      expect(data.blueprintId).toBe('blueprint-xyz')
    })
  })

  describe('authorization', () => {
    it('should verify user ownership before returning data', async () => {
      const mockMcpserverIntegration = {
        id: 'mcpserver-123',
        name: 'Test MCP Server',
        description: '',
        userId: 'user-123',
        blueprintId: null,
        skillsetId: 'skillset-789',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prisma.mcpserverIntegration.findUniqueByIdentifier.mockResolvedValue(
        mockMcpserverIntegration
      )

      const req = {
        query: { mcpserverIntegrationId: 'mcpserver-123' },
      }

      const result = await handler(req, mockSession)

      expect(
        prisma.mcpserverIntegration.findUniqueByIdentifier
      ).toHaveBeenCalled()
      expect(result.status).toBe(200)
    })
  })
})

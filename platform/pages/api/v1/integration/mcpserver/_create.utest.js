/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    mcpserverIntegration: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/types', () => ({}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: { object: jest.fn(() => ({})) },
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, json: async () => data })),
}))

jest.mock('@/schemas/blueprintId', () => jest.fn(() => ({})))
jest.mock('@/schemas/description', () => ({}))
jest.mock('@/schemas/meta', () => ({}))
jest.mock('@/schemas/name', () => ({}))
jest.mock('@/schemas/oAuthConnectionId', () => ({}))
jest.mock('@/schemas/skillsetId', () => jest.fn(() => ({})))

describe('/api/v1/integration/mcpserver/create', () => {
  const mockSession = {
    user: { id: 'user-123' },
  }

  const makeReq = () => ({})

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful creation', () => {
    it('creates an mcpserver integration and returns its id', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({
        id: 'mcp-int-456',
      })

      const body = {
        name: 'My MCP Server',
        description: 'A test MCP server integration',
      }

      const res = await handler(makeReq(), mockSession, body)

      expect(res.status).toBe(200)

      const data = await res.json()

      expect(data).toEqual({ id: 'mcp-int-456' })
    })

    it('stores the userId from the session', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), { user: { id: 'user-xyz' } }, {})

      const callData = prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(callData.userId).toBe('user-xyz')
    })

    it('stores optional fields when provided', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      const body = {
        name: 'MCP Server',
        description: 'A description',
        meta: { custom: 'value' },
      }

      await handler(makeReq(), mockSession, body)

      const callData = prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(callData.name).toBe('MCP Server')
      expect(callData.description).toBe('A description')
      expect(callData.meta).toEqual({ custom: 'value' })
    })
  })

  describe('access token generation', () => {
    it('generates an accessToken on every creation', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), mockSession, {})

      const callData = prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(callData.accessToken).toBeDefined()
      expect(typeof callData.accessToken).toBe('string')
      expect(callData.accessToken.length).toBe(64)
    })

    it('generates a unique accessToken for each creation', async () => {
      prisma.mcpserverIntegration.create
        .mockResolvedValueOnce({ id: 'mcp-int-1' })
        .mockResolvedValueOnce({ id: 'mcp-int-2' })

      await handler(makeReq(), mockSession, {})
      await handler(makeReq(), mockSession, {})

      const token1 =
        prisma.mcpserverIntegration.create.mock.calls[0][0].data.accessToken
      const token2 =
        prisma.mcpserverIntegration.create.mock.calls[1][0].data.accessToken

      expect(token1).not.toBe(token2)
    })

    it('accessToken is a hex string', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), mockSession, {})

      const { accessToken } =
        prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(accessToken).toMatch(/^[0-9a-f]+$/)
    })
  })

  describe('blueprint linking', () => {
    it('resolves blueprintId from nested object', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), mockSession, {
        blueprintId: { id: 'bp-123' },
      })

      const callData = prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-123')
    })

    it('uses string blueprintId directly', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), mockSession, {
        blueprintId: 'bp-string',
      })

      const callData = prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBe('bp-string')
    })

    it('passes through null/undefined blueprintId as-is', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), mockSession, {})

      const callData = prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(callData.blueprintId).toBeUndefined()
    })
  })

  describe('skillset linking', () => {
    it('resolves skillsetId from nested object', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), mockSession, {
        skillsetId: { id: 'skillset-789' },
      })

      const callData = prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(callData.skillsetId).toBe('skillset-789')
    })

    it('uses string skillsetId directly', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), mockSession, {
        skillsetId: 'skillset-string',
      })

      const callData = prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(callData.skillsetId).toBe('skillset-string')
    })
  })

  describe('OAuth connection linking', () => {
    it('resolves oAuthConnectionId from nested object', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), mockSession, {
        oAuthConnectionId: { id: 'oauth-abc' },
      })

      const callData = prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(callData.oAuthConnectionId).toBe('oauth-abc')
    })

    it('uses string oAuthConnectionId directly', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), mockSession, {
        oAuthConnectionId: 'oauth-string',
      })

      const callData = prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(callData.oAuthConnectionId).toBe('oauth-string')
    })

    it('creates integration without oAuthConnectionId when not provided', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), mockSession, {
        name: 'Public MCP Server',
      })

      const callData = prisma.mcpserverIntegration.create.mock.calls[0][0].data

      expect(callData.oAuthConnectionId).toBeUndefined()
    })
  })

  describe('select fields', () => {
    it('selects only the id field from the database', async () => {
      prisma.mcpserverIntegration.create.mockResolvedValue({ id: 'mcp-int-1' })

      await handler(makeReq(), mockSession, {})

      const callArg = prisma.mcpserverIntegration.create.mock.calls[0][0]

      expect(callArg.select).toEqual({ id: true })
    })
  })
})

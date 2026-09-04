import { getAbilityFunctionName } from '@/lib/ability.function'
import { captureError } from '@/lib/error'
import { resolveMcpHeaders } from '@/lib/mcp.headers'
import { McpOAuthProvider } from '@/lib/mcp.oauth'
import { installEnvironmentTools } from '@/lib/tool.environment'

import { callMcpTool, installMcpTools } from './mcp.direct'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

jest.mock('@/lib/error', () => ({
  UserAuthError: class UserAuthError extends Error {},
  UserInputError: class UserInputError extends Error {},
  captureError: jest.fn(),
}))

jest.mock('@/lib/ability.function', () => ({
  ...jest.requireActual('@/lib/ability.function'),
  getAbilityFunctionName: jest.fn(
    jest.requireActual('@/lib/ability.function').getAbilityFunctionName
  ),
}))

jest.mock('@/lib/tool.environment', () => ({
  installEnvironmentTools: jest.fn(async () => true),
  makeEnvironmentToolSource: (kind, id, prefix) =>
    [kind, id, prefix].filter(Boolean).join(':'),
}))

jest.mock('@/lib/mcp.headers', () => ({
  resolveMcpHeaders: jest.fn(),
}))

jest.mock('@/lib/mcp.oauth', () => ({
  McpOAuthProvider: {
    getClientTransport: jest.fn(() => ({
      authProvider: {
        cleanup: jest.fn(),
      },
    })),
  },
  McpStreamableHTTPClientTransport: jest.fn(),
}))

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn(),
}))

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolResultSchema: {},
}))

describe('mcp.direct', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('installMcpTools', () => {
    const mockUser = { id: 'user-123' }
    const mockSessionId = 'session-456'
    const mockUrl = 'https://mcp.example.com'

    let mockClient

    beforeEach(() => {
      mockClient = {
        connect: jest.fn(),
        listTools: jest.fn(() => ({
          tools: [
            { name: 'tool1', description: 'Tool 1' },
            { name: 'tool2', description: 'Tool 2' },
          ],
        })),
        close: jest.fn(),
      }

      Client.mockImplementation(() => mockClient)
    })

    it('should install all mcp tools successfully', async () => {
      const result = await installMcpTools(mockUser, {
        sessionId: mockSessionId,
        url: mockUrl,
      })

      expect(result).toEqual({ success: true })
      expect(McpOAuthProvider.getClientTransport).toHaveBeenCalledWith(
        mockUser,
        {
          sessionId: mockSessionId,
          url: mockUrl,
          headers: undefined,
        }
      )
      expect(mockClient.connect).toHaveBeenCalled()
      expect(mockClient.listTools).toHaveBeenCalled()
      expect(installEnvironmentTools).toHaveBeenCalled()
      expect(mockClient.close).toHaveBeenCalled()
    })

    it('should filter tools when tools array is provided', async () => {
      await installMcpTools(mockUser, {
        sessionId: mockSessionId,
        url: mockUrl,
        tools: ['tool1'],
      })

      const installCall = installEnvironmentTools.mock.calls[0][0]

      expect(installCall).toHaveLength(1)
      expect(installCall[0].options.toolName).toBe('tool1')
    })

    it('should add prefix to tool names', async () => {
      await installMcpTools(mockUser, {
        sessionId: mockSessionId,
        url: mockUrl,
        prefix: 'custom',
      })

      expect(getAbilityFunctionName).toHaveBeenCalledWith({
        name: 'custom tool1',
      })

      const installCall = installEnvironmentTools.mock.calls[0][0]

      expect(installCall[0]).toMatchObject({ name: 'custom_tool1' })
    })

    it('should pass custom headers', async () => {
      const headers = { Authorization: 'Bearer token' }

      await installMcpTools(mockUser, {
        sessionId: mockSessionId,
        url: mockUrl,
        headers,
      })

      expect(McpOAuthProvider.getClientTransport).toHaveBeenCalledWith(
        mockUser,
        {
          sessionId: mockSessionId,
          url: mockUrl,
          headers,
        }
      )
    })

    it('should store the header source instead of the swapped headers', async () => {
      const headers = { Authorization: 'Bearer swapped' }
      const headerSource = {
        headerTemplate: { Authorization: '${SECRET_DEFAULT}' },
        abilityId: 'ability-1',
        secretId: 'secret-1',
      }

      await installMcpTools(mockUser, {
        sessionId: mockSessionId,
        url: mockUrl,
        headers,
        headerSource,
      })

      // the swapped headers still open the install-time connection
      expect(McpOAuthProvider.getClientTransport).toHaveBeenCalledWith(
        mockUser,
        { sessionId: mockSessionId, url: mockUrl, headers }
      )

      const installCall = installEnvironmentTools.mock.calls[0][0]

      expect(installCall[0].options).toMatchObject(headerSource)
      expect(installCall[0].options.headers).toBeUndefined()
    })

    it('should close client even on error', async () => {
      mockClient.listTools.mockRejectedValue(new Error('Connection failed'))

      await expect(
        installMcpTools(mockUser, {
          sessionId: mockSessionId,
          url: mockUrl,
        })
      ).rejects.toThrow('Connection failed')

      expect(mockClient.close).toHaveBeenCalled()
    })

    it('should cleanup transport on non-auth errors', async () => {
      const transport = {
        authProvider: {
          cleanup: jest.fn(),
        },
      }

      McpOAuthProvider.getClientTransport.mockReturnValue(transport)
      mockClient.connect.mockRejectedValue(new Error('Network error'))

      await expect(
        installMcpTools(mockUser, {
          sessionId: mockSessionId,
          url: mockUrl,
        })
      ).rejects.toThrow('Network error')

      expect(transport.authProvider.cleanup).toHaveBeenCalled()
    })

    it('should handle empty tools list', async () => {
      mockClient.listTools.mockResolvedValue({ tools: [] })

      const result = await installMcpTools(mockUser, {
        sessionId: mockSessionId,
        url: mockUrl,
      })

      expect(result).toEqual({ success: true })
      expect(installEnvironmentTools).toHaveBeenCalledWith([])
    })

    it('should handle tools with whitespace in filter', async () => {
      await installMcpTools(mockUser, {
        sessionId: mockSessionId,
        url: mockUrl,
        tools: ['  tool1  ', 'TOOL2'],
      })

      const installCall = installEnvironmentTools.mock.calls[0][0]

      expect(installCall).toHaveLength(2)
    })
  })

  describe('callMcpTool', () => {
    const mockUser = { id: 'user-123' }
    const mockTool = {
      name: 'test-tool',
      options: {
        sessionId: 'session-456',
        url: 'https://mcp.example.com',
        headers: { 'X-Custom': 'value' },
        toolName: 'originalToolName',
      },
    }

    let mockClient

    beforeEach(() => {
      mockClient = {
        connect: jest.fn(),
        request: jest.fn(() => ({ result: 'success' })),
        close: jest.fn(),
      }

      Client.mockImplementation(() => mockClient)
    })

    it('should resolve headers from the stored source on every call', async () => {
      const resolved = { Authorization: 'Bearer fresh' }

      resolveMcpHeaders.mockResolvedValue(resolved)

      const tool = {
        name: 'test-tool',
        options: {
          sessionId: 'session-456',
          url: 'https://mcp.example.com',
          headerTemplate: { Authorization: '${SECRET_DEFAULT}' },
          abilityId: 'ability-1',
          secretId: 'secret-1',
          toolName: 'originalToolName',
        },
      }

      await callMcpTool(mockUser, tool, {})

      expect(resolveMcpHeaders).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          headerTemplate: tool.options.headerTemplate,
          abilityId: 'ability-1',
          secretId: 'secret-1',
        })
      )
      expect(McpOAuthProvider.getClientTransport).toHaveBeenCalledWith(
        mockUser,
        {
          sessionId: 'session-456',
          url: 'https://mcp.example.com',
          headers: resolved,
        }
      )
    })

    it('should call mcp tool successfully', async () => {
      const args = { param1: 'value1' }
      const result = await callMcpTool(mockUser, mockTool, args)

      // a legacy tool without a template keeps its stored headers
      expect(resolveMcpHeaders).not.toHaveBeenCalled()

      expect(result).toEqual({ result: 'success' })
      expect(McpOAuthProvider.getClientTransport).toHaveBeenCalledWith(
        mockUser,
        {
          sessionId: mockTool.options.sessionId,
          url: mockTool.options.url,
          headers: mockTool.options.headers,
        }
      )
      expect(mockClient.connect).toHaveBeenCalled()
      expect(mockClient.request).toHaveBeenCalledWith(
        {
          method: 'tools/call',
          params: {
            name: 'originalToolName',
            arguments: args,
          },
        },
        {},
        { timeout: 60000, resetTimeoutOnProgress: true }
      )
      expect(mockClient.close).toHaveBeenCalled()
    })

    it('should throw error when sessionId is missing', async () => {
      const invalidTool = {
        ...mockTool,
        options: { ...mockTool.options, sessionId: undefined },
      }

      await expect(callMcpTool(mockUser, invalidTool, {})).rejects.toThrow(
        'Missing required MCP tool options'
      )
    })

    it('should throw error when url is missing', async () => {
      const invalidTool = {
        ...mockTool,
        options: { ...mockTool.options, url: undefined },
      }

      await expect(callMcpTool(mockUser, invalidTool, {})).rejects.toThrow(
        'Missing required MCP tool options'
      )
    })

    it('should throw error when toolName is missing', async () => {
      const invalidTool = {
        ...mockTool,
        options: { ...mockTool.options, toolName: undefined },
      }

      await expect(callMcpTool(mockUser, invalidTool, {})).rejects.toThrow(
        'Missing required MCP tool options'
      )
    })

    it('should close client even on error', async () => {
      mockClient.request.mockRejectedValue(new Error('Tool execution failed'))

      await expect(callMcpTool(mockUser, mockTool, {})).rejects.toThrow(
        'Tool execution failed'
      )

      expect(mockClient.close).toHaveBeenCalled()
    })

    it('should handle null arguments', async () => {
      await callMcpTool(mockUser, mockTool, null)

      expect(mockClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            arguments: null,
          }),
        }),
        {},
        { timeout: 60000, resetTimeoutOnProgress: true }
      )
    })

    it('should capture errors during client close', async () => {
      mockClient.close.mockRejectedValue(new Error('Close failed'))

      await callMcpTool(mockUser, mockTool, {})

      expect(captureError).toHaveBeenCalledWith(expect.any(Error))
    })
  })
})

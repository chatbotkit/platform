import {
  getContextContact,
  getContextConversation,
  getContextNamespace,
} from '@/lib/context.store'
import { SafeError, UserAuthError, UserInputError } from '@/lib/error'
import fetch, { getFetchError } from '@/lib/fetch'
import { getLocalAPIHostURL } from '@/lib/host'
import { callMcpTool, installMcpTools } from '@/lib/mcp.edge'
import { NOT_AUTHENTICATED_CODE, throwConflict } from '@/lib/response'
import { getTemporaryUserToken } from '@/lib/session.temp'

jest.mock('@/lib/context.store', () => ({
  getContextConversation: jest.fn(),
  getContextContact: jest.fn(),
  getContextNamespace: jest.fn(),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  getFetchError: jest.fn(),
}))

jest.mock('@/lib/host', () => ({
  getLocalAPIHostURL: jest.fn((path) => `https://api.example.com${path}`),
}))

jest.mock('@/lib/response', () => ({
  ...jest.requireActual('@/lib/response'),
  throwConflict: jest.fn(),
  NOT_AUTHENTICATED_CODE: 'NOT_AUTHENTICATED',
}))

jest.mock('@/lib/session.temp', () => ({
  getTemporaryUserToken: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    log: jest.fn(() => ({})),
  })),
}))

describe('mcp.edge', () => {
  const mockUser = { id: 'user-123' }

  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock implementations
    getTemporaryUserToken.mockResolvedValue('temp-token-123')
    getLocalAPIHostURL.mockImplementation(
      (path) => `https://api.example.com${path}`
    )
  })

  describe('installMcpTools', () => {
    const defaultParams = {
      url: 'https://mcp.example.com',
      headers: { 'X-Custom': 'value' },
      prefix: 'test',
    }

    describe('session ID resolution', () => {
      it('should use conversation ID when conversation is available', async () => {
        const mockConversation = { id: 'conv-789' }

        getContextConversation.mockReturnValue(mockConversation)
        getContextContact.mockReturnValue({ id: 'contact-456' })
        getContextNamespace.mockReturnValue('test-namespace')

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        }

        fetch.mockResolvedValue(mockResponse)

        await installMcpTools(mockUser, defaultParams)

        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/install',
          expect.objectContaining({
            body: expect.stringContaining(
              '"sessionId":"conversation-conv-789"'
            ),
          })
        )
      })

      it('should use namespace when conversation is not available but namespace is', async () => {
        getContextContact.mockReturnValue({ id: 'contact-456' })
        getContextConversation.mockReturnValue(null)
        getContextNamespace.mockReturnValue('test-namespace')

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        }

        fetch.mockResolvedValue(mockResponse)

        await installMcpTools(mockUser, defaultParams)

        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/install',
          expect.objectContaining({
            body: expect.stringContaining(
              '"sessionId":"namespace-test-namespace"'
            ),
          })
        )
      })

      it('should use contact ID when only contact is available', async () => {
        const mockContact = { id: 'contact-456' }

        getContextContact.mockReturnValue(mockContact)
        getContextConversation.mockReturnValue(null)
        getContextNamespace.mockReturnValue(null)

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        }

        fetch.mockResolvedValue(mockResponse)

        await installMcpTools(mockUser, defaultParams)

        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/install',
          expect.objectContaining({
            body: expect.stringContaining('"sessionId":"contact-contact-456"'),
          })
        )
      })

      it('should use conversation ID when contact and namespace are not available', async () => {
        getContextContact.mockReturnValue(null)
        getContextConversation.mockReturnValue({ id: 'conv-789' })
        getContextNamespace.mockReturnValue(null)

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        }

        fetch.mockResolvedValue(mockResponse)

        await installMcpTools(mockUser, defaultParams)

        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/install',
          expect.objectContaining({
            body: expect.stringContaining(
              '"sessionId":"conversation-conv-789"'
            ),
          })
        )
      })

      it('should throw conflict error when no session can be obtained', async () => {
        getContextContact.mockReturnValue(null)
        getContextConversation.mockReturnValue(null)
        getContextNamespace.mockReturnValue(null)

        throwConflict.mockImplementation((message) => {
          throw new Error(message)
        })

        await expect(installMcpTools(mockUser, defaultParams)).rejects.toThrow(
          'Cannot obtain session'
        )

        expect(throwConflict).toHaveBeenCalledWith('Cannot obtain session')
      })
    })

    describe('URL validation', () => {
      it('should throw conflict error when URL is missing', async () => {
        getContextContact.mockReturnValue({ id: 'contact-456' })
        throwConflict.mockImplementation((message) => {
          throw new Error(message)
        })

        await expect(installMcpTools(mockUser, { url: '' })).rejects.toThrow(
          'MCP server URL or client integration ID is required'
        )

        expect(throwConflict).toHaveBeenCalledWith(
          'MCP server URL or client integration ID is required'
        )
      })

      it('should throw UserInputError for invalid URL format', async () => {
        getContextContact.mockReturnValue({ id: 'contact-456' })

        await expect(
          installMcpTools(mockUser, { url: 'invalid-url' })
        ).rejects.toThrow(UserInputError)
        await expect(
          installMcpTools(mockUser, { url: 'invalid-url' })
        ).rejects.toThrow('Invalid MCP server URL: invalid-url')
      })

      it('should accept valid URL formats', async () => {
        getContextContact.mockReturnValue({ id: 'contact-456' })

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        }

        fetch.mockResolvedValue(mockResponse)

        const validUrls = [
          'https://mcp.example.com',
          'http://localhost:3000',
          'https://api.test.com/mcp',
        ]

        for (const url of validUrls) {
          await expect(installMcpTools(mockUser, { url })).resolves.toEqual({
            success: true,
          })
        }
      })
    })

    describe('API request construction', () => {
      it('should make POST request with correct headers and body', async () => {
        const mockConversation = { id: 'conv-789' }
        const mockContact = { id: 'contact-456' }
        const mockNamespace = 'test-namespace'

        getContextConversation.mockReturnValue(mockConversation)
        getContextContact.mockReturnValue(mockContact)
        getContextNamespace.mockReturnValue(mockNamespace)

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        }

        fetch.mockResolvedValue(mockResponse)

        await installMcpTools(mockUser, defaultParams)

        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/install',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer temp-token-123',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversationId: 'conv-789',
              contactId: 'contact-456',
              namespace: 'test-namespace',
              sessionId: 'conversation-conv-789',
              url: 'https://mcp.example.com',
              headers: { 'X-Custom': 'value' },
              prefix: 'test',
            }),
          }
        )
      })

      it('should handle missing optional parameters', async () => {
        getContextContact.mockReturnValue({ id: 'contact-456' })
        getContextConversation.mockReturnValue(null)
        getContextNamespace.mockReturnValue(null)

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        }

        fetch.mockResolvedValue(mockResponse)

        await installMcpTools(mockUser, { url: 'https://mcp.example.com' })

        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/install',
          expect.objectContaining({
            body: expect.stringContaining('"contactId":"contact-456"'),
          })
        )

        // Verify the body contains expected fields and omits undefined ones
        const callArgs = fetch.mock.calls[0][1]
        const body = JSON.parse(callArgs.body)

        expect(body).toEqual({
          contactId: 'contact-456',
          sessionId: 'contact-contact-456',
          url: 'https://mcp.example.com',
        })
        expect(body).not.toHaveProperty('namespace')
        expect(body).not.toHaveProperty('conversationId')
      })
    })

    describe('error handling', () => {
      it('should transform authentication errors correctly', async () => {
        getContextContact.mockReturnValue({ id: 'contact-456' })

        const mockError = {
          code: NOT_AUTHENTICATED_CODE,
          message: 'Not authenticated',
        }
        const mockResponse = { ok: false }

        fetch.mockResolvedValue(mockResponse)
        getFetchError.mockResolvedValue(mockError)

        await expect(installMcpTools(mockUser, defaultParams)).rejects.toThrow(
          UserAuthError
        )
        await expect(installMcpTools(mockUser, defaultParams)).rejects.toThrow(
          'Not authenticated'
        )
      })

      it('should transform other errors to SafeError', async () => {
        getContextContact.mockReturnValue({ id: 'contact-456' })

        const mockError = { code: 'OTHER_ERROR', message: 'Some other error' }
        const mockResponse = { ok: false }

        fetch.mockResolvedValue(mockResponse)
        getFetchError.mockResolvedValue(mockError)

        await expect(installMcpTools(mockUser, defaultParams)).rejects.toThrow(
          SafeError
        )
        await expect(installMcpTools(mockUser, defaultParams)).rejects.toThrow(
          'Some other error'
        )
      })

      it('should return successful result for successful API response', async () => {
        getContextContact.mockReturnValue({ id: 'contact-456' })

        const mockResult = { success: true, tools: ['tool1', 'tool2'] }
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResult),
        }

        fetch.mockResolvedValue(mockResponse)

        const result = await installMcpTools(mockUser, defaultParams)

        expect(result).toEqual(mockResult)
      })
    })
  })

  describe('callMcpTool', () => {
    const mockTool = {
      name: 'test-tool',
      description: 'A test tool',
      options: {
        sessionId: 'session-123',
        url: 'https://mcp.example.com',
        headers: { 'X-Custom': 'header' },
        toolName: 'original-tool-name',
      },
    }

    const mockArgs = { param1: 'value1', param2: 42 }

    describe('API request construction', () => {
      it('should make POST request with correct headers and body', async () => {
        const mockConversation = { id: 'conv-789' }
        const mockContact = { id: 'contact-456' }
        const mockNamespace = 'test-namespace'

        getContextConversation.mockReturnValue(mockConversation)
        getContextContact.mockReturnValue(mockContact)
        getContextNamespace.mockReturnValue(mockNamespace)

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ result: 'success' }),
        }

        fetch.mockResolvedValue(mockResponse)

        await callMcpTool(mockUser, mockTool, mockArgs)

        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/call',
          {
            method: 'POST',
            headers: {
              Authorization: 'Bearer temp-token-123',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversationId: 'conv-789',
              contactId: 'contact-456',
              namespace: 'test-namespace',
              tool: mockTool,
              args: mockArgs,
            }),
          }
        )
      })

      it('should handle missing context values', async () => {
        getContextConversation.mockReturnValue(null)
        getContextContact.mockReturnValue(null)
        getContextNamespace.mockReturnValue(null)

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ result: 'success' }),
        }

        fetch.mockResolvedValue(mockResponse)

        await callMcpTool(mockUser, mockTool, mockArgs)

        expect(fetch).toHaveBeenCalledWith(
          'https://api.example.com/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/call',
          expect.objectContaining({
            body:
              expect.stringContaining('"namespace":null') &&
              expect.stringContaining('"tool":') &&
              expect.stringContaining('"args":'),
          })
        )
      })
    })

    describe('error handling', () => {
      it('should transform authentication errors correctly', async () => {
        const mockError = {
          code: NOT_AUTHENTICATED_CODE,
          message: 'Authentication failed',
        }
        const mockResponse = { ok: false }

        fetch.mockResolvedValue(mockResponse)
        getFetchError.mockResolvedValue(mockError)

        await expect(callMcpTool(mockUser, mockTool, mockArgs)).rejects.toThrow(
          UserAuthError
        )
        await expect(callMcpTool(mockUser, mockTool, mockArgs)).rejects.toThrow(
          'Authentication failed'
        )
      })

      it('should transform other errors to SafeError', async () => {
        const mockError = {
          code: 'TOOL_ERROR',
          message: 'Tool execution failed',
        }
        const mockResponse = { ok: false }

        fetch.mockResolvedValue(mockResponse)
        getFetchError.mockResolvedValue(mockError)

        await expect(callMcpTool(mockUser, mockTool, mockArgs)).rejects.toThrow(
          SafeError
        )
        await expect(callMcpTool(mockUser, mockTool, mockArgs)).rejects.toThrow(
          'Tool execution failed'
        )
      })

      it('should return successful result for successful API response', async () => {
        const mockResult = {
          output: 'Tool executed successfully',
          data: [1, 2, 3],
        }
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue(mockResult),
        }

        fetch.mockResolvedValue(mockResponse)

        const result = await callMcpTool(mockUser, mockTool, mockArgs)

        expect(result).toEqual(mockResult)
      })
    })

    describe('argument handling', () => {
      it('should handle complex arguments', async () => {
        const complexArgs = {
          stringArg: 'test string',
          numberArg: 42,
          booleanArg: true,
          arrayArg: [1, 2, 3],
          objectArg: { nested: { value: 'deep' } },
          nullArg: null,
          undefinedArg: undefined,
        }

        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ result: 'success' }),
        }

        fetch.mockResolvedValue(mockResponse)

        await callMcpTool(mockUser, mockTool, complexArgs)

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining(JSON.stringify(complexArgs)),
          })
        )
      })

      it('should handle empty arguments', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ result: 'success' }),
        }

        fetch.mockResolvedValue(mockResponse)

        await callMcpTool(mockUser, mockTool, {})

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('"args":{}'),
          })
        )
      })
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete workflow with both functions', async () => {
      // Setup context
      const mockContact = { id: 'contact-456' }

      getContextContact.mockReturnValue(mockContact)
      getContextConversation.mockReturnValue(null)
      getContextNamespace.mockReturnValue(null)

      // Mock successful installation
      const installResult = { success: true, tools: ['tool1', 'tool2'] }
      const installResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(installResult),
      }

      fetch.mockResolvedValueOnce(installResponse)

      // Install tools
      const installationResult = await installMcpTools(mockUser, {
        url: 'https://mcp.example.com',
        prefix: 'test',
      })

      expect(installationResult).toEqual(installResult)

      // Mock successful tool call
      const callResult = { output: 'Tool executed', status: 'success' }
      const callResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(callResult),
      }

      fetch.mockResolvedValueOnce(callResponse)

      // Call tool
      const mockTool = {
        name: 'test-tool1',
        options: {
          sessionId: 'session-123',
          url: 'https://mcp.example.com',
          toolName: 'tool1',
        },
      }

      const toolResult = await callMcpTool(mockUser, mockTool, {
        input: 'test',
      })

      expect(toolResult).toEqual(callResult)
      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('edge cases', () => {
    it('should handle network errors during installation', async () => {
      getContextContact.mockReturnValue({ id: 'contact-456' })
      fetch.mockRejectedValue(new Error('Network error'))

      await expect(
        installMcpTools(mockUser, { url: 'https://mcp.example.com' })
      ).rejects.toThrow('Network error')
    })

    it('should handle network errors during tool call', async () => {
      const mockTool = {
        name: 'test-tool',
        options: {
          sessionId: 'session-123',
          url: 'https://mcp.example.com',
          toolName: 'tool1',
        },
      }

      fetch.mockRejectedValue(new Error('Connection timeout'))

      await expect(
        callMcpTool(mockUser, mockTool, { input: 'test' })
      ).rejects.toThrow('Connection timeout')
    })

    it('should handle malformed JSON responses', async () => {
      getContextContact.mockReturnValue({ id: 'contact-456' })

      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      }

      fetch.mockResolvedValue(mockResponse)

      await expect(
        installMcpTools(mockUser, { url: 'https://mcp.example.com' })
      ).rejects.toThrow('Invalid JSON')
    })
  })
})

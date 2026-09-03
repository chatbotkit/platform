/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

let capturedHandlerFn = null

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedHandler: jest.fn((schema, fn) => {
    capturedHandlerFn = fn

    return jest.fn()
  }),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
    },
    contact: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/context.store', () => ({
  setContextConversation: jest.fn(),
  setContextContact: jest.fn(),
  setContextNamespace: jest.fn(),
}))

jest.mock('@/lib/mcp.direct', () => ({
  callMcpTool: jest.fn(),
}))

jest.mock('@/lib/mcp.error', () => ({
  rethrowMcpError: jest.fn((e) => {
    throw e
  }),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

// Import after mocks are set up so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/call')

const prisma = require('@/prisma/client').default
const {
  setContextConversation,
  setContextContact,
  setContextNamespace,
} = require('@/lib/context.store')
const { callMcpTool } = require('@/lib/mcp.direct')
const { rethrowMcpError } = require('@/lib/mcp.error')

describe('auxiliary/skillset/ability/chatbotkit/mcp/tool/call', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  const mockHeaders = new Headers()

  const mockTool = {
    name: 'test-tool',
    description: 'A test tool',
    inputSchema: { type: 'object', properties: {} },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should export an authenticatedHandler', () => {
    expect(capturedHandlerFn).toBeDefined()
    expect(typeof capturedHandlerFn).toBe('function')
  })

  describe('without context parameters', () => {
    it('should call callMcpTool with user, tool, and args', async () => {
      const toolResult = { content: [{ type: 'text', text: 'result' }] }

      callMcpTool.mockResolvedValue(toolResult)

      const result = await capturedHandlerFn(
        mockSession,
        { tool: mockTool, args: { input: 'hello' } },
        mockHeaders
      )

      expect(callMcpTool).toHaveBeenCalledWith(mockSession.user, mockTool, {
        input: 'hello',
      })
      expect(result).toEqual(toolResult)
    })

    it('should pass null args to callMcpTool when not provided', async () => {
      callMcpTool.mockResolvedValue({ content: [] })

      await capturedHandlerFn(
        mockSession,
        { tool: mockTool, args: null },
        mockHeaders
      )

      expect(callMcpTool).toHaveBeenCalledWith(mockSession.user, mockTool, null)
    })
  })

  describe('conversation authorization', () => {
    it('should throw when conversation belongs to a different user', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        userId: 'other-user',
      })

      await expect(
        capturedHandlerFn(
          mockSession,
          { conversationId: 'conv-1', tool: mockTool, args: {} },
          mockHeaders
        )
      ).rejects.toThrow()

      expect(callMcpTool).not.toHaveBeenCalled()
    })

    it('should set conversation context when user is authorized', async () => {
      const conversation = { id: 'conv-1', userId: 'user-123' }

      prisma.conversation.findUnique.mockResolvedValue(conversation)
      callMcpTool.mockResolvedValue({ content: [] })

      await capturedHandlerFn(
        mockSession,
        { conversationId: 'conv-1', tool: mockTool, args: {} },
        mockHeaders
      )

      expect(setContextConversation).toHaveBeenCalledWith(conversation)
    })

    it('should not set context and not throw when conversation is not found', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)
      callMcpTool.mockResolvedValue({ content: [] })

      await capturedHandlerFn(
        mockSession,
        { conversationId: 'conv-missing', tool: mockTool, args: {} },
        mockHeaders
      )

      expect(setContextConversation).not.toHaveBeenCalled()
      expect(callMcpTool).toHaveBeenCalled()
    })
  })

  describe('contact authorization', () => {
    it('should throw when contact belongs to a different user', async () => {
      prisma.contact.findUnique.mockResolvedValue({
        id: 'contact-1',
        userId: 'other-user',
      })

      await expect(
        capturedHandlerFn(
          mockSession,
          { contactId: 'contact-1', tool: mockTool, args: {} },
          mockHeaders
        )
      ).rejects.toThrow()

      expect(callMcpTool).not.toHaveBeenCalled()
    })

    it('should set contact context when user is authorized', async () => {
      const contact = { id: 'contact-1', userId: 'user-123' }

      prisma.contact.findUnique.mockResolvedValue(contact)
      callMcpTool.mockResolvedValue({ content: [] })

      await capturedHandlerFn(
        mockSession,
        { contactId: 'contact-1', tool: mockTool, args: {} },
        mockHeaders
      )

      expect(setContextContact).toHaveBeenCalledWith(contact)
    })

    it('should not set context and not throw when contact is not found', async () => {
      prisma.contact.findUnique.mockResolvedValue(null)
      callMcpTool.mockResolvedValue({ content: [] })

      await capturedHandlerFn(
        mockSession,
        { contactId: 'contact-missing', tool: mockTool, args: {} },
        mockHeaders
      )

      expect(setContextContact).not.toHaveBeenCalled()
      expect(callMcpTool).toHaveBeenCalled()
    })
  })

  describe('namespace context', () => {
    it('should set namespace context when namespace is provided', async () => {
      callMcpTool.mockResolvedValue({ content: [] })

      await capturedHandlerFn(
        mockSession,
        { namespace: 'my-namespace', tool: mockTool, args: {} },
        mockHeaders
      )

      expect(setContextNamespace).toHaveBeenCalledWith('my-namespace')
    })

    it('should not set namespace when namespace is not provided', async () => {
      callMcpTool.mockResolvedValue({ content: [] })

      await capturedHandlerFn(
        mockSession,
        { tool: mockTool, args: {} },
        mockHeaders
      )

      expect(setContextNamespace).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should call rethrowMcpError when callMcpTool throws', async () => {
      const error = new Error('MCP error')

      callMcpTool.mockRejectedValue(error)

      await expect(
        capturedHandlerFn(
          mockSession,
          { tool: mockTool, args: {} },
          mockHeaders
        )
      ).rejects.toThrow('MCP error')

      expect(rethrowMcpError).toHaveBeenCalledWith(error)
    })

    it('should propagate non-MCP errors after rethrowMcpError', async () => {
      const error = new TypeError('Unexpected type')

      callMcpTool.mockRejectedValue(error)

      await expect(
        capturedHandlerFn(
          mockSession,
          { tool: mockTool, args: {} },
          mockHeaders
        )
      ).rejects.toThrow('Unexpected type')
    })
  })

  describe('combined context parameters', () => {
    it('should set both conversation and contact context when both are provided and authorized', async () => {
      const conversation = { id: 'conv-1', userId: 'user-123' }
      const contact = { id: 'contact-1', userId: 'user-123' }

      prisma.conversation.findUnique.mockResolvedValue(conversation)
      prisma.contact.findUnique.mockResolvedValue(contact)
      callMcpTool.mockResolvedValue({ content: [] })

      await capturedHandlerFn(
        mockSession,
        {
          conversationId: 'conv-1',
          contactId: 'contact-1',
          namespace: 'ns',
          tool: mockTool,
          args: {},
        },
        mockHeaders
      )

      expect(setContextConversation).toHaveBeenCalledWith(conversation)
      expect(setContextContact).toHaveBeenCalledWith(contact)
      expect(setContextNamespace).toHaveBeenCalledWith('ns')
    })
  })
})

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
  installMcpTools: jest.fn(),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

// Import after mocks so capturedHandlerFn is populated
require('@/pages/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/install')

const prisma = require('@/prisma/client').default
const {
  setContextConversation,
  setContextContact,
  setContextNamespace,
} = require('@/lib/context.store')
const { installMcpTools } = require('@/lib/mcp.direct')

describe('auxiliary/skillset/ability/chatbotkit/mcp/tool/install', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  const mockHeaders = new Headers()

  const baseParameters = {
    sessionId: 'session-abc',
    url: 'https://mcp.example.com',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    installMcpTools.mockResolvedValue({ success: true })
  })

  it('should export an authenticatedHandler', () => {
    expect(capturedHandlerFn).toBeDefined()
    expect(typeof capturedHandlerFn).toBe('function')
  })

  describe('basic installation', () => {
    it('should call installMcpTools with user and required parameters', async () => {
      const result = await capturedHandlerFn(
        mockSession,
        baseParameters,
        mockHeaders
      )

      expect(installMcpTools).toHaveBeenCalledWith(mockSession.user, {
        sessionId: 'session-abc',
        url: 'https://mcp.example.com',
        headers: undefined,
        tools: undefined,
        prefix: undefined,
      })
      expect(result).toEqual({ success: true })
    })

    it('should pass optional headers to installMcpTools', async () => {
      await capturedHandlerFn(
        mockSession,
        {
          ...baseParameters,
          headers: { Authorization: 'Bearer token-xyz' },
        },
        mockHeaders
      )

      expect(installMcpTools).toHaveBeenCalledWith(
        mockSession.user,
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-xyz' },
        })
      )
    })

    it('should pass tools filter array to installMcpTools', async () => {
      await capturedHandlerFn(
        mockSession,
        {
          ...baseParameters,
          tools: ['tool-a', 'tool-b'],
        },
        mockHeaders
      )

      expect(installMcpTools).toHaveBeenCalledWith(
        mockSession.user,
        expect.objectContaining({
          tools: ['tool-a', 'tool-b'],
        })
      )
    })

    it('should pass prefix to installMcpTools', async () => {
      await capturedHandlerFn(
        mockSession,
        {
          ...baseParameters,
          prefix: 'my_prefix_',
        },
        mockHeaders
      )

      expect(installMcpTools).toHaveBeenCalledWith(
        mockSession.user,
        expect.objectContaining({
          prefix: 'my_prefix_',
        })
      )
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
          { ...baseParameters, conversationId: 'conv-1' },
          mockHeaders
        )
      ).rejects.toThrow()

      expect(installMcpTools).not.toHaveBeenCalled()
    })

    it('should set conversation context when user is authorized', async () => {
      const conversation = { id: 'conv-1', userId: 'user-123' }

      prisma.conversation.findUnique.mockResolvedValue(conversation)

      await capturedHandlerFn(
        mockSession,
        { ...baseParameters, conversationId: 'conv-1' },
        mockHeaders
      )

      expect(setContextConversation).toHaveBeenCalledWith(conversation)
      expect(installMcpTools).toHaveBeenCalled()
    })

    it('should not set context and proceed when conversation is not found', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      await capturedHandlerFn(
        mockSession,
        { ...baseParameters, conversationId: 'conv-missing' },
        mockHeaders
      )

      expect(setContextConversation).not.toHaveBeenCalled()
      expect(installMcpTools).toHaveBeenCalled()
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
          { ...baseParameters, contactId: 'contact-1' },
          mockHeaders
        )
      ).rejects.toThrow()

      expect(installMcpTools).not.toHaveBeenCalled()
    })

    it('should set contact context when user is authorized', async () => {
      const contact = { id: 'contact-1', userId: 'user-123' }

      prisma.contact.findUnique.mockResolvedValue(contact)

      await capturedHandlerFn(
        mockSession,
        { ...baseParameters, contactId: 'contact-1' },
        mockHeaders
      )

      expect(setContextContact).toHaveBeenCalledWith(contact)
      expect(installMcpTools).toHaveBeenCalled()
    })

    it('should not set context and proceed when contact is not found', async () => {
      prisma.contact.findUnique.mockResolvedValue(null)

      await capturedHandlerFn(
        mockSession,
        { ...baseParameters, contactId: 'contact-missing' },
        mockHeaders
      )

      expect(setContextContact).not.toHaveBeenCalled()
      expect(installMcpTools).toHaveBeenCalled()
    })
  })

  describe('namespace context', () => {
    it('should set namespace context when namespace is provided', async () => {
      await capturedHandlerFn(
        mockSession,
        { ...baseParameters, namespace: 'project-ns' },
        mockHeaders
      )

      expect(setContextNamespace).toHaveBeenCalledWith('project-ns')
    })

    it('should not set namespace when namespace is not provided', async () => {
      await capturedHandlerFn(mockSession, baseParameters, mockHeaders)

      expect(setContextNamespace).not.toHaveBeenCalled()
    })
  })

  describe('error propagation', () => {
    it('should propagate errors from installMcpTools', async () => {
      installMcpTools.mockRejectedValue(new Error('Connection refused'))

      await expect(
        capturedHandlerFn(mockSession, baseParameters, mockHeaders)
      ).rejects.toThrow('Connection refused')
    })
  })

  describe('combined context', () => {
    it('should set all contexts when all are provided and authorized', async () => {
      const conversation = { id: 'conv-1', userId: 'user-123' }
      const contact = { id: 'contact-1', userId: 'user-123' }

      prisma.conversation.findUnique.mockResolvedValue(conversation)
      prisma.contact.findUnique.mockResolvedValue(contact)

      await capturedHandlerFn(
        mockSession,
        {
          ...baseParameters,
          conversationId: 'conv-1',
          contactId: 'contact-1',
          namespace: 'test-ns',
        },
        mockHeaders
      )

      expect(setContextConversation).toHaveBeenCalledWith(conversation)
      expect(setContextContact).toHaveBeenCalledWith(contact)
      expect(setContextNamespace).toHaveBeenCalledWith('test-ns')
      expect(installMcpTools).toHaveBeenCalled()
    })
  })
})

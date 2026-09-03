/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import prisma from '@/prisma/client'

import handler from './upsert'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/contact.create', () => ({
  ensureTrustedContact: jest.fn(),
  ensureUntrustedContact: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

const {
  ensureTrustedContact,
  ensureUntrustedContact,
} = require('@/lib/contact.create')

describe('POST /api/v1/conversation/[conversationId]/contact/upsert', () => {
  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockConversation = {
    id: 'conv_456',
    userId: 'user_123',
    contactId: null,
  }

  const mockContact = {
    id: 'contact_789',
    name: 'Alice',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.conversation.update.mockResolvedValue({})
    prisma.message.create.mockResolvedValue({})
  })

  // -------------------------------------------------------
  // Not found
  // -------------------------------------------------------

  describe('conversation not found', () => {
    it('should return 404 when conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const req = { query: { conversationId: 'conv_missing' } }
      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(404)
    })
  })

  // -------------------------------------------------------
  // Authorization
  // -------------------------------------------------------

  describe('authorization', () => {
    it('should return 403 when conversation belongs to a different user', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv_456',
        userId: 'user_other',
        contactId: null,
      })

      const req = { query: { conversationId: 'conv_456' } }
      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(403)
    })
  })

  // -------------------------------------------------------
  // Idempotency - conversation already has a contact
  // -------------------------------------------------------

  describe('already has contact', () => {
    it('should return 304 when conversation already has a contactId', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        contactId: 'contact_existing',
      })

      const req = { query: { conversationId: 'conv_456' } }
      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(304)
      expect(ensureTrustedContact).not.toHaveBeenCalled()
      expect(ensureUntrustedContact).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------
  // With fingerprint - trusted contact
  // -------------------------------------------------------

  describe('trusted contact (with fingerprint)', () => {
    it('should call ensureTrustedContact when fingerprint is provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ensureTrustedContact.mockResolvedValue(mockContact)

      const req = { query: { conversationId: 'conv_456' } }
      const body = {
        fingerprint: 'fp_abc123',
        name: 'Alice',
        email: 'alice@example.com',
      }

      await handler(req, mockSession, body)

      expect(ensureTrustedContact).toHaveBeenCalledWith(
        mockSession.user,
        expect.objectContaining({ name: 'Alice', email: 'alice@example.com' }),
        'fp_abc123'
      )
      expect(ensureUntrustedContact).not.toHaveBeenCalled()
    })

    it('should update conversation.contactId after trusted contact creation', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ensureTrustedContact.mockResolvedValue(mockContact)

      const req = { query: { conversationId: 'conv_456' } }

      await handler(req, mockSession, { fingerprint: 'fp_abc123' })

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv_456' },
        data: { contactId: 'contact_789' },
      })
    })

    it('should create a context message after trusted contact creation', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ensureTrustedContact.mockResolvedValue(mockContact)

      const req = { query: { conversationId: 'conv_456' } }

      await handler(req, mockSession, { fingerprint: 'fp_abc123' })

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'conv_456',
            text: expect.stringContaining('Alice'),
          }),
        })
      )
    })

    it('should return ok with contact id', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ensureTrustedContact.mockResolvedValue(mockContact)

      const req = { query: { conversationId: 'conv_456' } }
      const result = await handler(req, mockSession, {
        fingerprint: 'fp_abc123',
      })

      expect(result.status).toBe(200)

      const body = await result.json()

      expect(body.id).toBe('contact_789')
    })
  })

  // -------------------------------------------------------
  // Without fingerprint - untrusted contact
  // -------------------------------------------------------

  describe('untrusted contact (no fingerprint)', () => {
    it('should call ensureUntrustedContact when no fingerprint provided', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ensureUntrustedContact.mockResolvedValue(mockContact)

      const req = { query: { conversationId: 'conv_456' } }
      const body = { name: 'Bob', email: 'bob@example.com' }

      await handler(req, mockSession, body)

      expect(ensureUntrustedContact).toHaveBeenCalledWith(
        { id: 'user_123' }, // conversation.userId passed as owner
        expect.objectContaining({ name: 'Bob', email: 'bob@example.com' })
      )
      expect(ensureTrustedContact).not.toHaveBeenCalled()
    })

    it('should update conversation.contactId after untrusted contact creation', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ensureUntrustedContact.mockResolvedValue(mockContact)

      const req = { query: { conversationId: 'conv_456' } }

      await handler(req, mockSession, {})

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv_456' },
        data: { contactId: 'contact_789' },
      })
    })

    it('should return ok with contact id for untrusted contact', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ensureUntrustedContact.mockResolvedValue(mockContact)

      const req = { query: { conversationId: 'conv_456' } }
      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(200)

      const body = await result.json()

      expect(body.id).toBe('contact_789')
    })
  })

  // -------------------------------------------------------
  // Context message content
  // -------------------------------------------------------

  describe('context message', () => {
    it('should include contact name in the context message text', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation)
      ensureUntrustedContact.mockResolvedValue({
        id: 'c1',
        name: 'Charlie Brown',
      })

      const req = { query: { conversationId: 'conv_456' } }

      await handler(req, mockSession, {})

      const createCall = prisma.message.create.mock.calls[0][0]

      expect(createCall.data.text).toContain('Charlie Brown')
    })
  })
})

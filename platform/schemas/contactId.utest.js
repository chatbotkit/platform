/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { canUseContact } from '@/lib/contact.access'
import { ensureTrustedContact } from '@/lib/contact.create'
import { schema } from '@/lib/joi.handler'

import contactIdSchema from '@/schemas/contactId'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    contact: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/contact.access', () => ({
  canUseContact: jest.fn(),
}))

jest.mock('@/lib/contact.create', () => ({
  ensureTrustedContact: jest.fn(),
}))

describe('contactIdSchema', () => {
  const mockUser = { id: 'user-123' }
  const mockSession = { user: mockUser }
  const mockContext = { session: mockSession }

  beforeEach(() => {
    jest.clearAllMocks()
    canUseContact.mockReturnValue(true)
  })

  describe('basic validation', () => {
    const validate = async (schema, input, expected) => {
      const response = await schema.validateAsync(input, {
        context: mockContext,
      })

      expect(response).toEqual(expected)
    }

    it('should correctly handle falsy values', async () => {
      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      await validate(s, {}, {})
      await validate(s, { contactId: null }, { contactId: null })
      await validate(s, { contactId: '' }, { contactId: null })
      await validate(s, { contactId: '  ' }, { contactId: null })
    })
  })

  describe('string input (existing contact)', () => {
    it('should find and return contact by identifier', async () => {
      const mockContact = {
        id: 'contact-123',
        userId: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
      }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)

      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      const result = await s.validateAsync(
        { contactId: 'contact-123' },
        { context: mockContext }
      )

      expect(result).toEqual({ contactId: mockContact })
      expect(prisma.contact.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockUser,
        'contact-123'
      )
      expect(canUseContact).toHaveBeenCalledWith('user-123', mockContact)
    })

    it('should throw error if contact not found', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      await expect(
        s.validateAsync({ contactId: 'nonexistent' }, { context: mockContext })
      ).rejects.toThrow('Contact not found')
    })

    it('should throw error if user not authorized', async () => {
      const mockContact = {
        id: 'contact-123',
        userId: 'other-user',
        name: 'John Doe',
      }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      canUseContact.mockReturnValue(false)

      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      await expect(
        s.validateAsync({ contactId: 'contact-123' }, { context: mockContext })
      ).rejects.toThrow('You are not authorized to use this contact')
    })

    it('should throw error if not authenticated', async () => {
      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      await expect(
        s.validateAsync(
          { contactId: 'contact-123' },
          { context: { session: {} } }
        )
      ).rejects.toThrow()
    })
  })

  describe('object input (create/ensure contact)', () => {
    it('should ensure trusted contact when object is provided', async () => {
      const mockContact = {
        id: 'contact-456',
        userId: 'user-123',
        name: 'Jane Doe',
        email: 'jane@example.com',
        fingerprint: 'fp-123',
        verifiedAt: new Date(),
      }

      ensureTrustedContact.mockResolvedValue(mockContact)

      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      const contactData = {
        fingerprint: 'fp-123',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        nick: 'jdoe',
        description: 'Test contact',
        meta: { source: 'test' },
      }

      const result = await s.validateAsync(
        { contactId: contactData },
        { context: mockContext }
      )

      expect(result).toEqual({ contactId: mockContact })
      expect(ensureTrustedContact).toHaveBeenCalledWith(
        mockUser,
        {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+1234567890',
          nick: 'jdoe',
          description: 'Test contact',
          meta: { source: 'test' },
        },
        'fp-123'
      )
      expect(canUseContact).toHaveBeenCalledWith('user-123', mockContact)
    })

    it('should throw error if fingerprint is missing', async () => {
      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      const contactData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
      }

      await expect(
        s.validateAsync({ contactId: contactData }, { context: mockContext })
      ).rejects.toThrow('Fingerprint is required when creating a contact')
    })

    it('should throw error if user not authorized for created contact', async () => {
      const mockContact = {
        id: 'contact-456',
        userId: 'other-user',
        name: 'Jane Doe',
      }

      ensureTrustedContact.mockResolvedValue(mockContact)
      canUseContact.mockReturnValue(false)

      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      const contactData = {
        fingerprint: 'fp-123',
        name: 'Jane Doe',
        email: 'jane@example.com',
      }

      await expect(
        s.validateAsync({ contactId: contactData }, { context: mockContext })
      ).rejects.toThrow('You are not authorized to use this contact')
    })

    it('should allow null/empty values in contact object fields', async () => {
      const mockContact = {
        id: 'contact-456',
        userId: 'user-123',
        fingerprint: 'fp-123',
        verifiedAt: new Date(),
      }

      ensureTrustedContact.mockResolvedValue(mockContact)

      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      const contactData = {
        fingerprint: 'fp-123',
        name: '',
        email: null,
        phone: '',
        nick: null,
        description: '',
      }

      const result = await s.validateAsync(
        { contactId: contactData },
        { context: mockContext }
      )

      expect(result).toEqual({ contactId: mockContact })
      expect(ensureTrustedContact).toHaveBeenCalled()
    })

    it('should throw error if not authenticated for object input', async () => {
      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      const contactData = {
        fingerprint: 'fp-123',
        name: 'Jane Doe',
      }

      await expect(
        s.validateAsync(
          { contactId: contactData },
          { context: { session: {} } }
        )
      ).rejects.toThrow()
    })
  })

  describe('payload.contactId propagation (token-based contact)', () => {
    it('should use contactId from payload when present', async () => {
      const mockContact = {
        id: 'contact-from-payload',
        userId: 'user-123',
        name: 'Token Contact',
        email: 'token@example.com',
      }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)

      const mockContextWithPayload = {
        session: {
          user: mockUser,
          payload: { contactId: 'contact-from-payload' },
        },
      }

      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      // @note even if contactId is not provided in the request body,
      // it should use the one from the payload
      const result = await s.validateAsync(
        {},
        { context: mockContextWithPayload }
      )

      expect(result).toEqual({ contactId: mockContact })
      expect(prisma.contact.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockUser,
        'contact-from-payload'
      )
      expect(canUseContact).toHaveBeenCalledWith('user-123', mockContact)
    })

    it('should override request body contactId with payload contactId', async () => {
      const mockContactFromPayload = {
        id: 'contact-from-payload',
        userId: 'user-123',
        name: 'Token Contact',
      }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(
        mockContactFromPayload
      )

      const mockContextWithPayload = {
        session: {
          user: mockUser,
          payload: { contactId: 'contact-from-payload' },
        },
      }

      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      // @note request body provides 'contact-in-body' but payload has 'contact-from-payload'
      // payload should take precedence
      const result = await s.validateAsync(
        { contactId: 'contact-in-body' },
        { context: mockContextWithPayload }
      )

      expect(result).toEqual({ contactId: mockContactFromPayload })
      expect(prisma.contact.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockUser,
        'contact-from-payload'
      )
    })

    it('should throw error if payload contactId not found', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const mockContextWithPayload = {
        session: {
          user: mockUser,
          payload: { contactId: 'nonexistent-contact' },
        },
      }

      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      await expect(
        s.validateAsync({}, { context: mockContextWithPayload })
      ).rejects.toThrow('Contact not found')
    })

    it('should throw error if user not authorized for payload contact', async () => {
      const mockContact = {
        id: 'contact-from-payload',
        userId: 'other-user',
        name: 'Token Contact',
      }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      canUseContact.mockReturnValue(false)

      const mockContextWithPayload = {
        session: {
          user: mockUser,
          payload: { contactId: 'contact-from-payload' },
        },
      }

      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      await expect(
        s.validateAsync({}, { context: mockContextWithPayload })
      ).rejects.toThrow('You are not authorized to use this contact')
    })

    it('should fall back to request body when payload.contactId is not present', async () => {
      const mockContact = {
        id: 'contact-from-body',
        userId: 'user-123',
        name: 'Body Contact',
      }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)

      // @note payload exists but without contactId
      const mockContextWithEmptyPayload = {
        session: {
          user: mockUser,
          payload: {},
        },
      }

      const s = schema.object({
        contactId: contactIdSchema('use'),
      })

      const result = await s.validateAsync(
        { contactId: 'contact-from-body' },
        { context: mockContextWithEmptyPayload }
      )

      expect(result).toEqual({ contactId: mockContact })
      expect(prisma.contact.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockUser,
        'contact-from-body'
      )
    })
  })
})

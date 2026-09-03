/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getMeta } from '@/lib/meta'

import handler from './update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    contact: {
      findUniqueByIdentifier: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const createChain = () => {
    const chain = {
      allow: jest.fn(() => chain),
      email: jest.fn(() => chain),
      phone: jest.fn(() => chain),
    }

    return chain
  }

  const schema = {
    object: jest.fn(() => ({})),
    number: jest.fn(() => createChain()),
    string: jest.fn(() => createChain()),
  }

  return {
    __esModule: true,
    default: schema,
    withSchema: (_schema, fn) => fn,
  }
})

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((newMeta, existingMeta) => ({
    ...existingMeta,
    ...newMeta,
  })),
}))

jest.mock('@/schemas/contactFingerprint', () => ({}))
jest.mock('@/schemas/dbString', () => {
  const s = { email: jest.fn(() => s), phone: jest.fn(() => s) }

  return { __esModule: true, default: s }
})
jest.mock('@/schemas/dbText', () => ({ __esModule: true, default: {} }))
jest.mock('@/schemas/description', () => ({ __esModule: true, default: {} }))
jest.mock('@/schemas/meta', () => ({ __esModule: true, default: {} }))
jest.mock('@/schemas/name', () => ({ __esModule: true, default: {} }))

describe('POST /api/v1/contact/[contactId]/update', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const existingContact = {
    id: 'contact_abc123',
    userId: 'user_123',
    meta: { existing_key: 'existing_value' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.contact.update.mockResolvedValue({ id: existingContact.id })
  })

  describe('basic functionality', () => {
    it('should update a contact and return its id', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(existingContact)

      const req = { query: { contactId: 'contact_abc123' } }
      const body = { name: 'Updated Name' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('contact_abc123')
    })

    it('should call prisma.contact.update with the correct contact id', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(existingContact)

      const req = { query: { contactId: 'contact_abc123' } }
      const body = { name: 'New Name' }

      await handler(req, mockSession, body)

      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contact_abc123' },
        })
      )
    })

    it('should pass name and description from body to the update', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(existingContact)

      const req = { query: { contactId: 'contact_abc123' } }
      const body = { name: 'Alice Updated', description: 'New description' }

      await handler(req, mockSession, body)

      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Alice Updated',
            description: 'New description',
          }),
        })
      )
    })
  })

  describe('authorization', () => {
    it('should return 404 when contact is not found', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { contactId: 'contact_nonexistent' } }
      const body = { name: 'Updated' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(prisma.contact.update).not.toHaveBeenCalled()
    })

    it('should return 403 when the contact belongs to another user', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        ...existingContact,
        userId: 'other_user_999',
      })

      const req = { query: { contactId: 'contact_abc123' } }
      const body = { name: 'Hijacked Name' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(403)
      expect(prisma.contact.update).not.toHaveBeenCalled()
    })
  })

  describe('verifiedAt handling', () => {
    it('should convert a numeric verifiedAt to a Date', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(existingContact)

      const timestamp = 1704067200000
      const req = { query: { contactId: 'contact_abc123' } }
      const body = { verifiedAt: timestamp }

      await handler(req, mockSession, body)

      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verifiedAt: new Date(timestamp),
          }),
        })
      )
    })

    it('should set verifiedAt to null when null is passed', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(existingContact)

      const req = { query: { contactId: 'contact_abc123' } }
      const body = { verifiedAt: null }

      await handler(req, mockSession, body)

      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verifiedAt: null,
          }),
        })
      )
    })

    it('should set verifiedAt to undefined (omit) when undefined is passed', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(existingContact)

      const req = { query: { contactId: 'contact_abc123' } }
      const body = {}

      await handler(req, mockSession, body)

      const updateCall = prisma.contact.update.mock.calls[0][0]

      expect(updateCall.data.verifiedAt).toBeUndefined()
    })
  })

  describe('metadata merging', () => {
    it('should call getMeta with the new meta and existing contact meta', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(existingContact)

      const req = { query: { contactId: 'contact_abc123' } }
      const body = { meta: { new_key: 'new_value' } }

      await handler(req, mockSession, body)

      expect(getMeta).toHaveBeenCalledWith(
        { new_key: 'new_value' },
        existingContact.meta
      )
    })

    it('should pass merged meta to the prisma update call', async () => {
      const mergedMeta = {
        existing_key: 'existing_value',
        new_key: 'new_value',
      }

      getMeta.mockReturnValue(mergedMeta)

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(existingContact)

      const req = { query: { contactId: 'contact_abc123' } }
      const body = { meta: { new_key: 'new_value' } }

      await handler(req, mockSession, body)

      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: mergedMeta,
          }),
        })
      )
    })
  })

  describe('error handling', () => {
    it('should propagate errors from the lookup', async () => {
      prisma.contact.findUniqueByIdentifier.mockRejectedValue(
        new Error('Lookup failed')
      )

      const req = { query: { contactId: 'contact_abc123' } }
      const body = { name: 'Test' }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Lookup failed'
      )
    })

    it('should propagate errors from the update', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(existingContact)
      prisma.contact.update.mockRejectedValue(new Error('Update failed'))

      const req = { query: { contactId: 'contact_abc123' } }
      const body = { name: 'Test' }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Update failed'
      )
    })
  })
})

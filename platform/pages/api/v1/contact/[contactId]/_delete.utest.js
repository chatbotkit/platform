/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      contact: {
        findUniqueByIdentifier: jest.fn(),
        delete: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

describe('POST /api/v1/contact/[contactId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should delete contact and return its id', async () => {
      const mockContact = {
        id: 'contact_abc123',
        userId: 'user_123',
      }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.contact.delete.mockResolvedValue(mockContact)

      const req = { query: { contactId: 'contact_abc123' } }

      const result = await handler(req, mockSession)

      expect(prisma.contact.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'contact_abc123',
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )
      expect(prisma.contact.delete).toHaveBeenCalledWith({
        where: { id: 'contact_abc123' },
      })
      expect(result).toEqual({ status: 200, body: { id: 'contact_abc123' } })
    })

    it('should return the correct id in the success response', async () => {
      const mockContact = {
        id: 'contact_xyz789',
        userId: 'user_123',
      }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.contact.delete.mockResolvedValue(mockContact)

      const req = { query: { contactId: 'contact_xyz789' } }

      const result = await handler(req, mockSession)

      expect(result.body.id).toBe('contact_xyz789')
    })
  })

  describe('authorization', () => {
    it('should return 404 when contact is not found', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { contactId: 'contact_nonexistent' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(prisma.contact.delete).not.toHaveBeenCalled()
    })

    it('should return 403 when user does not own the contact', async () => {
      const mockContact = {
        id: 'contact_abc123',
        userId: 'other_user_999',
      }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)

      const req = { query: { contactId: 'contact_abc123' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(prisma.contact.delete).not.toHaveBeenCalled()
    })

    it('should not delete a contact belonging to a different user', async () => {
      const mockContact = {
        id: 'contact_other',
        userId: 'attacker_user',
      }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)

      const req = { query: { contactId: 'contact_other' } }

      await handler(req, mockSession)

      expect(prisma.contact.delete).not.toHaveBeenCalled()
    })
  })

  describe('lookup behavior', () => {
    it('should pass the contactId from the request query to findUniqueByIdentifier', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { contactId: 'specific_contact_id' } }

      await handler(req, mockSession)

      expect(prisma.contact.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'specific_contact_id',
        expect.any(Object)
      )
    })

    it('should pass the session user to findUniqueByIdentifier', async () => {
      const sessionWithUser = { user: { id: 'user_456' } }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { contactId: 'contact_abc' } }

      await handler(req, sessionWithUser)

      expect(prisma.contact.findUniqueByIdentifier).toHaveBeenCalledWith(
        sessionWithUser.user,
        expect.any(String),
        expect.any(Object)
      )
    })

    it('should use only the minimal select fields needed for authorization', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { contactId: 'contact_abc123' } }

      await handler(req, mockSession)

      expect(prisma.contact.findUniqueByIdentifier).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )
    })
  })

  describe('error handling', () => {
    it('should propagate database lookup errors', async () => {
      const dbError = new Error('Database connection failed')

      prisma.contact.findUniqueByIdentifier.mockRejectedValue(dbError)

      const req = { query: { contactId: 'contact_abc123' } }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should propagate database delete errors', async () => {
      const mockContact = {
        id: 'contact_abc123',
        userId: 'user_123',
      }

      prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
      prisma.contact.delete.mockRejectedValue(
        new Error('Delete operation failed')
      )

      const req = { query: { contactId: 'contact_abc123' } }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Delete operation failed'
      )
    })
  })
})

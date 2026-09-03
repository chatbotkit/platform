/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { makeJsonSafe } from '@/lib/struct'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    contact: {
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

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('GET /api/v1/contact/[contactId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const fullContact = {
    id: 'contact_abc123',
    name: 'Alice',
    description: 'Test contact',
    userId: 'user_123',
    fingerprint: 'fp_abc',
    email: 'alice@example.com',
    phone: '+1234567890',
    nick: 'alice',
    preferences: 'lang=en',
    verifiedAt: new Date('2024-01-01'),
    meta: { foo: 'bar' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should return contact data on success', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        ...fullContact,
      })

      const req = { query: { contactId: 'contact_abc123' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).toBeDefined()
      expect(result.body.id).toBe('contact_abc123')
    })

    it('should strip the userId field from the response', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        ...fullContact,
      })

      const req = { query: { contactId: 'contact_abc123' } }

      const result = await handler(req, mockSession)

      expect(result.body.userId).toBeUndefined()
    })

    it('should call makeJsonSafe on the contact before returning', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        ...fullContact,
      })

      const req = { query: { contactId: 'contact_abc123' } }

      await handler(req, mockSession)

      expect(makeJsonSafe).toHaveBeenCalledTimes(1)
    })

    it('should include all expected contact fields in the response', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        ...fullContact,
      })

      const req = { query: { contactId: 'contact_abc123' } }

      const result = await handler(req, mockSession)

      expect(result.body.id).toBe('contact_abc123')
      expect(result.body.name).toBe('Alice')
      expect(result.body.fingerprint).toBe('fp_abc')
      expect(result.body.email).toBe('alice@example.com')
      expect(result.body.nick).toBe('alice')
    })
  })

  describe('authorization', () => {
    it('should return 404 when contact is not found', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { contactId: 'contact_nonexistent' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when contact belongs to a different user', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        ...fullContact,
        userId: 'other_user_999',
      })

      const req = { query: { contactId: 'contact_abc123' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should not include contact data in a 403 response', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        ...fullContact,
        userId: 'attacker_user',
      })

      const req = { query: { contactId: 'contact_abc123' } }

      const result = await handler(req, mockSession)

      expect(result.body).toBeUndefined()
    })
  })

  describe('lookup behavior', () => {
    it('should query using the contactId from the request', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { contactId: 'specific_contact_id' } }

      await handler(req, mockSession)

      expect(prisma.contact.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'specific_contact_id',
        expect.any(Object)
      )
    })

    it('should request select fields including userId for authorization', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { contactId: 'contact_abc123' } }

      await handler(req, mockSession)

      const callArgs = prisma.contact.findUniqueByIdentifier.mock.calls[0]
      const selectArg = callArgs[2]

      expect(selectArg.select.id).toBe(true)
      expect(selectArg.select.userId).toBe(true)
      expect(selectArg.select.fingerprint).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection lost')

      prisma.contact.findUniqueByIdentifier.mockRejectedValue(dbError)

      const req = { query: { contactId: 'contact_abc123' } }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection lost'
      )
    })
  })
})

/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './search'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: mockDeep(),
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: {
    object: jest.fn(() => ({})),
    string: jest.fn(() => ({})),
  },
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/memory.search', () => ({
  searchMemories: jest.fn(),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((x) => x),
}))

const { searchMemories } = require('@/lib/memory.search')

describe('POST /api/v1/contact/{contactId}/memory/search', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockContact = {
    id: 'contact_abc',
    userId: 'user_123',
  }

  const mockMemories = [
    { id: 'mem_1', text: 'User prefers tea over coffee' },
    { id: 'mem_2', text: 'User mentioned enjoying hiking' },
  ]

  beforeEach(() => {
    mockReset(prisma)
    searchMemories.mockResolvedValue(mockMemories)
    prisma.contact.findUniqueByIdentifier.mockResolvedValue(mockContact)
  })

  describe('authorization', () => {
    it('should return 404 when the contact does not exist', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { contactId: 'contact_missing' } }
      const body = { search: 'preferences' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(searchMemories).not.toHaveBeenCalled()
    })

    it('should return 403 when contact belongs to a different user', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        id: 'contact_abc',
        userId: 'other_user_999',
      })

      const req = { query: { contactId: 'contact_abc' } }
      const body = { search: 'preferences' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(403)
      expect(searchMemories).not.toHaveBeenCalled()
    })

    it('should return 200 for the contact owner', async () => {
      const req = { query: { contactId: 'contact_abc' } }
      const body = { search: 'preferences' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
    })
  })

  describe('search execution', () => {
    it('should call searchMemories with session user, search query, contactId, take 50, and limit 10', async () => {
      const req = { query: { contactId: 'contact_abc' } }
      const body = { search: 'favorite food' }

      await handler(req, mockSession, body)

      expect(searchMemories).toHaveBeenCalledWith(
        mockSession.user,
        'favorite food',
        {
          contactId: 'contact_abc',
          take: 50,
          limit: 10,
        }
      )
    })

    it('should return the items from searchMemories in the response body', async () => {
      const req = { query: { contactId: 'contact_abc' } }
      const body = { search: 'hobbies' }

      const result = await handler(req, mockSession, body)

      const responseBody = await result.json()

      expect(responseBody.items).toHaveLength(2)
      expect(responseBody.items[0].id).toBe('mem_1')
      expect(responseBody.items[1].id).toBe('mem_2')
    })

    it('should return an empty items array when searchMemories returns nothing', async () => {
      searchMemories.mockResolvedValue([])

      const req = { query: { contactId: 'contact_abc' } }
      const body = { search: 'nonexistent topic' }

      const result = await handler(req, mockSession, body)

      const responseBody = await result.json()

      expect(responseBody.items).toHaveLength(0)
    })

    it('should use the contact internal id (not the URL contactId) when calling searchMemories', async () => {
      // @note the contact record stores its own internal id separate from the URL param
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        id: 'internal_contact_id_xyz',
        userId: 'user_123',
      })

      const req = { query: { contactId: 'url-param-id' } }
      const body = { search: 'preferences' }

      await handler(req, mockSession, body)

      expect(searchMemories).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ contactId: 'internal_contact_id_xyz' })
      )
    })
  })

  describe('prisma lookup', () => {
    it('should look up the contact by session user and contactId from URL', async () => {
      const req = { query: { contactId: 'contact_abc' } }
      const body = { search: 'test' }

      await handler(req, mockSession, body)

      expect(prisma.contact.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'contact_abc',
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            userId: true,
          }),
        })
      )
    })
  })

  describe('error handling', () => {
    it('should propagate errors from the contact lookup', async () => {
      prisma.contact.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB connection lost')
      )

      const req = { query: { contactId: 'contact_abc' } }
      const body = { search: 'test' }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'DB connection lost'
      )
    })

    it('should propagate errors from searchMemories', async () => {
      searchMemories.mockRejectedValue(
        new Error('Embedding service unavailable')
      )

      const req = { query: { contactId: 'contact_abc' } }
      const body = { search: 'test' }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Embedding service unavailable'
      )
    })
  })
})

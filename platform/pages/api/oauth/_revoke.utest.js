/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './revoke'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    oAuthApplicationToken: {
      findUnique: jest.fn(),
      delete: jest.fn(),
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
  const actual = jest.requireActual('@/lib/joi.handler')

  return {
    __esModule: true,
    ...actual,
    withSchema: (_, fn) => fn,
  }
})

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

describe('OAuth revoke handler', () => {
  const mockSession = { user: { id: 'user_owner' } }
  const req = {}

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('token not found', () => {
    it('returns 404 when the token does not exist', async () => {
      prisma.oAuthApplicationToken.findUnique.mockResolvedValue(null)

      const result = await handler(req, mockSession, {
        id: 'token_nonexistent',
      })

      expect(result.status).toBe(404)
    })

    it('does not attempt to delete a non-existent token', async () => {
      prisma.oAuthApplicationToken.findUnique.mockResolvedValue(null)

      await handler(req, mockSession, { id: 'token_xyz' })

      expect(prisma.oAuthApplicationToken.delete).not.toHaveBeenCalled()
    })

    it('looks up the token by the provided id', async () => {
      prisma.oAuthApplicationToken.findUnique.mockResolvedValue(null)

      await handler(req, mockSession, { id: 'token_abc' })

      expect(prisma.oAuthApplicationToken.findUnique).toHaveBeenCalledWith({
        where: { id: 'token_abc' },
      })
    })
  })

  describe('ownership enforcement', () => {
    it('returns 403 when the token belongs to a different user', async () => {
      prisma.oAuthApplicationToken.findUnique.mockResolvedValue({
        id: 'token_123',
        userId: 'user_other',
      })

      const result = await handler(req, mockSession, { id: 'token_123' })

      expect(result.status).toBe(403)
    })

    it('does not delete the token when the requester is not the owner', async () => {
      prisma.oAuthApplicationToken.findUnique.mockResolvedValue({
        id: 'token_123',
        userId: 'user_other',
      })

      await handler(req, mockSession, { id: 'token_123' })

      expect(prisma.oAuthApplicationToken.delete).not.toHaveBeenCalled()
    })

    it('allows revocation by the token owner', async () => {
      const token = { id: 'token_123', userId: 'user_owner' }

      prisma.oAuthApplicationToken.findUnique.mockResolvedValue(token)
      prisma.oAuthApplicationToken.delete.mockResolvedValue(token)

      const result = await handler(req, mockSession, { id: 'token_123' })

      expect(result.status).toBe(200)
    })
  })

  describe('successful revocation', () => {
    it('deletes the token with the correct id', async () => {
      const token = { id: 'token_123', userId: 'user_owner' }

      prisma.oAuthApplicationToken.findUnique.mockResolvedValue(token)
      prisma.oAuthApplicationToken.delete.mockResolvedValue(token)

      await handler(req, mockSession, { id: 'token_123' })

      expect(prisma.oAuthApplicationToken.delete).toHaveBeenCalledWith({
        where: { id: 'token_123' },
      })
    })

    it('returns the revoked token id in the response', async () => {
      const token = { id: 'token_123', userId: 'user_owner' }

      prisma.oAuthApplicationToken.findUnique.mockResolvedValue(token)
      prisma.oAuthApplicationToken.delete.mockResolvedValue(token)

      const result = await handler(req, mockSession, { id: 'token_123' })

      expect(result.body.id).toBe('token_123')
    })
  })
})

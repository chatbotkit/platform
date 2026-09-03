/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { canManipulateSecret } from '@/lib/secret.access'
import { mintSecret } from '@/lib/secret.mint'

import handler from './mint'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    secret: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({ withPost: (fn) => fn }))

jest.mock('@/lib/session.handler', () => ({ withSession: (fn) => fn }))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/secret.access', () => ({ canManipulateSecret: jest.fn() }))

jest.mock('@/lib/secret.mint', () => ({ mintSecret: jest.fn() }))

describe('/api/v1/secret/[secretId]/mint', () => {
  const session = { user: { id: 'user-1' } }

  const req = { query: { secretId: 'secret-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when the secret does not exist', async () => {
    prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result.status).toBe(404)
    expect(mintSecret).not.toHaveBeenCalled()
  })

  it('returns 403 when the user is not the owner (mint is owner-only)', async () => {
    prisma.secret.findUniqueByIdentifier.mockResolvedValue({
      id: 'secret-1',
      userId: 'other-user',
    })

    canManipulateSecret.mockResolvedValue(false)

    const result = await handler(req, session)

    expect(result.status).toBe(403)
    expect(mintSecret).not.toHaveBeenCalled()
  })

  it('delegates to mintSecret for the owner', async () => {
    const secret = { id: 'secret-1', userId: 'user-1' }

    prisma.secret.findUniqueByIdentifier.mockResolvedValue(secret)

    canManipulateSecret.mockResolvedValue(true)

    const sentinel = { status: 200 }

    mintSecret.mockResolvedValue(sentinel)

    const result = await handler(req, session)

    expect(mintSecret).toHaveBeenCalledWith(secret)
    expect(result).toBe(sentinel)
  })
})

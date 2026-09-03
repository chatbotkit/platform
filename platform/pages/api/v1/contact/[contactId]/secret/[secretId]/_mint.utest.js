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
    contact: {
      findUniqueByIdentifier: jest.fn(),
    },
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

describe('/api/v1/contact/[contactId]/secret/[secretId]/mint', () => {
  const session = { user: { id: 'user-1' } }

  const req = { query: { contactId: 'contact-1', secretId: 'secret-1' } }

  const contact = { id: 'contact-1', userId: 'user-1' }
  const secret = { id: 'secret-1', userId: 'user-1' }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when the contact does not exist', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result.status).toBe(404)
    expect(mintSecret).not.toHaveBeenCalled()
  })

  it('returns 403 when the contact belongs to another user', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue({
      id: 'contact-1',
      userId: 'other-user',
    })

    const result = await handler(req, session)

    expect(result.status).toBe(403)
    expect(mintSecret).not.toHaveBeenCalled()
  })

  it('returns 404 when the secret does not exist', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue(contact)
    prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result.status).toBe(404)
    expect(mintSecret).not.toHaveBeenCalled()
  })

  it('returns 403 when the user is not the owner', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue(contact)
    prisma.secret.findUniqueByIdentifier.mockResolvedValue(secret)

    canManipulateSecret.mockResolvedValue(false)

    const result = await handler(req, session)

    expect(result.status).toBe(403)
    expect(mintSecret).not.toHaveBeenCalled()
  })

  it('delegates to mintSecret with the contact', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue(contact)
    prisma.secret.findUniqueByIdentifier.mockResolvedValue(secret)

    canManipulateSecret.mockResolvedValue(true)

    const sentinel = { status: 200 }

    mintSecret.mockResolvedValue(sentinel)

    const result = await handler(req, session)

    expect(mintSecret).toHaveBeenCalledWith(secret, { contact })
    expect(result).toBe(sentinel)
  })
})

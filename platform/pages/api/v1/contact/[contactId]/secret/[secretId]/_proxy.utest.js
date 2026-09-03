/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { canUseSecret } from '@/lib/secret.access'
import { executeSecretProxy } from '@/lib/secret.proxy'

import handler from './proxy'

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

jest.mock('@/lib/joi.handler', () => {
  const schema = new Proxy(function () {}, {
    get: () => () => schema,
    apply: () => schema,
  })

  return { __esModule: true, default: schema, withSchema: (_schema, fn) => fn }
})

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/secret.access', () => ({ canUseSecret: jest.fn() }))

jest.mock('@/lib/secret.proxy', () => ({ executeSecretProxy: jest.fn() }))

describe('/api/v1/contact/[contactId]/secret/[secretId]/proxy', () => {
  const session = { user: { id: 'user-1' } }

  const req = { query: { contactId: 'contact-1', secretId: 'secret-1' } }

  const body = { method: 'GET', url: 'https://api.example.com', headers: {} }

  const contact = { id: 'contact-1', userId: 'user-1' }
  const secret = { id: 'secret-1', userId: 'user-1' }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when the contact does not exist', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, body)

    expect(result.status).toBe(404)
    expect(executeSecretProxy).not.toHaveBeenCalled()
  })

  it('returns 403 when the contact belongs to another user', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue({
      id: 'contact-1',
      userId: 'other-user',
    })

    const result = await handler(req, session, body)

    expect(result.status).toBe(403)
    expect(executeSecretProxy).not.toHaveBeenCalled()
  })

  it('returns 404 when the secret does not exist', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue(contact)
    prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, body)

    expect(result.status).toBe(404)
    expect(executeSecretProxy).not.toHaveBeenCalled()
  })

  it('returns 403 when the user cannot use the secret', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue(contact)
    prisma.secret.findUniqueByIdentifier.mockResolvedValue(secret)

    canUseSecret.mockResolvedValue(false)

    const result = await handler(req, session, body)

    expect(result.status).toBe(403)
    expect(executeSecretProxy).not.toHaveBeenCalled()
  })

  it('delegates to executeSecretProxy with the contact', async () => {
    prisma.contact.findUniqueByIdentifier.mockResolvedValue(contact)
    prisma.secret.findUniqueByIdentifier.mockResolvedValue(secret)

    canUseSecret.mockResolvedValue(true)

    const sentinel = { status: 200 }

    executeSecretProxy.mockResolvedValue(sentinel)

    const result = await handler(req, session, body)

    expect(executeSecretProxy).toHaveBeenCalledWith('user-1', secret, body, {
      contact,
    })
    expect(result).toBe(sentinel)
  })
})

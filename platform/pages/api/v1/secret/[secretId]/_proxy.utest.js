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

describe('/api/v1/secret/[secretId]/proxy', () => {
  const session = { user: { id: 'user-1' } }

  const req = { query: { secretId: 'secret-1' } }

  const body = { method: 'GET', url: 'https://api.example.com', headers: {} }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when the secret does not exist', async () => {
    prisma.secret.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, body)

    expect(result.status).toBe(404)
    expect(executeSecretProxy).not.toHaveBeenCalled()
  })

  it('returns 403 when the user cannot use the secret', async () => {
    prisma.secret.findUniqueByIdentifier.mockResolvedValue({
      id: 'secret-1',
      userId: 'user-1',
    })

    canUseSecret.mockResolvedValue(false)

    const result = await handler(req, session, body)

    expect(result.status).toBe(403)
    expect(executeSecretProxy).not.toHaveBeenCalled()
  })

  it('delegates to executeSecretProxy when access is granted', async () => {
    const secret = { id: 'secret-1', userId: 'user-1' }

    prisma.secret.findUniqueByIdentifier.mockResolvedValue(secret)

    canUseSecret.mockResolvedValue(true)

    const sentinel = { status: 200 }

    executeSecretProxy.mockResolvedValue(sentinel)

    const result = await handler(req, session, body)

    expect(executeSecretProxy).toHaveBeenCalledWith('user-1', secret, body)
    expect(result).toBe(sentinel)
  })
})

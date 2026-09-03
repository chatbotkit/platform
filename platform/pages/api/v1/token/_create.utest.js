/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import { digestCredential } from '@/lib/credential.digest'

import handler from './create'

import crypto from 'crypto'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      token: {
        create: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withUserSession: (fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
}))

const prisma = require('@/prisma/client').default

describe('POST /api/v1/token/create', () => {
  const session = { user: { id: 'user_1' } }

  const body = {
    name: 'Token Name',
    description: 'Token Description',
    config: { scope: 'read' },
    meta: { source: 'test' },
  }

  beforeEach(() => {
    jest.clearAllMocks()

    crypto.randomBytes.mockReturnValue(Buffer.from('abcd'))
    prisma.token.create.mockResolvedValue({
      id: 'token_1',
      token: 'sk-61626364',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    })
  })

  it('creates token for authenticated user and returns id token and createdAt', async () => {
    const result = await handler({}, session, body)

    expect(prisma.token.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        name: 'Token Name',
        description: 'Token Description',
        config: { scope: 'read' },
        meta: { source: 'test' },
        token: await digestCredential('sk-61626364'),
      }),
      select: {
        id: true,
        createdAt: true,
      },
    })

    expect(result).toEqual({
      status: 200,
      body: {
        id: 'token_1',
        token: 'sk-61626364',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    })
  })

  it('propagates prisma create errors', async () => {
    prisma.token.create.mockRejectedValue(new Error('create failed'))

    await expect(handler({}, session, body)).rejects.toThrow('create failed')
  })
})

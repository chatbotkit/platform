/**
 * @jest-environment node
 */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/prisma/client', () => {
  const { mockDeep } = require('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

describe('POST /api/v1/oauth/connection/create', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  it('should accept blank configuration fields in the request body', async () => {
    await expect(
      bodySchema.validateAsync({
        name: 'OAuth Connection',
        description: 'Test',
        issuer: '',
        clientId: '',
        clientSecret: '',
      })
    ).resolves.toBeDefined()
  })

  it('should normalize blank credential fields to null when creating the resource', async () => {
    prisma.oAuthConnection.create.mockResolvedValue({ id: 'oauth-123' })

    const result = await handler({}, mockSession, {
      name: 'OAuth Connection',
      description: 'Test',
      issuer: '',
      clientId: '',
      clientSecret: '',
    })

    expect(result.status).toBe(200)
    expect(prisma.oAuthConnection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        issuer: null,
        clientId: null,
        clientSecret: null,
      }),
      select: {
        id: true,
      },
    })
  })

  it('should use openid email profile as the default scope when not provided', async () => {
    prisma.oAuthConnection.create.mockResolvedValue({ id: 'oauth-123' })

    await handler({}, mockSession, {
      name: 'OAuth Connection',
      description: 'Test',
    })

    expect(prisma.oAuthConnection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scopes: 'openid email profile',
      }),
      select: expect.any(Object),
    })
  })

  it('should use the caller-provided scopes when explicitly set', async () => {
    prisma.oAuthConnection.create.mockResolvedValue({ id: 'oauth-123' })

    await handler({}, mockSession, {
      name: 'OAuth Connection',
      description: 'Test',
      scopes: 'openid profile',
    })

    expect(prisma.oAuthConnection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scopes: 'openid profile',
      }),
      select: expect.any(Object),
    })
  })

  it('should return the created connection id', async () => {
    prisma.oAuthConnection.create.mockResolvedValue({ id: 'oauth-new-456' })

    const result = await handler({}, mockSession, {
      name: 'OAuth Connection',
      description: 'Test',
    })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ id: 'oauth-new-456' })
  })
})

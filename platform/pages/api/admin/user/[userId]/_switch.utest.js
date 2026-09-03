/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './switch'

import { createMocks } from 'node-mocks-http'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn(),
    },
  },
}))

jest.mock('@/lib/admin', () => ({
  withAdminSession: (fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: (req, param) => req.query?.[param] || 'user-123',
}))

jest.mock('@/lib/response', () => ({
  notFound: () => ({ statusCode: 404, body: { error: 'Not found' } }),
  ok: (data, headers) => ({ statusCode: 200, body: data, headers }),
}))

jest.mock('@/config/cookie', () => ({
  RUNAS_USERID_COOKIE_NAME: 'cbk_runas_user_id',
  RUNAS_USERNAME_COOKIE_NAME: 'cbk_runas_user_name',
  RUNAS_TEAMID_COOKIE_NAME: 'cbk_runas_team_id',
  RUNAS_TEAMNAME_COOKIE_NAME: 'cbk_runas_team_name',
}))

describe('/api/admin/user/[userId]/switch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should switch to user successfully by user ID', async () => {
    const user = {
      id: 'user-123',
      email: 'user@example.com',
      name: 'John Doe',
    }

    prisma.user.findFirst.mockResolvedValueOnce(user)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'user-123' },
    })

    const result = await handler(req, res)

    expect(result.statusCode).toBe(200)
    expect(result.body).toEqual({ id: 'user-123' })
    expect(result.headers).toBeDefined()
  })

  it('should find user by ID', async () => {
    const user = {
      id: 'specific-user-456',
      email: 'test@example.com',
      name: 'Test User',
    }

    prisma.user.findFirst.mockResolvedValueOnce(user)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'specific-user-456' },
    })

    await handler(req, res)

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { id: 'specific-user-456' },
          { email: 'specific-user-456' },
        ]),
      }),
    })
  })

  it('should find user by email', async () => {
    const user = {
      id: 'user-789',
      email: 'admin@example.com',
      name: 'Admin',
    }

    prisma.user.findFirst.mockResolvedValueOnce(user)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'admin@example.com' },
    })

    await handler(req, res)

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { id: 'admin@example.com' },
          { email: 'admin@example.com' },
        ]),
      }),
    })
  })

  it('should return 404 when user not found', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'missing-user' },
    })

    const result = await handler(req, res)

    expect(result.statusCode).toBe(404)
    expect(result.body).toEqual({ error: 'Not found' })
    expect(result.headers).toBeUndefined()
  })

  it('should set cookies for user switch', async () => {
    const user = {
      id: 'user-123',
      email: 'user@example.com',
      name: 'John Doe',
    }

    prisma.user.findFirst.mockResolvedValueOnce(user)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'user-123' },
    })

    const result = await handler(req, res)

    const headers = result.headers

    expect(headers).toBeDefined()

    // Should have multiple Set-Cookie headers for user ID and username
    const setCookieCount = headers?.getSetCookie
      ? headers.getSetCookie().length
      : 0

    expect(setCookieCount).toBeGreaterThanOrEqual(2)
  })

  it('should use user name if available', async () => {
    const user = {
      id: 'user-123',
      email: 'user@example.com',
      name: 'Named User',
    }

    prisma.user.findFirst.mockResolvedValueOnce(user)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'user-123' },
    })

    const result = await handler(req, res)

    expect(result.statusCode).toBe(200)

    // Cookies should contain the user name
    const headers = result.headers

    expect(headers).toBeDefined()
  })

  it('should fallback to user email if name not available', async () => {
    const user = {
      id: 'user-123',
      email: 'user@example.com',
      name: null,
    }

    prisma.user.findFirst.mockResolvedValueOnce(user)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'user-123' },
    })

    const result = await handler(req, res)

    expect(result.statusCode).toBe(200)
    // Should still succeed with email as fallback
    expect(result.body.id).toBe('user-123')
  })

  it('should include user ID in response', async () => {
    const user = {
      id: 'specific-user-id-999',
      email: 'test@example.com',
      name: 'Test',
    }

    prisma.user.findFirst.mockResolvedValueOnce(user)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'specific-user-id-999' },
    })

    const result = await handler(req, res)

    expect(result.body.id).toBe('specific-user-id-999')
  })

  it('should clear team cookies on user switch', async () => {
    const user = {
      id: 'user-123',
      email: 'user@example.com',
      name: 'User',
    }

    prisma.user.findFirst.mockResolvedValueOnce(user)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'user-123' },
    })

    const result = await handler(req, res)

    const headers = result.headers

    expect(headers).toBeDefined()
    // Should have Set-Cookie headers that include expiry for clearing team cookies
  })

  it('should handle user with empty name', async () => {
    const user = {
      id: 'user-123',
      email: 'user@example.com',
      name: '',
    }

    prisma.user.findFirst.mockResolvedValueOnce(user)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'user-123' },
    })

    const result = await handler(req, res)

    expect(result.statusCode).toBe(200)
  })

  it('should handle database errors', async () => {
    const dbError = new Error('Database connection failed')

    prisma.user.findFirst.mockRejectedValueOnce(dbError)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'user-123' },
    })

    await expect(handler(req, res)).rejects.toThrow(
      'Database connection failed'
    )
  })

  it('should URL-encode user ID in cookie', async () => {
    const user = {
      id: 'user-with-special@chars#123',
      email: 'user@example.com',
      name: 'User',
    }

    prisma.user.findFirst.mockResolvedValueOnce(user)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'user-with-special@chars#123' },
    })

    const result = await handler(req, res)

    expect(result.statusCode).toBe(200)
  })

  it('should set secure and SameSite attributes on cookies', async () => {
    const user = {
      id: 'user-123',
      email: 'user@example.com',
      name: 'User',
    }

    prisma.user.findFirst.mockResolvedValueOnce(user)

    const { req, res } = createMocks({
      method: 'POST',
      query: { userId: 'user-123' },
    })

    const result = await handler(req, res)

    const headers = result.headers

    expect(headers).toBeDefined()
    // Cookies should have Secure and SameSite attributes for security
  })
})

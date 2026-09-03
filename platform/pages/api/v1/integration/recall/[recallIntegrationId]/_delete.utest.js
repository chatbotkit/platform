/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './delete'

import { createMocks } from 'node-mocks-http'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      recallIntegration: {
        findUniqueByIdentifier: jest.fn(),
        delete: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
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

describe('POST /api/v1/integration/recall/[recallIntegrationId]/delete', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should delete recall integration successfully', async () => {
    const mockIntegration = {
      id: 'recall-integration-123',
      userId: 'user-123',
    }

    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue(
      mockIntegration
    )
    prisma.recallIntegration.delete.mockResolvedValue(mockIntegration)

    const { req } = createMocks({
      method: 'POST',
      query: {
        recallIntegrationId: 'recall-integration-123',
      },
    })

    const result = await handler(req, mockSession)

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ id: 'recall-integration-123' })
    expect(prisma.recallIntegration.delete).toHaveBeenCalledWith({
      where: { id: 'recall-integration-123' },
    })
  })

  it('should return 404 when integration is not found', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const { req } = createMocks({
      method: 'POST',
      query: {
        recallIntegrationId: 'recall-integration-123',
      },
    })

    const result = await handler(req, mockSession)

    expect(result.status).toBe(404)
    expect(prisma.recallIntegration.delete).not.toHaveBeenCalled()
  })

  it('should return 403 when user does not own integration', async () => {
    prisma.recallIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'recall-integration-123',
      userId: 'other-user-456',
    })

    const { req } = createMocks({
      method: 'POST',
      query: {
        recallIntegrationId: 'recall-integration-123',
      },
    })

    const result = await handler(req, mockSession)

    expect(result.status).toBe(403)
    expect(prisma.recallIntegration.delete).not.toHaveBeenCalled()
  })

  it('should return 403 when query param is missing', async () => {
    const { req } = createMocks({
      method: 'POST',
      query: {},
    })

    const result = await handler(req, mockSession)

    expect(result.status).toBe(403)
    expect(prisma.recallIntegration.delete).not.toHaveBeenCalled()
  })
})

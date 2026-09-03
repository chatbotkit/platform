/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { bodySchema } from './update'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const createChainableMock = () => {
    const mock = {
      required: () => mock,
      optional: () => mock,
      allow: () => mock,
      valid: () => mock,
      min: () => mock,
      max: () => mock,
      describe: () => ({ keys: {} }),
    }

    return mock
  }

  const mockSchema = {
    object: (fields) => ({
      ...createChainableMock(),
      describe: () => ({ keys: fields || {} }),
    }),
    string: () => createChainableMock(),
    number: () => createChainableMock(),
    boolean: () => createChainableMock(),
    array: () => createChainableMock(),
  }

  return {
    __esModule: true,
    default: mockSchema,
    withSchema: (schema, fn) => fn,
  }
})

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

describe('/api/v1/me/update', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  describe('bodySchema', () => {
    it('should define required fields', () => {
      expect(bodySchema).toBeDefined()
      expect(bodySchema.describe().keys).toHaveProperty('channel')
      expect(bodySchema.describe().keys).toHaveProperty('organization')
      expect(bodySchema.describe().keys).toHaveProperty('industry')
      expect(bodySchema.describe().keys).toHaveProperty('role')
      expect(bodySchema.describe().keys).toHaveProperty('goal')
    })
  })

  describe('handler', () => {
    const mockRequest = {}
    const mockSession = {
      user: {
        id: 'usr_test123',
      },
    }

    it('should update user with all provided fields', async () => {
      const body = {
        channel: 'web',
        organization: 'Test Corp',
        industry: 'Technology',
        role: 'Developer',
        goal: 'Build AI chatbots',
      }

      prisma.user.update.mockResolvedValue({
        id: 'usr_test123',
        ...body,
      })

      const response = await handler(mockRequest, mockSession, body)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: {
          id: 'usr_test123',
        },
        data: body,
      })

      expect(response).toEqual({
        status: 200,
        body: {
          id: 'usr_test123',
        },
      })
    })

    it('should update user with empty strings', async () => {
      const body = {
        channel: '',
        organization: '',
        industry: '',
        role: '',
        goal: '',
      }

      prisma.user.update.mockResolvedValue({
        id: 'usr_test123',
        ...body,
      })

      await handler(mockRequest, mockSession, body)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: {
          id: 'usr_test123',
        },
        data: body,
      })
    })

    it('should use session user id for update', async () => {
      const differentSession = {
        user: {
          id: 'usr_different456',
        },
      }

      const body = {
        channel: 'mobile',
        organization: 'Another Corp',
        industry: 'Finance',
        role: 'Manager',
        goal: 'Automate support',
      }

      prisma.user.update.mockResolvedValue({
        id: 'usr_different456',
        ...body,
      })

      await handler(mockRequest, differentSession, body)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: {
          id: 'usr_different456',
        },
        data: body,
      })
    })

    it('should return user id on success', async () => {
      const body = {
        channel: 'slack',
        organization: 'Test Org',
        industry: 'Education',
        role: 'Teacher',
        goal: 'Educational assistant',
      }

      prisma.user.update.mockResolvedValue({
        id: 'usr_test123',
        ...body,
      })

      const response = await handler(mockRequest, mockSession, body)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        id: 'usr_test123',
      })
    })

    it('should handle database errors', async () => {
      const body = {
        channel: 'web',
        organization: 'Test Corp',
        industry: 'Technology',
        role: 'Developer',
        goal: 'Build AI chatbots',
      }

      prisma.user.update.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(handler(mockRequest, mockSession, body)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should update only provided fields in body', async () => {
      const body = {
        channel: 'email',
        organization: 'New Org',
        industry: 'Healthcare',
        role: 'Engineer',
        goal: 'Patient support bot',
      }

      prisma.user.update.mockResolvedValue({
        id: 'usr_test123',
        ...body,
      })

      await handler(mockRequest, mockSession, body)

      expect(prisma.user.update).toHaveBeenCalledTimes(1)

      const callArgs = prisma.user.update.mock.calls[0][0]

      expect(callArgs.data).toEqual(body)
    })

    it('should handle special characters in text fields', async () => {
      const body = {
        channel: 'web',
        organization: 'Test & Co. "Quoted"',
        industry: "Tech's Best",
        role: 'Senior <Developer>',
        goal: 'Build bots with "AI" & automation',
      }

      prisma.user.update.mockResolvedValue({
        id: 'usr_test123',
        ...body,
      })

      await handler(mockRequest, mockSession, body)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: {
          id: 'usr_test123',
        },
        data: body,
      })
    })

    it('should handle long goal text', async () => {
      const longGoal = 'A'.repeat(1000)
      const body = {
        channel: 'web',
        organization: 'Test Corp',
        industry: 'Technology',
        role: 'Developer',
        goal: longGoal,
      }

      prisma.user.update.mockResolvedValue({
        id: 'usr_test123',
        ...body,
      })

      await handler(mockRequest, mockSession, body)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: {
          id: 'usr_test123',
        },
        data: expect.objectContaining({
          goal: longGoal,
        }),
      })
    })
  })
})

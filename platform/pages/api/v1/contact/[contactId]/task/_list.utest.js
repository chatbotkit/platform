/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './list'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    contact: {
      findUniqueByIdentifier: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/filter', () => ({
  getMetaQueryFilter: jest.fn(() => []),
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({})),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: () => {
    throw new Error('Not found')
  },
  throwNotAuthorized: () => {
    throw new Error('Not authorized')
  },
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: (data) => data,
}))

const {
  getMetaQueryFilter,
  getCursorConstraints,
  getTakeConstraints,
} = require('@/lib/filter')

describe('GET /api/v1/contact/{contactId}/task/list', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const makeReq = (contactId) => ({ query: { contactId } })

  beforeEach(() => {
    jest.clearAllMocks()
    getMetaQueryFilter.mockReturnValue([])
    getCursorConstraints.mockReturnValue({})
    getTakeConstraints.mockReturnValue({})
  })

  describe('successful list', () => {
    it('should return tasks belonging to the contact', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        id: 'contact_1',
        userId: 'user_123',
      })

      const mockTasks = [
        {
          id: 'task_1',
          name: 'Weekly check-in',
          description: 'Automated check-in',
          contactId: 'contact_1',
          botId: 'bot_1',
          schedule: '0 9 * * 1',
          timezone: 'America/New_York',
          status: 'idle',
          outcome: 'pending',
          maxIterations: null,
          maxTime: null,
          meta: null,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ]

      prisma.task.findMany.mockResolvedValue(mockTasks)

      const result = await handler(
        null,
        makeReq('contact_1'),
        null,
        mockSession
      )

      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('task_1')
      expect(result.items[0].timezone).toBe('America/New_York')
    })

    it('should filter tasks by the resolved contact id', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        id: 'contact_1',
        userId: 'user_123',
      })
      prisma.task.findMany.mockResolvedValue([])

      await handler(null, makeReq('contact_1'), null, mockSession)

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ contactId: 'contact_1' }],
          },
          select: expect.objectContaining({
            schedule: true,
            timezone: true,
            nextRunAt: true,
          }),
        })
      )
    })

    it('should return an empty items array when contact has no tasks', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        id: 'contact_1',
        userId: 'user_123',
      })
      prisma.task.findMany.mockResolvedValue([])

      const result = await handler(
        null,
        makeReq('contact_1'),
        null,
        mockSession
      )

      expect(result.items).toHaveLength(0)
    })

    it('should look up the contact using the session user and requested contactId', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        id: 'contact_1',
        userId: 'user_123',
      })
      prisma.task.findMany.mockResolvedValue([])

      await handler(null, makeReq('contact_1'), null, mockSession)

      expect(prisma.contact.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'contact_1',
        expect.objectContaining({
          select: expect.objectContaining({ id: true, userId: true }),
        })
      )
    })
  })

  describe('authorization', () => {
    it('should throw not found when contact does not exist', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue(null)

      await expect(
        handler(null, makeReq('missing_contact'), null, mockSession)
      ).rejects.toThrow('Not found')

      expect(prisma.task.findMany).not.toHaveBeenCalled()
    })

    it('should throw not authorized when contact belongs to another user', async () => {
      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        id: 'contact_1',
        userId: 'other_user',
      })

      await expect(
        handler(null, makeReq('contact_1'), null, mockSession)
      ).rejects.toThrow('Not authorized')

      expect(prisma.task.findMany).not.toHaveBeenCalled()
    })
  })

  describe('pagination', () => {
    it('should apply cursor and take constraints to the query', async () => {
      getCursorConstraints.mockReturnValue({
        cursor: { id: 'task_1' },
        skip: 1,
      })
      getTakeConstraints.mockReturnValue({ take: 25 })

      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        id: 'contact_1',
        userId: 'user_123',
      })
      prisma.task.findMany.mockResolvedValue([])

      await handler('task_1', makeReq('contact_1'), null, mockSession)

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'task_1' },
          skip: 1,
          take: 25,
        })
      )
    })

    it('should include metadata filter when provided', async () => {
      const metaFilter = [{ meta: { path: ['type'], equals: 'follow-up' } }]

      getMetaQueryFilter.mockReturnValue(metaFilter)

      prisma.contact.findUniqueByIdentifier.mockResolvedValue({
        id: 'contact_1',
        userId: 'user_123',
      })
      prisma.task.findMany.mockResolvedValue([])

      await handler(null, makeReq('contact_1'), null, mockSession)

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ contactId: 'contact_1' }, ...metaFilter],
          },
        })
      )
    })
  })
})

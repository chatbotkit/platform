/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './list'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/filter', () => ({
  getCursorConstraints: jest.fn(() => ({})),
  getTakeConstraints: jest.fn(() => ({ take: 50 })),
  getMetaQueryFilter: jest.fn(() => []),
  getFieldQueryFilter: jest.fn(() => []),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const {
  getCursorConstraints,
  getTakeConstraints,
  getMetaQueryFilter,
  getFieldQueryFilter,
} = require('@/lib/filter')

const { makeJsonSafe } = require('@/lib/struct')

describe('audit/log/list', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  const mockReq = {
    query: {},
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockReset(prisma)
    getCursorConstraints.mockReturnValue({
      orderBy: [{ createdAt: 'desc' }],
    })
    getTakeConstraints.mockReturnValue({ take: 50 })
    getMetaQueryFilter.mockReturnValue([])
    getFieldQueryFilter.mockReturnValue([])
  })

  describe('handler', () => {
    it('should list audit logs for authenticated user', async () => {
      const mockAuditLogs = [
        {
          id: 'log-1',
          name: 'Updated Bot',
          description: 'Modified bot configuration',
          action: 'update',
          botId: 'bot-123',
          createdAt: new Date('2025-01-15T10:00:00Z'),
          updatedAt: new Date('2025-01-15T10:00:00Z'),
        },
        {
          id: 'log-2',
          name: 'Created Dataset',
          description: 'New dataset added',
          action: 'create',
          datasetId: 'dataset-456',
          createdAt: new Date('2025-01-14T09:00:00Z'),
          updatedAt: new Date('2025-01-14T09:00:00Z'),
        },
      ]

      prisma.auditLog.findMany.mockResolvedValue(mockAuditLogs)

      const result = await handler(null, mockReq, null, mockSession)

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user-123' }]),
          }),
        })
      )
      expect(result).toEqual({ items: mockAuditLogs })
    })

    it('should filter audit logs by userId', async () => {
      prisma.auditLog.findMany.mockResolvedValue([])

      await handler(null, mockReq, null, mockSession)

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ userId: 'user-123' }]),
          }),
        })
      )
    })

    it('should apply meta query filters', async () => {
      const mockMetaFilter = [{ meta: { path: 'tier', equals: 'premium' } }]

      getMetaQueryFilter.mockReturnValue(mockMetaFilter)
      prisma.auditLog.findMany.mockResolvedValue([])

      const req = { query: { 'meta[tier]': 'premium' } }

      await handler(null, req, null, mockSession)

      expect(getMetaQueryFilter).toHaveBeenCalledWith(req)
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining(mockMetaFilter),
          }),
        })
      )
    })

    it('should apply field query filters', async () => {
      const mockFieldFilter = [{ action: 'update' }]

      getFieldQueryFilter.mockReturnValue(mockFieldFilter)
      prisma.auditLog.findMany.mockResolvedValue([])

      const req = { query: { action: 'update' } }

      await handler(null, req, null, mockSession)

      expect(getFieldQueryFilter).toHaveBeenCalledWith(
        req,
        expect.arrayContaining([
          'action',
          'blueprintId',
          'botId',
          'datasetId',
          'recordId',
          'skillsetId',
          'abilityId',
          'fileId',
          'secretId',
          'portalId',
          'webhookId',
          'sessionId',
        ])
      )
    })

    it('should apply cursor constraints for pagination', async () => {
      prisma.auditLog.findMany.mockResolvedValue([])

      await handler('cursor-123', mockReq, null, mockSession)

      expect(getCursorConstraints).toHaveBeenCalledWith(mockReq, 'cursor-123')
    })

    it('should apply take constraints for pagination', async () => {
      const mockTakeConstraints = { take: 100 }

      getTakeConstraints.mockReturnValue(mockTakeConstraints)
      prisma.auditLog.findMany.mockResolvedValue([])

      const req = { query: { take: '100' } }

      await handler(null, req, null, mockSession)

      expect(getTakeConstraints).toHaveBeenCalledWith(req)
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining(mockTakeConstraints)
      )
    })

    it('should select all required audit log fields', async () => {
      prisma.auditLog.findMany.mockResolvedValue([])

      await handler(null, mockReq, null, mockSession)

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            name: true,
            description: true,
            blueprintId: true,
            botId: true,
            datasetId: true,
            recordId: true,
            skillsetId: true,
            abilityId: true,
            fileId: true,
            secretId: true,
            portalId: true,
            webhookId: true,
            sessionId: true,
            action: true,
            oldValues: true,
            newValues: true,
            ipAddress: true,
            userAgent: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )
    })

    it('should make result JSON safe', async () => {
      const mockAuditLogs = [{ id: 'log-1', name: 'Test Log' }]

      prisma.auditLog.findMany.mockResolvedValue(mockAuditLogs)

      await handler(null, mockReq, null, mockSession)

      expect(makeJsonSafe).toHaveBeenCalledWith(mockAuditLogs)
    })
  })

  describe('error handling', () => {
    it('should propagate database errors', async () => {
      const dbError = new Error('Database connection failed')

      prisma.auditLog.findMany.mockRejectedValueOnce(dbError)

      await expect(handler(null, mockReq, null, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle filter function errors', async () => {
      const filterError = new Error('Invalid filter format')

      getFieldQueryFilter.mockImplementationOnce(() => {
        throw filterError
      })

      await expect(handler(null, mockReq, null, mockSession)).rejects.toThrow(
        'Invalid filter format'
      )
    })
  })
})

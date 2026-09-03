/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler from './detach'

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

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: (req, param) => req.query[param],
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

describe('/api/v1/integration/widget/[widgetIntegrationId]/file/[fileId]/detach', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  beforeEach(() => {
    mockReset(prisma)
  })

  describe('basic functionality', () => {
    it('should detach file from widget integration', async () => {
      const mockAttachment = {
        widgetIntegrationId: 'widget_123',
        fileId: 'file_456',
        type: 'avatar',
        widgetIntegration: {
          id: 'widget_123',
          userId: 'user_123',
        },
        file: {
          id: 'file_456',
          userId: 'user_123',
        },
      }

      prisma.widgetIntegrationFileAttachment.findFirst.mockResolvedValue(
        mockAttachment
      )
      prisma.widgetIntegrationFileAttachment.delete.mockResolvedValue(
        mockAttachment
      )

      const req = {
        query: {
          widgetIntegrationId: 'widget_123',
          fileId: 'file_456',
        },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('file_456')
      expect(result.body.type).toBe('avatar')
      expect(result.body.widgetIntegrationId).toBe('widget_123')

      expect(
        prisma.widgetIntegrationFileAttachment.findFirst
      ).toHaveBeenCalledWith({
        where: {
          widgetIntegrationId: 'widget_123',
          fileId: 'file_456',
        },
        include: {
          widgetIntegration: true,
          file: true,
        },
      })

      expect(
        prisma.widgetIntegrationFileAttachment.delete
      ).toHaveBeenCalledWith({
        where: {
          widgetIntegrationId_type: {
            widgetIntegrationId: 'widget_123',
            type: 'avatar',
          },
        },
      })
    })
  })

  describe('error handling', () => {
    it('should return 404 when attachment not found', async () => {
      prisma.widgetIntegrationFileAttachment.findFirst.mockResolvedValue(null)

      const req = {
        query: {
          widgetIntegrationId: 'widget_123',
          fileId: 'file_456',
        },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when widget integration user does not match session user', async () => {
      const mockAttachment = {
        widgetIntegrationId: 'widget_123',
        fileId: 'file_456',
        type: 'avatar',
        widgetIntegration: {
          id: 'widget_123',
          userId: 'other_user',
        },
        file: {
          id: 'file_456',
          userId: 'user_123',
        },
      }

      prisma.widgetIntegrationFileAttachment.findFirst.mockResolvedValue(
        mockAttachment
      )

      const req = {
        query: {
          widgetIntegrationId: 'widget_123',
          fileId: 'file_456',
        },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(
        prisma.widgetIntegrationFileAttachment.delete
      ).not.toHaveBeenCalled()
    })

    it('should return 404 when file not found', async () => {
      const mockAttachment = {
        widgetIntegrationId: 'widget_123',
        fileId: 'file_456',
        type: 'avatar',
        widgetIntegration: {
          id: 'widget_123',
          userId: 'user_123',
        },
        file: null,
      }

      prisma.widgetIntegrationFileAttachment.findFirst.mockResolvedValue(
        mockAttachment
      )

      const req = {
        query: {
          widgetIntegrationId: 'widget_123',
          fileId: 'file_456',
        },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
      expect(
        prisma.widgetIntegrationFileAttachment.delete
      ).not.toHaveBeenCalled()
    })

    it('should return 403 when file user does not match session user', async () => {
      const mockAttachment = {
        widgetIntegrationId: 'widget_123',
        fileId: 'file_456',
        type: 'avatar',
        widgetIntegration: {
          id: 'widget_123',
          userId: 'user_123',
        },
        file: {
          id: 'file_456',
          userId: 'other_user',
        },
      }

      prisma.widgetIntegrationFileAttachment.findFirst.mockResolvedValue(
        mockAttachment
      )

      const req = {
        query: {
          widgetIntegrationId: 'widget_123',
          fileId: 'file_456',
        },
      }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
      expect(
        prisma.widgetIntegrationFileAttachment.delete
      ).not.toHaveBeenCalled()
    })
  })
})

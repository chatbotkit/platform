/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { SYNC_EVENT_TYPE, handleSyncEvent, sendEvent } from './queue'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/debug', () => jest.fn())

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: (param, handlers) => handlers,
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: (msg) => {
    throw new Error(msg)
  },
}))

jest.mock('@/lib/error', () => ({
  captureInputError: jest.fn((error) => error),
}))

jest.mock('@/lib/zod.schema', () => ({
  parseAsync: jest.fn((schema, data) => Promise.resolve(data)),
  z: {
    object: () => ({ parse: jest.fn() }),
  },
}))

jest.mock(
  '@/pages/api/v1/integration/sitemap/[sitemapIntegrationId]/sync',
  () => ({
    doSync: jest.fn(),
  })
)

describe('/api/v1/integration/sitemap/[sitemapIntegrationId]/queue', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  describe('handleSyncEvent', () => {
    it('should handle sync event with valid integration', async () => {
      const mockIntegration = {
        id: 'sitemap_123',
        userId: 'user_123',
        user: {
          id: 'user_123',
          email: 'user@example.com',
        },
      }

      prisma.sitemapIntegration.findUnique.mockResolvedValue(mockIntegration)

      const {
        doSync,
      } = require('@/pages/api/v1/integration/sitemap/[sitemapIntegrationId]/sync')

      doSync.mockResolvedValue(undefined)

      const payload = {}

      await handleSyncEvent('sitemap_123', payload)

      expect(prisma.sitemapIntegration.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'sitemap_123',
        },
        include: {
          user: true,
        },
      })

      expect(doSync).toHaveBeenCalledWith(mockIntegration)
    })

    it('should throw not found when integration does not exist', async () => {
      prisma.sitemapIntegration.findUnique.mockResolvedValue(null)

      const payload = {}

      await expect(handleSyncEvent('sitemap_123', payload)).rejects.toThrow(
        'SitemapIntegration not found: sitemap_123'
      )
    })
  })

  describe('sendEvent', () => {
    it('should validate and queue sync event', async () => {
      const queue = require('@/lib/queue')
      const { parseAsync } = require('@/lib/zod.schema')

      parseAsync.mockResolvedValue({})
      queue.mockResolvedValue(undefined)

      const event = {
        type: SYNC_EVENT_TYPE,
        payload: {},
      }

      await sendEvent('sitemap_123', event)

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith(
        '/api/v1/integration/sitemap/sitemap_123/queue',
        event
      )
    })
  })

  describe('handler configuration', () => {
    it('should export handler with correct structure', () => {
      expect(handler).toBeDefined()
      expect(handler[SYNC_EVENT_TYPE]).toBeDefined()
      expect(handler[SYNC_EVENT_TYPE].handler).toBe(handleSyncEvent)
      expect(handler[SYNC_EVENT_TYPE].schema).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty payload in sync event', async () => {
      const mockIntegration = {
        id: 'sitemap_123',
        userId: 'user_123',
        user: {
          id: 'user_123',
          email: 'user@example.com',
        },
      }

      prisma.sitemapIntegration.findUnique.mockResolvedValue(mockIntegration)

      const {
        doSync,
      } = require('@/pages/api/v1/integration/sitemap/[sitemapIntegrationId]/sync')

      doSync.mockResolvedValue(undefined)

      await handleSyncEvent('sitemap_123', {})

      expect(doSync).toHaveBeenCalled()
    })

    it('should handle integration with all fields populated', async () => {
      const mockIntegration = {
        id: 'sitemap_123',
        userId: 'user_123',
        datasetId: 'dataset_456',
        sitemapUrl: 'https://example.com/sitemap.xml',
        user: {
          id: 'user_123',
          email: 'user@example.com',
          name: 'Test User',
        },
      }

      prisma.sitemapIntegration.findUnique.mockResolvedValue(mockIntegration)

      const {
        doSync,
      } = require('@/pages/api/v1/integration/sitemap/[sitemapIntegrationId]/sync')

      doSync.mockResolvedValue(undefined)

      await handleSyncEvent('sitemap_123', {})

      expect(doSync).toHaveBeenCalledWith(mockIntegration)
    })
  })
})

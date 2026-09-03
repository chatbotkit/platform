/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import handler, { SYNC_EVENT_TYPE, handleSyncEvent, sendEvent } from './queue'

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

jest.mock('@/prisma/client', () => {
  const { mockDeep } = require('jest-mock-extended')

  return {
    __esModule: true,
    default: mockDeep(),
  }
})

jest.mock('@/lib/debug', () => jest.fn())

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: (_param, handlers) => handlers,
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
  parseAsync: jest.fn((_schema, data) => Promise.resolve(data)),
}))

jest.mock(
  '@/pages/api/v1/integration/notion/[notionIntegrationId]/sync',
  () => ({
    doSync: jest.fn(),
  })
)

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

beforeEach(() => {
  mockReset(prisma)
  jest.clearAllMocks()
})

// =============================================================================
// handleSyncEvent
// =============================================================================

describe('handleSyncEvent', () => {
  it('should call doSync with the found integration', async () => {
    const mockIntegration = {
      id: 'notion-123',
      userId: 'user-456',
      datasetId: 'dataset-789',
      user: {
        id: 'user-456',
        email: 'user@example.com',
      },
    }

    prisma.notionIntegration.findUnique.mockResolvedValue(mockIntegration)

    const {
      doSync,
    } = require('@/pages/api/v1/integration/notion/[notionIntegrationId]/sync')

    doSync.mockResolvedValue(undefined)

    await handleSyncEvent('notion-123', {})

    expect(prisma.notionIntegration.findUnique).toHaveBeenCalledWith({
      where: { id: 'notion-123' },
      include: { user: true },
    })

    expect(doSync).toHaveBeenCalledWith(mockIntegration)
  })

  it('should throw not found when integration does not exist', async () => {
    prisma.notionIntegration.findUnique.mockResolvedValue(null)

    await expect(handleSyncEvent('notion-missing', {})).rejects.toThrow(
      'NotionIntegration not found: notion-missing'
    )

    expect(prisma.notionIntegration.findUnique).toHaveBeenCalledWith({
      where: { id: 'notion-missing' },
      include: { user: true },
    })
  })

  it('should not call doSync when integration is not found', async () => {
    prisma.notionIntegration.findUnique.mockResolvedValue(null)

    const {
      doSync,
    } = require('@/pages/api/v1/integration/notion/[notionIntegrationId]/sync')

    await expect(handleSyncEvent('notion-missing', {})).rejects.toThrow()

    expect(doSync).not.toHaveBeenCalled()
  })

  it('should propagate errors thrown by doSync', async () => {
    const mockIntegration = {
      id: 'notion-123',
      userId: 'user-456',
      user: { id: 'user-456' },
    }

    prisma.notionIntegration.findUnique.mockResolvedValue(mockIntegration)

    const {
      doSync,
    } = require('@/pages/api/v1/integration/notion/[notionIntegrationId]/sync')

    doSync.mockRejectedValue(new Error('Notion API error'))

    await expect(handleSyncEvent('notion-123', {})).rejects.toThrow(
      'Notion API error'
    )
  })

  it('should pass full integration record (including user) to doSync', async () => {
    const mockIntegration = {
      id: 'notion-abc',
      userId: 'user-xyz',
      datasetId: 'dataset-001',
      accessToken: 'secret-token',
      user: {
        id: 'user-xyz',
        email: 'owner@example.com',
        name: 'Owner Name',
      },
    }

    prisma.notionIntegration.findUnique.mockResolvedValue(mockIntegration)

    const {
      doSync,
    } = require('@/pages/api/v1/integration/notion/[notionIntegrationId]/sync')

    doSync.mockResolvedValue(undefined)

    await handleSyncEvent('notion-abc', {})

    expect(doSync).toHaveBeenCalledWith(mockIntegration)
  })
})

// =============================================================================
// sendEvent
// =============================================================================

describe('sendEvent', () => {
  it('should validate sync payload and enqueue to correct route', async () => {
    const queue = require('@/lib/queue')
    const { parseAsync } = require('@/lib/zod.schema')

    parseAsync.mockResolvedValue({})
    queue.mockResolvedValue(undefined)

    const event = {
      type: SYNC_EVENT_TYPE,
      payload: {},
    }

    await sendEvent('notion-123', event)

    expect(parseAsync).toHaveBeenCalled()
    expect(queue).toHaveBeenCalledWith(
      '/api/v1/integration/notion/notion-123/queue',
      event
    )
  })

  it('should reject when SyncPayloadSchema validation fails', async () => {
    const { parseAsync } = require('@/lib/zod.schema')

    parseAsync.mockRejectedValue(new Error('Validation failed'))

    const event = {
      type: SYNC_EVENT_TYPE,
      payload: { unexpected: 'data' },
    }

    await expect(sendEvent('notion-123', event)).rejects.toThrow(
      'Validation failed'
    )
  })

  it('should use the correct notionIntegrationId in the queue path', async () => {
    const queue = require('@/lib/queue')
    const { parseAsync } = require('@/lib/zod.schema')

    parseAsync.mockResolvedValue({})
    queue.mockResolvedValue(undefined)

    await sendEvent('my-notion-integration', {
      type: SYNC_EVENT_TYPE,
      payload: {},
    })

    expect(queue).toHaveBeenCalledWith(
      '/api/v1/integration/notion/my-notion-integration/queue',
      expect.any(Object)
    )
  })
})

// =============================================================================
// handler configuration
// =============================================================================

describe('handler configuration', () => {
  it('should export a handler object with sync event configuration', () => {
    expect(handler).toBeDefined()
    expect(handler[SYNC_EVENT_TYPE]).toBeDefined()
    expect(handler[SYNC_EVENT_TYPE].handler).toBe(handleSyncEvent)
    expect(handler[SYNC_EVENT_TYPE].schema).toBeDefined()
  })

  it('should export SYNC_EVENT_TYPE as "sync"', () => {
    expect(SYNC_EVENT_TYPE).toBe('sync')
  })
})

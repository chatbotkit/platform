import { getSessionClient } from '@/lib/cbk.sdk'

import { listAll, listLogs } from './server'

// Mock the appActionHandler to be a passthrough that calls the handler directly
jest.mock('@/lib/app.action', () => ({
  appActionHandler:
    (_appName, _configSchema, _paramsSchema, handler) => async (params) => {
      return handler({}, { user: { id: 'user-123' } }, params || {})
    },
  appContactActionHandler:
    (_appName, _ns, _configSchema, _paramsSchema, handler) =>
    async (params) => {
      return handler(
        {},
        { user: { id: 'user-123' } },
        { id: 'contact-123' },
        params || {}
      )
    },
}))

jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(),
}))

jest.mock('@chatbotkit/react/utils/stream', () => ({
  stream: jest.fn((gen) => gen),
}))

describe('eventlog/server', () => {
  let mockClient

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient = {
      event: {
        log: {
          list: jest.fn(),
          subscribe: jest.fn(),
        },
      },
    }

    getSessionClient.mockResolvedValue(mockClient)
  })

  describe('listLogs', () => {
    it('should return items with cursor set to last item id', async () => {
      const mockItems = [
        {
          id: 'log-1',
          type: 'conversation.create',
          createdAt: 1,
          updatedAt: 1,
        },
        { id: 'log-2', type: 'bot.update', createdAt: 2, updatedAt: 2 },
      ]

      mockClient.event.log.list.mockResolvedValue({ items: mockItems })

      const result = await listLogs({})

      expect(result.items).toEqual(mockItems)
      expect(result.cursor).toBe('log-2')
    })

    it('should call SDK with default order and take when not specified', async () => {
      mockClient.event.log.list.mockResolvedValue({ items: [] })

      await listLogs({})

      expect(mockClient.event.log.list).toHaveBeenCalledWith({
        cursor: undefined,
        order: 'desc',
        take: 50,
      })
    })

    it('should pass through custom order, take, and cursor params', async () => {
      mockClient.event.log.list.mockResolvedValue({ items: [] })

      await listLogs({ cursor: 'cursor-abc', order: 'asc', take: 20 })

      expect(mockClient.event.log.list).toHaveBeenCalledWith({
        cursor: 'cursor-abc',
        order: 'asc',
        take: 20,
      })
    })

    it('should return undefined cursor when items array is empty', async () => {
      mockClient.event.log.list.mockResolvedValue({ items: [] })

      const result = await listLogs({})

      expect(result.cursor).toBeUndefined()
    })

    it('should handle missing items in SDK response', async () => {
      mockClient.event.log.list.mockResolvedValue({})

      const result = await listLogs({})

      expect(result.items).toEqual([])
      expect(result.cursor).toBeUndefined()
    })

    it('should handle SDK errors', async () => {
      mockClient.event.log.list.mockRejectedValue(new Error('SDK error'))

      await expect(listLogs({})).rejects.toThrow('SDK error')
    })
  })

  describe('listAll', () => {
    it('should return items with cursor using only cursor param', async () => {
      const mockItems = [
        { id: 'log-a', type: 'test', createdAt: 1, updatedAt: 1 },
      ]

      mockClient.event.log.list.mockResolvedValue({ items: mockItems })

      const result = await listAll({})

      expect(result.items).toEqual(mockItems)
      expect(result.cursor).toBe('log-a')
    })

    it('should default to desc order and take 50', async () => {
      mockClient.event.log.list.mockResolvedValue({ items: [] })

      await listAll({})

      expect(mockClient.event.log.list).toHaveBeenCalledWith(
        expect.objectContaining({ order: 'desc', take: 50 })
      )
    })

    it('should pass cursor through to SDK', async () => {
      mockClient.event.log.list.mockResolvedValue({ items: [] })

      await listAll({ cursor: 'next-page' })

      expect(mockClient.event.log.list).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 'next-page' })
      )
    })
  })
})

import { getContextBot } from '@/lib/context.store'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'

import {
  LIST_MAX_TTL_SECONDS,
  doListPop,
  doListPush,
  doListRead,
  executeListAction,
  listPopSchema,
  listPushSchema,
  listReadSchema,
} from './action.exec.list'

jest.mock('@/lib/context.store', () => ({
  getContextBot: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    lpush: jest.fn(),
    rpush: jest.fn(),
    lpop: jest.fn(),
    rpop: jest.fn(),
    lrange: jest.fn(),
    expire: jest.fn(),
  },
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
  debug: jest.fn(() => ({ log: jest.fn() })),
}))

describe('action.exec.list', () => {
  const options = {
    userId: 'user 123',
    linkedResources: {
      botId: 'bot:abc',
    },
    contextResources: {
      blueprintId: 'bp1',
      skillsetId: 'ss1',
      abilityId: 'ab1',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getContextBot.mockReturnValue(null)
  })

  describe('schemas', () => {
    it('validates push input with default position', () => {
      const result = listPushSchema.parse({
        name: 'queue',
        item: { id: 1, title: 'Test' },
      })

      expect(result).toEqual({
        name: 'queue',
        item: { id: 1, title: 'Test' },
        position: 'end',
      })
    })

    it('validates pop input with start position', () => {
      const result = listPopSchema.parse({
        name: 'queue',
        position: 'start',
      })

      expect(result).toEqual({
        name: 'queue',
        position: 'start',
      })
    })

    it('rejects old front/back terminology as a pop position', () => {
      expect(() => {
        listPopSchema.parse({
          name: 'queue',
          position: 'front',
        })
      }).toThrow()
    })

    it('validates read input with default pagination', () => {
      const result = listReadSchema.parse({
        name: 'queue',
      })

      expect(result).toEqual({
        name: 'queue',
        position: 'start',
        offset: 0,
        limit: 100,
      })
    })
  })

  describe('doListPush', () => {
    it('pushes to the start and sets expiry for a new list', async () => {
      memcache.lpush.mockResolvedValue(1)
      memcache.expire.mockResolvedValue(1)

      const result = await doListPush({
        input: JSON.stringify({
          name: 'queue',
          item: 'alpha',
          position: 'start',
        }),
        params: { push: true },
        options,
      })

      expect(memcache.lpush).toHaveBeenCalledWith(
        'list:user%20123:bot%3Aabc:queue',
        'alpha'
      )
      expect(memcache.rpush).not.toHaveBeenCalled()
      expect(memcache.expire).toHaveBeenCalledWith(
        'list:user%20123:bot%3Aabc:queue',
        LIST_MAX_TTL_SECONDS
      )
      expect(result.result).toEqual({
        success: true,
        name: 'queue',
        position: 'start',
        length: 1,
      })
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action.list.push',
          user: { id: 'user 123' },
          relations: {
            blueprintId: 'bp1',
            skillsetId: 'ss1',
            abilityId: 'ab1',
          },
        })
      )
    })

    it('pushes to the end by default', async () => {
      memcache.rpush.mockResolvedValue(2)

      await doListPush({
        input: JSON.stringify({
          name: 'queue',
          item: { id: 1 },
        }),
        params: { push: true },
        options,
      })

      expect(memcache.rpush).toHaveBeenCalledWith(
        'list:user%20123:bot%3Aabc:queue',
        { id: 1 }
      )
      expect(memcache.lpush).not.toHaveBeenCalled()
      expect(memcache.expire).not.toHaveBeenCalled()
    })
  })

  describe('doListPop', () => {
    it('pops from the start by default', async () => {
      memcache.lpop.mockResolvedValue('alpha')

      const result = await doListPop({
        input: JSON.stringify({ name: 'queue' }),
        params: { pop: true },
        options,
      })

      expect(memcache.lpop).toHaveBeenCalledWith(
        'list:user%20123:bot%3Aabc:queue'
      )
      expect(memcache.rpop).not.toHaveBeenCalled()
      expect(result.result).toEqual({
        name: 'queue',
        position: 'start',
        item: 'alpha',
      })
    })

    it('pops from the end', async () => {
      memcache.rpop.mockResolvedValue('omega')

      await doListPop({
        input: JSON.stringify({ name: 'queue', position: 'end' }),
        params: { pop: true },
        options,
      })

      expect(memcache.rpop).toHaveBeenCalledWith(
        'list:user%20123:bot%3Aabc:queue'
      )
      expect(memcache.lpop).not.toHaveBeenCalled()
    })
  })

  describe('doListRead', () => {
    it('reads from the start of a Redis list', async () => {
      memcache.lrange.mockResolvedValue(['a', 'b'])

      const result = await doListRead({
        input: JSON.stringify({
          name: 'queue',
          position: 'start',
          offset: 2,
          limit: 3,
        }),
        params: { read: true },
        options,
      })

      expect(memcache.lrange).toHaveBeenCalledWith(
        'list:user%20123:bot%3Aabc:queue',
        2,
        4
      )
      expect(result.result).toEqual(['a', 'b'])
    })

    it('reads from the end of a Redis list', async () => {
      memcache.lrange.mockResolvedValue(['c', 'd'])

      const result = await doListRead({
        input: JSON.stringify({
          name: 'queue',
          position: 'end',
          offset: 1,
          limit: 2,
        }),
        params: { read: true },
        options,
      })

      expect(memcache.lrange).toHaveBeenCalledWith(
        'list:user%20123:bot%3Aabc:queue',
        -3,
        -2
      )
      expect(result.result).toEqual(['d', 'c'])
    })

    it('uses context bot when no linked bot is present', async () => {
      getContextBot.mockReturnValue({ id: 'context-bot' })
      memcache.lrange.mockResolvedValue([])

      await doListRead({
        input: JSON.stringify({ name: 'queue' }),
        params: { read: true },
        options: {
          userId: 'user123',
        },
      })

      expect(memcache.lrange).toHaveBeenCalledWith(
        'list:user123:context-bot:queue',
        0,
        99
      )
    })

    it('throws when no bot is available', async () => {
      await expect(
        doListRead({
          input: JSON.stringify({ name: 'queue' }),
          params: { read: true },
          options: {
            userId: 'user123',
          },
        })
      ).rejects.toThrow('A bot is required for list actions')
    })
  })

  describe('executeListAction', () => {
    it('routes push operations', async () => {
      memcache.rpush.mockResolvedValue(1)
      memcache.expire.mockResolvedValue(1)

      const result = await executeListAction(
        JSON.stringify({ name: 'queue', item: 'alpha' }),
        { push: true },
        options
      )

      expect(memcache.rpush).toHaveBeenCalled()
      expect(result.result.success).toBe(true)
    })

    it('routes pop operations', async () => {
      memcache.lpop.mockResolvedValue('alpha')

      const result = await executeListAction(
        JSON.stringify({ name: 'queue' }),
        { pop: true },
        options
      )

      expect(memcache.lpop).toHaveBeenCalled()
      expect(result.result.item).toBe('alpha')
    })

    it('routes read operations', async () => {
      memcache.lrange.mockResolvedValue([])

      const result = await executeListAction(
        JSON.stringify({ name: 'queue' }),
        { read: true },
        options
      )

      expect(memcache.lrange).toHaveBeenCalled()
      expect(result.result).toEqual([])
    })

    it('throws for unknown operations', async () => {
      await expect(executeListAction('', {}, options)).rejects.toThrow(
        'Unknown operation'
      )
    })
  })
})

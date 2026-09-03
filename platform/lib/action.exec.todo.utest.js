import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'

import {
  doTodoManage,
  doTodoRead,
  doTodoWrite,
  executeTodoAction,
  todoManageSchema,
} from './action.exec.todo'

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
  },
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
  debug: jest.fn(() => ({ log: jest.fn() })),
}))

describe('action.exec.todo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('todoManageSchema', () => {
    it('should validate read operation', () => {
      const result = todoManageSchema.parse({
        op: 'read',
      })

      expect(result.op).toBe('read')
      expect(result.todoList).toBeUndefined()
    })

    it('should validate write operation with todoList', () => {
      const result = todoManageSchema.parse({
        op: 'write',
        todoList: [
          { id: 1, title: 'Test Task', status: 'not-started' },
          { id: 2, title: 'Another Task', status: 'in-progress' },
        ],
      })

      expect(result.op).toBe('write')
      expect(result.todoList).toHaveLength(2)
      expect(result.todoList[0].title).toBe('Test Task')
    })

    it('should reject invalid operation', () => {
      expect(() => {
        todoManageSchema.parse({ op: 'invalid' })
      }).toThrow()
    })

    it('should reject invalid todo item', () => {
      expect(() => {
        todoManageSchema.parse({
          op: 'write',
          todoList: [
            { id: 'not-a-number', title: 'Test', status: 'not-started' },
          ],
        })
      }).toThrow()
    })

    it('should reject invalid status', () => {
      expect(() => {
        todoManageSchema.parse({
          op: 'write',
          todoList: [{ id: 1, title: 'Test', status: 'invalid-status' }],
        })
      }).toThrow()
    })

    it('should reject empty title', () => {
      expect(() => {
        todoManageSchema.parse({
          op: 'write',
          todoList: [{ id: 1, title: '', status: 'not-started' }],
        })
      }).toThrow()
    })
  })

  describe('doTodoRead', () => {
    const mockOptions = {
      userId: 'user123',
      meta: { namespace: 'test-namespace' },
    }

    it('should read todos from Redis', async () => {
      const mockTodos = [
        { id: 1, title: 'Task 1', status: 'not-started' },
        { id: 2, title: 'Task 2', status: 'completed' },
      ]

      memcache.get.mockResolvedValue(mockTodos)

      const result = await doTodoRead({
        input: '',
        params: {},
        options: mockOptions,
      })

      expect(memcache.get).toHaveBeenCalledWith('todo:test-namespace')
      expect(result.result).toEqual(mockTodos)
      expect(result.messages).toEqual([])
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action.todo.read',
          user: { id: 'user123' },
        })
      )
    })

    it('should return empty array when no todos exist', async () => {
      memcache.get.mockResolvedValue(null)

      const result = await doTodoRead({
        input: '',
        params: {},
        options: mockOptions,
      })

      expect(result.result).toEqual([])
    })

    it('should use sessionId as fallback for namespace', async () => {
      memcache.get.mockResolvedValue([])

      await doTodoRead({
        input: '',
        params: {},
        options: {
          userId: 'user123',
          meta: { sessionId: 'session456' },
        },
      })

      expect(memcache.get).toHaveBeenCalledWith('todo:session456')
    })

    it('should use conversationId as fallback', async () => {
      memcache.get.mockResolvedValue([])

      await doTodoRead({
        input: '',
        params: {},
        options: {
          userId: 'user123',
          meta: { conversationId: 'conv789' },
        },
      })

      expect(memcache.get).toHaveBeenCalledWith('todo:conv789')
    })

    it('should use userId as final fallback', async () => {
      memcache.get.mockResolvedValue([])

      await doTodoRead({
        input: '',
        params: {},
        options: {
          userId: 'user123',
          meta: {},
        },
      })

      expect(memcache.get).toHaveBeenCalledWith('todo:user123')
    })

    it('should include linkedResources in log event', async () => {
      memcache.get.mockResolvedValue([])

      await doTodoRead({
        input: '',
        params: {},
        options: {
          userId: 'user123',
          meta: { namespace: 'test' },
          linkedResources: {},
          contextResources: {
            blueprintId: 'bp1',
            skillsetId: 'ss1',
            abilityId: 'ab1',
          },
        },
      })

      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: {
            blueprintId: 'bp1',
            skillsetId: 'ss1',
            abilityId: 'ab1',
          },
        })
      )
    })
  })

  describe('doTodoWrite', () => {
    const mockOptions = {
      userId: 'user123',
      meta: { namespace: 'test-namespace' },
    }

    it('should write todos to Redis with expiration', async () => {
      const mockTodos = [
        { id: 1, title: 'Task 1', status: 'not-started' },
        { id: 2, title: 'Task 2', status: 'in-progress' },
      ]

      memcache.set.mockResolvedValue('OK')

      const result = await doTodoWrite({
        input: JSON.stringify({ op: 'write', todoList: mockTodos }),
        params: { write: { op: 'write', todoList: mockTodos } },
        options: mockOptions,
      })

      expect(memcache.set).toHaveBeenCalledWith('todo:test-namespace', mockTodos, {
        ex: 24 * 60 * 60,
      })
      expect(result.result).toEqual({ success: true, count: 2 })
      expect(result.messages).toEqual([])
      expect(logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action.todo.write',
          user: { id: 'user123' },
        })
      )
    })

    it('should throw error when todoList is missing', async () => {
      await expect(
        doTodoWrite({
          input: JSON.stringify({ op: 'write' }),
          params: { write: { op: 'write' } },
          options: mockOptions,
        })
      ).rejects.toThrow('todoList is required for write operation')
    })

    it('should write empty array', async () => {
      memcache.set.mockResolvedValue('OK')

      const result = await doTodoWrite({
        input: JSON.stringify({ op: 'write', todoList: [] }),
        params: { write: { op: 'write', todoList: [] } },
        options: mockOptions,
      })

      expect(memcache.set).toHaveBeenCalledWith('todo:test-namespace', [], {
        ex: 24 * 60 * 60,
      })
      expect(result.result.count).toBe(0)
    })

    it('should handle all todo statuses', async () => {
      const mockTodos = [
        { id: 1, title: 'Task 1', status: 'not-started' },
        { id: 2, title: 'Task 2', status: 'in-progress' },
        { id: 3, title: 'Task 3', status: 'completed' },
      ]

      memcache.set.mockResolvedValue('OK')

      await doTodoWrite({
        input: JSON.stringify({ op: 'write', todoList: mockTodos }),
        params: { write: { op: 'write', todoList: mockTodos } },
        options: mockOptions,
      })

      expect(memcache.set).toHaveBeenCalledWith('todo:test-namespace', mockTodos, {
        ex: 24 * 60 * 60,
      })
    })
  })

  describe('doTodoManage', () => {
    const mockOptions = {
      userId: 'user123',
      meta: { namespace: 'test' },
    }

    it('should route to doTodoRead for read operation', async () => {
      memcache.get.mockResolvedValue([])

      const result = await doTodoManage({
        input: JSON.stringify({ op: 'read' }),
        params: { manage: { op: 'read' } },
        options: mockOptions,
      })

      expect(memcache.get).toHaveBeenCalled()
      expect(result.result).toEqual([])
    })

    it('should route to doTodoWrite for write operation', async () => {
      const mockTodos = [{ id: 1, title: 'Task', status: 'not-started' }]

      memcache.set.mockResolvedValue('OK')

      const result = await doTodoManage({
        input: JSON.stringify({ op: 'write', todoList: mockTodos }),
        params: { manage: { op: 'write', todoList: mockTodos } },
        options: mockOptions,
      })

      expect(memcache.set).toHaveBeenCalled()
      expect(result.result.success).toBe(true)
    })
  })

  describe('executeTodoAction', () => {
    const mockOptions = {
      userId: 'user123',
      meta: { namespace: 'test' },
    }

    it('should execute manage operation', async () => {
      memcache.get.mockResolvedValue([])

      const result = await executeTodoAction(
        JSON.stringify({ op: 'read' }),
        { manage: { op: 'read' } },
        mockOptions
      )

      expect(result.result).toEqual([])
    })

    it('should execute read operation directly', async () => {
      memcache.get.mockResolvedValue([])

      const result = await executeTodoAction('', { read: {} }, mockOptions)

      expect(memcache.get).toHaveBeenCalled()
      expect(result.result).toEqual([])
    })

    it('should execute write operation directly', async () => {
      const mockTodos = [{ id: 1, title: 'Task', status: 'not-started' }]

      memcache.set.mockResolvedValue('OK')

      const result = await executeTodoAction(
        JSON.stringify({ op: 'write', todoList: mockTodos }),
        { write: { op: 'write', todoList: mockTodos } },
        mockOptions
      )

      expect(memcache.set).toHaveBeenCalled()
      expect(result.result.success).toBe(true)
    })

    it('should throw error for unknown operation', async () => {
      await expect(executeTodoAction('', {}, mockOptions)).rejects.toThrow(
        'Unknown operation'
      )
    })

    it('should handle complex workflow', async () => {
      memcache.get.mockResolvedValue([])
      memcache.set.mockResolvedValue('OK')

      const readResult = await executeTodoAction('', { read: {} }, mockOptions)

      expect(readResult.result).toEqual([])

      const mockTodos = [{ id: 1, title: 'New Task', status: 'not-started' }]

      const writeResult = await executeTodoAction(
        JSON.stringify({ op: 'write', todoList: mockTodos }),
        { write: { op: 'write', todoList: mockTodos } },
        mockOptions
      )

      expect(writeResult.result.count).toBe(1)
    })
  })

  describe('edge cases', () => {
    const mockOptions = {
      userId: 'user123',
      meta: { namespace: 'test' },
    }

    it('should handle Redis errors during read', async () => {
      memcache.get.mockRejectedValue(new Error('Redis connection failed'))

      await expect(
        doTodoRead({
          input: '',
          params: {},
          options: mockOptions,
        })
      ).rejects.toThrow('Redis connection failed')
    })

    it('should handle Redis errors during write', async () => {
      memcache.set.mockRejectedValue(new Error('Redis connection failed'))

      await expect(
        doTodoWrite({
          input: JSON.stringify({ op: 'write', todoList: [] }),
          params: { write: { op: 'write', todoList: [] } },
          options: mockOptions,
        })
      ).rejects.toThrow('Redis connection failed')
    })

    it('should handle malformed input in write', async () => {
      await expect(
        doTodoWrite({
          input: 'not valid json',
          params: { write: { op: 'write' } },
          options: mockOptions,
        })
      ).rejects.toThrow()
    })

    it('should handle large todo lists', async () => {
      const largeTodoList = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        title: `Task ${i}`,
        status: 'not-started',
      }))

      memcache.set.mockResolvedValue('OK')

      const result = await doTodoWrite({
        input: JSON.stringify({ op: 'write', todoList: largeTodoList }),
        params: { write: { op: 'write', todoList: largeTodoList } },
        options: mockOptions,
      })

      expect(result.result.count).toBe(1000)
      expect(memcache.set).toHaveBeenCalledWith('todo:test', largeTodoList, {
        ex: 24 * 60 * 60,
      })
    })

    it('should handle todos with special characters in title', async () => {
      const mockTodos = [
        {
          id: 1,
          title: 'Task with "quotes" and \'apostrophes\'',
          status: 'not-started',
        },
        {
          id: 2,
          title: 'Task with\nnewlines\tand\ttabs',
          status: 'in-progress',
        },
      ]

      memcache.set.mockResolvedValue('OK')

      const result = await doTodoWrite({
        input: JSON.stringify({ op: 'write', todoList: mockTodos }),
        params: { write: { op: 'write', todoList: mockTodos } },
        options: mockOptions,
      })

      expect(result.result.success).toBe(true)
    })
  })
})

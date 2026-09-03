import { PLATFORM_LIMITS } from '@/config/execution'

import prisma from '@/prisma/client'
import { Schedule } from '@/prisma/types'

import {
  doTaskCreate,
  doTaskDelete,
  doTaskFetch,
  doTaskList,
  doTaskRun,
  doTaskUpdate,
  executeTaskAction,
} from '@/lib/action.exec.task'
import { canUseBot } from '@/lib/bot.access'
import * as context from '@/lib/context.store'
import { getNext } from '@/lib/task.schedule'

import { executeTask } from '@/pages/api/v1/task/[taskId]/workflow'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,

    default: {
      task: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      bot: {
        findUnique: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/prisma/types', () => ({
  Schedule: {
    never: 'never',
    quarterhourly: 'quarterhourly',
    halfhourly: 'halfhourly',
    hourly: 'hourly',
    twicedaily: 'twicedaily',
    daily: 'daily',
    twiceweekly: 'twiceweekly',
    weekly: 'weekly',
    twicemonthly: 'twicemonthly',
    monthly: 'monthly',
  },
}))

jest.mock('@/lib/context.store', () => ({
  getContextBot: jest.fn(),
  getContextUser: jest.fn(),
  getContextNamespace: jest.fn(),
  getContextContact: jest.fn(),
}))

jest.mock('@/lib/task.schedule', () => ({
  getNext: jest.fn((schedule) => {
    if (schedule === 'hourly') {
      return new Date('2030-02-01T12:00:00Z')
    }

    if (schedule === 'daily') {
      return new Date('2030-02-02T00:00:00Z')
    }

    if (schedule === 'weekly') {
      return new Date('2030-02-08T00:00:00Z')
    }

    if (schedule === '2020-01-01T00:00:00Z') {
      return new Date('2020-01-01T00:00:00Z')
    }

    return new Date('2030-02-01T10:00:00Z')
  }),
}))

jest.mock('@/lib/bot.access', () => ({
  canUseBot: jest.fn(),
}))

jest.mock('@/pages/api/v1/task/[taskId]/workflow', () => ({
  executeTask: jest.fn(),
}))

describe('action.exec.task', () => {
  const mockUser = { id: 'user-123' }

  const mockContact = { id: 'contact-123' }

  const mockBotData = { id: 'bot-456' }

  const mockOptions = {
    userId: 'user-123',
    linkedResources: {
      botId: 'bot-456',
    },
    contextResources: {
      skillsetId: 'skillset-789',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    context.getContextBot.mockReturnValue(null)
    context.getContextUser.mockReturnValue(mockUser)
    context.getContextNamespace.mockReturnValue(null)
    context.getContextContact.mockReturnValue(mockContact)
    prisma.bot.findUnique.mockResolvedValue(mockBotData)
    canUseBot.mockResolvedValue(true)
  })

  describe('doTaskList', () => {
    it('should list all tasks for the user', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          name: 'Daily Report',
          description: 'Generate daily report',
          status: 'idle',
          outcome: 'success',
          schedule: Schedule.DAILY,
          lastRunAt: new Date('2024-01-01'),
          nextRunAt: new Date('2024-01-02'),
        },
        {
          id: 'task-2',
          name: 'Weekly Summary',
          description: 'Generate weekly summary',
          status: 'running',
          outcome: 'failure',
          schedule: '0 9 * * 1',
          lastRunAt: null,
          nextRunAt: new Date('2024-01-08'),
        },
      ]

      prisma.task.findMany.mockResolvedValue(mockTasks)

      const result = await doTaskList({
        user: mockUser,
        input: '',
        params: { '@scope': 'user' },
        options: mockOptions,
      })

      expect(result.result).toEqual(mockTasks)
      expect(result.messages).toEqual([])
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            botId: 'bot-456',
          }),
          select: expect.objectContaining({
            id: true,
            name: true,
            description: true,
            status: true,
            outcome: true,
            schedule: true,
            lastRunAt: true,
            nextRunAt: true,
          }),
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        })
      )
    })

    it('should request the latest execution summary for each listed task', async () => {
      prisma.task.findMany.mockResolvedValue([])

      await doTaskList({
        user: mockUser,
        input: '',
        params: { '@scope': 'user' },
        options: mockOptions,
      })

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            taskExecutions: expect.objectContaining({
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: expect.objectContaining({
                status: true,
                outcome: true,
                completedAt: true,
                summary: true,
              }),
            }),
          }),
        })
      )
    })

    it('should filter tasks by namespace when provided', async () => {
      context.getContextNamespace.mockReturnValue('test-namespace')

      prisma.task.findMany.mockResolvedValue([])

      await doTaskList({
        user: mockUser,
        input: '',
        params: { '@scope': 'user' },
        options: mockOptions,
      })

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      )
    })

    it('should return empty array when no tasks exist', async () => {
      prisma.task.findMany.mockResolvedValue([])

      const result = await doTaskList({
        user: mockUser,
        input: '',
        params: { '@scope': 'user' },
        options: mockOptions,
      })

      expect(result.result).toEqual([])
    })

    it('should apply metadata filters when meta is provided', async () => {
      prisma.task.findMany.mockResolvedValue([])

      await doTaskList({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          meta: {
            namespace: 'alpha',
            status: {
              active: true,
            },
          },
        },
        options: mockOptions,
      })

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            AND: [
              {
                meta: {
                  path: '$.namespace',
                  equals: 'alpha',
                },
              },
              {
                meta: {
                  path: '$.status.active',
                  equals: true,
                },
              },
            ],
          }),
        })
      )
    })

    it('should narrow list results by explicit botId when provided', async () => {
      prisma.task.findMany.mockResolvedValue([])

      await doTaskList({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          botId: 'bot-scoped',
        },
        options: {
          ...mockOptions,
          linkedResources: {},
        },
      })

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            botId: 'bot-scoped',
          }),
        })
      )
    })

    it('should allow explicit botId to satisfy bot-scoped list filtering', async () => {
      prisma.task.findMany.mockResolvedValue([])

      await doTaskList({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'bot',
          botId: 'bot-scoped',
        },
        options: {
          ...mockOptions,
          linkedResources: {},
        },
      })

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            botId: 'bot-scoped',
          }),
        })
      )
    })

    it('should throw error when listing with an unauthorized botId', async () => {
      canUseBot.mockResolvedValue(false)

      await expect(
        doTaskList({
          user: mockUser,
          input: '',
          params: { '@scope': 'user' },
          options: mockOptions,
        })
      ).rejects.toThrow('Bot not found')

      expect(prisma.task.findMany).not.toHaveBeenCalled()
    })
  })

  describe('doTaskFetch', () => {
    it('should fetch a task by id', async () => {
      const mockTaskData = {
        id: 'task-1',
        name: 'Daily Report',
        description: 'Generate daily report',
        status: 'idle',
        outcome: 'success',
        schedule: Schedule.DAILY,
        lastRunAt: new Date('2024-01-01'),
        nextRunAt: new Date('2024-01-02'),
        taskExecutions: [
          {
            id: 'exec-1',
            name: 'Daily Report Run',
            description: 'Generate daily report',
            status: 'idle',
            outcome: 'success',
            completedAt: new Date('2024-01-01T00:05:00Z'),
            summary: 'Completed successfully',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-01T00:05:00Z'),
            conversation: {
              id: 'conv-1',
              name: 'Conversation 1',
              description: 'First conversation',
            },
          },
        ],
      }

      prisma.task.findFirst.mockResolvedValue(mockTaskData)

      const result = await doTaskFetch({
        user: mockUser,
        input: 'task-1',
        params: { '@scope': 'user', taskId: 'task-1' },
        options: mockOptions,
      })

      expect(result.result).toEqual(mockTaskData)
      expect(prisma.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'task-1',
            userId: 'user-123',
            botId: 'bot-456',
          }),
          select: expect.objectContaining({
            id: true,
            name: true,
            description: true,
            status: true,
            outcome: true,
            schedule: true,
            timezone: true,
            maxIterations: true,
            maxTime: true,
            sessionDuration: true,
            expiresAt: true,
            meta: true,
            bot: expect.any(Object),
            lastRunAt: true,
            nextRunAt: true,
            taskExecutions: expect.objectContaining({
              orderBy: {
                createdAt: 'desc',
              },
              take: 10,
              select: expect.objectContaining({
                id: true,
                name: true,
                description: true,
                status: true,
                outcome: true,
                completedAt: true,
                summary: true,
                meta: true,
                endMessage: expect.any(Object),
                createdAt: true,
                updatedAt: true,
                conversation: expect.any(Object),
              }),
            }),
          }),
        })
      )
    })

    it('should throw error when task not found', async () => {
      prisma.task.findFirst.mockResolvedValue(null)

      await expect(
        doTaskFetch({
          user: mockUser,
          input: 'non-existent',
          params: { '@scope': 'user', taskId: 'non-existent' },
          options: mockOptions,
        })
      ).rejects.toThrow('Task not found')
    })
  })

  describe('doTaskCreate', () => {
    it('should create a task with basic information', async () => {
      const mockTaskData = {
        id: 'task-new',
        name: 'New Task',
        description: 'Task description',
        schedule: Schedule.DAILY,
        expiresAt: null,
      }

      prisma.task.create.mockResolvedValue(mockTaskData)

      const result = await doTaskCreate({
        user: mockUser,
        input: 'name: New Task\ndescription: Task description',
        params: { '@scope': 'user' },
        options: mockOptions,
      })

      expect(result.result).toEqual(mockTaskData)
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            botId: 'bot-456',
            name: 'New Task',
            description: 'Task description',
          }),
          select: expect.objectContaining({
            id: true,
            name: true,
            description: true,
            schedule: true,
            expiresAt: true,
          }),
        })
      )
    })

    it('should not set an auto-expiry on a scheduled task even in a namespace context', async () => {
      // A namespace context would otherwise stamp a 1-day expiry; the presence
      // of a schedule must suppress that so the cleanup sweep never collects a
      // still-recurring task out from under its schedule.
      context.getContextContact.mockReturnValue(null)
      context.getContextNamespace.mockReturnValue('test-namespace')

      prisma.task.create.mockResolvedValue({
        id: 'task-scheduled',
        name: 'Scheduled Task',
        description: '',
        schedule: 'daily',
        expiresAt: null,
      })

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Scheduled Task',
          schedule: 'daily',
        },
        options: mockOptions,
      })

      const [createArg] = prisma.task.create.mock.calls[0]

      expect(createArg.data.schedule).toBe('daily')
      expect(createArg.data.expiresAt).toBeUndefined()
    })

    it('should stamp the namespace-derived expiry on an unscheduled task', async () => {
      // Same namespace context, but with no schedule the task is one-off and
      // remains eligible for expiry-based collection.
      context.getContextContact.mockReturnValue(null)
      context.getContextNamespace.mockReturnValue('test-namespace')

      prisma.task.create.mockResolvedValue({
        id: 'task-oneoff',
        name: 'One-off Task',
        description: '',
        schedule: null,
        expiresAt: null,
      })

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'One-off Task',
        },
        options: mockOptions,
      })

      const [createArg] = prisma.task.create.mock.calls[0]

      expect(createArg.data.expiresAt).toBeInstanceOf(Date)
    })

    it('should resolve bot from explicit botId param when linked bot is absent', async () => {
      prisma.bot.findUnique.mockResolvedValue({ id: 'bot-explicit' })
      prisma.task.create.mockResolvedValue({
        id: 'task-explicit',
        name: 'Explicit Bot Task',
        description: 'Task description',
        schedule: null,
        expiresAt: null,
      })

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          botId: 'bot-explicit',
          name: 'Explicit Bot Task',
          description: 'Task description',
        },
        options: {
          ...mockOptions,
          linkedResources: {},
        },
      })

      expect(prisma.bot.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'bot-explicit',
        },
      })

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: 'bot-explicit',
          }),
        })
      )
    })

    it('should resolve bot from context when linked and explicit are absent', async () => {
      context.getContextBot.mockReturnValue({ id: 'bot-context' })
      prisma.bot.findUnique.mockResolvedValue({ id: 'bot-context' })
      prisma.task.create.mockResolvedValue({
        id: 'task-context',
        name: 'Context Bot Task',
        description: 'Task description',
        schedule: null,
        expiresAt: null,
      })

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Context Bot Task',
          description: 'Task description',
        },
        options: {
          ...mockOptions,
          linkedResources: {},
        },
      })

      expect(prisma.bot.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'bot-context',
        },
      })

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: 'bot-context',
          }),
        })
      )
    })

    it('should resolve bot from linkedResources botId with highest priority', async () => {
      prisma.bot.findUnique.mockResolvedValue({ id: 'bot-linked' })
      prisma.task.create.mockResolvedValue({
        id: 'task-linked',
        name: 'Linked Bot Task',
        description: 'Task description',
        schedule: null,
        expiresAt: null,
      })

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Linked Bot Task',
          description: 'Task description',
        },
        options: {
          ...mockOptions,
          linkedResources: {
            botId: 'bot-linked',
          },
        },
      })

      expect(prisma.bot.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'bot-linked',
        },
      })

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: 'bot-linked',
          }),
        })
      )
    })

    it('should prefer linkedResources botId over explicit botId param', async () => {
      prisma.bot.findUnique.mockResolvedValue({ id: 'bot-linked' })
      prisma.task.create.mockResolvedValue({
        id: 'task-priority',
        name: 'Priority Task',
        description: 'Task description',
        schedule: null,
        expiresAt: null,
      })

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          botId: 'bot-explicit',
          name: 'Priority Task',
          description: 'Task description',
        },
        options: {
          ...mockOptions,
          linkedResources: {
            botId: 'bot-linked',
          },
        },
      })

      // @note linked bot wins over explicit botId
      expect(prisma.bot.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'bot-linked',
        },
      })

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: 'bot-linked',
          }),
        })
      )
    })

    it('should throw error when task creation cannot resolve a bot', async () => {
      prisma.bot.findUnique.mockResolvedValue(null)

      await expect(
        doTaskCreate({
          user: mockUser,
          input: '',
          params: {
            '@scope': 'user',
            name: 'Missing Bot Task',
            description: 'Task description',
          },
          options: {
            ...mockOptions,
            linkedResources: {},
          },
        })
      ).rejects.toThrow('Bot not found')
    })

    it('should throw error when user cannot use the resolved bot', async () => {
      canUseBot.mockResolvedValue(false)

      await expect(
        doTaskCreate({
          user: mockUser,
          input: '',
          params: {
            '@scope': 'user',
            name: 'Unauthorized Bot Task',
            description: 'Task description',
          },
          options: mockOptions,
        })
      ).rejects.toThrow('Bot not found')

      expect(prisma.task.create).not.toHaveBeenCalled()
    })

    it('should execute task immediately when schedule is now', async () => {
      const mockTaskData = {
        id: 'task-now',
        name: 'Immediate Task',
        description: 'Run right away',
        schedule: null,
        expiresAt: null,
      }

      prisma.task.create.mockResolvedValue(mockTaskData)
      executeTask.mockResolvedValue(undefined)

      const result = await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Immediate Task',
          description: 'Run right away',
          schedule: 'now',
        },
        options: mockOptions,
      })

      expect(result.result).toEqual(mockTaskData)
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: null,
          }),
        })
      )
      expect(executeTask).toHaveBeenCalledWith('task-now')
    })

    it('should persist in-range execution limits unchanged', async () => {
      const mockTaskData = { id: 'task-limits', name: 'Bounded Task' }

      prisma.task.create.mockResolvedValue(mockTaskData)

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Bounded Task',
          maxIterations: 250,
          maxTime: 3_600_000,
          maxCalls: 50,
          sessionDuration: 1_800_000,
        },
        options: mockOptions,
      })

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxIterations: 250,
            maxTime: 3_600_000,
            maxCalls: 50,
            sessionDuration: 1_800_000,
          }),
        })
      )
    })

    it('should clamp out-of-range execution limits to platform bounds', async () => {
      const mockTaskData = { id: 'task-clamp', name: 'Clamped Task' }

      prisma.task.create.mockResolvedValue(mockTaskData)

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Clamped Task',
          maxIterations: 5, // below minIterations
          maxTime: PLATFORM_LIMITS.maxTime * 10, // above maxTime
          maxCalls: PLATFORM_LIMITS.maxCalls * 10, // above maxCalls
          sessionDuration: 0, // floored at 0 (fresh conversation per run)
        },
        options: mockOptions,
      })

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxIterations: PLATFORM_LIMITS.minIterations,
            maxTime: PLATFORM_LIMITS.maxTime,
            maxCalls: PLATFORM_LIMITS.maxCalls,
            sessionDuration: 0,
          }),
        })
      )
    })

    it('should leave execution limits unset when not provided', async () => {
      const mockTaskData = { id: 'task-default', name: 'Default Task' }

      prisma.task.create.mockResolvedValue(mockTaskData)

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: { '@scope': 'user', name: 'Default Task' },
        options: mockOptions,
      })

      const data = prisma.task.create.mock.calls[0][0].data

      expect(data.maxIterations).toBeUndefined()
      expect(data.maxTime).toBeUndefined()
      expect(data.maxCalls).toBeUndefined()
      expect(data.sessionDuration).toBeUndefined()
    })

    it('should accept human-readable duration strings for time limits', async () => {
      const mockTaskData = { id: 'task-dur', name: 'Duration Task' }

      prisma.task.create.mockResolvedValue(mockTaskData)

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Duration Task',
          maxTime: '1 hour',
          sessionDuration: '30 minutes',
        },
        options: mockOptions,
      })

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxTime: 3_600_000,
            sessionDuration: 1_800_000,
          }),
        })
      )
    })

    it('should clamp a duration string above the platform maximum', async () => {
      const mockTaskData = { id: 'task-dur-clamp', name: 'Clamped Duration' }

      prisma.task.create.mockResolvedValue(mockTaskData)

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Clamped Duration',
          maxTime: '10 days', // above the 1-day platform max
        },
        options: mockOptions,
      })

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxTime: PLATFORM_LIMITS.maxTime,
          }),
        })
      )
    })

    it('should throw for an unparseable duration string', async () => {
      await expect(
        doTaskCreate({
          user: mockUser,
          input: '',
          params: {
            '@scope': 'user',
            name: 'Bad Duration',
            maxTime: 'soon',
          },
          options: mockOptions,
        })
      ).rejects.toThrow(/duration/i)
    })

    it('should create task with cron schedule', async () => {
      const mockTaskData = {
        id: 'task-cron',
        name: 'Cron Task',
        description: 'Task with cron',
        schedule: '0 9 * * *',
        expiresAt: null,
      }

      prisma.task.create.mockResolvedValue(mockTaskData)

      const result = await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Cron Task',
          description: 'Task with cron',
          schedule: '0 9 * * *',
        },
        options: mockOptions,
      })

      expect(result.result.schedule).toBe('0 9 * * *')
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: '0 9 * * *',
            nextRunAt: new Date('2030-02-01T10:00:00Z'),
          }),
        })
      )
    })

    it('should create task with specific date schedule', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day from now
      const mockTaskData = {
        id: 'task-scheduled',
        name: 'Scheduled Task',
        description: 'Task scheduled for future',
        schedule: futureDate.toISOString(),
        expiresAt: null,
      }

      prisma.task.create.mockResolvedValue(mockTaskData)

      const result = await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Scheduled Task',
          description: 'Task scheduled for future',
          schedule: futureDate.toISOString(),
        },
        options: mockOptions,
      })

      expect(result.result.schedule).toBe(futureDate.toISOString())
    })

    it('should include namespace in created task metadata', async () => {
      context.getContextNamespace.mockReturnValue('test-namespace')
      context.getContextContact.mockReturnValue(null)

      prisma.task.create.mockResolvedValue({
        id: 'task-meta',
        name: 'Task With Meta',
        description: 'Task description',
        schedule: null,
        expiresAt: expect.any(Date),
      })

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Task With Meta',
          description: 'Task description',
          meta: {
            priority: 'high',
            status: {
              active: true,
            },
          },
        },
        options: mockOptions,
      })

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: {
              priority: 'high',
              status: {
                active: true,
              },
              namespace: 'test-namespace',
            },
          }),
        })
      )
    })

    it('should set expiresAt for namespace tasks', async () => {
      context.getContextNamespace.mockReturnValue('test-namespace')
      context.getContextContact.mockReturnValue(null)

      const mockTaskData = {
        id: 'task-namespace',
        name: 'Namespace Task',
        description: 'Task in namespace',
        schedule: Schedule.DAILY,
        expiresAt: expect.any(Date),
      }

      prisma.task.create.mockResolvedValue(mockTaskData)

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          name: 'Namespace Task',
          description: 'Task in namespace',
          schedule: Schedule.DAILY,
        },
        options: mockOptions,
      })

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        })
      )
    })

    it('should not set expiresAt for contact tasks', async () => {
      const mockContact = { id: 'contact-123' }

      context.getContextContact.mockReturnValue(mockContact)

      const mockTaskData = {
        id: 'task-contact',
        name: 'Contact Task',
        description: 'Task for contact',
        schedule: Schedule.DAILY,
        expiresAt: null,
      }

      prisma.task.create.mockResolvedValue(mockTaskData)

      await doTaskCreate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'contact',
          name: 'Contact Task',
          description: 'Task for contact',
          schedule: Schedule.DAILY,
        },
        options: mockOptions,
      })

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contactId: 'contact-123',
            expiresAt: undefined,
          }),
        })
      )
    })

    it('should throw error for invalid schedule', async () => {
      await expect(
        doTaskCreate({
          user: mockUser,
          input: '',
          params: {
            '@scope': 'user',
            name: 'Invalid Task',
            description: 'Task with invalid schedule',
            schedule: 'invalid-schedule',
          },
          options: mockOptions,
        })
      ).rejects.toThrow('Invalid schedule')
    })

    it('should throw error for past date schedule', async () => {
      const pastDate = new Date('2020-01-01')

      await expect(
        doTaskCreate({
          user: mockUser,
          input: '',
          params: {
            '@scope': 'user',
            name: 'Past Task',
            description: 'Task scheduled in past',
            schedule: pastDate.toISOString(),
          },
          options: mockOptions,
        })
      ).rejects.toThrow('Schedule is in the past')
    })
  })

  describe('doTaskUpdate', () => {
    it('should update task properties', async () => {
      const mockTaskData = {
        id: 'task-1',
        name: 'Updated Task',
        description: 'Updated description',
        schedule: Schedule.WEEKLY,
        expiresAt: null,
      }

      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' })
      prisma.task.update.mockResolvedValue(mockTaskData)

      const result = await doTaskUpdate({
        user: mockUser,
        input: 'name: Updated Task',
        params: {
          '@scope': 'user',
          taskId: 'task-1',
          description: 'Updated description',
          schedule: Schedule.WEEKLY,
        },
        options: mockOptions,
      })

      expect(result.result).toEqual(mockTaskData)
      expect(prisma.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'task-1',
            userId: 'user-123',
          }),
        })
      )
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'task-1',
          }),
          data: expect.objectContaining({
            name: 'Updated Task',
            description: 'Updated description',
          }),
          select: expect.objectContaining({
            id: true,
            name: true,
            description: true,
            schedule: true,
            expiresAt: true,
          }),
        })
      )
    })

    it('should update execution limits, clamped to platform bounds', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' })
      prisma.task.update.mockResolvedValue({ id: 'task-1' })

      await doTaskUpdate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          taskId: 'task-1',
          maxIterations: PLATFORM_LIMITS.maxIterations * 2, // above max
          maxTime: 7_200_000, // in range
          maxCalls: PLATFORM_LIMITS.maxCalls * 2, // above max
        },
        options: mockOptions,
      })

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxIterations: PLATFORM_LIMITS.maxIterations,
            maxTime: 7_200_000,
            maxCalls: PLATFORM_LIMITS.maxCalls,
          }),
        })
      )
    })

    it('should clear execution limits to default when null', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' })
      prisma.task.update.mockResolvedValue({ id: 'task-1' })

      await doTaskUpdate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          taskId: 'task-1',
          maxIterations: null,
          maxTime: null,
          maxCalls: null,
          sessionDuration: null,
        },
        options: mockOptions,
      })

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            maxIterations: null,
            maxTime: null,
            maxCalls: null,
            sessionDuration: null,
          }),
        })
      )
    })

    it('should leave execution limits unchanged when not provided', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' })
      prisma.task.update.mockResolvedValue({ id: 'task-1' })

      await doTaskUpdate({
        user: mockUser,
        input: 'name: Renamed',
        params: { '@scope': 'user', taskId: 'task-1' },
        options: mockOptions,
      })

      const data = prisma.task.update.mock.calls[0][0].data

      expect(data.maxIterations).toBeUndefined()
      expect(data.maxTime).toBeUndefined()
      expect(data.maxCalls).toBeUndefined()
      expect(data.sessionDuration).toBeUndefined()
    })

    it('should update task schedule to cron', async () => {
      const mockTaskData = {
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        schedule: '0 0 * * *',
        expiresAt: null,
      }

      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' })
      prisma.task.update.mockResolvedValue(mockTaskData)

      const result = await doTaskUpdate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          taskId: 'task-1',
          schedule: '0 0 * * *',
        },
        options: mockOptions,
      })

      expect(result.result.schedule).toBe('0 0 * * *')
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: '0 0 * * *',
            nextRunAt: new Date('2030-02-01T10:00:00Z'),
          }),
        })
      )
    })

    it('should merge metadata updates with existing task metadata via $update', async () => {
      prisma.task.findFirst.mockResolvedValue({
        id: 'task-1',
        meta: {
          namespace: 'existing',
          priority: 'low',
        },
      })
      prisma.task.update.mockResolvedValue({
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        schedule: null,
        expiresAt: null,
      })

      await doTaskUpdate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          taskId: 'task-1',
          meta: {
            $update: {
              priority: 'high',
              status: 'open',
            },
          },
        },
        options: mockOptions,
      })

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: {
              namespace: 'existing',
              priority: 'high',
              status: 'open',
            },
          }),
        })
      )
    })

    it('should not clear schedule when updating task without providing schedule', async () => {
      const mockTaskData = {
        id: 'task-1',
        name: 'Updated Task',
        description: 'Task',
        schedule: 'daily',
        expiresAt: null,
      }

      prisma.task.findFirst.mockResolvedValue({
        id: 'task-1',
        schedule: 'daily',
      })
      prisma.task.update.mockResolvedValue(mockTaskData)

      await doTaskUpdate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          taskId: 'task-1',
          name: 'Updated Task',
          // schedule intentionally omitted - should preserve existing schedule
        },
        options: mockOptions,
      })

      // @note schedule must be undefined (no change), not null (would clear the schedule)
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: undefined,
          }),
        })
      )
    })

    it('should throw error when updating non-existent task', async () => {
      prisma.task.findFirst.mockResolvedValue(null)

      await expect(
        doTaskUpdate({
          user: mockUser,
          input: '',
          params: {
            '@scope': 'user',
            taskId: 'non-existent',
            name: 'Updated',
          },
          options: mockOptions,
        })
      ).rejects.toThrow('Task not found')
    })

    it('should clear schedule when empty string is provided', async () => {
      prisma.task.findFirst.mockResolvedValue({
        id: 'task-1',
        schedule: 'daily',
        timezone: null,
      })
      prisma.task.update.mockResolvedValue({
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        schedule: null,
        expiresAt: null,
      })

      await doTaskUpdate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          taskId: 'task-1',
          schedule: '',
        },
        options: mockOptions,
      })

      // @note empty string schedule means "clear the schedule" - sets schedule to null and nextRunAt to null
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            schedule: null,
            nextRunAt: null,
          }),
        })
      )
    })

    it('should set nextRunAt to null when getNext returns a past date for the new schedule', async () => {
      // @note override getNext to return a past date to exercise the nextRunAt guard
      getNext.mockImplementationOnce(() => new Date('2020-01-01T00:00:00Z'))

      prisma.task.findFirst.mockResolvedValue({
        id: 'task-1',
        schedule: null,
        timezone: null,
      })
      prisma.task.update.mockResolvedValue({
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        schedule: 'daily',
        expiresAt: null,
      })

      await doTaskUpdate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          taskId: 'task-1',
          schedule: 'daily',
        },
        options: mockOptions,
      })

      // @note when getNext returns a past date the guard sets nextRunAt to null
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nextRunAt: null,
          }),
        })
      )
    })

    it('should recompute nextRunAt when only timezone is updated', async () => {
      prisma.task.findFirst.mockResolvedValue({
        id: 'task-1',
        schedule: 'daily',
        timezone: 'UTC',
      })
      prisma.task.update.mockResolvedValue({
        id: 'task-1',
        name: 'Task',
        description: 'Task',
        schedule: 'daily',
        expiresAt: null,
      })

      await doTaskUpdate({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          taskId: 'task-1',
          timezone: 'America/New_York',
        },
        options: mockOptions,
      })

      // @note changing timezone alone triggers nextRunAt recomputation using the new timezone
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timezone: 'America/New_York',
            nextRunAt: new Date('2030-02-02T00:00:00Z'),
          }),
        })
      )
    })
  })

  describe('doTaskDelete', () => {
    it('should delete a task', async () => {
      const mockTaskData = {
        id: 'task-1',
      }

      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' })
      prisma.task.delete.mockResolvedValue(mockTaskData)

      const result = await doTaskDelete({
        user: mockUser,
        input: 'task-1',
        params: { '@scope': 'user', taskId: 'task-1' },
        options: mockOptions,
      })

      expect(result.result).toEqual(mockTaskData)

      expect(prisma.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'task-1',
            userId: 'user-123',
          }),
        })
      )
      expect(prisma.task.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'task-1',
          }),
          select: expect.objectContaining({
            id: true,
          }),
        })
      )
    })

    it('should use explicit botId for delete scoping when provided', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' })
      prisma.task.delete.mockResolvedValue({ id: 'task-1' })

      await doTaskDelete({
        user: mockUser,
        input: '',
        params: {
          '@scope': 'user',
          botId: 'bot-scoped',
          taskId: 'task-1',
        },
        options: {
          ...mockOptions,
          linkedResources: {},
        },
      })

      expect(prisma.task.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            id: 'task-1',
            botId: 'bot-scoped',
          }),
        })
      )
    })

    it('should throw error when deleting non-existent task', async () => {
      prisma.task.findFirst.mockResolvedValue(null)

      await expect(
        doTaskDelete({
          user: mockUser,
          input: '',
          params: { '@scope': 'user', taskId: 'non-existent' },
          options: mockOptions,
        })
      ).rejects.toThrow('Task not found')
    })
  })

  describe('doTaskRun', () => {
    it('should trigger a task to run', async () => {
      const mockTaskData = {
        id: 'task-1',
      }

      prisma.task.findFirst.mockResolvedValue(mockTaskData)
      executeTask.mockResolvedValue(undefined)

      const result = await doTaskRun({
        user: mockUser,
        input: 'task-1',
        params: { '@scope': 'user', taskId: 'task-1' },
        options: mockOptions,
      })

      expect(result.result).toEqual(mockTaskData)
      expect(executeTask).toHaveBeenCalledWith('task-1')
    })

    it('should throw error when running non-existent task', async () => {
      prisma.task.findFirst.mockResolvedValue(null)

      await expect(
        doTaskRun({
          user: mockUser,
          input: 'non-existent',
          params: { '@scope': 'user', taskId: 'non-existent' },
          options: mockOptions,
        })
      ).rejects.toThrow('Task not found')
    })
  })

  describe('executeTaskAction', () => {
    it('should route to list operation', async () => {
      prisma.task.findMany.mockResolvedValue([])

      const result = await executeTaskAction(
        '',
        { '@scope': 'user', list: true, system: true },
        mockOptions
      )

      expect(result.result).toEqual([])
      expect(prisma.task.findMany).toHaveBeenCalled()
    })

    it('should route to fetch operation', async () => {
      const mockTaskData = {
        id: 'task-1',
        name: 'Task',
        description: 'Description',
        schedule: Schedule.DAILY,
        lastRunAt: null,
        nextRunAt: null,
        conversations: [],
      }

      prisma.task.findFirst.mockResolvedValue(mockTaskData)

      const result = await executeTaskAction(
        JSON.stringify({ taskId: 'task-1' }),
        { '@scope': 'user', fetch: true, system: true },
        mockOptions
      )

      expect(result.result).toEqual(mockTaskData)
    })

    it('should route to create operation', async () => {
      const mockTaskData = {
        id: 'task-new',
        name: 'New Task',
        description: 'Description',
        schedule: Schedule.DAILY,
        expiresAt: null,
      }

      prisma.task.create.mockResolvedValue(mockTaskData)

      const result = await executeTaskAction(
        '',
        {
          '@scope': 'user',
          create: {
            name: 'New Task',
            description: 'Description',
            schedule: Schedule.DAILY,
          },
        },
        mockOptions
      )

      expect(result.result).toEqual(mockTaskData)
    })

    it('should route to update operation', async () => {
      const mockTaskData = {
        id: 'task-1',
        name: 'Updated',
        description: 'Description',
        schedule: Schedule.DAILY,
        expiresAt: null,
      }

      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' })
      prisma.task.update.mockResolvedValue(mockTaskData)

      const result = await executeTaskAction(
        JSON.stringify({
          taskId: 'task-1',
          name: 'Updated',
        }),
        { '@scope': 'user', update: true },
        mockOptions
      )

      expect(result.result).toEqual(mockTaskData)
    })

    it('should route to delete operation', async () => {
      const mockTaskData = { id: 'task-1' }

      prisma.task.findFirst.mockResolvedValue({ id: 'task-1' })
      prisma.task.delete.mockResolvedValue(mockTaskData)

      const result = await executeTaskAction(
        JSON.stringify({
          taskId: 'task-1',
        }),
        { '@scope': 'user', delete: true },
        mockOptions
      )

      expect(result.result).toEqual(mockTaskData)
    })

    it('should route to run operation', async () => {
      const mockTaskData = { id: 'task-1' }

      prisma.task.findFirst.mockResolvedValue(mockTaskData)
      executeTask.mockResolvedValue(undefined)

      const result = await executeTaskAction(
        JSON.stringify({ taskId: 'task-1' }),
        { '@scope': 'user', run: true },
        mockOptions
      )

      expect(result.result).toEqual(mockTaskData)
      expect(executeTask).toHaveBeenCalled()
    })

    it('should throw error for unknown operation', async () => {
      await expect(
        executeTaskAction('', { '@scope': 'user', unknown: {} }, mockOptions)
      ).rejects.toThrow('Unknown operation')
    })

    it('should throw error when user not found', async () => {
      context.getContextUser.mockReturnValue(null)

      await expect(
        executeTaskAction('', { '@scope': 'user', list: {} }, mockOptions)
      ).rejects.toThrow('Missing user')
    })
  })
})

import { getSessionClient } from '@/lib/cbk.sdk'

import { cancelAutomation, cancelAutomationExecution, listAll } from './server'

jest.mock('@/lib/app.action', () => ({
  appActionHandler:
    (_appName, _configSchema, _paramsSchema, handler) => async (params) => {
      return handler({}, { user: { id: 'user-123' } }, params || {})
    },
}))

jest.mock('@/lib/cbk.sdk', () => ({
  getSessionClient: jest.fn(),
}))

describe('6e3b7f2a/server', () => {
  let mockClient

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient = {
      task: {
        list: jest.fn(),
        cancel: jest.fn(),
        execution: {
          list: jest.fn(),
          cancel: jest.fn(),
        },
      },
    }

    getSessionClient.mockResolvedValue(mockClient)
  })

  it('lists running tasks using SDK data only', async () => {
    mockClient.task.list.mockResolvedValue({
      items: [
        {
          id: 'task-running',
          name: 'Running Task',
          status: 'running',
          outcome: 'pending',
          updatedAt: 200,
          createdAt: 100,
          botId: 'bot-task',
        },
        {
          id: 'task-idle',
          name: 'Idle Task',
          status: 'idle',
          outcome: 'success',
          updatedAt: 50,
          createdAt: 25,
        },
      ],
    })

    const result = await listAll({ includeIdle: false, take: 10 })

    expect(result.items).toHaveLength(1)
    expect(result.items.map((item) => item.id)).toEqual(['task-running'])

    expect(mockClient.task.list).toHaveBeenCalledWith({
      cursor: undefined,
      order: 'desc',
      take: 100,
    })

    // executions are no longer fanned out server-side - the client fetches
    // execution detail directly via a minted token on selection.
    expect(mockClient.task.execution.list).not.toHaveBeenCalled()
  })

  it('normalizes non-string SDK fields to null', async () => {
    mockClient.task.list.mockResolvedValue({
      items: [
        {
          id: 'task-running',
          name: 'Running Task',
          description: { text: 'not-a-string' },
          status: { value: 'running' },
          outcome: { value: 'pending' },
          botId: { id: 'bot-task' },
          contactId: { id: 'contact-task' },
          schedule: { cron: '* * * * *' },
          updatedAt: 200,
          createdAt: 100,
        },
      ],
    })

    const result = await listAll({ includeIdle: true, take: 10 })

    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'task-running',
        description: null,
        status: null,
        outcome: null,
        botId: null,
        contactId: null,
        schedule: null,
        execution: null,
      }),
    ])
  })

  it('cancels a task via the SDK', async () => {
    await cancelAutomation({ kind: 'task', id: 'task-123' })

    expect(mockClient.task.cancel).toHaveBeenCalledWith('task-123')
  })

  it('cancels a task execution via the SDK', async () => {
    await cancelAutomationExecution({
      kind: 'task',
      id: 'task-123',
      executionId: 'task-exec-1',
    })

    expect(mockClient.task.execution.cancel).toHaveBeenCalledWith(
      'task-123',
      'task-exec-1'
    )
  })
})

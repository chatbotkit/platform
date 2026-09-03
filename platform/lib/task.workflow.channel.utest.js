/* eslint-disable @typescript-eslint/no-require-imports */
import {
  TAG_ERROR,
  TAG_OPERATION_BEGIN,
  TAG_OPERATION_END,
  TAG_TOKEN,
} from '@/lib/conversation.tag'

import {
  TASK_WORKFLOW_CHANNEL_HISTORY_EXPIRE_SECONDS,
  TASK_WORKFLOW_CHANNEL_HISTORY_LENGTH,
  createTaskWorkflowOperationSink,
  getTaskWorkflowHistoryOptions,
  pipeTaskWorkflowEventsToStream,
  publishTaskWorkflowEvent,
  streamTaskWorkflowEvents,
} from './task.workflow.channel'

jest.mock('@/lib/channel.user', () => ({
  publishChannelMessage: jest.fn(),
  streamChannelEvents: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
}))

const {
  publishChannelMessage,
  streamChannelEvents,
} = require('@/lib/channel.user')
const { captureError } = require('@/lib/error')

describe('task.workflow.channel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function makeOperationData(overrides = {}) {
    return {
      id: 'op-1',
      action: {
        id: 'action-1',
        kind: 'function',
        name: 'searchContacts',
        input: { query: 'private input' },
        justification: 'Need to search contacts',
        icon: '@logo/chatbotkit.com',
      },
      ...overrides,
    }
  }

  describe('getTaskWorkflowHistoryOptions', () => {
    it('should use the task workflow history defaults', () => {
      expect(getTaskWorkflowHistoryOptions()).toEqual({
        historyLength: TASK_WORKFLOW_CHANNEL_HISTORY_LENGTH,
        historyExpireSeconds: TASK_WORKFLOW_CHANNEL_HISTORY_EXPIRE_SECONDS,
      })
    })
  })

  describe('publishTaskWorkflowEvent', () => {
    it('should publish to the user-scoped task workflow channel', async () => {
      const event = {
        type: TAG_OPERATION_BEGIN,
        createdAt: 1_700_000_000_000,
        data: makeOperationData(),
      }

      publishChannelMessage.mockResolvedValue(undefined)

      await publishTaskWorkflowEvent('user-1', 'task-1', event)

      expect(publishChannelMessage).toHaveBeenCalledWith(
        'user-1',
        'task[task-1]:workflow',
        event,
        {
          historyLength: TASK_WORKFLOW_CHANNEL_HISTORY_LENGTH,
          historyExpireSeconds: TASK_WORKFLOW_CHANNEL_HISTORY_EXPIRE_SECONDS,
        }
      )
    })

    it('should pass explicit history options through', async () => {
      const event = {
        type: TAG_OPERATION_END,
        createdAt: 1_700_000_000_000,
        data: makeOperationData(),
      }
      const options = { historyLength: 5, historyExpireSeconds: 60 }

      publishChannelMessage.mockResolvedValue(undefined)

      await publishTaskWorkflowEvent('user-1', 'task-1', event, options)

      expect(publishChannelMessage).toHaveBeenCalledWith(
        'user-1',
        'task[task-1]:workflow',
        event,
        options
      )
    })
  })

  describe('streamTaskWorkflowEvents', () => {
    it('should stream from the user-scoped task workflow channel', async () => {
      const options = { historyLength: 25 }
      const channelEvents = [
        {
          type: 'message',
          data: {
            type: TAG_OPERATION_BEGIN,
            createdAt: 1_700_000_000_000,
            data: makeOperationData(),
          },
        },
      ]

      streamChannelEvents.mockImplementation(async function* () {
        yield* channelEvents
      })

      const events = []

      for await (const event of streamTaskWorkflowEvents(
        'user-1',
        'task-1',
        options
      )) {
        events.push(event)
      }

      expect(streamChannelEvents).toHaveBeenCalledWith(
        'user-1',
        'task[task-1]:workflow',
        options
      )
      expect(events).toEqual(channelEvents)
    })
  })

  describe('createTaskWorkflowOperationSink', () => {
    it('should ignore non-operation events', async () => {
      const sink = createTaskWorkflowOperationSink({
        userId: 'user-1',
        taskId: 'task-1',
      })

      const event = await sink.push(TAG_TOKEN, { token: 'hello' })

      expect(publishChannelMessage).not.toHaveBeenCalled()
      expect(event).toEqual({
        type: TAG_TOKEN,
        createdAt: expect.any(Number),
        data: { token: 'hello' },
      })
    })

    it('should publish operation begin events without changing their shape', async () => {
      const sink = createTaskWorkflowOperationSink({
        userId: 'user-1',
        taskId: 'task-1',
      })

      publishChannelMessage.mockResolvedValue(undefined)

      const data = makeOperationData()

      await sink.push(TAG_OPERATION_BEGIN, data)

      expect(publishChannelMessage).toHaveBeenCalledWith(
        'user-1',
        'task[task-1]:workflow',
        {
          type: TAG_OPERATION_BEGIN,
          createdAt: expect.any(Number),
          data,
        },
        {
          historyLength: TASK_WORKFLOW_CHANNEL_HISTORY_LENGTH,
          historyExpireSeconds: TASK_WORKFLOW_CHANNEL_HISTORY_EXPIRE_SECONDS,
        }
      )
    })

    it('should publish operation end events without changing their shape', async () => {
      const sink = createTaskWorkflowOperationSink({
        userId: 'user-1',
        taskId: 'task-1',
      })

      publishChannelMessage.mockResolvedValue(undefined)

      const data = makeOperationData()

      await sink.push(TAG_OPERATION_END, data)

      expect(publishChannelMessage).toHaveBeenCalledWith(
        'user-1',
        'task[task-1]:workflow',
        {
          type: TAG_OPERATION_END,
          createdAt: expect.any(Number),
          data,
        },
        expect.any(Object)
      )
    })

    it('should publish error events without changing their shape', async () => {
      const sink = createTaskWorkflowOperationSink({
        userId: 'user-1',
        taskId: 'task-1',
      })

      const error = {
        code: 'WORKFLOW_FAILED',
        message: 'workflow failed',
      }

      publishChannelMessage.mockResolvedValue(undefined)

      await sink.push(TAG_ERROR, error)

      expect(publishChannelMessage).toHaveBeenCalledWith(
        'user-1',
        'task[task-1]:workflow',
        {
          type: TAG_ERROR,
          createdAt: expect.any(Number),
          data: error,
        },
        {
          historyLength: TASK_WORKFLOW_CHANNEL_HISTORY_LENGTH,
          historyExpireSeconds: TASK_WORKFLOW_CHANNEL_HISTORY_EXPIRE_SECONDS,
        }
      )
    })

    it('should capture publish errors without throwing', async () => {
      const error = new Error('publish failed')
      const sink = createTaskWorkflowOperationSink({
        userId: 'user-1',
        taskId: 'task-1',
      })

      publishChannelMessage.mockRejectedValue(error)

      await expect(
        sink.push(TAG_OPERATION_BEGIN, makeOperationData())
      ).resolves.toEqual(
        expect.objectContaining({
          type: TAG_OPERATION_BEGIN,
          createdAt: expect.any(Number),
        })
      )

      expect(captureError).toHaveBeenCalledWith(error)
    })
  })

  describe('pipeTaskWorkflowEventsToStream', () => {
    it('should unwrap channel messages into completion-style stream events', async () => {
      const abortController = new AbortController()
      const stream = {
        push: jest.fn().mockResolvedValue(undefined),
        abortSignal: abortController.signal,
      }
      const taskWorkflowEvent = {
        type: TAG_OPERATION_BEGIN,
        createdAt: 1_700_000_000_000,
        data: makeOperationData(),
      }

      streamChannelEvents.mockImplementation(async function* () {
        yield { type: 'subscribe', channel: 'channel' }
        yield { type: 'message', channel: 'channel', data: taskWorkflowEvent }
      })

      await pipeTaskWorkflowEventsToStream('user-1', 'task-1', stream, {
        historyLength: 10,
      })

      expect(streamChannelEvents).toHaveBeenCalledWith(
        'user-1',
        'task[task-1]:workflow',
        {
          historyLength: 10,
          abortSignal: abortController.signal,
        }
      )
      expect(stream.push).toHaveBeenCalledWith(taskWorkflowEvent)
    })

    it('should silently ignore non-message channel events', async () => {
      const abortController = new AbortController()
      const stream = {
        push: jest.fn().mockResolvedValue(undefined),
        abortSignal: abortController.signal,
      }

      streamChannelEvents.mockImplementation(async function* () {
        yield { type: 'subscribe', channel: 'channel' }
        yield { type: 'pong', channel: 'channel' }
        yield { type: 'unsubscribe', channel: 'channel' }
      })

      await pipeTaskWorkflowEventsToStream('user-1', 'task-1', stream, {
        historyLength: 0,
      })

      expect(stream.push).not.toHaveBeenCalled()
    })

    it('should push multiple message events to stream in order', async () => {
      const abortController = new AbortController()
      const stream = {
        push: jest.fn().mockResolvedValue(undefined),
        abortSignal: abortController.signal,
      }

      const event1 = {
        type: TAG_OPERATION_BEGIN,
        createdAt: 1_700_000_000_000,
        data: makeOperationData({ id: 'op-1' }),
      }
      const event2 = {
        type: TAG_OPERATION_END,
        createdAt: 1_700_000_001_000,
        data: makeOperationData({ id: 'op-2' }),
      }

      streamChannelEvents.mockImplementation(async function* () {
        yield { type: 'subscribe', channel: 'channel' }
        yield { type: 'message', channel: 'channel', data: event1 }
        yield { type: 'message', channel: 'channel', data: event2 }
      })

      await pipeTaskWorkflowEventsToStream('user-1', 'task-1', stream, {
        historyLength: 2,
      })

      expect(stream.push).toHaveBeenCalledTimes(2)
      expect(stream.push).toHaveBeenNthCalledWith(1, event1)
      expect(stream.push).toHaveBeenNthCalledWith(2, event2)
    })
  })
})

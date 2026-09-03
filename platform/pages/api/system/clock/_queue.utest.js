/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import {
  handleClock10Event,
  handleEmptyConversations,
  handleExpiredConversations,
} from './queue'

jest.mock('@/lib/debug', () => () => ({
  log: () => ({
    log: () => ({}),
  }),
}))

jest.mock('@/lib/error', () => ({
  captureObservation: jest.fn(),
}))

jest.mock('@/lib/job', () => ({
  runTasks: jest.fn((tasks) => Promise.allSettled(tasks)),
}))

jest.mock('@/lib/queue', () => jest.fn())
jest.mock('@/lib/queue2', () => ({
  withQueueHandler: (handlers) => handlers,
}))

jest.mock('@/pages/api/session/queue', () => ({
  sendEvent: jest.fn(async () => undefined),
}))
jest.mock('@/pages/api/v1/audit/log/queue', () => ({
  sendEvent: jest.fn(async () => undefined),
}))
jest.mock('@/pages/api/v1/conversation/queue', () => ({
  sendEvent: jest.fn(async () => undefined),
}))
jest.mock('@/pages/api/v1/dataset/queue', () => ({
  sendEvent: jest.fn(async () => undefined),
}))
jest.mock('@/pages/api/v1/event/log/queue', () => ({
  sendEvent: jest.fn(async () => undefined),
}))
jest.mock('@/pages/api/v1/event/metric/queue', () => ({
  sendEvent: jest.fn(async () => undefined),
}))
jest.mock('@/pages/api/v1/memory/queue', () => ({
  sendEvent: jest.fn(async () => undefined),
}))
jest.mock('@/pages/api/v1/usage/queue', () => ({
  sendEvent: jest.fn(async () => undefined),
}))
jest.mock('@/pages/api/v1/oauth/application/queue', () => ({
  sendEvent: jest.fn(async () => undefined),
}))

jest.mock('@/pages/api/v1/integration/queue', () => ({
  sendEvent: jest.fn(),
}))

jest.mock('@/pages/api/v1/task/queue', () => ({
  sendEvent: jest.fn(),
}))

describe('/api/system/clock/queue', () => {
  const {
    sendEvent: sendIntegrationEvent,
  } = require('@/pages/api/v1/integration/queue')
  const { sendEvent: sendTaskEvent } = require('@/pages/api/v1/task/queue')

  beforeEach(() => {
    jest.clearAllMocks()

    sendIntegrationEvent.mockImplementation(async ({ type }) => {
      if (type === 'schedule') {
        await new Promise((resolve) => {
          process.nextTick(resolve)
        })
      }
    })

    sendTaskEvent.mockImplementation(async ({ type }) => {
      if (type === 'schedule') {
        await new Promise((resolve) => {
          process.nextTick(resolve)
        })
      }
    })
  })

  it('should dispatch both integration schedule and trigger events in the same clock tick', async () => {
    await handleClock10Event({})

    const integrationTypes = sendIntegrationEvent.mock.calls.map(([event]) => {
      return event.type
    })

    expect(integrationTypes).toContain('schedule')
    expect(integrationTypes).toContain('trigger')
  })

  it('should dispatch both task schedule and trigger events in the same clock tick', async () => {
    await handleClock10Event({})

    const taskTypes = sendTaskEvent.mock.calls.map(([event]) => event.type)

    expect(taskTypes).toContain('schedule')
    expect(taskTypes).toContain('trigger')
  })

  it('should dispatch expired conversation cleanup event each clock tick', async () => {
    const {
      sendEvent: sendConversationEvent,
    } = require('@/pages/api/v1/conversation/queue')

    await handleExpiredConversations()

    expect(sendConversationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'expired' })
    )
  })

  it('should dispatch empty conversation cleanup event each clock tick', async () => {
    const {
      sendEvent: sendConversationEvent,
    } = require('@/pages/api/v1/conversation/queue')

    await handleEmptyConversations()

    expect(sendConversationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'empty' })
    )
  })
})

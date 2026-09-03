/* eslint-disable @typescript-eslint/no-require-imports */
import {
  SETUP_EVENT_TYPE,
  TRIGGER_EVENT_TYPE,
  executeWebhook,
  handleSetupEventType,
  handleTriggerEventType,
  sendEvent,
} from './queue'

jest.mock('@/prisma/client', () => ({
  user: {
    findUnique: jest.fn(),
  },
  bot: { create: jest.fn(), findMany: jest.fn() },
  dataset: { create: jest.fn() },
  skillset: { create: jest.fn() },
  supportIntegration: { create: jest.fn() },
  webhook: { paginate: jest.fn() },
}))

jest.mock('@/lib/user.type', () => ({
  isEffectivePartnerAccount: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  captureException: jest.fn(),
}))

jest.mock('@/lib/fetch', () => {
  const fn = jest.fn()

  fn.getFetchError = jest.fn()

  return {
    __esModule: true,
    default: fn,
    getFetchError: fn.getFetchError,
  }
})

jest.mock('@/lib/host', () => ({
  getLocalHostURL: jest.fn().mockReturnValue('https://chatbotkit.com'),
}))

jest.mock('@/lib/queue', () => jest.fn().mockResolvedValue(undefined))

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn().mockReturnValue(jest.fn()),
}))

jest.mock('@/lib/debug', () => {
  const log = jest.fn()
  const dbg = jest.fn(() => ({ log }))

  return { __esModule: true, default: dbg }
})

jest.mock('@/lib/cbk.sdk', () => ({
  getUserClient: jest.fn(),
}))

jest.mock('@/lib/job', () => ({
  runTasksEach: jest.fn(),
}))

jest.mock('@/lib/slug', () => ({
  generateThreeWordSlug: jest.fn().mockReturnValue('test-slug'),
}))

jest.mock('@/pages/api/v1/webhook/[webhookId]/queue', () => ({
  sendEvent: jest.fn().mockResolvedValue(undefined),
}))

const mockPrisma = require('@/prisma/client')
const mockSendWebhookEvent =
  require('@/pages/api/v1/webhook/[webhookId]/queue').sendEvent
const mockQueue = require('@/lib/queue')
const { runTasksEach: mockRunTasksEach } = require('@/lib/job')
const {
  isEffectivePartnerAccount: mockIsPartnerAccount,
} = require('@/lib/user.type')

describe('executeWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns early without sending if webhook has no request configured', async () => {
    const webhook = {
      id: 'w1',
      request: null,
      events: 'conversation.create,conversation.delete',
    }

    await executeWebhook(webhook, 'conversation.create', { id: 'c1' })

    expect(mockSendWebhookEvent).not.toHaveBeenCalled()
  })

  it('returns early without sending if webhook has no events configured', async () => {
    const webhook = {
      id: 'w1',
      request: 'https://example.com/hook',
      events: null,
    }

    await executeWebhook(webhook, 'conversation.create', { id: 'c1' })

    expect(mockSendWebhookEvent).not.toHaveBeenCalled()
  })

  it('returns early without sending if the event type is not in the supported events list', async () => {
    const webhook = {
      id: 'w1',
      request: 'https://example.com/hook',
      events: 'conversation.update,conversation.delete',
    }

    await executeWebhook(webhook, 'conversation.create', { id: 'c1' })

    expect(mockSendWebhookEvent).not.toHaveBeenCalled()
  })

  it('sends the webhook trigger event when the event type is in the supported events list', async () => {
    const webhook = {
      id: 'w1',
      request: 'https://example.com/hook',
      events: 'conversation.create,conversation.update',
    }
    const eventData = { id: 'c1', text: 'hello' }

    await executeWebhook(webhook, 'conversation.create', eventData)

    expect(mockSendWebhookEvent).toHaveBeenCalledWith('w1', {
      type: 'trigger',
      payload: {
        eventType: 'conversation.create',
        eventData: { id: 'c1', text: 'hello' },
      },
    })
  })

  it('correctly matches a supported event when multiple events are configured', async () => {
    const webhook = {
      id: 'w2',
      request: 'https://example.com/hook',
      events: 'bot.create,bot.update,bot.delete',
    }

    await executeWebhook(webhook, 'bot.update', {})

    expect(mockSendWebhookEvent).toHaveBeenCalledWith(
      'w2',
      expect.objectContaining({
        payload: expect.objectContaining({ eventType: 'bot.update' }),
      })
    )
  })

  it('does not partially match event names - conversation.create does not match conversation.create.extra', async () => {
    const webhook = {
      id: 'w3',
      request: 'https://example.com/hook',
      events: 'conversation.create',
    }

    await executeWebhook(webhook, 'conversation.create.extra', {})

    expect(mockSendWebhookEvent).not.toHaveBeenCalled()
  })
})

describe('handleTriggerEventType', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('paginates webhooks scoped to the specified user only', async () => {
    mockPrisma.webhook.paginate.mockReturnValue([])
    mockRunTasksEach.mockImplementation(async (workers, iter, fn) => {
      for (const item of iter) {
        await fn(item)
      }
    })

    await handleTriggerEventType('user-abc', {
      eventType: 'conversation.create',
      eventData: {},
    })

    expect(mockPrisma.webhook.paginate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-abc' } })
    )
  })

  it('calls executeWebhook for each webhook belonging to the user', async () => {
    const webhooks = [
      {
        id: 'w1',
        request: 'https://a.com/hook',
        events: 'conversation.create',
      },
      {
        id: 'w2',
        request: 'https://b.com/hook',
        events: 'conversation.create',
      },
    ]

    mockPrisma.webhook.paginate.mockReturnValue(webhooks)
    mockRunTasksEach.mockImplementation(async (workers, iter, fn) => {
      for (const item of iter) {
        await fn(item)
      }
    })

    await handleTriggerEventType('user-abc', {
      eventType: 'conversation.create',
      eventData: { id: 'c1' },
    })

    expect(mockSendWebhookEvent).toHaveBeenCalledTimes(2)
    expect(mockSendWebhookEvent).toHaveBeenCalledWith(
      'w1',
      expect.objectContaining({
        payload: expect.objectContaining({ eventType: 'conversation.create' }),
      })
    )
    expect(mockSendWebhookEvent).toHaveBeenCalledWith(
      'w2',
      expect.objectContaining({
        payload: expect.objectContaining({ eventType: 'conversation.create' }),
      })
    )
  })

  it('does not call sendWebhookEvent when the user has no webhooks', async () => {
    mockPrisma.webhook.paginate.mockReturnValue([])
    mockRunTasksEach.mockImplementation(async (workers, iter, fn) => {
      for (const item of iter) {
        await fn(item)
      }
    })

    await handleTriggerEventType('user-abc', {
      eventType: 'conversation.create',
      eventData: {},
    })

    expect(mockSendWebhookEvent).not.toHaveBeenCalled()
  })
})

describe('handleSetupEventType', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns early without creating resources when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const { getUserClient } = require('@/lib/cbk.sdk')

    await handleSetupEventType('user-404', {})

    expect(getUserClient).not.toHaveBeenCalled()
  })

  it('returns early without creating resources when the user is a partner account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-partner',
      email: 'partner@example.com',
    })

    mockIsPartnerAccount.mockResolvedValue(true)

    const { getUserClient } = require('@/lib/cbk.sdk')

    await handleSetupEventType('user-partner', {})

    expect(getUserClient).not.toHaveBeenCalled()
  })
})

describe('sendEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('queues a setup event with a deduplication ID to prevent duplicate account setup', async () => {
    await sendEvent('user-123', { type: SETUP_EVENT_TYPE, payload: {} })

    expect(mockQueue).toHaveBeenCalledWith(
      '/api/user/user-123/queue',
      { type: SETUP_EVENT_TYPE, payload: {} },
      expect.objectContaining({
        deduplicationId: 'user-queue-event-user-123-setup',
      })
    )
  })

  it('queues a trigger event without any deduplication ID or delay', async () => {
    await sendEvent('user-123', {
      type: TRIGGER_EVENT_TYPE,
      payload: { eventType: 'conversation.create', eventData: {} },
    })

    const callArgs = mockQueue.mock.calls[0]

    expect(callArgs[0]).toBe('/api/user/user-123/queue')
    expect(callArgs[2]).not.toHaveProperty('deduplicationId')
    expect(callArgs[2]).not.toHaveProperty('delayInSeconds')
  })
})

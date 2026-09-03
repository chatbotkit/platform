/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { ensureUntrustedContact } from '@/lib/contact.create'
import { extractContactDetails3 } from '@/lib/extract.contact'
import queue from '@/lib/queue'
import { sendEmailNotification } from '@chatbotkit-dev/email'
import { Usage } from '@/lib/usage.model'

import {
  IDLE_EVENT_TYPE,
  handleIdleEvent,
  sendEvent,
} from '@/pages/api/v1/integration/support/[supportIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    supportIntegration: { findUnique: jest.fn() },
    conversation: { findUnique: jest.fn(), update: jest.fn() },
    message: { findMyriad: jest.fn() },
  },
}))

jest.mock('@/lib/error', () => {
  const actual = jest.requireActual('@/lib/error')

  return {
    ...actual,
    captureError: jest.fn(),
    captureInputError: jest.fn(),
  }
})

jest.mock('@/lib/extract.contact', () => ({
  extractContactDetails3: jest.fn(),
}))

jest.mock('@/lib/contact.create', () => ({
  ensureUntrustedContact: jest.fn(),
}))

jest.mock('@chatbotkit-dev/email', () => ({
  sendEmailNotification: jest.fn(),
}))

jest.mock('@/lib/usage.model', () => ({
  Usage: {
    createAndRecord: jest.fn(),
  },
}))

jest.mock('@/lib/message', () => ({
  getSortedMessages: jest.fn((msgs) => msgs),
}))

jest.mock('@/lib/job', () => ({
  runTasks: jest.fn(async (tasks) => {
    for (const task of tasks) {
      await task()
    }
  }),
}))

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/zod.schema', () => {
  const actual = jest.requireActual('@/lib/zod.schema')

  return {
    ...actual,
    parseAsync: jest.fn(async () => undefined),
  }
})

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn(() => ({ log: jest.fn() })) })),
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: jest.fn((msg) => {
    throw new Error(msg)
  }),
  throwNotAuthorized: jest.fn((msg) => {
    throw new Error(msg)
  }),
}))

describe('handleIdleEvent', () => {
  const SUPPORT_INTEGRATION_ID = 'support-int-1'

  const baseIntegration = {
    id: SUPPORT_INTEGRATION_ID,
    userId: 'user-1',
    trigger: 'always', // not Trigger.never
    email: 'support@example.com',
    botId: null,
  }

  const baseConversation = {
    id: 'conv-1',
    userId: 'user-1',
    name: '',
    description: '',
    meta: {},
    user: { id: 'user-1', email: 'owner@example.com' },
    contact: { id: 'contact-1', email: 'user@example.com', name: 'Alice' },
  }

  const baseMessages = [
    {
      id: 'msg-1',
      type: 'user',
      text: 'Hello',
      meta: {},
      createdAt: new Date('2024-01-01'),
    },
    {
      id: 'msg-2',
      type: 'bot',
      text: 'Hi there',
      meta: {},
      createdAt: new Date('2024-01-02'),
    },
  ]

  const baseExtraction = {
    details: {
      email: 'alice@example.com',
      name: 'Alice Smith',
      conversationName: 'Support Chat',
      conversationDescription: 'A support conversation',
    },
    tokensUsed: 100,
    modelUsed: 'gpt-4',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.supportIntegration.findUnique.mockResolvedValue(baseIntegration)
    prisma.conversation.findUnique.mockResolvedValue(baseConversation)
    prisma.message.findMyriad.mockResolvedValue(baseMessages)
    prisma.conversation.update.mockResolvedValue({})

    extractContactDetails3.mockResolvedValue(baseExtraction)
    Usage.createAndRecord.mockResolvedValue(undefined)
    sendEmailNotification.mockResolvedValue(undefined)
  })

  describe('authorization guards', () => {
    it('should throw not found when integration does not exist', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue(null)

      await expect(
        handleIdleEvent(SUPPORT_INTEGRATION_ID, { conversationId: 'conv-1' })
      ).rejects.toThrow(
        `SupportIntegration not found: ${SUPPORT_INTEGRATION_ID}`
      )
    })

    it('should throw not found when conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      await expect(
        handleIdleEvent(SUPPORT_INTEGRATION_ID, {
          conversationId: 'conv-missing',
        })
      ).rejects.toThrow('Conversation not found: conv-missing')
    })

    it('should throw not authorized when conversation belongs to a different user', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...baseConversation,
        userId: 'user-other',
      })

      await expect(
        handleIdleEvent(SUPPORT_INTEGRATION_ID, { conversationId: 'conv-1' })
      ).rejects.toThrow('Conversation access not allowed: conv-1')
    })

    it('should return early when integration trigger is never', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue({
        ...baseIntegration,
        trigger: 'never',
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      // Should not proceed to fetch conversation or extract details
      expect(prisma.conversation.findUnique).not.toHaveBeenCalled()
      expect(extractContactDetails3).not.toHaveBeenCalled()
    })

    it('should skip autonomous conversations (e.g. trigger runs)', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...baseConversation,
        contact: null,
        meta: { app: 'trigger' },
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      // Should bail before extracting details or creating/attaching a contact
      expect(extractContactDetails3).not.toHaveBeenCalled()
      expect(ensureUntrustedContact).not.toHaveBeenCalled()
      expect(prisma.conversation.update).not.toHaveBeenCalled()
    })
  })

  describe('contact association', () => {
    it('should use existing conversation contact when present', async () => {
      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      // Should not create a new contact when one already exists
      expect(ensureUntrustedContact).not.toHaveBeenCalled()

      // Should update conversation with existing contact id
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contactId: 'contact-1',
          }),
        })
      )
    })

    it('forwards the queue monitor signal to the contact extraction', async () => {
      const signal = { aborted: false }

      await handleIdleEvent(
        SUPPORT_INTEGRATION_ID,
        { conversationId: 'conv-1' },
        { signal }
      )

      // @note the hard-timeout signal must reach the extraction completion so it
      // aborts promptly instead of running to the hard kill
      expect(extractContactDetails3).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ signal })
      )
    })

    it('should create a new contact when conversation has no contact and a real email is extracted', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...baseConversation,
        contact: null,
      })

      extractContactDetails3.mockResolvedValue({
        ...baseExtraction,
        details: { ...baseExtraction.details, email: 'alice@acme.com' },
      })

      ensureUntrustedContact.mockResolvedValue({
        id: 'new-contact-1',
        email: 'alice@acme.com',
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(ensureUntrustedContact).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          email: 'alice@acme.com',
        })
      )

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contactId: 'new-contact-1',
          }),
        })
      )
    })

    it('should NOT create a contact when the extracted email is a reserved example domain', async () => {
      // @note reproduces the trigger/task hallucination signature: the
      // extractor invents a placeholder like "Daily Trigger"
      // <daily_trigger@example.com> when there is no human in the conversation.

      prisma.conversation.findUnique.mockResolvedValue({
        ...baseConversation,
        contact: null,
      })

      extractContactDetails3.mockResolvedValue({
        ...baseExtraction,
        details: {
          ...baseExtraction.details,
          name: 'Daily Trigger',
          email: 'daily_trigger@example.com',
        },
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(ensureUntrustedContact).not.toHaveBeenCalled()

      const updateCall = prisma.conversation.update.mock.calls[0]

      expect(updateCall[0].data).not.toHaveProperty('contactId')
    })

    it('should NOT create a contact when no email can be extracted', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...baseConversation,
        contact: null,
      })

      extractContactDetails3.mockResolvedValue({
        ...baseExtraction,
        details: { ...baseExtraction.details, email: null },
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(ensureUntrustedContact).not.toHaveBeenCalled()

      const updateCall = prisma.conversation.update.mock.calls[0]

      expect(updateCall[0].data).not.toHaveProperty('contactId')
    })
  })

  describe('email sending', () => {
    it('should send email when integration.email and valid contact email are present', async () => {
      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(sendEmailNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'support@example.com',
          subject: expect.stringContaining('Conversation with'),
          replyTo: 'user@example.com',
          content: expect.objectContaining({
            text: expect.any(String),
            html: expect.any(String),
          }),
        })
      )
    })

    it('should not send email when integration.email is missing', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue({
        ...baseIntegration,
        email: null,
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(sendEmailNotification).not.toHaveBeenCalled()
    })

    it('should not send email when contact has no email', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...baseConversation,
        contact: { id: 'contact-1', email: null, name: 'Alice' },
      })

      // @note extractContactDetails3 returns no email either
      extractContactDetails3.mockResolvedValue({
        ...baseExtraction,
        details: { ...baseExtraction.details, email: null },
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(sendEmailNotification).not.toHaveBeenCalled()
    })

    it('should not send email when contact email is invalid', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...baseConversation,
        contact: { id: 'contact-1', email: 'not-an-email', name: 'Alice' },
      })

      extractContactDetails3.mockResolvedValue({
        ...baseExtraction,
        details: { ...baseExtraction.details, email: 'not-an-email' },
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(sendEmailNotification).not.toHaveBeenCalled()
    })
  })

  describe('conversation metadata updates', () => {
    it('should update conversation name when extracted and conversation has no existing name', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...baseConversation,
        name: '', // no existing name
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Support Chat',
          }),
        })
      )
    })

    it('should NOT update conversation name when conversation already has a name', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...baseConversation,
        name: 'Existing Name',
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      const updateCall = prisma.conversation.update.mock.calls[0]

      expect(updateCall[0].data).not.toHaveProperty('name')
    })

    it('should update conversation description when extracted and conversation has no existing description', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...baseConversation,
        description: '', // no existing description
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'A support conversation',
          }),
        })
      )
    })

    it('should NOT update conversation description when it already exists', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...baseConversation,
        description: 'Existing description',
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      const updateCall = prisma.conversation.update.mock.calls[0]

      expect(updateCall[0].data).not.toHaveProperty('description')
    })

    it('should store extracted email and name in conversation meta', async () => {
      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: expect.objectContaining({
              integrations: expect.objectContaining({
                support: expect.objectContaining({
                  email: expect.any(String),
                }),
              }),
            }),
          }),
        })
      )
    })

    it('should filter conversation query by botId when integration has a botId', async () => {
      prisma.supportIntegration.findUnique.mockResolvedValue({
        ...baseIntegration,
        botId: 'bot-1',
      })

      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            botId: 'bot-1',
          }),
        })
      )
    })

    it('should NOT filter by botId when integration has no botId', async () => {
      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      const call = prisma.conversation.findUnique.mock.calls[0]

      expect(call[0].where).not.toHaveProperty('botId')
    })
  })

  describe('usage tracking', () => {
    it('should record usage after contact details extraction', async () => {
      await handleIdleEvent(SUPPORT_INTEGRATION_ID, {
        conversationId: 'conv-1',
      })

      expect(Usage.createAndRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          user: baseConversation.user,
          token: baseExtraction.tokensUsed,
          model: baseExtraction.modelUsed,
          meta: expect.objectContaining({
            reason: 'conversation/extract',
          }),
        })
      )
    })
  })
})

describe('sendEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should queue the event to the correct route', async () => {
    const event = {
      type: IDLE_EVENT_TYPE,
      payload: { conversationId: 'conv-1' },
    }

    await sendEvent('support-int-1', event)

    expect(queue).toHaveBeenCalledWith(
      '/api/v1/integration/support/support-int-1/queue',
      event
    )
  })

  it('should validate idle event payload before queuing', async () => {
    const { parseAsync } = require('@/lib/zod.schema')

    const event = {
      type: IDLE_EVENT_TYPE,
      payload: { conversationId: 'conv-1' },
    }

    await sendEvent('support-int-1', event)

    expect(parseAsync).toHaveBeenCalled()
    expect(queue).toHaveBeenCalled()
  })
})

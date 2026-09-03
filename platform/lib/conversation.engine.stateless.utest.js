/**
 * @jest-environment node
 */

/* eslint-disable custom-eslint-rules/require-dispose-for-factory-result -- tests create short-lived engines and clean database state explicitly */
import prisma from '@/prisma/client'

import { deleteBot } from '@/lib/bot.delete'
import {
  CoreEngine,
  getStatelessConversationEngine,
} from '@/lib/conversation.engine'

jest.retryTimes(3)

const testBotModel = 'custom/name=test-bot/provider=openai/credentials=sk-test'
const testExplicitModel =
  'custom/name=test-explicit/provider=openai/credentials=sk-test'
const testFallbackModel =
  'custom/name=test-fallback/provider=openai/credentials=sk-test'

async function cleanupBot(botId) {
  if (!botId) {
    return
  }

  await deleteBot({ id: botId })
}

describe('getStatelessConversationEngine', () => {
  it('must propagate provided messages into engine instance', async () => {
    const engine = await getStatelessConversationEngine({
      messages: [
        { type: 'user', text: 'Hello there' },
        { type: 'bot', text: 'Hi!' },
      ],
      options: {
        userId: '-',
        model: testBotModel,
      },
    })

    expect(engine).toBeInstanceOf(CoreEngine)

    const messages = await engine.getMessages()

    expect(messages.at(-2)).toEqual({ type: 'user', text: 'Hello there' })
    expect(messages.at(-1)).toEqual({ type: 'bot', text: 'Hi!' })
  })

  it('must preserve caller usage references when no bot or conversation is resolved', async () => {
    // @note the stateless engine has no persisted conversation and resolves no
    // bot here, so the caller-provided references (e.g. from the extract
    // integration) must survive instead of being clobbered with undefined

    const engine = await getStatelessConversationEngine({
      messages: [{ type: 'user', text: 'Hello' }],
      options: {
        userId: '-',
        model: testBotModel,
        usageReferences: {
          conversationId: 'conv_test_123',
          botId: 'bot_test_456',
        },
      },
    })

    expect(engine).toBeInstanceOf(CoreEngine)

    expect(engine.usageReferences).toMatchObject({
      conversationId: 'conv_test_123',
      botId: 'bot_test_456',
    })
  })

  it('must inherit bot details when botId provided', async () => {
    const userId = '-'
    let botId

    try {
      ;({ id: botId } = await prisma.bot.create({
        data: {
          userId,
          name: 'Test Bot',
          description: 'Test Description',
          backstory: 'You are helpful.',
          model: testBotModel,
        },
        select: { id: true },
      }))

      const engine = await getStatelessConversationEngine({
        botId,
        options: {
          userId,
        },
      })

      expect(engine).toBeInstanceOf(CoreEngine)

      const messages = await engine.getMessages()

      expect(messages[0].type).toBe('backstory')
      expect(messages[0].text).toContain('You are helpful.')
    } finally {
      await cleanupBot(botId)
    }
  })

  it('must prefer explicit options over bot details (reversed precedence)', async () => {
    const userId = '-'
    let botId

    try {
      ;({ id: botId } = await prisma.bot.create({
        data: {
          userId,
          name: 'Test Bot',
          description: 'Test Description',
          backstory: 'Bot backstory.',
          model: testBotModel,
          privacy: true,
          moderation: true,
        },
        select: { id: true },
      }))

      const engine = await getStatelessConversationEngine({
        botId,
        backstory: 'Explicit backstory.',
        model: testExplicitModel,
        privacy: false,
        moderation: false,
        options: {
          userId,
        },
      })

      const messages = await engine.getMessages()

      expect(messages[0].text).toContain('Explicit backstory.')
      expect(messages[0].text).not.toContain('Bot backstory.')

      expect(engine.backstory).toContain('Explicit backstory.')
      expect(engine.model).toBe(testExplicitModel)
      expect(engine.privacy).toBe(false)
      expect(engine.moderation).toBe(false)
    } finally {
      await cleanupBot(botId)
    }
  })

  it('must fall back to the bot model when the explicit model is an empty string', async () => {
    const userId = '-'
    let botId

    try {
      ;({ id: botId } = await prisma.bot.create({
        data: {
          userId,
          name: 'Test Bot',
          description: 'Test Description',
          backstory: 'Bot backstory.',
          model: testFallbackModel,
        },
        select: { id: true },
      }))

      const engine = await getStatelessConversationEngine({
        botId,
        model: '',
        options: {
          userId,
        },
      })

      expect(engine.model).toBe(testFallbackModel)
    } finally {
      await cleanupBot(botId)
    }
  })
})

/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'
import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import { createConversation } from '@/lib/conversation.create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/bot.access', () => ({
  canUseBot: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/dataset.access', () => ({
  canUseDataset: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/skillset.access', () => ({
  canUseSkillset: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/usage.record', () => ({
  recordConversationUsage: jest.fn().mockResolvedValue(undefined),
  recordMessageUsage: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,

  default: jest.fn(() => ({ log: jest.fn() })),

  createSpan: jest.fn(() => ({ finish: jest.fn() })),
}))

jest.mock('@/lib/cuid', () => ({
  __esModule: true,

  default: jest.fn(() => 'cuid-123'),
}))

jest.mock('@/lib/message', () => ({
  getMessageType: jest.fn((t) => t),
}))

const { canUseBot } = jest.requireMock('@/lib/bot.access')
const { canUseDataset } = jest.requireMock('@/lib/dataset.access')
const { canUseSkillset } = jest.requireMock('@/lib/skillset.access')
const { recordConversationUsage, recordMessageUsage } =
  jest.requireMock('@/lib/usage.record')
const { getMessageType } = jest.requireMock('@/lib/message')

describe('conversation.create.createConversation', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.clearAllMocks()
  })

  const userId = 'user-1'

  test('creates a conversation with minimal options (no messages)', async () => {
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    const result = await createConversation(userId, {})

    expect(result).toEqual({ id: 'cuid-123' })
    expect(prisma.conversation.create).toHaveBeenCalledTimes(1)
    expect(recordConversationUsage).toHaveBeenCalledWith({
      user: { id: userId },
      count: 1,
    })
    expect(recordMessageUsage).not.toHaveBeenCalled()
  })

  test('persists provided messages and records message usage', async () => {
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })
    prisma.message.createMany.mockResolvedValue({ count: 2 })

    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'bot', text: 'Hi there' },
    ]

    const result = await createConversation(userId, { messages })

    expect(result).toEqual({ id: 'cuid-123', messages })
    expect(prisma.message.createMany).toHaveBeenCalledTimes(1)

    const callArg = prisma.message.createMany.mock.calls[0][0].data

    expect(callArg).toHaveLength(2)
    expect(getMessageType).toHaveBeenCalledWith('user')
    expect(getMessageType).toHaveBeenCalledWith('bot')
    expect(recordMessageUsage).toHaveBeenCalledWith({
      user: { id: userId },
      count: 2,
    })
  })

  test('reuses supplied bot resource from resources list without extra fetch', async () => {
    const botInstance = { id: 'bot-1', userId: 'user-1', visibility: 'public' }

    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    await createConversation(userId, {
      botId: 'bot-1',
      resources: [
        {
          type: 'bot',
          instance: botInstance,
        },
      ],
    })

    expect(prisma.bot.findUnique).not.toHaveBeenCalled()
    expect(canUseBot).toHaveBeenCalledWith(userId, botInstance)
  })

  test('fetches bot when not provided in resources', async () => {
    const botInstance = { id: 'bot-2', userId: userId, visibility: 'public' }

    prisma.bot.findUnique.mockResolvedValue(botInstance)
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    await createConversation(userId, { botId: 'bot-2' })

    expect(prisma.bot.findUnique).toHaveBeenCalledWith({
      where: { id: 'bot-2' },
      select: { id: true, userId: true, visibility: true },
      cacheStrategy: { ttl: 60, swr: 60 },
    })
    expect(canUseBot).toHaveBeenCalledWith(userId, botInstance)
  })

  test('throws when bot not found', async () => {
    prisma.bot.findUnique.mockResolvedValue(null)

    await expect(
      createConversation(userId, { botId: 'missing-bot' })
    ).rejects.toThrow('Bot not found: missing-bot')
  })

  test('throws when bot access denied', async () => {
    const botInstance = {
      id: 'bot-3',
      userId: 'other-user',
      visibility: 'private',
    }

    prisma.bot.findUnique.mockResolvedValue(botInstance)
    canUseBot.mockResolvedValueOnce(false)

    await expect(
      createConversation(userId, { botId: 'bot-3' })
    ).rejects.toThrow('You are not authorized to access this bot')
  })

  test('bypasses access control when bpacc is true', async () => {
    const botInstance = {
      id: 'bot-4',
      userId: 'other-user',
      visibility: 'private',
    }

    prisma.bot.findUnique.mockResolvedValue(botInstance)
    canUseBot.mockResolvedValueOnce(false)
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    const result = await createConversation(
      userId,
      { botId: 'bot-4' },
      { bpacc: true }
    )

    expect(result.id).toBe('cuid-123')
    expect(canUseBot).toHaveBeenCalled()
  })

  test('handles dataset and skillset validation similarly', async () => {
    const datasetInstance = { id: 'ds-1', userId: userId, visibility: 'public' }
    const skillsetInstance = {
      id: 'sk-1',
      userId: userId,
      visibility: 'public',
    }

    prisma.dataset.findUnique.mockResolvedValue(datasetInstance)
    prisma.skillset.findUnique.mockResolvedValue(skillsetInstance)
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    const result = await createConversation(userId, {
      datasetId: 'ds-1',
      skillsetId: 'sk-1',
    })

    expect(result.id).toBe('cuid-123')
    expect(canUseDataset).toHaveBeenCalledWith(userId, datasetInstance)
    expect(canUseSkillset).toHaveBeenCalledWith(userId, skillsetInstance)
  })

  test('message text respects MAX_DB_TEXT_BYTES_LENGTH', async () => {
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })
    prisma.message.createMany.mockResolvedValue({ count: 1 })

    const longText = 'a'.repeat(70000) // > 65533

    await createConversation(userId, {
      messages: [{ type: 'user', text: longText }],
    })

    const dataEntry = prisma.message.createMany.mock.calls[0][0].data[0]

    expect(dataEntry.text.length).toBe(
      Math.min(longText.length, MAX_DB_TEXT_BYTES_LENGTH)
    )
  })

  test('throws when dataset not found', async () => {
    prisma.dataset.findUnique.mockResolvedValue(null)

    await expect(
      createConversation(userId, { datasetId: 'missing-ds' })
    ).rejects.toThrow('Dataset not found: missing-ds')
  })

  test('throws when dataset access denied', async () => {
    const datasetInstance = {
      id: 'ds-private',
      userId: 'other-user',
      visibility: 'private',
    }

    prisma.dataset.findUnique.mockResolvedValue(datasetInstance)
    canUseDataset.mockResolvedValueOnce(false)

    await expect(
      createConversation(userId, { datasetId: 'ds-private' })
    ).rejects.toThrow('You are not authorized to access this dataset')
  })

  test('reuses dataset resource from resources list without extra fetch', async () => {
    const datasetInstance = { id: 'ds-1', userId: userId, visibility: 'public' }

    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    await createConversation(userId, {
      datasetId: 'ds-1',
      resources: [{ type: 'dataset', instance: datasetInstance }],
    })

    expect(prisma.dataset.findUnique).not.toHaveBeenCalled()
    expect(canUseDataset).toHaveBeenCalledWith(userId, datasetInstance)
  })

  test('throws when skillset not found', async () => {
    prisma.skillset.findUnique.mockResolvedValue(null)

    await expect(
      createConversation(userId, { skillsetId: 'missing-sk' })
    ).rejects.toThrow('Skillset not found: missing-sk')
  })

  test('throws when skillset access denied', async () => {
    const skillsetInstance = {
      id: 'sk-private',
      userId: 'other-user',
      visibility: 'private',
    }

    prisma.skillset.findUnique.mockResolvedValue(skillsetInstance)
    canUseSkillset.mockResolvedValueOnce(false)

    await expect(
      createConversation(userId, { skillsetId: 'sk-private' })
    ).rejects.toThrow('You are not authorized to access this skillset')
  })

  test('reuses skillset resource from resources list without extra fetch', async () => {
    const skillsetInstance = {
      id: 'sk-1',
      userId: userId,
      visibility: 'public',
    }

    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    await createConversation(userId, {
      skillsetId: 'sk-1',
      resources: [{ type: 'skillset', instance: skillsetInstance }],
    })

    expect(prisma.skillset.findUnique).not.toHaveBeenCalled()
    expect(canUseSkillset).toHaveBeenCalledWith(userId, skillsetInstance)
  })

  test('passes contactId, taskId and spaceId to conversation data', async () => {
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    await createConversation(userId, {
      contactId: 'contact-1',
      taskId: 'task-1',
      spaceId: 'space-1',
    })

    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactId: 'contact-1',
          taskId: 'task-1',
          spaceId: 'space-1',
        }),
      })
    )
  })

  test('stores namespace in conversation meta', async () => {
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    await createConversation(userId, { namespace: 'my-ns' })

    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          meta: expect.objectContaining({ namespace: 'my-ns' }),
        }),
      })
    )
  })

  test('merges custom meta with namespace into conversation meta', async () => {
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    await createConversation(userId, {
      namespace: 'ns-1',
      meta: { customKey: 'customValue' },
    })

    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          meta: { namespace: 'ns-1', customKey: 'customValue' },
        }),
      })
    )
  })

  test('bypasses access control for dataset when bpacc is true', async () => {
    const datasetInstance = {
      id: 'ds-private',
      userId: 'other-user',
      visibility: 'private',
    }

    prisma.dataset.findUnique.mockResolvedValue(datasetInstance)
    canUseDataset.mockResolvedValueOnce(false)
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    const result = await createConversation(
      userId,
      { datasetId: 'ds-private' },
      { bpacc: true }
    )

    expect(result.id).toBe('cuid-123')
    expect(canUseDataset).toHaveBeenCalled()
  })

  test('bypasses access control for skillset when bpacc is true', async () => {
    const skillsetInstance = {
      id: 'sk-private',
      userId: 'other-user',
      visibility: 'private',
    }

    prisma.skillset.findUnique.mockResolvedValue(skillsetInstance)
    canUseSkillset.mockResolvedValueOnce(false)
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })

    const result = await createConversation(
      userId,
      { skillsetId: 'sk-private' },
      { bpacc: true }
    )

    expect(result.id).toBe('cuid-123')
    expect(canUseSkillset).toHaveBeenCalled()
  })

  test('preserves meta property from individual messages', async () => {
    prisma.conversation.create.mockResolvedValue({ id: 'cuid-123' })
    prisma.message.createMany.mockResolvedValue({ count: 1 })

    const msgMeta = { source: 'webhook', priority: 1 }

    await createConversation(userId, {
      messages: [{ type: 'user', text: 'Hello', meta: msgMeta }],
    })

    const callArg = prisma.message.createMany.mock.calls[0][0].data[0]

    expect(callArg.meta).toEqual(msgMeta)
  })
})

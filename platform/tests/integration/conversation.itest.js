import { ConversationClient } from '@chatbotkit/sdk/conversation/index.js'

import { z } from 'zod'

const env = z
  .object({
    _ITEST_CHATBOTKIT_BASE_URL: z.string(),
    _ITEST_CHATBOTKIT_SECRET: z.string(),
  })
  .parse(process.env)

jest.retryTimes(3)

describe('ConversationClient', () => {
  const client = new ConversationClient({
    baseUrl: env._ITEST_CHATBOTKIT_BASE_URL,
    secret: env._ITEST_CHATBOTKIT_SECRET,
  })

  it('should be able to list conversations', async () => {
    const conversations = await client.list()

    expect(conversations).toBeTruthy()
    expect(Array.isArray(conversations.items)).toBeTruthy()
    expect(conversations.items.length).toBeTruthy()
  })

  it('should be able to list conversations with stream', async () => {
    let total = 0

    for await (const _item of client.list().stream()) {
      total++
    }

    expect(total).toBeTruthy()
  })

  it('should be able to create and delete conversations', async () => {
    const conversation = await client.create({})

    expect(conversation?.id).toBeTruthy()

    expect(await client.delete(conversation.id)).toBeTruthy()
  })

  it('should be able to complete conversation', async () => {
    const messages = [{ type: 'user', text: 'Hi there' }]

    let text = ''

    for await (const item of client.complete(null, { messages }).stream()) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toBeTruthy()
  })

  it('should be able to complete conversation with inline abilities', async () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'bot', text: 'Hi there! How can I assist you today?' },
      { type: 'user', text: 'get my last message' },
    ]

    const inlineSkillset = {
      abilities: [
        {
          name: 'getLastMessage',
          description: 'Get the last message',
          instruction: '```echo\nThe last message just says "Hi Bob"\n```',
        },
      ],
    }

    const receivedMessages = []

    for await (const item of client
      .complete(null, { messages, extensions: { skillsets: [inlineSkillset] } })
      .stream()) {
      if (item.type === 'message') {
        receivedMessages.push(item.data)
      }
    }

    const lastReceivedMessage = receivedMessages.at(-1)

    expect(lastReceivedMessage).toBeTruthy()
    expect(lastReceivedMessage.type).toEqual('bot')
    expect(lastReceivedMessage.text).toContain('Hi Bob')
  })

  it('should be able to complete conversations with functions', async () => {
    const messages = [
      { type: 'user', text: 'Hello' },
      { type: 'bot', text: 'Hi there! How can I assist you today?' },
      { type: 'user', text: 'get my last message' },
    ]

    const functions = [
      {
        name: 'getLastMessage',
        description: 'Get the last message',
        parameters: {},
      },
    ]

    const receivedMessages = []

    for await (const item of client
      .complete(null, { messages, functions })
      .stream()) {
      if (item.type === 'message') {
        receivedMessages.push(item.data)
      }
    }

    const lastReceivedMessage = receivedMessages.at(-1)

    expect(lastReceivedMessage).toBeTruthy()
    expect(lastReceivedMessage.type).toEqual('activity')
    expect(lastReceivedMessage.meta.activity.function.name).toEqual(
      'getLastMessage'
    )
  })

  it('should be able to complete stateful conversation', async () => {
    const { id: conversationId } = await client.create({})

    let text = ''

    for await (const item of client
      .complete(conversationId, { text: 'Hi there' })
      .stream()) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toBeTruthy()

    await client.delete(conversationId)
  })

  it('should be able to complete conversation with inline abilities', async () => {
    const { id: conversationId } = await client.create({})

    const inlineSkillset = {
      abilities: [
        {
          name: 'getLastMessage',
          description: 'Get the last message',
          instruction: '```echo\nThe last message just says "Hi Bob"\n```',
        },
      ],
    }

    let text = ''

    for await (const item of client
      .complete(conversationId, {
        text: 'get my last message',
        extensions: { skillsets: [inlineSkillset] },
      })
      .stream()) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toContain('Hi Bob')

    await client.delete(conversationId)
  })
})

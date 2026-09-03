import { ConversationClient } from '@chatbotkit/sdk/conversation/index.js'
import { DatasetClient } from '@chatbotkit/sdk/dataset/index.js'

import { z } from 'zod'

const env = z
  .object({
    _ITEST_CHATBOTKIT_BASE_URL: z.string(),
    _ITEST_CHATBOTKIT_SECRET: z.string(),
  })
  .parse(process.env)

describe('DatasetClient', () => {
  const client = new DatasetClient({
    baseUrl: env._ITEST_CHATBOTKIT_BASE_URL,
    secret: env._ITEST_CHATBOTKIT_SECRET,
  })

  it('should be able to list datasets', async () => {
    const datasets = await client.list()

    expect(datasets).toBeTruthy()
    expect(Array.isArray(datasets.items)).toBeTruthy()
    expect(datasets.items.length).toBeTruthy()
  })

  it('should be able to list datasets with stream', async () => {
    let total = 0

    for await (const _item of client.list().stream()) {
      total++
    }

    expect(total).toBeTruthy()
  })

  it('any dataset should have at least one record', async () => {
    const datasets = await client.list()

    expect(
      (
        await Promise.all(
          datasets.items.map(async (dataset) => {
            const records = await client.record.list(dataset.id)

            return records.items.length
          })
        )
      ).some((total) => total > 0)
    ).toBeTruthy()
  })

  it('should be able to create and use a dataset', async () => {
    const { id } = await client.create({
      searchMaxRecords: 1,
    })

    try {
      await client.record.create(id, {
        text: "Today's word is banana-pineapple-boop.",
      })

      const conversationClient = new ConversationClient({
        baseUrl: env._ITEST_CHATBOTKIT_BASE_URL,
        secret: env._ITEST_CHATBOTKIT_SECRET,
      })

      const messages = [
        {
          type: 'backstory',
          text: 'You are a question and answer bot. Use the available tools to help answer the question.',
        },
        { type: 'user', text: "What's todays word?" },
      ]

      const newMessages = []

      let text = ''

      for await (const item of conversationClient
        .complete(null, { model: 'gpt-4o', messages, datasetId: id })
        .stream()) {
        if (item.type === 'token') {
          text += item.data.token
        } else if (item.type === 'message') {
          newMessages.push(item.data)
        }
      }

      expect(text).toBeTruthy()
      expect(text.toLowerCase()).toContain('banana-pineapple-boop')
    } finally {
      await client.delete(id)
    }
  })
})

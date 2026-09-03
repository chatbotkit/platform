import { ConversationClient } from '@chatbotkit/sdk/conversation/index.js'
import { SkillsetClient } from '@chatbotkit/sdk/skillset/index.js'

import { z } from 'zod'

const env = z
  .object({
    _ITEST_CHATBOTKIT_BASE_URL: z.string(),
    _ITEST_CHATBOTKIT_SECRET: z.string(),
  })
  .parse(process.env)

describe('SkillsetClient', () => {
  const client = new SkillsetClient({
    baseUrl: env._ITEST_CHATBOTKIT_BASE_URL,
    secret: env._ITEST_CHATBOTKIT_SECRET,
  })

  it('should be able to list skillsets', async () => {
    const skillsets = await client.list()

    expect(skillsets).toBeTruthy()
    expect(Array.isArray(skillsets.items)).toBeTruthy()
    expect(skillsets.items.length).toBeTruthy()
  })

  it('should be able to list skillsets with stream', async () => {
    let total = 0

    for await (const _item of client.list().stream()) {
      total++
    }

    expect(total).toBeTruthy()
  })

  it('any skillset should have at least one ability', async () => {
    const skillsets = await client.list()

    expect(
      (
        await Promise.all(
          skillsets.items.map(async (dataset) => {
            const abilities = await client.ability.list(dataset.id)

            return abilities.items.length
          })
        )
      ).some((total) => total > 0)
    ).toBeTruthy()
  })

  it('should be able to create and use a skillset', async () => {
    const { id } = await client.create({})

    try {
      await client.ability.create(id, {
        name: 'Get Weather',
        description: 'Get the weather of a city',
        instruction: `\`\`\`echo
The weather in $[location|the location, e.g london] is fine!
\`\`\``,
      })

      const conversationClient = new ConversationClient({
        baseUrl: env._ITEST_CHATBOTKIT_BASE_URL,
        secret: env._ITEST_CHATBOTKIT_SECRET,
      })

      const messages = [
        {
          type: 'user',
          text: 'Hi there. What is the weather like in Sofia?',
        },
      ]

      const newMessages = []

      let text = ''

      for await (const item of conversationClient
        .complete(null, { messages, skillsetId: id })
        .stream()) {
        if (item.type === 'token') {
          text += item.data.token
        } else if (item.type === 'message') {
          newMessages.push(item.data)
        }
      }

      expect(text).toBeTruthy()
      expect(text.toLowerCase()).toContain('sofia')
    } finally {
      await client.delete(id)
    }
  }, 180000)
})

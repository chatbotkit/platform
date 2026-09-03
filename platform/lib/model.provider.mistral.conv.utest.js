import { completeChatConversation } from '@/lib/model.provider.mistral.conv'

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('mistral')
  ? describe
  : describe.skip

describeIfConfigured('completeChatConversation', () => {
  it.skip('must be able to complete chat conversation', async () => {
    const options = {
      model: 'mistral-large-latest',
      backstory: 'A bot that can do math',
      messages: [{ type: 'user', text: 'How much is 2+2?' }],
    }

    let text = ''

    for await (const item of completeChatConversation(options)) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toBeTruthy()
  })

  it.skip('must be able to complete chat conversation with functions', async () => {
    const options = {
      model: 'mistral-large-latest',
      backstory: 'A bot that fetches the last message',
      messages: [
        {
          type: 'user',
          text: `Use the getFoodPreferences function to fetch my food preferences and print them to me.`,
        },
      ],
      functions: [
        {
          name: 'getFoodPreferences',
          description: 'A simple function to get the users food preferences',
          parameters: {},

          handler: async () => {
            return JSON.stringify({ preferences: ['avocado'] })
          },
        },
      ],
    }

    let text = ''

    for await (const item of completeChatConversation(options)) {
      if (item.type === 'token') {
        text += item.data.token
      }
    }

    expect(text).toMatch(/av[oa]cado/i)
  })
})

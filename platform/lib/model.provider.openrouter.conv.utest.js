import { completeChatConversation } from '@/lib/model.provider.openrouter.conv'

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('openrouter')
  ? describe
  : describe.skip

describeIfConfigured('completeChatConversation', () => {
  it.each([['claude-3.7-sonnet']])(
    'must be able to complete chat conversation',
    async (model) => {
      const options = {
        model: model,
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
    }
  )

  it.each([['claude-3.7-sonnet', 'claude-3.5-sonnet']])(
    'must be able to complete chat conversation with functions',
    async (model) => {
      const options = {
        model: model,
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
          {
            name: 'getFirstMessage',
            description: 'A simple function that gets the first message',
            parameters: {},

            handler: async () => {
              return JSON.stringify({ messages: ['apple'] })
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
    }
  )
})

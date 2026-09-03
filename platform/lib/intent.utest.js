import { baseLanguageModel } from '@/config/models'

import { getStatelessConversationEngine } from '@/lib/conversation.engine'
import { detectIntentV1, detectIntentV2, detectIntentV3 } from '@/lib/intent'
import { execPrompt } from '@/lib/prompt'
import { Usage } from '@/lib/usage.model'

jest.mock('@/lib/conversation.engine', () => ({
  getStatelessConversationEngine: jest.fn(),
}))

jest.mock('@/lib/prompt', () => ({
  execPrompt: jest.fn(),
}))

jest.retryTimes(3)

const user = { id: '123' }

describe.skip('detectIntentV1', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not detect any intent when the last message is not from the user', async () => {
    await expect(
      detectIntentV1(
        [{ type: 'bot', text: 'Hello there.' }],
        [
          {
            name: 'search',
            description: 'Search for additional information',
          },
        ],
        { user }
      )
    ).resolves.toEqual({
      action: null,
      tokensUsed: 0,
      modelUsed: baseLanguageModel,
    })

    expect(execPrompt).not.toHaveBeenCalled()
  })

  it('should detect a valid prompted action', async () => {
    execPrompt.mockResolvedValueOnce({
      completion: JSON.stringify({
        name: 'search',
        input: 'How much does ChatBotKit cost?',
      }),
      tokensUsed: 23,
      modelUsed: 'gpt-4.1-mini',
    })

    await expect(
      detectIntentV1(
        [
          {
            type: 'bot',
            text: 'ChatBotKit helps you build advanced AI chatbots.',
          },
          { type: 'user', text: 'How much chatbotkit cost?' },
        ],
        [
          {
            name: 'search',
            description: 'Search for additional information',
          },
        ],
        { user }
      )
    ).resolves.toEqual({
      action: {
        name: 'search',
        input: 'How much does ChatBotKit cost?',
      },
      tokensUsed: 23,
      modelUsed: 'gpt-4.1-mini',
    })
  })

  it('should discard prompted actions that are not in the allowed list', async () => {
    execPrompt.mockResolvedValueOnce({
      completion: JSON.stringify({
        name: 'delete_everything',
        input: 'Delete everything',
      }),
      tokensUsed: 11,
      modelUsed: 'gpt-4.1-mini',
    })

    await expect(
      detectIntentV1(
        [{ type: 'user', text: 'Delete everything' }],
        [
          {
            name: 'search',
            description: 'Search for additional information',
          },
        ],
        { user }
      )
    ).resolves.toEqual({
      action: null,
      tokensUsed: 11,
      modelUsed: 'gpt-4.1-mini',
    })
  })
})

describe.skip('detectIntentV2', () => {
  it('should not detect any intent for empty conversation', async () => {
    expect(await detectIntentV2([], [], { user })).toMatchObject({
      action: null,
    })
  })

  it('should not detect any intent for an unknown action', async () => {
    expect(
      await detectIntentV2(
        [{ type: 'user', text: 'Can you please delete my account?' }],
        [],
        { user }
      )
    ).toMatchObject({ action: null })
  })

  it('should not detect search intent', async () => {
    expect(
      await detectIntentV2(
        [
          {
            type: 'bot',
            text: 'Thank you very much. Let me know if you have more questions.',
          },
          { type: 'user', text: 'No thank you! I am good!' },
        ],
        [],
        { user }
      )
    ).toMatchObject({ action: null })

    expect(
      await detectIntentV2(
        [
          {
            type: 'bot',
            text: 'Thank you very much. Let me know if you have more questions.',
          },
          { type: 'user', text: 'No thank you! I am good!' },
        ],
        [
          {
            name: 'search',
            description: `search for additional information based on the user's input`,
          },
        ],
        {
          user,
        }
      )
    ).toMatchObject({ action: null })
  })

  it('should detect search intent', async () => {
    expect(
      await detectIntentV2(
        [
          {
            type: 'bot',
            text: 'ChatBotKit helps you build advanced AI chatbots.',
          },
          { type: 'user', text: 'How much chatbotkit cost?' },
        ],
        [
          {
            name: 'search',
            description: `Search for additional information based on the user's questions related to: chatbotkit`,
            hintMessages: [
              {
                type: 'instruction',
                text: `Use search function if the user is asking for information but there are no available answers in the conversation itself and the query is related: ChatBotKit`,
              },
            ],
          },
        ],
        {
          user,
        }
      )
    ).toMatchObject({ action: { name: 'search' } })
  })

  it('should detect delete_this_user_forever intent', async () => {
    expect(
      await detectIntentV2(
        [
          {
            type: 'bot',
            text: 'ChatBotKit helps you build advanced AI chatbots.',
          },
          {
            type: 'user',
            text: 'Please forget me forever and never callback!',
          },
        ],
        [
          {
            name: 'search',
            description: `search for additional information based on the user's input`,
          },
          {
            name: 'delete_this_user_forever',
            description: 'The user will be deleted forever from the system.',
          },
        ],
        {
          user,
        }
      )
    ).toMatchObject({ action: { name: 'delete_this_user_forever' } })
  })

  it('should detect delete_this_user_forever intent dubious', async () => {
    expect(
      await detectIntentV2(
        [
          {
            type: 'bot',
            text: 'ChatBotKit helps you build advanced AI chatbots.',
          },
          {
            type: 'user',
            text: 'Please forget me forever and never callback!',
          },
        ],
        [
          {
            name: 'search',
            description: `search for additional information based on the user's input`,
          },
          {
            name: 'delete_from_mailing_list',
            description:
              'The user will be removed from the given mailing list.',
          },
          {
            name: 'delete_this_user_forever',
            description: 'The user will be deleted forever from the system.',
          },
        ],
        {
          user,
        }
      )
    ).toMatchObject({ action: { name: 'delete_this_user_forever' } })
  })
})

describe('detectIntentV3', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should preserve structured action input extracted from json schema', async () => {
    const usage = new Usage()

    usage.addTokens(17, baseLanguageModel)

    getStatelessConversationEngine.mockImplementationOnce(async (config) => {
      return {
        complete: jest.fn(async () => {
          await config.options.sink.push('message', {
            type: 'activity',
            meta: {
              activity: {
                type: 'request',
                function: {
                  name: 'detectIntentV3',
                  arguments: {
                    data: {
                      name: 'modify_image',
                      input: {
                        prompt: 'Edit the original image',
                        directions: 'Keep the same design language',
                        images: ['https://example.com/original.png'],
                      },
                    },
                  },
                },
              },
            },
          })

          return { usage }
        }),
        dispose: jest.fn(async () => undefined),
      }
    })

    await expect(
      detectIntentV3(
        [{ type: 'user', text: 'Modify the original image' }],
        [
          {
            name: 'modify_image',
            description: 'Modify an existing image using edit instructions',
            parameters: {
              type: 'object',
              properties: {
                prompt: { type: 'string' },
                directions: { type: 'string' },
                images: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        ],
        { user }
      )
    ).resolves.toEqual({
      action: {
        name: 'modify_image',
        input: {
          prompt: 'Edit the original image',
          directions: 'Keep the same design language',
          images: ['https://example.com/original.png'],
        },
      },
      tokensUsed: usage.token,
      modelUsed: 'gemini-2.5-flash',
    })
  })

  it('should discard extracted actions that are not in the allowed list', async () => {
    getStatelessConversationEngine.mockImplementationOnce(async (config) => {
      return {
        complete: jest.fn(async () => {
          await config.options.sink.push('message', {
            type: 'activity',
            meta: {
              activity: {
                type: 'request',
                function: {
                  name: 'detectIntentV3',
                  arguments: {
                    data: {
                      name: 'delete_everything',
                      input: {},
                    },
                  },
                },
              },
            },
          })

          return { usage: new Usage() }
        }),
        dispose: jest.fn(async () => undefined),
      }
    })

    await expect(
      detectIntentV3(
        [{ type: 'user', text: 'Delete everything' }],
        [
          {
            name: 'search',
            description: 'Search for additional information',
          },
        ],
        { user }
      )
    ).resolves.toEqual({
      action: null,
      tokensUsed: 0,
      modelUsed: 'gemini-2.5-flash',
    })
  })
})

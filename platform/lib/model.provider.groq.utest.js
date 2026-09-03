import {
  createChatCompletion,
  createChatCompletionStream,
} from '@/lib/model.provider.groq'

jest.retryTimes(3)

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('groq')
  ? describe
  : describe.skip

describeIfConfigured('createChatCompletion', () => {
  it('must correctly complete chat', async () => {
    const { completion, usage } = await createChatCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content:
            'Finish the following sequence by guessing the next number 1,2,3,',
        },
      ],
    })

    expect(completion).toBeTruthy()
    expect(usage.totalTokens).toBeGreaterThan(0)
  })

  it('must correctly interpret chat and tool calls', async () => {
    const { toolCalls } = await createChatCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Please book a meeting tonight!' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'book_meeting',
            description: 'Book a meeting',
            parameters: {
              type: 'object',
              properties: {
                when: {
                  type: 'string',
                  enum: ['tonight', 'tomorrow', 'next week', 'next month'],
                },
              },
            },
          },
        },
      ],
    })

    expect(toolCalls?.length).toEqual(1)
    expect(toolCalls?.[0]?.function).toEqual({
      name: 'book_meeting',
      arguments: {
        when: 'tonight',
      },
    })
  })
})

describeIfConfigured('createChatCompletionStream', () => {
  it('must correctly complete chat with stream', async () => {
    const chunks = []

    for await (const { completion } of createChatCompletionStream({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content:
            'Finish the following sequence by guessing the next number 1,2,3,',
        },
      ],
    })) {
      chunks.push(completion)
    }

    expect(chunks.join('')).toBeTruthy()
  })

  it('must correctly interpret chat with stream and tool calls', async () => {
    const calls = []

    for await (const { toolCalls } of createChatCompletionStream({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Book a meeting tonight!' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'book_meeting',
            description: 'Book a meeting',
            parameters: {
              type: 'object',
              properties: {
                when: {
                  type: 'string',
                  enum: ['tonight', 'tomorrow', 'next week', 'next month'],
                },
              },
            },
          },
        },
      ],
    })) {
      if (toolCalls) {
        calls.push(...toolCalls)
      }
    }

    expect(calls.length).toEqual(1)
    expect(calls[0].function.name.toLowerCase()).toEqual('book_meeting')
    expect(calls[0].function.arguments.when.toLowerCase()).toEqual('tonight')
  })
})

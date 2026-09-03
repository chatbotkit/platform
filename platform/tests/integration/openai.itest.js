import OpenAI from 'openai'
import { z } from 'zod'

const env = z
  .object({
    _ITEST_CHATBOTKIT_BASE_URL: z.string(),
    _ITEST_CHATBOTKIT_SECRET: z.string(),
  })
  .parse(process.env)

jest.retryTimes(3)

// @note exercises the OpenAI-compatible endpoint with the real `openai` SDK to
// prove end-to-end compatibility: the SDK builds the request, our endpoint
// translates it onto the CBK engine, and the SDK parses our response. The
// model field is a CBK structstr selector (see pages/api/v1/openai/chat).

describe('OpenAI-compatible chat completions', () => {
  const client = new OpenAI({
    apiKey: env._ITEST_CHATBOTKIT_SECRET,

    // @note on api.chatbotkit.com the /api prefix is rewritten away, but the
    // raw itest host serves routes under /api, matching the other itests.
    baseURL: new URL('/api/v1/openai', env._ITEST_CHATBOTKIT_BASE_URL).href,

    // @note the itest runner uses a jsdom-based environment which the SDK flags
    // as browser-like; this is a server-side test harness, not a real browser
    dangerouslyAllowBrowser: true,
  })

  it('completes a chat (non-streaming)', async () => {
    const completion = await client.chat.completions.create({
      model: 'model/name=gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a terse assistant. Reply with a single word.',
        },
        { role: 'user', content: 'Say hello' },
      ],
    })

    expect(completion.object).toBe('chat.completion')
    expect(completion.choices[0].message.role).toBe('assistant')
    expect(completion.choices[0].message.content).toBeTruthy()
    expect(completion.choices[0].finish_reason).toBe('stop')
    expect(completion.usage.total_tokens).toBeGreaterThan(0)
  })

  it('streams a chat completion', async () => {
    const stream = await client.chat.completions.create({
      model: 'model/name=gpt-4o',
      stream: true,
      messages: [{ role: 'user', content: 'Say hello in a single word' }],
    })

    let chunks = 0
    let text = ''

    for await (const chunk of stream) {
      chunks++
      text += chunk.choices[0]?.delta?.content ?? ''
    }

    expect(chunks).toBeGreaterThan(0)
    expect(text.trim()).toBeTruthy()
  })

  it('completes against a CBK model with extra OpenAI sampling params', async () => {
    // @note real OpenAI clients routinely pass temperature/max_tokens; the
    // endpoint must accept (and ignore) params it does not map rather than 400
    const completion = await client.chat.completions.create({
      model: 'model/name=gpt-4o',
      messages: [{ role: 'user', content: 'Say hello' }],
      temperature: 0.2,
      max_tokens: 16,
    })

    expect(completion.choices[0].message.content).toBeTruthy()
  })

  it('invokes a tool and finishes with tool_calls', async () => {
    const completion = await client.chat.completions.create({
      model: 'model/name=gpt-4o',
      messages: [
        {
          role: 'user',
          content:
            'What is the weather in Tokyo? You must call the get_weather tool.',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get the current weather for a city',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string' } },
              required: ['city'],
            },
          },
        },
      ],
    })

    expect(completion.choices[0].finish_reason).toBe('tool_calls')

    const toolCalls = completion.choices[0].message.tool_calls

    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].type).toBe('function')
    expect(toolCalls[0].function.name).toBe('get_weather')
    // @note arguments must be a JSON string per the OpenAI contract
    expect(() => JSON.parse(toolCalls[0].function.arguments)).not.toThrow()
  })

  it('rejects an unsupported (bare) model selector with a 400', async () => {
    await expect(
      client.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hi' }],
      })
    ).rejects.toMatchObject({ status: 400 })
  })
})

import { openrouterLanguageModels } from '@/config/models'

import fetch from '@/lib/fetch'
import {
  createChatCompletion,
  createChatCompletionStream,
  getOpenRouterAPIKey,
} from '@/lib/model.provider.openrouter'
import { getLanguageModel } from '@/lib/model.provider.openrouter.adaptor'

jest.retryTimes(3)

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('openrouter')
  ? describe
  : describe.skip

function getCheapestModel() {
  const [name] = Object.entries(openrouterLanguageModels)
    .filter(
      ([name, config]) =>
        !/mimo/.test(name) &&
        !config.deprecated &&
        config.visible &&
        config.features.includes('functions')
    )
    .sort((a, b) => a[1].pricing.tokenRatio - b[1].pricing.tokenRatio)[0]

  return name
}

describeIfConfigured('createChatCompletion', () => {
  it('must correctly complete chat', async () => {
    const { completion, usage } = await createChatCompletion({
      model: getCheapestModel(),
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
      model: getCheapestModel(),
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
      model: getCheapestModel(),
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
      model: getCheapestModel(),
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

describeIfConfigured('listModels', () => {
  const ONE_MILLION = 1_000_000

  function roundPrice(value) {
    return Number(Number(value).toFixed(4))
  }

  function parseOpenRouterPrice(value) {
    return roundPrice(Number(value || 0) * ONE_MILLION)
  }

  it('must match configured OpenRouter model pricing and sizing', async () => {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${getOpenRouterAPIKey()}`,
      },
    })

    expect(response.ok).toBe(true)

    const { data } = await response.json()

    const modelsById = new Map(data.map((model) => [model.id, model]))

    const mismatches = []

    for (const [modelName, config] of Object.entries(
      openrouterLanguageModels
    )) {
      if (config.deprecated || !config.visible) {
        continue
      }

      const modelId = getLanguageModel({ model: modelName })
      const liveModel = modelsById.get(modelId)

      if (!liveModel) {
        mismatches.push(`${modelName}: missing live model ${modelId}`)

        continue
      }

      const liveInputPrice = parseOpenRouterPrice(liveModel.pricing?.prompt)
      const liveOutputPrice = parseOpenRouterPrice(
        liveModel.pricing?.completion
      )
      const liveContextLength =
        liveModel.context_length || liveModel.top_provider?.context_length
      const liveMaxCompletionTokens =
        liveModel.top_provider?.max_completion_tokens

      if (liveInputPrice === 0 || liveOutputPrice === 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `${modelName}: upstream reports zero pricing (input=${liveInputPrice}, output=${liveOutputPrice})`
        )
      } else {
        if (roundPrice(config.pricing.inputPrice || 0) !== liveInputPrice) {
          mismatches.push(
            `${modelName}: inputPrice ${config.pricing.inputPrice} !== ${liveInputPrice}`
          )
        }

        if (roundPrice(config.pricing.outputPrice || 0) !== liveOutputPrice) {
          mismatches.push(
            `${modelName}: outputPrice ${config.pricing.outputPrice} !== ${liveOutputPrice}`
          )
        }
      }

      if (
        typeof liveContextLength === 'number' &&
        config.maxTokens !== liveContextLength
      ) {
        mismatches.push(
          `${modelName}: maxTokens ${config.maxTokens} !== ${liveContextLength}`
        )
      }

      if (
        typeof liveMaxCompletionTokens === 'number' &&
        config.maxOutputTokens > liveMaxCompletionTokens
      ) {
        mismatches.push(
          `${modelName}: maxOutputTokens ${config.maxOutputTokens} > ${liveMaxCompletionTokens}`
        )
      }

      if (
        typeof liveContextLength === 'number' &&
        config.maxInputTokens > liveContextLength - config.maxOutputTokens
      ) {
        mismatches.push(
          `${modelName}: maxInputTokens ${config.maxInputTokens} > ${liveContextLength - config.maxOutputTokens}`
        )
      }
    }

    const mismatchSummary = mismatches.slice(0, 25)

    if (mismatches.length > mismatchSummary.length) {
      mismatchSummary.push(
        `... and ${mismatches.length - mismatchSummary.length} more mismatches`
      )
    }

    expect(mismatchSummary).toEqual([])
  }, 120000)
})

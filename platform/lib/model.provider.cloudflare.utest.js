import {
  cloudflareLanguageModels,
  imageModels,
  videoModels,
} from '@/config/models'

import _fetch from '@/lib/fetch'
import {
  BASE_INPUT_PRICE_PER_MILLION,
  BASE_OUTPUT_PRICE_PER_MILLION,
} from '@/lib/model.pricing'
import {
  cloudflareRunInputSchemas,
  cloudflareRunOutputSchemas,
  createChatCompletion,
  createChatCompletionStream,
  createImage,
  createVideo,
  editImage,
  getCloudflareAPIKey,
} from '@/lib/model.provider.cloudflare'
import {
  getImageModel,
  getLanguageModel,
  getVideoModel,
} from '@/lib/model.provider.cloudflare.adaptor'
import {
  createChatCompletion as openAICompatibleChatCompletion,
  createChatCompletionStream as openAICompatibleChatCompletionStream,
} from '@/lib/model.provider.openai'

import { zodToJsonSchema } from 'zod-to-json-schema'

jest.mock('@/lib/fetch', () => {
  const actual = jest.fn()

  // @ts-ignore
  actual.withRetry = jest.fn((fn) => fn)
  // @ts-ignore
  actual.withTimeout = jest.fn((fn) => fn)
  // @ts-ignore
  actual.withBodyTimeout = jest.fn((fn) => fn)

  return {
    __esModule: true,
    default: actual,
    // @ts-ignore
    withRetry: actual.withRetry,
    // @ts-ignore
    withTimeout: actual.withTimeout,
    // @ts-ignore
    withBodyTimeout: actual.withBodyTimeout,
  }
})

jest.mock('@/lib/model.context', () => ({
  getSafeModelStore: jest.fn(() => ({})),
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createChatCompletion: jest.fn(),
  createChatCompletionStream: jest.fn(),
  throwOpenAIError: jest.fn(),
}))

describe('model.provider.cloudflare', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    process.env.CLOUDFLARE_MODELS_ACCOUNT_ID = 'account-123'
    process.env.CLOUDFLARE_MODELS_API_KEY = 'cf-models-key'
  })

  it('gets Cloudflare API key from CLOUDFLARE_MODELS_API_KEY', () => {
    expect(getCloudflareAPIKey()).toBe('cf-models-key')
  })

  it('delegates chat completion to the OpenAI-compatible Cloudflare endpoint', async () => {
    openAICompatibleChatCompletion.mockResolvedValue({ completion: 'ok' })

    await createChatCompletion({
      model: 'openai/gpt-4.1',
      messages: [{ role: 'user', content: 'Hi' }],
      extra: {
        providerOptions: {
          gateway: { id: 'chat' },
        },
      },
    })

    expect(openAICompatibleChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.cloudflare.com/client/v4/accounts/account-123/ai/v1/chat/completions',
        authorization: 'Bearer cf-models-key',
        headers: {
          'cf-aig-gateway-id': 'chat',
        },
        extra: {},
        errorPrefix: 'CF_',
      })
    )
  })

  it('delegates chat stream to the OpenAI-compatible Cloudflare endpoint', async () => {
    openAICompatibleChatCompletionStream.mockImplementation(async function* () {
      yield { completion: 'ok' }
    })

    const chunks = []

    for await (const chunk of createChatCompletionStream({
      model: 'openai/gpt-4.1',
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([{ completion: 'ok' }])
    expect(openAICompatibleChatCompletionStream).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.cloudflare.com/client/v4/accounts/account-123/ai/v1/chat/completions',
      })
    )
  })

  it('creates images through the universal run endpoint', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        result: {
          state: 'Completed',
          result: {
            image: 'https://example.com/image.png',
          },
        },
      }),
    })

    const result = await createImage({
      prompt: 'draw a tree',
      model: 'openai/gpt-image-2',
      size: '1024x1024',
      modelOptions: {
        gateway: { id: 'images' },
        quality: 'high',
      },
    })

    expect(result.urls).toEqual(['https://example.com/image.png'])
    expect(_fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/account-123/ai/run',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer cf-models-key',
          'cf-aig-gateway-id': 'images',
        }),
      })
    )
    expect(JSON.parse(_fetch.mock.calls[0][1].body)).toEqual({
      model: 'openai/gpt-image-2',
      input: {
        quality: 'high',
        prompt: 'draw a tree',
        size: '1024x1024',
      },
    })
  })

  it('edits images with base64 data URLs in the images array', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        result: {
          image: 'https://example.com/edited.png',
        },
      }),
    })

    await editImage({
      prompt: 'make it brighter',
      images: [new Blob(['image'], { type: 'image/png' })],
      model: 'openai/gpt-image-2',
    })

    expect(JSON.parse(_fetch.mock.calls[0][1].body).input.images).toEqual([
      'data:image/png;base64,aW1hZ2U=',
    ])
  })

  it('creates videos through the universal run endpoint', async () => {
    // @ts-ignore
    _fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        result: {
          video: 'https://example.com/video.mp4',
        },
      }),
    })

    const result = await createVideo({
      prompt: 'make waves roll',
      model: 'google/veo-3.1',
      duration: 8,
      aspectRatio: '16:9',
      resolution: '720p',
    })

    expect(result).toEqual({
      urls: ['https://example.com/video.mp4'],
      usage: {
        model: 'google/veo-3.1',
        inputTokens: 0,
        outputTokens: 8,
      },
    })
    expect(JSON.parse(_fetch.mock.calls[0][1].body).input).toEqual({
      prompt: 'make waves roll',
      duration: 8,
      aspect_ratio: '16:9',
      resolution: '720p',
    })
  })
})

// Captured at module load, before the mocked-provider describe block's
// beforeEach overwrites process.env with placeholder credentials. These are
// the real platform credentials supplied by `pnpm run with-env <env> test:unit`; the
// catalogue test below is skipped when they (or any configured Cloudflare
// models) are absent, mirroring the Vercel suite's describeIfConfigured gate.
const REAL_CLOUDFLARE_MODELS_ACCOUNT_ID =
  process.env.CLOUDFLARE_MODELS_ACCOUNT_ID
const REAL_CLOUDFLARE_MODELS_API_KEY = process.env.CLOUDFLARE_MODELS_API_KEY

// The default export of `@/lib/fetch` is mocked at the top of this file for the
// provider behaviour tests. The catalogue test needs to hit the real upstream,
// so reach past the mock to the genuine implementation.
const realFetch = jest.requireActual('@/lib/fetch').default

function hasConfiguredCloudflareModels() {
  const visible = (config) =>
    config.provider === 'cloudflare' && config.visible && !config.deprecated

  return (
    Object.values(cloudflareLanguageModels).some(
      (config) => config.visible && !config.deprecated
    ) ||
    Object.values(imageModels).some(visible) ||
    Object.values(videoModels).some(visible)
  )
}

const describeIfConfigured =
  REAL_CLOUDFLARE_MODELS_ACCOUNT_ID &&
  REAL_CLOUDFLARE_MODELS_API_KEY &&
  hasConfiguredCloudflareModels()
    ? describe
    : describe.skip

describeIfConfigured('cloudflare model catalogue', () => {
  const ONE_MILLION = 1_000_000

  function roundPrice(value) {
    return Number(Number(value).toFixed(4))
  }

  function roundRatio(value) {
    return Number(Number(value).toFixed(4))
  }

  // Cloudflare's `?format=openrouter` response prices in USD per token; multiply
  // up to USD per million to match config/models.js. OpenRouter calls the
  // language fields `prompt`/`completion`, but tolerate the native
  // `input`/`output` names too in case the upstream shape shifts.
  function parseCloudflarePrice(value) {
    return roundPrice(Number(value || 0) * ONE_MILLION)
  }

  function getLanguageInputPrice(liveModel) {
    return parseCloudflarePrice(
      liveModel.pricing?.input ?? liveModel.pricing?.prompt
    )
  }

  function getLanguageOutputPrice(liveModel) {
    return parseCloudflarePrice(
      liveModel.pricing?.output ?? liveModel.pricing?.completion
    )
  }

  function getContextLength(liveModel) {
    return (
      liveModel.context_length ||
      liveModel.context_window ||
      liveModel.top_provider?.context_length
    )
  }

  function getMaxCompletionTokens(liveModel) {
    return (
      liveModel.max_completion_tokens ||
      liveModel.max_output_length ||
      liveModel.max_tokens ||
      liveModel.top_provider?.max_completion_tokens
    )
  }

  function getUnitPricingRatios({ inputPrice, outputPrice }) {
    const inputTokenRatio = roundRatio(
      inputPrice / (BASE_INPUT_PRICE_PER_MILLION / ONE_MILLION)
    )
    const outputTokenRatio = roundRatio(
      outputPrice / (BASE_OUTPUT_PRICE_PER_MILLION / ONE_MILLION)
    )

    return {
      tokenRatio: outputTokenRatio,
      inputTokenRatio,
      outputTokenRatio,
    }
  }

  // Per-image upstream price, in raw USD per generated image. Handles both the
  // OpenRouter fields (`image_output`/`image`/`image_token`) and the
  // gateway-style `image_dimension_quality_pricing` array.
  function getImagePrice(liveModel) {
    const dimensionPricing = liveModel.pricing?.image_dimension_quality_pricing

    if (dimensionPricing) {
      const prices = dimensionPricing.map((item) => Number(item.cost))

      if (prices.length) {
        return roundPrice(Math.max(...prices))
      }
    }

    const direct =
      liveModel.pricing?.image_output ??
      liveModel.pricing?.image ??
      liveModel.pricing?.image_token

    if (direct !== undefined && direct !== null && direct !== '') {
      return roundPrice(Number(direct))
    }

    return undefined
  }

  // Per-second upstream price for video models. The gateway shape exposes
  // `video_duration_pricing`; the OpenRouter shape may instead price per second
  // via `video`/`video_output`/`per_second`.
  function getVideoPricePerSecond(liveModel, config) {
    const durationPricing = liveModel.pricing?.video_duration_pricing

    if (durationPricing) {
      const availableResolutions = config.availableResolutions || [
        config.resolution,
      ]
      const matches = durationPricing.filter(
        (item) =>
          availableResolutions.includes(item.resolution) &&
          (item.audio === false || item.audio === undefined)
      )
      const fallbackMatches = durationPricing.filter(
        (item) => item.audio === false || item.audio === undefined
      )
      const prices = (matches.length ? matches : fallbackMatches).map((item) =>
        Number(item.cost_per_second)
      )

      if (prices.length) {
        return roundPrice(Math.max(...prices))
      }
    }

    const direct =
      liveModel.pricing?.video_output ??
      liveModel.pricing?.video ??
      liveModel.pricing?.per_second

    if (direct !== undefined && direct !== null && direct !== '') {
      return roundPrice(Number(direct))
    }

    return undefined
  }

  function assertPricingRatios(modelName, pricing, mismatches) {
    const inputPrice = roundPrice(pricing.inputPrice || 0)
    const outputPrice = roundPrice(pricing.outputPrice || 0)
    const expectedRatios = getUnitPricingRatios({
      inputPrice,
      outputPrice,
    })

    if (roundRatio(pricing.tokenRatio) !== expectedRatios.tokenRatio) {
      mismatches.push(
        `${modelName}: tokenRatio ${pricing.tokenRatio} !== ${expectedRatios.tokenRatio}`
      )
    }

    if (
      roundRatio(pricing.inputTokenRatio) !== expectedRatios.inputTokenRatio
    ) {
      mismatches.push(
        `${modelName}: inputTokenRatio ${pricing.inputTokenRatio} !== ${expectedRatios.inputTokenRatio}`
      )
    }

    if (
      roundRatio(pricing.outputTokenRatio) !== expectedRatios.outputTokenRatio
    ) {
      mismatches.push(
        `${modelName}: outputTokenRatio ${pricing.outputTokenRatio} !== ${expectedRatios.outputTokenRatio}`
      )
    }
  }

  // Language prices are documented per MILLION tokens, so the ratio divides by
  // the per-million base directly - unlike the media/realtime loops above,
  // where the price is per unit (second/image) and getUnitPricingRatios
  // applies. Mirrors the language-model ratio check in the vercel suite.
  function assertTokenPricingRatios(modelName, pricing, mismatches) {
    const expectedInputTokenRatio = roundRatio(
      (pricing.inputPrice || 0) / BASE_INPUT_PRICE_PER_MILLION
    )
    const expectedOutputTokenRatio = roundRatio(
      (pricing.outputPrice || 0) / BASE_OUTPUT_PRICE_PER_MILLION
    )
    const expectedTokenRatio = expectedOutputTokenRatio

    if (roundRatio(pricing.tokenRatio) !== expectedTokenRatio) {
      mismatches.push(
        `${modelName}: tokenRatio ${pricing.tokenRatio} !== ${expectedTokenRatio}`
      )
    }

    if (roundRatio(pricing.inputTokenRatio) !== expectedInputTokenRatio) {
      mismatches.push(
        `${modelName}: inputTokenRatio ${pricing.inputTokenRatio} !== ${expectedInputTokenRatio}`
      )
    }

    if (roundRatio(pricing.outputTokenRatio) !== expectedOutputTokenRatio) {
      mismatches.push(
        `${modelName}: outputTokenRatio ${pricing.outputTokenRatio} !== ${expectedOutputTokenRatio}`
      )
    }
  }

  it('must match configured Cloudflare model pricing and parameters', async () => {
    const response = await realFetch(
      `https://api.cloudflare.com/client/v4/accounts/${REAL_CLOUDFLARE_MODELS_ACCOUNT_ID}/ai/models/search?format=openrouter`,
      {
        headers: {
          Authorization: `Bearer ${REAL_CLOUDFLARE_MODELS_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    expect(response.ok).toBe(true)

    const data = await response.json()
    const liveModels = data.data || data.result || []
    const modelsById = new Map(liveModels.map((model) => [model.id, model]))

    // Marketplace/partner models (e.g. `bytedance/seedance-2.0`,
    // `google/veo-3.1`) are routed through the universal `/ai/run` endpoint but
    // are NOT listed by `models/search` in either format - only Cloudflare's own
    // `@cf/...` / `@hf/...` models are. So upstream pricing for partner models
    // cannot be verified through this API; we can still assert that their
    // configured price/ratio relationship is internally consistent.
    const isMarketplaceModel = (modelId) => !/^@/.test(modelId)

    const mismatches = []
    const unverified = []

    for (const [modelName, config] of Object.entries(
      cloudflareLanguageModels
    )) {
      if (config.deprecated || !config.visible) {
        continue
      }

      const modelId = getLanguageModel({ model: modelName })
      const liveModel = modelsById.get(modelId)

      if (!liveModel) {
        if (isMarketplaceModel(modelId)) {
          unverified.push(`${modelName} (${modelId})`)
          assertTokenPricingRatios(modelName, config.pricing, mismatches)

          continue
        }

        mismatches.push(`${modelName}: missing live model ${modelId}`)

        continue
      }

      const liveInputPrice = getLanguageInputPrice(liveModel)
      const liveOutputPrice = getLanguageOutputPrice(liveModel)
      const liveContextLength = getContextLength(liveModel)
      const liveMaxCompletionTokens = getMaxCompletionTokens(liveModel)

      if (liveInputPrice !== 0) {
        if (roundPrice(config.pricing.inputPrice || 0) !== liveInputPrice) {
          mismatches.push(
            `${modelName}: inputPrice ${config.pricing.inputPrice} !== ${liveInputPrice}`
          )
        }
      }

      if (liveOutputPrice !== 0) {
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
    }

    for (const [modelName, config] of Object.entries(imageModels)) {
      if (
        config.provider !== 'cloudflare' ||
        config.deprecated ||
        !config.visible
      ) {
        continue
      }

      const modelId = getImageModel({ model: modelName, prompt: 'test' })
      const liveModel = modelsById.get(modelId)

      if (!liveModel) {
        if (isMarketplaceModel(modelId)) {
          unverified.push(`${modelName} (${modelId})`)
          assertPricingRatios(modelName, config.pricing, mismatches)

          continue
        }

        mismatches.push(`${modelName}: missing live model ${modelId}`)

        continue
      }

      if (
        liveModel.type &&
        liveModel.type !== 'image' &&
        !liveModel.tags?.includes('image-generation')
      ) {
        mismatches.push(
          `${modelName}: live model type ${liveModel.type} is not image-generation`
        )
      }

      const inputPrice = roundPrice(config.pricing.inputPrice || 0)
      const outputPrice = roundPrice(config.pricing.outputPrice || 0)
      const liveImagePrice = getImagePrice(liveModel)

      if (inputPrice !== outputPrice) {
        mismatches.push(
          `${modelName}: inputPrice ${config.pricing.inputPrice} !== outputPrice ${config.pricing.outputPrice}`
        )
      }

      if (liveImagePrice !== undefined) {
        if (inputPrice !== liveImagePrice) {
          mismatches.push(
            `${modelName}: inputPrice ${config.pricing.inputPrice} !== ${liveImagePrice}`
          )
        }

        if (outputPrice !== liveImagePrice) {
          mismatches.push(
            `${modelName}: outputPrice ${config.pricing.outputPrice} !== ${liveImagePrice}`
          )
        }
      } else {
        mismatches.push(
          `${modelName}: live model does not expose image pricing`
        )
      }

      assertPricingRatios(modelName, config.pricing, mismatches)
    }

    for (const [modelName, config] of Object.entries(videoModels)) {
      if (
        config.provider !== 'cloudflare' ||
        config.deprecated ||
        !config.visible
      ) {
        continue
      }

      const modelId = getVideoModel({
        model: modelName,
        duration: config.duration,
      })
      const liveModel = modelsById.get(modelId)

      if (!liveModel) {
        if (isMarketplaceModel(modelId)) {
          unverified.push(`${modelName} (${modelId})`)
          assertPricingRatios(modelName, config.pricing, mismatches)

          continue
        }

        mismatches.push(`${modelName}: missing live model ${modelId}`)

        continue
      }

      if (liveModel.type && liveModel.type !== 'video') {
        mismatches.push(
          `${modelName}: live model type ${liveModel.type} !== video`
        )
      }

      const inputPrice = roundPrice(config.pricing.inputPrice || 0)
      const outputPrice = roundPrice(config.pricing.outputPrice || 0)
      const livePricePerSecond = getVideoPricePerSecond(liveModel, config)

      if (inputPrice !== outputPrice) {
        mismatches.push(
          `${modelName}: inputPrice ${config.pricing.inputPrice} !== outputPrice ${config.pricing.outputPrice}`
        )
      }

      if (livePricePerSecond !== undefined) {
        if (inputPrice !== livePricePerSecond) {
          mismatches.push(
            `${modelName}: inputPrice ${config.pricing.inputPrice} !== ${livePricePerSecond}`
          )
        }

        if (outputPrice !== livePricePerSecond) {
          mismatches.push(
            `${modelName}: outputPrice ${config.pricing.outputPrice} !== ${livePricePerSecond}`
          )
        }
      } else {
        mismatches.push(
          `${modelName}: live model does not expose per-second video pricing`
        )
      }

      assertPricingRatios(modelName, config.pricing, mismatches)
    }

    if (unverified.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[cloudflare-catalogue] upstream pricing could not be verified for ` +
          `${unverified.length} marketplace model(s) not listed by models/search: ` +
          unverified.join(', ') +
          `. Their price/ratio consistency was still checked.`
      )
    }

    const mismatchSummary = mismatches.slice(0, 25)

    if (mismatches.length > mismatchSummary.length) {
      mismatchSummary.push(
        `... and ${mismatches.length - mismatchSummary.length} more mismatches`
      )
    }

    expect(mismatchSummary).toEqual([])
  })
})

function getConfiguredCloudflareRunModels() {
  const entries = []

  for (const [name, config] of [
    ...Object.entries(imageModels),
    ...Object.entries(videoModels),
  ]) {
    if (
      config.provider === 'cloudflare' &&
      config.visible &&
      !config.deprecated
    ) {
      entries.push([name, config])
    }
  }

  return entries
}

const describeIfRunModels = getConfiguredCloudflareRunModels().length
  ? describe
  : describe.skip

// Fallback schemas for models Cloudflare does not publish in the public docs
// (so they 404 at developers.cloudflare.com), keyed by providerModel. Add an
// entry here when a configured model is undocumented; remove it once Cloudflare
// publishes the model, so the live docs stay the source of truth.
const CLOUDFLARE_SCHEMA_FIXTURES = {}

describeIfRunModels('cloudflare model run schemas', () => {
  // Compares each configured Cloudflare `/ai/run` model's hardcoded zod
  // input/output schema against the authoritative Cloudflare schema: the live
  // public `schema-{input,output}.json` when documented, or a hardcoded fixture
  // above when Cloudflare does not publish it. The public docs
  // need no credentials. We compare a normalized projection (per-property
  // type/enum/const/array-item type plus additionalProperties) so formatting and
  // constraint differences (description, default, min/max) are ignored - what
  // trips the test is the contract that matters: a renamed, added, removed, or
  // retyped field.
  function normalize(schema) {
    const props = (schema && schema.properties) || {}
    const properties = {}

    // Sort keys so the JSON.stringify comparison is order-independent (the
    // upstream docs and our zod declaration order differ).
    for (const [name, def] of Object.entries(props).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      properties[name] = {
        type: def.type,
        ...(def.enum ? { enum: [...def.enum].sort() } : {}),
        ...(def.const !== undefined ? { const: def.const } : {}),
        ...(def.items?.type ? { items: def.items.type } : {}),
      }
    }

    return {
      additionalProperties:
        schema && schema.additionalProperties !== undefined
          ? schema.additionalProperties
          : true,
      properties,
    }
  }

  // Returns the authoritative upstream JSON schema for a model/kind, preferring
  // the live published doc and falling back to a local fixture on 404.
  async function resolveUpstreamSchema(providerModel, kind) {
    const url = `https://developers.cloudflare.com/ai/models/${providerModel}/schema-${kind}.json`
    const response = await realFetch(url)

    if (response.ok) {
      return { schema: await response.json(), source: 'docs' }
    }

    if (response.status === 404) {
      const fixture = CLOUDFLARE_SCHEMA_FIXTURES[providerModel]?.[kind]

      if (fixture) {
        return { schema: fixture, source: 'fixture' }
      }

      return { error: `undocumented (no fixture) at ${url}` }
    }

    return { error: `could not fetch ${url} (status ${response.status})` }
  }

  it.each([
    ['input', cloudflareRunInputSchemas],
    ['output', cloudflareRunOutputSchemas],
  ])(
    'hardcoded %s schema matches Cloudflare schema (docs or fixture)',
    async (kind, registry) => {
      const mismatches = []

      for (const [modelName, config] of getConfiguredCloudflareRunModels()) {
        const providerModel = config.providerModel || modelName
        const ourSchema = registry[providerModel]

        if (!ourSchema) {
          mismatches.push(
            `${modelName}: no hardcoded ${kind} schema for ${providerModel}`
          )

          continue
        }

        const resolved = await resolveUpstreamSchema(providerModel, kind)

        if (resolved.error) {
          mismatches.push(`${modelName}: ${resolved.error}`)

          continue
        }

        const upstream = normalize(resolved.schema)
        const ours = normalize(zodToJsonSchema(ourSchema))

        if (JSON.stringify(upstream) !== JSON.stringify(ours)) {
          mismatches.push(
            `${providerModel}: ${kind} schema drift (source=${resolved.source})\n  upstream=${JSON.stringify(upstream)}\n  ours=${JSON.stringify(ours)}`
          )
        }
      }

      expect(mismatches).toEqual([])
    },
    30000
  )
})

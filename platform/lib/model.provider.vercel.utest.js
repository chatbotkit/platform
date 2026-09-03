import {
  imageModels,
  rerankModels,
  vercelLanguageModels,
  videoModels,
} from '@/config/models'

import fetch from '@/lib/fetch'
import {
  BASE_INPUT_PRICE_PER_MILLION,
  BASE_OUTPUT_PRICE_PER_MILLION,
} from '@/lib/model.pricing'
import {
  createChatCompletion,
  createChatCompletionStream,
  getVercelAPIKey,
} from '@/lib/model.provider.vercel'
import {
  getImageModel,
  getLanguageModel,
  getVideoModel,
  rerank as rerankVercel,
} from '@/lib/model.provider.vercel.adaptor'

jest.retryTimes(3)

const { hasLanguageModelsByProvider } = jest.requireActual('@/lib/model.utils')

const describeIfConfigured = hasLanguageModelsByProvider('vercel')
  ? describe
  : describe.skip

function getCheapestModel() {
  const [name, config] = Object.entries(vercelLanguageModels)
    .filter(
      ([name, config]) =>
        !/mimo/.test(name) &&
        !config.deprecated &&
        config.visible &&
        config.features.includes('functions')
    )
    .sort((a, b) => a[1].pricing.tokenRatio - b[1].pricing.tokenRatio)[0]

  return {
    model: config.providerModel || name,
    extra: config.providerOptions
      ? {
          providerOptions: config.providerOptions,
        }
      : undefined,
  }
}

describeIfConfigured('createChatCompletion', () => {
  it('must correctly complete chat', async () => {
    const { model, extra } = getCheapestModel()

    const { completion, usage } = await createChatCompletion({
      model,
      extra,
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
    const { model, extra } = getCheapestModel()

    const { toolCalls } = await createChatCompletion({
      model,
      extra,
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
    const { model, extra } = getCheapestModel()
    const chunks = []

    for await (const { completion } of createChatCompletionStream({
      model,
      extra,
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
    const { model, extra } = getCheapestModel()
    const calls = []

    for await (const { toolCalls } of createChatCompletionStream({
      model,
      extra,
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

describeIfConfigured('rerank', () => {
  // @note a small, unambiguous corpus: two banana documents that clearly answer
  // the query plus three distractors. Any working reranker must surface a banana
  // document first.
  const documents = [
    {
      id: 'banana-curved',
      text: 'A banana is a long, curved fruit with a soft, sweet inside and a yellow skin.',
    },
    {
      id: 'paris',
      text: 'The Eiffel Tower is a wrought-iron lattice landmark located in Paris, France.',
    },
    {
      id: 'apple',
      text: 'Apples are round fruits that are usually red, green or yellow.',
    },
    {
      id: 'banana-tropical',
      text: 'Bananas grow in hanging bunches on large herbaceous plants in tropical regions.',
    },
    {
      id: 'sports-car',
      text: 'A sports car is a low, two-seat vehicle designed for speed and high performance.',
    },
  ]

  const query = 'What is a banana?'

  const bananaIds = ['banana-curved', 'banana-tropical']

  // @note exercise every non-deprecated Vercel reranker (visible or not) against
  // the live gateway, so a broken provider model id, bad providerOptions, or a
  // request-shape rejection (the cause of the regression) is caught here rather
  // than in production. Calls go through the adaptor so providerModel and
  // providerOptions are resolved exactly as in the live dataset-search path.
  const rerankerModelNames = Object.entries(rerankModels)
    .filter(([, config]) => config.provider === 'vercel' && !config.deprecated)
    .map(([name]) => name)

  it.each(rerankerModelNames)(
    'must rerank documents with %s',
    async (model) => {
      const config = rerankModels[model]
      const topN = 3

      const { documents: ranked, usage } = await rerankVercel({
        model,
        query,
        documents,
        topN,
      })

      // returns a non-empty ranking that respects topN
      expect(Array.isArray(ranked)).toBe(true)
      expect(ranked.length).toBeGreaterThan(0)
      expect(ranked.length).toBeLessThanOrEqual(topN)

      // every ranked entry maps back to a real input document via a valid index
      // and carries a finite numeric score
      for (const doc of ranked) {
        expect(doc.index).toBeGreaterThanOrEqual(0)
        expect(doc.index).toBeLessThan(documents.length)
        expect(documents[doc.index].id).toEqual(doc.id)
        expect(typeof doc.score).toBe('number')
        expect(Number.isFinite(doc.score)).toBe(true)
      }

      // relevance sanity check: a banana document is ranked first
      expect(bananaIds).toContain(ranked[0].id)

      // usage is reported (against the resolved gateway model) so the search can
      // be billed
      expect(usage.model).toEqual(config.providerModel || model)
      expect(usage.outputTokens).toBeGreaterThan(0)
    },
    120000
  )
})

describeIfConfigured('listModels', () => {
  const ONE_MILLION = 1_000_000

  function roundPrice(value) {
    return Number(Number(value).toFixed(4))
  }

  function roundRatio(value) {
    return Number(Number(value).toFixed(4))
  }

  function parseVercelPrice(value) {
    return roundPrice(Number(value || 0) * ONE_MILLION)
  }

  function getVideoPricePerSecond(liveModel, config) {
    const durationPricing = liveModel.pricing?.video_duration_pricing

    if (!durationPricing) {
      return undefined
    }

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

    if (!prices.length) {
      return undefined
    }

    return roundPrice(Math.max(...prices))
  }

  function getImagePrice(liveModel) {
    const dimensionPricing = liveModel.pricing?.image_dimension_quality_pricing

    if (dimensionPricing) {
      const prices = dimensionPricing.map((item) => Number(item.cost))

      if (prices.length) {
        return roundPrice(Math.max(...prices))
      }
    }

    if (liveModel.pricing?.image) {
      return roundPrice(Number(liveModel.pricing.image))
    }

    return undefined
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

  it('must match configured Vercel model pricing and sizing', async () => {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/models', {
      headers: {
        Authorization: `Bearer ${getVercelAPIKey()}`,
        'Content-Type': 'application/json',
      },
    })

    expect(response.ok).toBe(true)

    const { data } = await response.json()

    const modelsById = new Map(data.map((model) => [model.id, model]))

    const mismatches = []
    // Models the gateway lists but for which it publishes no token pricing
    // (e.g. the perplexity/sonar* family return an empty `pricing` object).
    // Their absolute price cannot be diffed against upstream; we still check
    // ratio consistency and surface them so the gap is visible, not silent.
    const unverified = []

    for (const [modelName, config] of Object.entries(vercelLanguageModels)) {
      if (config.deprecated || !config.visible) {
        continue
      }

      const modelId = getLanguageModel({ model: modelName })
      const liveModel = modelsById.get(modelId)

      if (!liveModel) {
        mismatches.push(`${modelName}: missing live model ${modelId}`)

        continue
      }

      const liveInputPrice = parseVercelPrice(liveModel.pricing?.input)
      const liveOutputPrice = parseVercelPrice(liveModel.pricing?.output)
      const liveContextLength = liveModel.context_window
      const liveMaxCompletionTokens = liveModel.max_tokens

      const hasUpstreamPricing =
        liveModel.pricing?.input != null || liveModel.pricing?.output != null

      if (!hasUpstreamPricing) {
        // The gateway lists the model but publishes no token pricing - there is
        // nothing to diff. Record it as unverified rather than silently passing.
        unverified.push(`${modelName} (${modelId})`)
      } else if (liveInputPrice === 0 || liveOutputPrice === 0) {
        // Upstream actively reports a zero price for a side it does price. That
        // would silently zero-bill, so treat it as a hard failure rather than
        // warn-and-skip.
        mismatches.push(
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
          `${modelName}: maxInputTokens ${config.maxInputTokens} > ${
            liveContextLength - config.maxOutputTokens
          }`
        )
      }

      // Billing is driven by the *ratio* fields (see lib/usage.model.ts), not by
      // inputPrice/outputPrice - those are documentation. A correct price with a
      // miscomputed ratio still mis-bills, so assert the ratios are consistent
      // with the documented per-million price. Language prices are per million
      // tokens, so the ratio divides by the per-million base (unlike the media
      // loops, where the price is per unit and getUnitPricingRatios is used).
      const expectedInputTokenRatio = roundRatio(
        (config.pricing.inputPrice || 0) / BASE_INPUT_PRICE_PER_MILLION
      )
      const expectedOutputTokenRatio = roundRatio(
        (config.pricing.outputPrice || 0) / BASE_OUTPUT_PRICE_PER_MILLION
      )
      const expectedTokenRatio = expectedOutputTokenRatio

      if (roundRatio(config.pricing.tokenRatio) !== expectedTokenRatio) {
        mismatches.push(
          `${modelName}: tokenRatio ${config.pricing.tokenRatio} !== ${expectedTokenRatio}`
        )
      }

      if (
        roundRatio(config.pricing.inputTokenRatio) !== expectedInputTokenRatio
      ) {
        mismatches.push(
          `${modelName}: inputTokenRatio ${config.pricing.inputTokenRatio} !== ${expectedInputTokenRatio}`
        )
      }

      if (
        roundRatio(config.pricing.outputTokenRatio) !== expectedOutputTokenRatio
      ) {
        mismatches.push(
          `${modelName}: outputTokenRatio ${config.pricing.outputTokenRatio} !== ${expectedOutputTokenRatio}`
        )
      }
    }

    for (const [modelName, config] of Object.entries(imageModels)) {
      if (
        config.provider !== 'vercel' ||
        config.deprecated ||
        !config.visible
      ) {
        continue
      }

      const modelId = getImageModel({
        model: modelName,
        prompt: 'test',
      })
      const liveModel = modelsById.get(modelId)

      if (!liveModel) {
        mismatches.push(`${modelName}: missing live model ${modelId}`)

        continue
      }

      if (
        liveModel.type !== 'image' &&
        !liveModel.tags?.includes('image-generation')
      ) {
        mismatches.push(
          `${modelName}: live model type ${liveModel.type} is not image-generation`
        )
      }

      const inputPrice = roundPrice(config.pricing.inputPrice || 0)
      const outputPrice = roundPrice(config.pricing.outputPrice || 0)

      if (inputPrice !== outputPrice) {
        mismatches.push(
          `${modelName}: inputPrice ${config.pricing.inputPrice} !== outputPrice ${config.pricing.outputPrice}`
        )
      }

      const liveImagePrice = getImagePrice(liveModel)

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

      const expectedRatios = getUnitPricingRatios({
        inputPrice,
        outputPrice,
      })

      if (roundRatio(config.pricing.tokenRatio) !== expectedRatios.tokenRatio) {
        mismatches.push(
          `${modelName}: tokenRatio ${config.pricing.tokenRatio} !== ${expectedRatios.tokenRatio}`
        )
      }

      if (
        roundRatio(config.pricing.inputTokenRatio) !==
        expectedRatios.inputTokenRatio
      ) {
        mismatches.push(
          `${modelName}: inputTokenRatio ${config.pricing.inputTokenRatio} !== ${expectedRatios.inputTokenRatio}`
        )
      }

      if (
        roundRatio(config.pricing.outputTokenRatio) !==
        expectedRatios.outputTokenRatio
      ) {
        mismatches.push(
          `${modelName}: outputTokenRatio ${config.pricing.outputTokenRatio} !== ${expectedRatios.outputTokenRatio}`
        )
      }
    }

    for (const [modelName, config] of Object.entries(videoModels)) {
      if (
        config.provider !== 'vercel' ||
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
        mismatches.push(`${modelName}: missing live model ${modelId}`)

        continue
      }

      if (liveModel.type !== 'video') {
        mismatches.push(
          `${modelName}: live model type ${liveModel.type} !== video`
        )
      }

      const inputPrice = roundPrice(config.pricing.inputPrice || 0)
      const outputPrice = roundPrice(config.pricing.outputPrice || 0)

      if (inputPrice !== outputPrice) {
        mismatches.push(
          `${modelName}: inputPrice ${config.pricing.inputPrice} !== outputPrice ${config.pricing.outputPrice}`
        )
      }

      const livePricePerSecond = getVideoPricePerSecond(liveModel, config)

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
      } else if (!liveModel.pricing?.video_token_pricing) {
        mismatches.push(
          `${modelName}: live model does not expose video duration or token pricing`
        )
      }

      const expectedRatios = getUnitPricingRatios({
        inputPrice,
        outputPrice,
      })

      if (roundRatio(config.pricing.tokenRatio) !== expectedRatios.tokenRatio) {
        mismatches.push(
          `${modelName}: tokenRatio ${config.pricing.tokenRatio} !== ${expectedRatios.tokenRatio}`
        )
      }

      if (
        roundRatio(config.pricing.inputTokenRatio) !==
        expectedRatios.inputTokenRatio
      ) {
        mismatches.push(
          `${modelName}: inputTokenRatio ${config.pricing.inputTokenRatio} !== ${expectedRatios.inputTokenRatio}`
        )
      }

      if (
        roundRatio(config.pricing.outputTokenRatio) !==
        expectedRatios.outputTokenRatio
      ) {
        mismatches.push(
          `${modelName}: outputTokenRatio ${config.pricing.outputTokenRatio} !== ${expectedRatios.outputTokenRatio}`
        )
      }
    }

    for (const [modelName, config] of Object.entries(rerankModels)) {
      if (
        config.provider !== 'vercel' ||
        config.deprecated ||
        !config.visible
      ) {
        continue
      }

      // @note no rerank adaptor resolver exists yet; the gateway model id lives
      // directly on the config (mirrors getCheapestModel above).
      const modelId = config.providerModel || modelName
      const liveModel = modelsById.get(modelId)

      if (!liveModel) {
        mismatches.push(`${modelName}: missing live model ${modelId}`)

        continue
      }

      if (
        liveModel.type !== 'reranking' &&
        !liveModel.tags?.includes('reranking')
      ) {
        mismatches.push(
          `${modelName}: live model type ${liveModel.type} is not reranking`
        )
      }

      const inputPrice = roundPrice(config.pricing.inputPrice || 0)
      const outputPrice = roundPrice(config.pricing.outputPrice || 0)

      // @note unlike image/video (priced per unit on both sides), reranking is
      // billed per search and we report one search per call as a single output
      // unit (see lib/model.provider.vercel.ts rerank()). The whole per-call
      // cost is therefore carried on outputPrice, with inputPrice pinned to 0.
      if (inputPrice !== 0) {
        mismatches.push(
          `${modelName}: inputPrice ${config.pricing.inputPrice} !== 0 (rerank cost is carried on outputPrice)`
        )
      }

      if (!(outputPrice > 0)) {
        mismatches.push(
          `${modelName}: outputPrice ${config.pricing.outputPrice} must be greater than 0`
        )
      }

      // @note the OpenAI-compatible /v1/models catalogue does not publish a
      // comparable per-search price for reranking models, so the absolute price
      // cannot be diffed upstream. Record it as unverified (like the perplexity
      // family) - ratio consistency below is still asserted.
      unverified.push(`${modelName} (${modelId})`)

      // @note rerank prices are per unit (per search), so the ratios divide by
      // the per-unit base - same as the image/video loops, not the per-million
      // language loop.
      const expectedRatios = getUnitPricingRatios({
        inputPrice,
        outputPrice,
      })

      if (roundRatio(config.pricing.tokenRatio) !== expectedRatios.tokenRatio) {
        mismatches.push(
          `${modelName}: tokenRatio ${config.pricing.tokenRatio} !== ${expectedRatios.tokenRatio}`
        )
      }

      if (
        roundRatio(config.pricing.inputTokenRatio) !==
        expectedRatios.inputTokenRatio
      ) {
        mismatches.push(
          `${modelName}: inputTokenRatio ${config.pricing.inputTokenRatio} !== ${expectedRatios.inputTokenRatio}`
        )
      }

      if (
        roundRatio(config.pricing.outputTokenRatio) !==
        expectedRatios.outputTokenRatio
      ) {
        mismatches.push(
          `${modelName}: outputTokenRatio ${config.pricing.outputTokenRatio} !== ${expectedRatios.outputTokenRatio}`
        )
      }
    }

    if (unverified.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[vercel-catalogue] upstream publishes no token pricing for ` +
          `${unverified.length} model(s): ${unverified.join(', ')}. ` +
          `Their absolute price could not be verified; ratio consistency was still checked.`
      )
    }

    // @note TIME-LOCKED exceptions for mismatches where OUR configuration is
    // correct but the gateway's /v1/models catalogue is wrong (verified against
    // the provider's own published pricing/limits). Each entry suppresses
    // mismatch lines starting with `prefix` only until `expires` (inclusive);
    // past that date the suppressed mismatches surface again AND an explicit
    // "expired exception" line is added, forcing a re-check. An entry that no
    // longer matches anything means upstream fixed their catalogue - the test
    // then fails with a "stale exception" line so the entry is removed rather
    // than lingering. To extend, re-verify upstream first, then bump `expires`.
    const upstreamMismatchExceptions = [
      {
        // MiniMax documents up to 1M context, but the gateway lists 512k.
        prefix: 'minimax-m3: maxTokens',
        expires: '2026-09-11',
      },
      {
        // 1M context minus the documented 128k maximum output leaves 872k input.
        prefix: 'minimax-m3: maxInputTokens',
        expires: '2026-09-11',
      },
    ]

    const exceptionStates = upstreamMismatchExceptions.map((exception) => ({
      exception,
      expired:
        Date.now() > new Date(`${exception.expires}T23:59:59Z`).getTime(),
      matched: 0,
    }))

    const activeMismatches = []
    const suppressedMismatches = []

    for (const mismatch of mismatches) {
      const state = exceptionStates.find(
        (item) => !item.expired && mismatch.startsWith(item.exception.prefix)
      )

      if (state) {
        state.matched += 1

        suppressedMismatches.push(mismatch)
      } else {
        activeMismatches.push(mismatch)
      }
    }

    for (const state of exceptionStates) {
      if (state.expired) {
        activeMismatches.push(
          `expired exception "${state.exception.prefix}" (expired ${state.exception.expires}): re-verify upstream, then remove the entry or bump expires`
        )
      } else if (state.matched === 0) {
        activeMismatches.push(
          `stale exception "${state.exception.prefix}": matches no mismatch anymore - upstream is fixed, remove the entry`
        )
      }
    }

    if (suppressedMismatches.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[vercel-catalogue] ${suppressedMismatches.length} mismatch(es) suppressed by time-locked upstream exceptions: ` +
          suppressedMismatches.join('; ')
      )
    }

    const mismatchSummary = activeMismatches.slice(0, 25)

    if (activeMismatches.length > mismatchSummary.length) {
      mismatchSummary.push(
        `... and ${
          activeMismatches.length - mismatchSummary.length
        } more mismatches`
      )
    }

    expect(mismatchSummary).toEqual([])
  }, 120000)
})

// @note static validation of the gateway routing configuration in
// config/models.js. Unlike the suites above, these run without a network or API
// key and catch billing/routing footguns that are otherwise only visible in
// production spend reports:
//
// 1. Models that force Zero Data Retention (ZDR) but restrict routing to a
//    provider set with no ZDR-capable provider - the gateway then has nowhere to
//    route and the request fails with `no_providers_available` (the class of bug
//    that made the openai-only codex models unroutable).
// 2. Models that use `gateway.order` (a soft preference that still falls back to
//    any other provider, billed via Vercel) instead of `gateway.only` (a hard
//    allow-list). `order` without `only` silently leaks spend.
// 3. Typos / unknown provider slugs in `only`/`order`.
//
// The lists below are hardcoded from the Vercel docs and will drift as Vercel
// signs new agreements / adds providers; update them when a legitimately-new
// provider trips these tests.
//
// @see https://vercel.com/docs/ai-gateway/capabilities/zdr (ZDR provider table)
// @see https://vercel.com/docs/ai-gateway/models-and-providers/provider-options#available-providers

// @note providers Vercel AI Gateway has a zero-data-retention agreement with. A
// request that forces ZDR can only be served by these. (ZDR docs table.)
const ZDR_CAPABLE_PROVIDERS = new Set([
  'bedrock',
  'anthropic',
  'azure',
  'baseten',
  'cerebras',
  'deepinfra',
  'fireworks',
  'vertex',
  'groq',
  'mistral',
  'moonshotai',
  'nebius',
  'parasail',
  'togetherai',
])

// @note model namespaces on the gateway whose every serving provider is outside
// the ZDR table, so a forced-ZDR request for them has nowhere to route. These
// models MUST set `zeroDataRetention: false`.
//
// Deliberately narrow: `openai/*` is NOT listed, because azure (ZDR-capable)
// also serves many openai models - those are only unroutable when pinned with
// `only: ['openai']`, which the `only`-based test above already covers.
const NON_ZDR_EXCLUSIVE_NAMESPACES = new Set(['meta'])

// @note every provider slug the gateway recognises (available-providers table).
// Used to catch typos in `only`/`order`.
const KNOWN_PROVIDERS = new Set([
  'alibaba',
  'anthropic',
  'arcee-ai',
  'azure',
  'baseten',
  'bedrock',
  'bfl',
  'blackbox',
  'bytedance',
  'cerebras',
  'claudeaws',
  'cohere',
  'crusoe',
  'deepinfra',
  'deepseek',
  'fireworks',
  'google',
  'groq',
  'inception',
  'inceptron',
  'interfaze',
  'klingai',
  'meituan',
  'minimax',
  'mistral',
  'moonshotai',
  'morph',
  'nebius',
  'novita',
  'openai',
  'parasail',
  'perplexity',
  'prodia',
  'quiverai',
  'recraft',
  'sambanova',
  'stepfun',
  'streamlake',
  'togetherai',
  'vercel',
  'vertex',
  'voyage',
  'xiaomi',
  // @note the gateway now serves the grok family under the `spacexai` owner;
  // `xai` is kept because older gateway responses still use it.
  'spacexai',
  'xai',
  'zai',
])

/**
 * Mirror the effective ZDR decision the runtime makes. Chat/language models
 * force ZDR on by default (lib/model.provider.vercel.ts uses `?? true`), so it
 * is effective unless the model opts out with `zeroDataRetention: false`. The
 * image/video paths do not inject ZDR, so it is only effective when a model
 * explicitly opts in with `zeroDataRetention: true`.
 */
function isZdrEffective(gateway, { forcedByDefault }) {
  if (forcedByDefault) {
    return gateway.zeroDataRetention !== false
  }

  return gateway.zeroDataRetention === true
}

/**
 * Yield [name, gateway] for every gateway-routed model in a model map.
 */
function gatewayEntries(models) {
  return Object.entries(models || {})
    .filter(([, config]) => !config.provider || config.provider === 'vercel')
    .map(([name, config]) => [name, config.providerOptions?.gateway])
    .filter(([, gateway]) => gateway)
}

describeIfConfigured('vercel gateway config', () => {
  const cfgLanguageModels = vercelLanguageModels
  const cfgImageModels = imageModels
  const cfgVideoModels = videoModels

  it('exposes the vercel model maps for validation', () => {
    expect(Object.keys(cfgLanguageModels).length).toBeGreaterThan(0)
  })

  describe('ZDR routing', () => {
    it('every ZDR-forced language model can route to a ZDR-capable provider', () => {
      const violations = []

      for (const [name, gateway] of gatewayEntries(cfgLanguageModels)) {
        if (!isZdrEffective(gateway, { forcedByDefault: true })) {
          continue
        }

        // @note an unrestricted model is only checked when it pins `only` - we
        // cannot statically know which providers serve a model without the
        // gateway's model/provider table, so we skip here.
        //
        // CAVEAT: an unrestricted model is NOT automatically safe. If every
        // provider serving the model is non-ZDR (e.g. meta/muse-spark-1.1, which
        // only `meta` serves), forced ZDR still leaves the gateway nowhere to
        // route and the request 400s at runtime. This suite cannot catch that
        // class; it surfaces on first use. When it does, set
        // `zeroDataRetention: false` on the model as we do for meta/openai.
        if (!Array.isArray(gateway.only) || gateway.only.length === 0) {
          continue
        }

        if (
          !gateway.only.some((provider) => ZDR_CAPABLE_PROVIDERS.has(provider))
        ) {
          violations.push(`${name} → only:[${gateway.only.join(', ')}]`)
        }
      }

      // @note a non-empty list here means ZDR is forced but the request has no
      // ZDR-compliant provider to route to and will fail with
      // no_providers_available. Either widen `only` to include a ZDR-capable
      // provider, or set `zeroDataRetention: false` on the model.
      expect(violations).toEqual([])
    })

    // @note the test above only sees models that already declare a
    // `providerOptions.gateway` block, and it skips any model without an `only`
    // list. A model served exclusively by a non-ZDR provider slips through both
    // gates and 400s at runtime with "No ZDR ... providers ... available". This
    // catches that class for the namespaces we know are non-ZDR-exclusive.
    it('every model served only by a non-ZDR provider opts out of forced ZDR', () => {
      const violations = []

      for (const [name, config] of Object.entries(cfgLanguageModels || {})) {
        if (config.provider && config.provider !== 'vercel') {
          continue
        }

        const namespace = String(config.providerModel || '').split('/')[0]

        if (!NON_ZDR_EXCLUSIVE_NAMESPACES.has(namespace)) {
          continue
        }

        // forced-ZDR default applies unless the model explicitly opts out
        if (config.providerOptions?.gateway?.zeroDataRetention === false) {
          continue
        }

        violations.push(`${name} → ${config.providerModel}`)
      }

      // @note a non-empty list means the platform's forced-ZDR default will make
      // these models unroutable. Set `zeroDataRetention: false` on the model.
      expect(violations).toEqual([])
    })

    it('every ZDR-opted-in image/video model can route to a ZDR-capable provider', () => {
      const violations = []

      for (const models of [cfgImageModels, cfgVideoModels]) {
        for (const [name, gateway] of gatewayEntries(models)) {
          if (!isZdrEffective(gateway, { forcedByDefault: false })) {
            continue
          }

          if (!Array.isArray(gateway.only) || gateway.only.length === 0) {
            continue
          }

          if (
            !gateway.only.some((provider) =>
              ZDR_CAPABLE_PROVIDERS.has(provider)
            )
          ) {
            violations.push(`${name} → only:[${gateway.only.join(', ')}]`)
          }
        }
      }

      expect(violations).toEqual([])
    })
  })

  describe('provider restriction', () => {
    it('no model uses gateway.order without gateway.only (leaks spend to fallback providers)', () => {
      const violations = []

      for (const models of [
        cfgLanguageModels,
        cfgImageModels,
        cfgVideoModels,
      ]) {
        for (const [name, gateway] of gatewayEntries(models)) {
          if (gateway.order && !gateway.only) {
            violations.push(`${name} → order:[${gateway.order.join(', ')}]`)
          }
        }
      }

      // @note `order` is only a preference; the gateway still falls back to any
      // other provider (billed via Vercel). Use `only` to enforce the allow-list.
      expect(violations).toEqual([])
    })

    it('every provider slug in only/order is a known Vercel provider', () => {
      const violations = []

      for (const models of [
        cfgLanguageModels,
        cfgImageModels,
        cfgVideoModels,
      ]) {
        for (const [name, gateway] of gatewayEntries(models)) {
          for (const provider of [
            ...(gateway.only || []),
            ...(gateway.order || []),
          ]) {
            if (!KNOWN_PROVIDERS.has(provider)) {
              violations.push(`${name} → "${provider}"`)
            }
          }
        }
      }

      expect(violations).toEqual([])
    })
  })
})

// @note always-on (no network / API key) sanity checks for the rerank model
// numbers. The live pricing diff above only runs when a Vercel key is configured
// (describeIfConfigured), so these guard the config arithmetic in CI too.
// rerankModels is not flag-gated (unlike the language/image/video maps), so the
// top-level import is always populated.
describe('vercel rerank pricing', () => {
  const ONE_MILLION = 1_000_000

  function roundRatio(value) {
    return Number(Number(value).toFixed(4))
  }

  it('exposes rerank models to validate', () => {
    expect(Object.keys(rerankModels).length).toBeGreaterThan(0)
  })

  it('every rerank model has pricing ratios consistent with its prices', () => {
    const mismatches = []

    for (const [name, config] of Object.entries(rerankModels)) {
      const inputPrice = config.pricing.inputPrice || 0
      const outputPrice = config.pricing.outputPrice || 0

      // @note rerank prices are per unit (per search), so ratios divide by the
      // per-unit base - the same arithmetic the live image/video loops assert.
      const expectedInputTokenRatio = roundRatio(
        inputPrice / (BASE_INPUT_PRICE_PER_MILLION / ONE_MILLION)
      )
      const expectedOutputTokenRatio = roundRatio(
        outputPrice / (BASE_OUTPUT_PRICE_PER_MILLION / ONE_MILLION)
      )

      if (roundRatio(config.pricing.tokenRatio) !== expectedOutputTokenRatio) {
        mismatches.push(
          `${name}: tokenRatio ${config.pricing.tokenRatio} !== ${expectedOutputTokenRatio}`
        )
      }

      if (
        roundRatio(config.pricing.inputTokenRatio) !== expectedInputTokenRatio
      ) {
        mismatches.push(
          `${name}: inputTokenRatio ${config.pricing.inputTokenRatio} !== ${expectedInputTokenRatio}`
        )
      }

      if (
        roundRatio(config.pricing.outputTokenRatio) !== expectedOutputTokenRatio
      ) {
        mismatches.push(
          `${name}: outputTokenRatio ${config.pricing.outputTokenRatio} !== ${expectedOutputTokenRatio}`
        )
      }
    }

    expect(mismatches).toEqual([])
  })

  it('bills reranking on the output side (per search), never the input side', () => {
    // @note usage reports one search per call as a single output unit (see
    // lib/model.provider.vercel.ts rerank()), so the per-call cost must sit on
    // outputPrice and inputPrice must stay 0 to avoid double/mis-billing.
    const violations = []

    for (const [name, config] of Object.entries(rerankModels)) {
      if ((config.pricing.inputPrice || 0) !== 0) {
        violations.push(
          `${name}: inputPrice ${config.pricing.inputPrice} (rerank cost belongs on outputPrice)`
        )
      }
    }

    expect(violations).toEqual([])
  })

  it('never exposes a rerank model without a positive price (guards free-billing)', () => {
    // @note a visible rerank model with a zero/placeholder price would bill
    // nothing - e.g. the voyage entries are intentionally kept invisible until
    // their token pricing is resolved. This fails if one is made visible early.
    const violations = []

    for (const [name, config] of Object.entries(rerankModels)) {
      if (config.visible && !((config.pricing.outputPrice || 0) > 0)) {
        violations.push(
          `${name}: visible but outputPrice ${config.pricing.outputPrice} is not > 0`
        )
      }
    }

    expect(violations).toEqual([])
  })
})

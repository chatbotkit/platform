/**
 * @jest-environment node
 */
import {
  baseLanguageModel,
  defaultDecisionModel,
  defaultImageModel,
  defaultLanguageModel,
  defaultRerankModel,
  defaultSpeechToTextModel,
  defaultTextToSpeechModel,
  defaultVideoModel,
  decisionModels,
  imageModels,
  languageModels,
  rerankModels,
  speechToTextModels,
  textToSpeechModels,
  videoModels,
  visibleLanguageModels,
} from '@/config/models'
import { calculateModelPricingRatios } from '@/lib/model.pricing'

const itIfLanguageModelsConfigured = Object.values(visibleLanguageModels).some(
  ({ provider }) => provider !== 'chatbotkit'
)
  ? it
  : it.skip

const itIfImageModelsConfigured = Object.keys(imageModels).length ? it : it.skip

const itIfVideoModelsConfigured = Object.keys(videoModels).length ? it : it.skip

const itIfDecisionModelsConfigured = Object.keys(decisionModels).length
  ? it
  : it.skip

// @note these tests assert properties of the model catalogue itself rather
// than behaviour of the platform that reads it: the data is the thing under
// test.
//
// The coherence cases need the application environment loaded, like the rest
// of this directory: each provider's models are gated on that provider's
// credential, so without the environment the catalogue is empty and the named
// defaults point at models this file cannot see.

describe('model catalogue', () => {
  it('exposes only visible models as visible', () => {
    for (const [name, model] of Object.entries(visibleLanguageModels)) {
      expect(model.visible).toBe(true)
      expect(languageModels[name]).toBeDefined()
    }
  })

  it('never marks a deprecated model visible', () => {
    for (const [name, model] of Object.entries(languageModels)) {
      if (model.deprecated) {
        expect(`${name}:${model.visible}`).toBe(`${name}:false`)
      }
    }
  })

  // @note a catalogue is coherent when the names it points *at* are names it
  // defines. The failures this catches - a default naming a model that a
  // feature flag removed, an alias whose target was retired - are invisible at
  // import and only surface when a user happens to pick the affected model.

  itIfLanguageModelsConfigured(
    'defaultLanguageModel names a model the catalogue defines',
    () => {
      expect(languageModels[defaultLanguageModel]).toBeDefined()
    }
  )

  itIfImageModelsConfigured(
    'defaultImageModel names a model the catalogue defines',
    () => {
      expect(imageModels[defaultImageModel]).toBeDefined()
    }
  )

  itIfVideoModelsConfigured(
    'defaultVideoModel names a model the catalogue defines',
    () => {
      expect(videoModels[defaultVideoModel]).toBeDefined()
    }
  )

  itIfDecisionModelsConfigured(
    'defaultDecisionModel names a model the catalogue defines',
    () => {
      expect(decisionModels[defaultDecisionModel]).toBeDefined()
    }
  )

  describe('decision model providers', () => {
    const keys = [
      'OPENROUTER_MODELS_API_KEY',
      'VERCEL_MODELS_API_KEY',
      'TYPESAFE_MODELS_API_KEY',
    ]

    const original = Object.fromEntries(keys.map((k) => [k, process.env[k]]))

    afterEach(() => {
      for (const key of keys) {
        if (original[key] === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = original[key]
        }
      }
    })

    async function loadWith(configured) {
      for (const key of keys) {
        delete process.env[key]
      }

      for (const key of configured) {
        process.env[key] = 'test-key'
      }

      jest.resetModules()

      const { decisionModels } = await import('@/config/models')

      return decisionModels
    }

    it.each([
      [[], undefined, undefined],
      [['OPENROUTER_MODELS_API_KEY'], 'openrouter', '~typesafe/jev-latest'],
      [['VERCEL_MODELS_API_KEY'], 'vercel', 'typesafe-ai/jev'],
      [['TYPESAFE_MODELS_API_KEY'], 'typesafe', 'jev-latest'],
      [
        ['OPENROUTER_MODELS_API_KEY', 'VERCEL_MODELS_API_KEY'],
        'vercel',
        'typesafe-ai/jev',
      ],
      [
        [
          'OPENROUTER_MODELS_API_KEY',
          'VERCEL_MODELS_API_KEY',
          'TYPESAFE_MODELS_API_KEY',
        ],
        'typesafe',
        'jev-latest',
      ],
    ])('serves jev with %j through %s', async (configured, provider, providerModel) => {
      const { jev } = await loadWith(configured)

      expect(jev?.provider).toBe(provider)
      expect(jev?.providerModel).toBe(providerModel)
    })
  })

  it.each([
    ['baseLanguageModel', baseLanguageModel, languageModels],
    ['defaultRerankModel', defaultRerankModel, rerankModels],
    ['defaultSpeechToTextModel', defaultSpeechToTextModel, speechToTextModels],
    ['defaultTextToSpeechModel', defaultTextToSpeechModel, textToSpeechModels],
  ])('%s names a model the catalogue defines', (_name, value, catalogue) => {
    expect(catalogue[value]).toBeDefined()
  })

  describe('pricing ratios', () => {
    const key = 'OPENAI_MODELS_API_KEY'

    const original = process.env[key]

    afterEach(() => {
      if (original === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = original
      }
    })

    // @note the openai catalogue is gated on a credential, so a deployment
    // without one compiles it away. These cases are about the data, not the
    // gate, so they load it with a credential present.

    async function loadLanguageModels() {
      process.env[key] = 'test-key'

      jest.resetModules()

      return (await import('@/config/models')).languageModels
    }

    // @note a hand-written ratio that disagrees with the price it was derived
    // from bills every request at the wrong rate, silently and forever.

    it('derives every priced model ratio from its own prices', async () => {
      const catalogue = await loadLanguageModels()

      for (const [name, model] of Object.entries(catalogue)) {
        const { inputPrice, outputPrice, ...ratios } = model.pricing ?? {}

        if (inputPrice === undefined || outputPrice === undefined) {
          continue
        }

        const expected = calculateModelPricingRatios({
          inputPrice,
          outputPrice,
        })

        expect({ name, ...ratios }).toStrictEqual({ name, ...expected })
      }
    })

    it('prices the GPT-6 family against its published rates', async () => {
      const catalogue = await loadLanguageModels()

      const rates = {
        'gpt-6-astra': { inputPrice: 10, outputPrice: 50 },
        'gpt-6-sol': { inputPrice: 2, outputPrice: 10 },
        'gpt-6-luna': { inputPrice: 0.1, outputPrice: 0.5 },
      }

      for (const [name, rate] of Object.entries(rates)) {
        const model = catalogue[name]

        expect(`${name}:${!!model}`).toBe(`${name}:true`)

        expect({
          family: model.family,
          maxTokens: model.maxTokens,
          maxInputTokens: model.maxInputTokens,
          maxOutputTokens: model.maxOutputTokens,
          inputPrice: model.pricing.inputPrice,
          outputPrice: model.pricing.outputPrice,
        }).toStrictEqual({
          family: 'gpt-6',
          maxTokens: 1_050_000,
          maxInputTokens: 922_000,
          maxOutputTokens: 128_000,
          ...rate,
        })
      }
    })
  })

  describe('vercel anthropic catalogue', () => {
    const key = 'VERCEL_MODELS_API_KEY'

    const original = process.env[key]

    afterEach(() => {
      if (original === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = original
      }
    })

    async function loadVercelLanguageModels() {
      process.env[key] = 'test-key'

      jest.resetModules()

      return (await import('@/config/models')).vercelLanguageModels
    }

    // @note the gateway id is the wire name. A typo here routes every request
    // for the model to a 404 the operator only sees at runtime.

    it('serves Claude Opus 5.5 on its published gateway id and rates', async () => {
      const catalogue = await loadVercelLanguageModels()

      const model = catalogue['claude-5.5-opus']

      expect(`claude-5.5-opus:${!!model}`).toBe('claude-5.5-opus:true')

      expect({
        providerModel: model.providerModel,
        family: model.family,
        maxTokens: model.maxTokens,
        maxInputTokens: model.maxInputTokens,
        maxOutputTokens: model.maxOutputTokens,
        ...model.pricing,
      }).toStrictEqual({
        providerModel: 'anthropic/claude-opus-5.5',
        family: 'opus',
        maxTokens: 1_000_000,
        maxInputTokens: 872_000,
        maxOutputTokens: 128_000,
        inputPrice: 4.0,
        outputPrice: 20.0,
        ...calculateModelPricingRatios({ inputPrice: 4, outputPrice: 20 }),
      })
    })

    // @note two featured models in one family put both in front of the user as
    // the flagship, so a new flagship has to take the flag off the old one.

    it('features Claude Opus 5.5 alone in the opus family', async () => {
      const catalogue = await loadVercelLanguageModels()

      const featured = Object.entries(catalogue)
        .filter(([, model]) => model.family === 'opus' && model.featured)
        .map(([name]) => name)

      expect(featured).toStrictEqual(['claude-5.5-opus'])
    })
  })

  it('every proxy alias points at a model that exists', () => {
    for (const [name, model] of Object.entries(languageModels)) {
      const target = model.proxyToModel

      if (target) {
        expect(`${name} -> ${target}:${!!languageModels[target]}`).toBe(
          `${name} -> ${target}:true`
        )
      }
    }
  })
})

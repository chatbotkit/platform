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

/**
 * @jest-environment node
 */
import {
  baseLanguageModel,
  defaultImageModel,
  defaultLanguageModel,
  defaultRerankModel,
  defaultSpeechToTextModel,
  defaultTextToSpeechModel,
  defaultVideoModel,
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

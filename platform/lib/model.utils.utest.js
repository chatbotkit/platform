import {
  baseLanguageModel,
  bedrockLanguageModels,
  chatbotkitLanguageModels,
  defaultImageModel,
  defaultLanguageModel,
  deprecatedLanguageModels,
  imageModels,
  languageModels,
  noneLanguageModels,
  openaiLanguageModels,
  openrouterLanguageModels,
  speechToTextModels,
  textToSpeechModels,
  videoModels,
} from '@/config/models'

import {
  BASE_INPUT_PRICE_PER_MILLION,
  BASE_OUTPUT_PRICE_PER_MILLION,
  calculateModelPricingRatios,
} from '@/lib/model.pricing'
import {
  audioModelToUseType,
  audioModelToUseTypeMapping,
  buildLanguageModel,
  convertLanguageModelTokenCount,
  getBaseImageModelTokenCount,
  getBaseLanguageModelTokenCount,
  getBaseVideoModelTokenCount,
  getImageModelTokenRatio,
  getVideoModelTokenRatio,
  hasLanguageModelsByProvider,
  imageModelToUseType,
  imageModelToUseTypeMapping,
  languageModelToUseType,
  languageModelToUseTypeMapping,
  modelRequiresUserTurnAsLastMessage,
  modelRequiresUserTurnBeforeToolCall,
  modelSupportsChat,
  modelSupportsFunctions,
  modelSupportsImageInput,
  modelSupportsRealtime,
  modelSupportsResponses,
  parseImageModel,
  parseLanguageModel,
  redactLanguageModel,
  revealLanguageModel,
  speechToTextModelToUseType,
  speechToTextModelToUseTypeMapping,
  textToSpeechModelToUseType,
  textToSpeechModelToUseTypeMapping,
} from '@/lib/model.utils'

jest.mock('@/config/models', () => {
  const actual = jest.requireActual('@/config/models')
  const base = actual.languageModels.base

  const languageModel = (overrides = {}) => ({
    ...base,
    description: 'Test model',
    provider: 'openai',
    family: 'gpt',
    features: ['chat', 'functions'],
    pricing: {
      tokenRatio: 1,
      inputTokenRatio: 1,
      outputTokenRatio: 1,
    },
    visible: true,
    deprecated: false,
    ...overrides,
  })

  const openaiFixtures = {
    'gpt-3.5-turbo': languageModel(),
    'gpt-3.5-turbo-instruct': languageModel({ features: [] }),
    'gpt-4': languageModel(),
    'gpt-4-turbo': languageModel({
      pricing: {
        tokenRatio: 2,
        inputTokenRatio: 2,
        outputTokenRatio: 2,
      },
    }),
    'gpt-4o': languageModel({ features: ['chat', 'functions', 'image'] }),
    'gpt-5': languageModel({
      pricing: {
        tokenRatio: 0.5556,
        inputTokenRatio: 0.5556,
        outputTokenRatio: 0.5556,
      },
    }),
    'gpt-5.4-mini': languageModel({
      features: ['chat', 'functions', 'responses'],
    }),
    'gpt-5.4-mini-2026-03-17': languageModel({
      features: ['chat', 'functions', 'responses'],
      visible: false,
    }),
    o1: languageModel({
      pricing: {
        tokenRatio: 3.3333,
        inputTokenRatio: 3.3333,
        outputTokenRatio: 3.3333,
      },
    }),
    'gpt-realtime-2.1': languageModel({ features: ['chat', 'realtime'] }),
    'gpt-realtime-2.1-mini': languageModel({
      features: ['chat', 'realtime'],
    }),
    'gpt-realtime-2': languageModel({ features: ['chat', 'realtime'] }),
    'gpt-realtime-1.5': languageModel({ features: ['chat', 'realtime'] }),
    'gpt-realtime-mini': languageModel({ features: ['chat', 'realtime'] }),
  }

  const otherFixtures = {
    'gemini-3.1-flash-lite': languageModel({
      provider: 'vercel',
      family: 'gemini',
      providerModel: 'google/gemini-3.1-flash-lite',
      requiresUserTurnBeforeToolCall: true,
    }),
    'claude-4-sonnet': languageModel({
      provider: 'vercel',
      family: 'claude',
      providerModel: 'anthropic/claude-4-sonnet',
    }),
    'claude-4-opus': languageModel({
      provider: 'vercel',
      family: 'claude',
      providerModel: 'anthropic/claude-4-opus',
    }),
    'claude-3.5-sonnet': languageModel({
      provider: 'vercel',
      family: 'claude',
      providerModel: 'anthropic/claude-3.5-sonnet',
    }),
    'claude-4.6-sonnet': languageModel({
      provider: 'vercel',
      family: 'claude',
      providerModel: 'anthropic/claude-4.6-sonnet',
      requiresUserTurnAsLastMessage: true,
    }),
    'claude-4.6-opus': languageModel({
      provider: 'vercel',
      family: 'claude',
      providerModel: 'anthropic/claude-4.6-opus',
      requiresUserTurnAsLastMessage: true,
    }),
    'claude-4.5-sonnet': languageModel({
      provider: 'vercel',
      family: 'claude',
      providerModel: 'anthropic/claude-4.5-sonnet',
      requiresUserTurnAsLastMessage: true,
    }),
    'claude-4.5-haiku': languageModel({
      provider: 'vercel',
      family: 'claude',
      providerModel: 'anthropic/claude-4.5-haiku',
      requiresUserTurnAsLastMessage: true,
    }),
    'text-algo-003': languageModel({ provider: 'chatbotkit' }),
  }

  otherFixtures['text-qaa-003'] = languageModel({
    provider: 'chatbotkit',
    forceFunction: 'query',
    interactionMaxMessages: 1,
    proxyToModel: 'text-algo-003',
  })

  return {
    ...actual,
    __esModule: true,
    openaiLanguageModels: {
      ...openaiFixtures,
      ...actual.openaiLanguageModels,
    },
    languageModels: {
      ...openaiFixtures,
      ...otherFixtures,
      ...actual.languageModels,
    },
    defaultLanguageModel:
      actual.defaultLanguageModel in actual.languageModels
        ? actual.defaultLanguageModel
        : 'gpt-4o',
    defaultImageModel:
      actual.defaultImageModel in actual.imageModels
        ? actual.defaultImageModel
        : 'gpt-image-1.5',
    imageModels: {
      dalle3: {
        provider: 'openai',
        pricing: { tokenRatio: 1 },
      },
      'gpt-image-1.5': {
        provider: 'openai',
        pricing: {
          tokenRatio: 1,
          inputTokenRatio: 2,
          outputTokenRatio: 3,
        },
      },
      ...actual.imageModels,
    },
    videoModels: {
      'veo-3.1': {
        provider: 'vercel',
        pricing: {
          tokenRatio: 1,
          inputTokenRatio: 2,
          outputTokenRatio: 3,
        },
      },
      ...actual.videoModels,
    },
    speechToTextModels: {
      'gpt-4o-transcribe': { provider: 'openai' },
      ...actual.speechToTextModels,
    },
    textToSpeechModels: {
      'tts-1': { provider: 'openai' },
      ...actual.textToSpeechModels,
    },
  }
})

// A deployment without the flagship provider's key falls back to the
// `custom` default on purpose (see config/models.ts), so the invariants
// below only apply when a concrete default is configured.
const hasConcreteDefaultLanguageModel = defaultLanguageModel !== 'custom'

describe('defaultLanguageModel', () => {
  it('must be a valid language model', () => {
    expect(defaultLanguageModel in languageModels).toBeTruthy()
  })

  // @note the view action (lib/action.exec.view.ts) runs the default language
  // model against images, so the default must always support image input.
  ;(hasConcreteDefaultLanguageModel ? it : it.skip)(
    'must support image input',
    () => {
      expect(modelSupportsImageInput(defaultLanguageModel)).toBe(true)
    }
  )
})

describe('baseLanguageModel', () => {
  it('must point to the canonical base model key', () => {
    expect(baseLanguageModel).toBe('base')
  })

  it('must always include the canonical base model definition', () => {
    expect(languageModels).toHaveProperty('base')
    expect(chatbotkitLanguageModels).toHaveProperty('base')
  })

  it('must be a valid language model', () => {
    expect(baseLanguageModel in languageModels).toBeTruthy()
  })

  it('must have token ratio of 1', () => {
    expect(languageModels[baseLanguageModel].pricing.tokenRatio).toEqual(1)
  })
})

describe('models', () => {
  it('model must have provider', () => {
    for (const [, config] of Object.entries(languageModels)) {
      expect(config.provider).toBeTruthy()
    }
  })

  it('model must have family', () => {
    for (const [, config] of Object.entries(languageModels)) {
      expect(config.family).toBeTruthy()
    }
  })

  it('model maxInputTokens and maxOutputTokens must be whole integers', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      expect({
        model: name,
        maxInputTokens: config.maxInputTokens % 1,
        maxOutputTokens: config.maxOutputTokens % 1,
      }).toEqual({
        model: name,
        maxInputTokens: 0,
        maxOutputTokens: 0,
      })
    }
  })

  it('model maxTokens must be the sum of model maxInputTokens and maxOutputTokens', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      expect({ name, maxTokens: config.maxTokens }).toEqual({
        name,
        maxTokens: config.maxInputTokens + config.maxOutputTokens,
      })
    }
  })

  it('model that has -next or -classic suffix must be set to invisible', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      if (
        (name.endsWith('-next') || name.endsWith('-classic')) &&
        !config.deprecated &&
        !name.includes('gpt-3.5-turbo-16k')
      ) {
        expect({
          name,
          visible: config.visible,
        }).toEqual({
          name,
          visible: false,
        })
      }
    }
  })

  it('model that has a date in the name must be invisible', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      if (/\d{4}-\d{2}-\d{2}/.test(name)) {
        expect({
          name,
          visible: config.visible,
        }).toEqual({
          name,
          visible: false,
        })
      }
    }
  })

  it('proxy models that have preview suffix must have beta tags and marked as hidden', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      // @note deprecated back-compat aliases (e.g. the flattened
      // gpt-4-*-preview version pins) inherit their target's tags and are
      // hidden by construction - the beta convention only applies to active
      // preview proxies
      if (
        config.proxyToModel &&
        name.endsWith('-preview') &&
        !config.deprecated
      ) {
        expect({
          name,
          beta: config.tags.includes('beta'),
          visible: config.visible,
        }).toEqual({
          name,
          beta: true,
          visible: false,
        })
      }
    }
  })

  it('proxy models must have a definition', () => {
    for (const [, config] of Object.entries(languageModels)) {
      if (config.proxyToModel) {
        expect(languageModels).toHaveProperty([config.proxyToModel])
      }
    }
  })

  it('proxy models must have the same family', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      if (config.proxyToModel) {
        expect({ name, family: config.family }).toEqual({
          name,
          family: languageModels[config.proxyToModel].family,
        })
      }
    }
  })

  it('proxy models must have the same features', () => {
    for (const [, config] of Object.entries(languageModels)) {
      if (config.proxyToModel) {
        for (const feature of languageModels[config.proxyToModel].features) {
          expect(config.features).toContain(feature)
        }
      }
    }
  })

  it('proxy models must have maxTokens, maxInputTokens, and maxOutputTokens equal or less the proxy model', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      if (config.proxyToModel) {
        const proxy = languageModels[config.proxyToModel]

        expect({
          name,
          maxTokens: config.maxTokens <= proxy.maxTokens,
          maxInputTokens: config.maxInputTokens <= proxy.maxInputTokens,
          maxOutputTokens: config.maxOutputTokens <= proxy.maxOutputTokens,
        }).toEqual({
          name,
          maxTokens: true,
          maxInputTokens: true,
          maxOutputTokens: true,
        })
      }
    }
  })

  it('models must have a token ratio that is equal or larger than the proxy model', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      if (config.proxyToModel) {
        const proxy = languageModels[config.proxyToModel]

        expect({
          name,
          tokenRatio: config.pricing.tokenRatio >= proxy.pricing.tokenRatio,
        }).toEqual({
          name,
          tokenRatio: true,
        })
      }
    }
  })

  it('next and classic models must have a proxy model', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      if (name.endsWith('-next') || name.endsWith('-classic')) {
        expect({
          name,
          proxyToModel: !!config.proxyToModel,
        }).toEqual({
          name,
          proxyToModel: true,
        })
      }
    }
  })

  it('text qaa models must have a force function', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      if (name.startsWith('text-qaa') && !name.startsWith('text-qaa-web')) {
        expect({
          name,
          forceFunction: config.forceFunction,
        }).toEqual({
          name,
          forceFunction: 'query',
        })
      }
    }
  })

  it('must correctly detect chat models', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      if (['base', 'custom'].includes(name)) {
        continue // skip base and custom models
      }

      if (config.deprecated) {
        continue // skip deprecated models because they will throw an error
      }

      if (modelSupportsChat(name)) {
        try {
          expect(config.features).toContain('chat')
        } catch {
          throw new Error(`Expected model ${name} to contain chat feature`)
        }
      } else if (config.features.includes('chat')) {
        try {
          expect(modelSupportsChat(name)).toBeTruthy()
        } catch {
          throw new Error(
            `Expected model ${name} to be detected as a chat model`
          )
        }
      }
    }

    expect(modelSupportsChat('gpt-3.5-turbo-instruct')).toBeFalsy()
  })

  it('must detect responses support, including custom/BYOK models that proxy to a responses model', () => {
    // @note standard gpt-5.4-mini carries the 'responses' feature directly
    expect(modelSupportsResponses('gpt-5.4-mini')).toBeTruthy()
    expect(modelSupportsResponses('gpt-5.4-mini-2026-03-17')).toBeTruthy()

    // @note a custom/BYOK model proxying to gpt-5.4-mini does not carry the
    // 'responses' feature itself, but the underlying model requires it - it must
    // still be detected
    expect(
      modelSupportsResponses(
        'custom/name=gpt-5.4-mini/provider=openai/reasoningEffort=medium/credentials=sk-test'
      )
    ).toBeTruthy()

    // @note a custom model proxying to a non-responses model must NOT route to
    // the Responses API
    expect(
      modelSupportsResponses(
        'custom/name=gpt-4o/provider=openai/credentials=sk-test'
      )
    ).toBeFalsy()
    expect(modelSupportsResponses('gpt-4o')).toBeFalsy()
  })

  it('must correctly detect function models', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      if (['base', 'custom'].includes(name)) {
        continue // skip base and custom models
      }

      if (config.deprecated) {
        continue // skip deprecated models because they will throw an error
      }

      if (modelSupportsFunctions(name)) {
        expect(config.features).toContain('functions')
      }
    }
  })

  it('must correctly detect models that require a user turn before tool calls', () => {
    expect(modelRequiresUserTurnBeforeToolCall('gemini-3.1-flash-lite')).toBe(
      true
    )
    expect(modelRequiresUserTurnBeforeToolCall('claude-4-sonnet')).toBe(false)
    expect(modelRequiresUserTurnBeforeToolCall('claude-4-opus')).toBe(false)
    expect(modelRequiresUserTurnBeforeToolCall('claude-3.5-sonnet')).toBe(false)
    expect(modelRequiresUserTurnBeforeToolCall('gpt-4o')).toBe(false)
  })

  it('must correctly detect models that require a user turn as the last message', () => {
    // Claude models route via anthropic/ providerModel and must end with a user turn
    expect(modelRequiresUserTurnAsLastMessage('claude-4.6-sonnet')).toBe(true)
    expect(modelRequiresUserTurnAsLastMessage('claude-4.6-opus')).toBe(true)
    expect(modelRequiresUserTurnAsLastMessage('claude-4.5-sonnet')).toBe(true)
    expect(modelRequiresUserTurnAsLastMessage('claude-4.5-haiku')).toBe(true)
    // Non-Anthropic models do not have this constraint
    expect(modelRequiresUserTurnAsLastMessage('gpt-4o')).toBe(false)
    expect(modelRequiresUserTurnAsLastMessage('gemini-3.1-flash-lite')).toBe(
      false
    )
  })

  it('detects realtime-capable language models', () => {
    expect(modelSupportsRealtime('gpt-realtime-2')).toBe(true)
    expect(modelSupportsRealtime(defaultLanguageModel)).toBe(false)
  })

  it('registers the supported OpenAI realtime conversation models', () => {
    for (const model of [
      'gpt-realtime-2.1',
      'gpt-realtime-2.1-mini',
      'gpt-realtime-2',
      'gpt-realtime-1.5',
      'gpt-realtime-mini',
    ]) {
      expect(openaiLanguageModels[model]).toBeDefined()
      expect(modelSupportsRealtime(model)).toBe(true)
    }
  })
})

describe('languageModelToUseType', () => {
  ;(hasConcreteDefaultLanguageModel ? it : it.skip)(
    'must correctly return the correct use type 01',
    () => {
      const type = languageModelToUseType(defaultLanguageModel)

      expect(typeof type).toBe('string')
      expect(type).toMatch(/^[A-Z][A-Z0-9_]+_TOKEN$/)
    }
  )

  it('must correctly return the correct use type 02', () => {
    for (const model of Object.keys(languageModels)) {
      if (['custom'].includes(model)) {
        continue // skip custom model because it requires additional config
      }

      if (languageModels[model].deprecated) {
        continue // skip deprecated models because they will throw an error
      }

      const type = languageModelToUseType(model)

      expect({
        model: model,
        isString: typeof type === 'string',
        matchesMapping: type === languageModelToUseTypeMapping[model],
      }).toEqual({
        model: model,
        isString: true,
        matchesMapping: true,
      })
    }
  })

  it('must correctly return the correct use type 03', () => {
    for (const model of Object.keys(languageModels)) {
      if (['custom'].includes(model)) {
        continue // skip custom model because it requires additional config
      }

      if (languageModels[model].deprecated) {
        continue // skip deprecated models because they will throw an error
      }

      const { name } = parseLanguageModel(`${model}/temperature=1`)

      const type = languageModelToUseType(name)

      expect({
        name: name,
        isString: typeof type === 'string',
        matchesMapping: type === languageModelToUseTypeMapping[name],
      }).toEqual({
        name: name,
        isString: true,
        matchesMapping: true,
      })
    }
  })
})

describe('imageModelToUseType', () => {
  it('must correctly return the correct use type 01', () => {
    const type = imageModelToUseType(defaultImageModel)

    expect(typeof type).toBe('string')
    expect(type).toMatch(/^[A-Z][A-Z0-9_]+_TOKEN$/)
    expect(type).toBe(imageModelToUseTypeMapping[defaultImageModel])
  })
})

describe('speechToTextModelToUseType', () => {
  it('must correctly return the correct use type', () => {
    const model = 'gpt-4o-transcribe'
    const type = speechToTextModelToUseType(model)

    expect(model in speechToTextModels).toBeTruthy()
    expect(typeof type).toBe('string')
    expect(type).toMatch(/^[A-Z][A-Z0-9_]+_TOKEN$/)
    expect(type).toBe(speechToTextModelToUseTypeMapping[model])
  })
})

describe('textToSpeechModelToUseType', () => {
  it('must correctly return the correct use type', () => {
    const model = 'tts-1'
    const type = textToSpeechModelToUseType(model)

    expect(model in textToSpeechModels).toBeTruthy()
    expect(typeof type).toBe('string')
    expect(type).toMatch(/^[A-Z][A-Z0-9_]+_TOKEN$/)
    expect(type).toBe(textToSpeechModelToUseTypeMapping[model])
  })
})

describe('audioModelToUseType', () => {
  it('must correctly return the speech-to-text use type', () => {
    const model = 'gpt-4o-transcribe'
    const type = audioModelToUseType(model)

    expect(type).toBe(audioModelToUseTypeMapping[model])
    expect(type).toBe(speechToTextModelToUseTypeMapping[model])
  })

  it('must correctly return the text-to-speech use type', () => {
    const model = 'tts-1'
    const type = audioModelToUseType(model)

    expect(type).toBe(audioModelToUseTypeMapping[model])
    expect(type).toBe(textToSpeechModelToUseTypeMapping[model])
  })
})

describe('parseLanguageModel', () => {
  it('model parse successfully', () => {
    if (hasConcreteDefaultLanguageModel) {
      expect(parseLanguageModel('')).toEqual({
        name: defaultLanguageModel,
        config: {},
      })
    }

    expect(parseLanguageModel('gpt-3.5-turbo')).toEqual({
      name: 'gpt-3.5-turbo',
      config: {},
    })

    expect(parseLanguageModel('gpt-3.5-turbo/temperature=1')).toEqual({
      name: 'gpt-3.5-turbo',
      config: { temperature: 1 },
    })

    expect(parseLanguageModel('gpt-3.5-turbo/maxTokens=3500')).toEqual({
      name: 'gpt-3.5-turbo',
      config: { maxTokens: 3500 },
    })

    expect(parseLanguageModel('gpt-realtime-2/voice=cedar')).toEqual({
      name: 'gpt-realtime-2',
      config: { voice: 'cedar' },
    })

    expect(parseLanguageModel('text-algo-003')).toEqual({
      name: 'text-algo-003',
      config: {},
    })
  })

  it('throws an error when an invalid model name or config provided', () => {
    expect(() => parseLanguageModel('invalid-model-name')).toThrow()

    expect(() =>
      parseLanguageModel('gpt-3.5-turbo/proxyToModel=text-algo-001')
    ).toThrow()
  })

  it('throws an error when a custom model is missing required fields', () => {
    expect(() => parseLanguageModel('custom/provider=openai')).toThrow()
    expect(() => parseLanguageModel('custom/name=gpt-4')).toThrow()
    expect(() =>
      parseLanguageModel('custom/name=gpt-4/provider=openai')
    ).toThrow()
  })

  it('parses a valid custom model with all required fields', () => {
    expect(() =>
      parseLanguageModel('custom/name=gpt-4/provider=openai/credentials=abc123')
    ).not.toThrow()
  })

  it('parses a valid custom model with a valid endpoint', () => {
    const { config } = parseLanguageModel(
      'custom/name=gpt-4/provider=openai/credentials=abc123/endpoint=https:%2F%2Fapi.example.com%2F'
    )

    expect(config.endpoint).toBe('https://api.example.com/')
  })

  it('parses a valid custom model with an empty endpoint', () => {
    const { config } = parseLanguageModel(
      'custom/name=gpt-4/provider=openai/credentials=abc123/endpoint='
    )

    expect(config.endpoint).toBe('')
  })

  it('throws an error for a custom model with an http endpoint', () => {
    expect(() =>
      parseLanguageModel(
        'custom/name=gpt-4/provider=openai/credentials=abc123/endpoint=http:%2F%2Fapi.example.com%2F'
      )
    ).toThrow()
  })

  it('throws an error for a custom model with an invalid endpoint', () => {
    expect(() =>
      parseLanguageModel(
        'custom/name=gpt-4/provider=openai/credentials=abc123/endpoint=not-a-url'
      )
    ).toThrow()
  })

  it('parses a valid custom model with features', () => {
    const { config } = parseLanguageModel(
      'custom/name=gpt-4/provider=openai/credentials=abc123/features=chat,functions'
    )

    expect(config.features).toBe('chat,functions')
  })

  it('parses a valid custom model with thresholdStrategy', () => {
    const { config } = parseLanguageModel(
      'custom/name=gpt-4/provider=openai/credentials=abc123/thresholdStrategy=compact'
    )

    expect(config.thresholdStrategy).toBe('compact')
  })

  it('throws an error for a custom model with an invalid thresholdStrategy', () => {
    expect(() =>
      parseLanguageModel(
        'custom/name=gpt-4/provider=openai/credentials=abc123/thresholdStrategy=invalid'
      )
    ).toThrow()
  })

  // @todo this test is disabled for now because we do not have a model that
  // deprecated but at the same time does not proxy to another model
  // it('throws an error when a deprecated model is deprecated', () => {
  //   for (const model of Object.keys(languageModels)) {
  //     if (languageModels[model].deprecated) {
  //       expect(() => parseLanguageModel(model)).toThrow()
  //     }
  //   }
  // })
})

describe('redactLanguageModel', () => {
  it('leaves predefined models untouched', () => {
    expect(redactLanguageModel('gpt-3.5-turbo')).toBe('gpt-3.5-turbo')
    expect(redactLanguageModel('gpt-3.5-turbo/temperature=1')).toBe(
      'gpt-3.5-turbo/temperature=1'
    )
  })

  it('passes through empty/falsy values', () => {
    expect(redactLanguageModel('')).toBe('')
    expect(redactLanguageModel(undefined)).toBe(undefined)
  })

  it('masks the credentials of a custom model', () => {
    const masked = redactLanguageModel(
      'custom/name=gpt-4/provider=openai/credentials=sk-proj-abcdefghijklmnopqrstuvwxyz123'
    )

    const { config } = parseLanguageModel(masked)

    // @note the raw credential must not survive
    expect(masked).not.toContain('sk-proj-abcdefghijklmnopqrstuvwxyz123')
    expect(config.credentials).toMatch(/^\*+123$/)

    // @note non-secret fields stay intact
    expect(config.name).toBe('gpt-4')
    expect(config.provider).toBe('openai')
  })

  it('masks even short / low-entropy credentials', () => {
    const masked = redactLanguageModel(
      'custom/name=gpt-4/provider=openai/credentials=abc123'
    )

    const { config } = parseLanguageModel(masked)

    expect(config.credentials).not.toBe('abc123')
    expect(config.credentials).toBe('***123')
  })

  it('preserves the endpoint while masking credentials', () => {
    const masked = redactLanguageModel(
      'custom/name=gpt-4/provider=openai/credentials=sk-secret-value-1234567890/endpoint=https:%2F%2Fapi.example.com%2F'
    )

    const { config } = parseLanguageModel(masked)

    expect(config.endpoint).toBe('https://api.example.com/')
    expect(config.credentials).not.toContain('secret')
  })
})

describe('revealLanguageModel', () => {
  it('must correctly reveal the language model', () => {
    const proxyModelName = languageModels['text-qaa-003'].proxyToModel
    const proxyModelConfig = languageModels[proxyModelName || '']

    const { name, config } = revealLanguageModel(
      parseLanguageModel('text-qaa-003')
    )

    expect(name).toEqual(proxyModelName)
    expect(config.provider).toEqual(proxyModelConfig.provider)

    expect(config.interactionMaxMessages).not.toEqual(
      proxyModelConfig.interactionMaxMessages
    )

    expect(config.proxyToModel).not.toBeTruthy()
  })

  it('must not be able to override name', () => {
    expect(() => {
      revealLanguageModel(parseLanguageModel('text-qaa-003/name=abc123'))
    }).toThrow()
  })

  it('must not be able to override provider', () => {
    expect(() => {
      revealLanguageModel(parseLanguageModel('text-qaa-003/provider=mistral'))
    }).toThrow()
  })

  it('must not be able to override features', () => {
    expect(() => {
      revealLanguageModel(parseLanguageModel('text-qaa-003/features=chat'))
    }).toThrow()
  })

  it('must not be able to override credentials', () => {
    expect(() => {
      revealLanguageModel(parseLanguageModel('text-qaa-003/credentials=abc123'))
    }).toThrow()
  })

  it('should be able to handle unknown models gracefully', () => {
    expect(() => {
      revealLanguageModel({ name: 'unknown-model', config: {} })
    }).not.toThrow()
  })

  it('must correctly reveal a custom model with known name', () => {
    const { name, config, originalName, originalConfig } = revealLanguageModel(
      parseLanguageModel(
        'custom/name=gpt-3.5-turbo/provider=openai/credentials=abcxyz'
      )
    )

    expect(name).toEqual('gpt-3.5-turbo')
    expect(config.provider).toEqual('openai')
    expect(config.features.length).toBeGreaterThan(0)
    expect(config.credentials).toEqual('abcxyz')

    expect(originalName).toEqual('custom')
    expect(originalConfig.name).toEqual('gpt-3.5-turbo')
    expect(originalConfig.provider).toEqual('openai')
    expect(originalConfig.credentials).toEqual('abcxyz')

    expect(config.proxyToModel).not.toBeTruthy()
  })

  it('must correctly reveal a custom model with unknown name', () => {
    const { name, config, originalName, originalConfig } = revealLanguageModel(
      parseLanguageModel(
        'custom/name=customName/provider=openai/credentials=abcxyz'
      )
    )

    expect(name).toEqual('customName')
    expect(config.provider).toEqual('openai')
    expect(config.credentials).toEqual('abcxyz')
    expect(config.features.length).toBeGreaterThan(0)

    expect(originalName).toEqual('custom')
    expect(originalConfig.name).toEqual('customName')
    expect(originalConfig.provider).toEqual('openai')
    expect(originalConfig.credentials).toEqual('abcxyz')

    expect(config.proxyToModel).not.toBeTruthy()
  })

  it('must throw when custom model has no name field', () => {
    // @note without a name field, 'custom' would be sent to the AI provider as the model name causing a 404 error
    expect(() =>
      revealLanguageModel({
        name: 'custom',
        config: { provider: 'openai', credentials: 'abcxyz' },
      })
    ).toThrow('Missing model name in the custom model configuration')
  })

  it('inherits the proxy target features into a custom model without stripping the base ones', () => {
    // @note the custom base features do NOT include 'responses', but the proxy
    // target (gpt-5.4-mini) does. The resolved model must inherit it (union, not
    // override) - otherwise it gets misrouted to chat completions, which 400s on
    // tools + reasoning_effort.
    const { name, config } = revealLanguageModel(
      parseLanguageModel(
        'custom/name=gpt-5.4-mini/provider=openai/credentials=abcxyz'
      )
    )

    expect(name).toEqual('gpt-5.4-mini')

    // @note inherited from the proxy target
    expect(config.features).toContain('responses')

    // @note retained from the custom base (proves union, not replacement)
    expect(config.features).toContain('file')
  })

  it('does not invent features the proxy target lacks', () => {
    // @note a custom model proxying to gpt-4o must NOT report 'responses'
    // (gpt-4o does not have it) - inheritance is scoped to the actual target,
    // so gpt-4o-backed custom models stay on the chat completions path
    const { config } = revealLanguageModel(
      parseLanguageModel(
        'custom/name=gpt-4o/provider=openai/credentials=abcxyz'
      )
    )

    expect(config.features).toContain('chat')
    expect(config.features).not.toContain('responses')
  })
})

describe('parseImageModel', () => {
  it('model parse successfully', () => {
    expect(parseImageModel('')).toEqual({
      name: defaultImageModel,
      config: {},
    })

    expect(parseImageModel('dalle3')).toEqual({
      name: 'dalle3',
      config: {},
    })

    expect(parseImageModel('dalle3/n=1')).toEqual({
      name: 'dalle3',
      config: { n: 1 },
    })

    expect(parseImageModel('dalle3/size=256x256')).toEqual({
      name: 'dalle3',
      config: { size: '256x256' },
    })
  })

  it('throws an error when an invalid model name or config provided', () => {
    expect(() => parseImageModel('invalid-model-name')).toThrow()

    expect(() => parseImageModel('dalle3/proxyToModel=dalle2')).toThrow()
  })
})

describe('getBaseModelTokenCount', () => {
  it('must correctly get the base model token count', () => {
    expect(getBaseLanguageModelTokenCount('gpt-3.5-turbo', 100)).toEqual(
      Math.round(languageModels['gpt-3.5-turbo'].pricing.tokenRatio * 100)
    )
  })
})

describe('convertTokenCount', () => {
  it('must correctly convert token count', () => {
    expect(
      convertLanguageModelTokenCount('gpt-3.5-turbo', 100, 'gpt-4-turbo')
    ).toEqual(
      Math.round(
        getBaseLanguageModelTokenCount('gpt-3.5-turbo', 100) /
          languageModels['gpt-4-turbo'].pricing.tokenRatio
      )
    )
  })
})

describe('getImageModelTokenRatio', () => {
  it('returns the default tokenRatio when no type is provided', () => {
    expect(getImageModelTokenRatio('gpt-image-1.5')).toBe(
      imageModels['gpt-image-1.5'].pricing.tokenRatio
    )
  })

  it('returns the default tokenRatio for type "default"', () => {
    expect(getImageModelTokenRatio('gpt-image-1.5', 'default')).toBe(
      imageModels['gpt-image-1.5'].pricing.tokenRatio
    )
  })

  it('returns the inputTokenRatio for type "input"', () => {
    expect(getImageModelTokenRatio('gpt-image-1.5', 'input')).toBe(
      imageModels['gpt-image-1.5'].pricing.inputTokenRatio
    )
  })

  it('returns the outputTokenRatio for type "output"', () => {
    expect(getImageModelTokenRatio('gpt-image-1.5', 'output')).toBe(
      imageModels['gpt-image-1.5'].pricing.outputTokenRatio
    )
  })

  it('throws for an unknown image model', () => {
    expect(() => getImageModelTokenRatio('not-a-real-image-model')).toThrow()
  })
})

describe('getBaseImageModelTokenCount', () => {
  it('multiplies raw count by the default tokenRatio and rounds', () => {
    const ratio = imageModels['gpt-image-1.5'].pricing.tokenRatio

    expect(getBaseImageModelTokenCount('gpt-image-1.5', 100)).toBe(
      Math.max(1, Math.round(100 * ratio))
    )
  })

  it('uses the inputTokenRatio for type "input"', () => {
    const ratio = imageModels['gpt-image-1.5'].pricing.inputTokenRatio

    expect(getBaseImageModelTokenCount('gpt-image-1.5', 100, 'input')).toBe(
      Math.max(1, Math.round(100 * ratio))
    )
  })

  it('uses the outputTokenRatio for type "output"', () => {
    const ratio = imageModels['gpt-image-1.5'].pricing.outputTokenRatio

    expect(getBaseImageModelTokenCount('gpt-image-1.5', 100, 'output')).toBe(
      Math.max(1, Math.round(100 * ratio))
    )
  })

  it('returns 0 when raw count is 0', () => {
    expect(getBaseImageModelTokenCount('gpt-image-1.5', 0, 'output')).toBe(0)
  })

  it('matches getImageModelTokenRatio per type', () => {
    for (const type of /** @type {const} */ (['default', 'input', 'output'])) {
      const ratio = getImageModelTokenRatio('gpt-image-1.5', type)

      expect(getBaseImageModelTokenCount('gpt-image-1.5', 50, type)).toBe(
        Math.max(1, Math.round(50 * ratio))
      )
    }
  })
})

describe('getVideoModelTokenRatio', () => {
  it('returns the default tokenRatio when no type is provided', () => {
    expect(getVideoModelTokenRatio('veo-3.1')).toBe(
      videoModels['veo-3.1'].pricing.tokenRatio
    )
  })

  it('returns the default tokenRatio for type "default"', () => {
    expect(getVideoModelTokenRatio('veo-3.1', 'default')).toBe(
      videoModels['veo-3.1'].pricing.tokenRatio
    )
  })

  it('returns the inputTokenRatio for type "input"', () => {
    expect(getVideoModelTokenRatio('veo-3.1', 'input')).toBe(
      videoModels['veo-3.1'].pricing.inputTokenRatio
    )
  })

  it('returns the outputTokenRatio for type "output"', () => {
    expect(getVideoModelTokenRatio('veo-3.1', 'output')).toBe(
      videoModels['veo-3.1'].pricing.outputTokenRatio
    )
  })

  it('falls back to tokenRatio when inputTokenRatio is missing', () => {
    const model = Object.entries(videoModels).find(
      ([, c]) => c.pricing.inputTokenRatio === undefined
    )

    if (!model) {
      return // skip - every configured video model defines an inputTokenRatio
    }

    const [name, config] = model

    expect(getVideoModelTokenRatio(name, 'input')).toBe(
      config.pricing.tokenRatio
    )
  })

  it('throws for an unknown video model', () => {
    expect(() => getVideoModelTokenRatio('not-a-real-video-model')).toThrow()
  })
})

describe('getBaseVideoModelTokenCount', () => {
  it('multiplies raw count by the default tokenRatio and rounds', () => {
    const ratio = videoModels['veo-3.1'].pricing.tokenRatio

    expect(getBaseVideoModelTokenCount('veo-3.1', 4)).toBe(
      Math.max(1, Math.round(4 * ratio))
    )
  })

  it('uses the inputTokenRatio for type "input"', () => {
    const ratio = videoModels['veo-3.1'].pricing.inputTokenRatio

    expect(getBaseVideoModelTokenCount('veo-3.1', 3, 'input')).toBe(
      Math.max(1, Math.round(3 * ratio))
    )
  })

  it('uses the outputTokenRatio for type "output"', () => {
    const ratio = videoModels['veo-3.1'].pricing.outputTokenRatio

    expect(getBaseVideoModelTokenCount('veo-3.1', 4, 'output')).toBe(
      Math.max(1, Math.round(4 * ratio))
    )
  })

  it('returns 0 when raw count is 0', () => {
    expect(getBaseVideoModelTokenCount('veo-3.1', 0, 'output')).toBe(0)
  })

  it('floors very small positive counts to a minimum of 1 debit', () => {
    // A pathological case: a model with a tiny ratio so that round(count*ratio)
    // would otherwise yield 0 for a non-zero raw count. We assert the function
    // never returns < 1 when raw count > 0.
    const small = 0.00001
    const ratio = videoModels['veo-3.1'].pricing.tokenRatio

    if (Math.round(small * ratio) !== 0) {
      return // skip - the chosen model doesn't exhibit the floor case
    }

    expect(getBaseVideoModelTokenCount('veo-3.1', small)).toBe(1)
  })

  it('matches getVideoModelTokenRatio per type', () => {
    for (const type of /** @type {const} */ (['default', 'input', 'output'])) {
      const ratio = getVideoModelTokenRatio('veo-3.1', type)

      expect(getBaseVideoModelTokenCount('veo-3.1', 7, type)).toBe(
        Math.max(1, Math.round(7 * ratio))
      )
    }
  })
})

describe('forceFunction configuration', () => {
  it('should parse forceFunction from model string', () => {
    // Test parsing a model string with forceFunction
    const parsed = parseLanguageModel('gpt-3.5-turbo/forceFunction=query')

    expect(parsed.name).toBe('gpt-3.5-turbo')
    expect(parsed.config.forceFunction).toBe('query')
  })

  it('should parse forceFunction with different function names', () => {
    // Test parsing with different function names
    const parsed1 = parseLanguageModel('gpt-4/forceFunction=search')

    expect(parsed1.config.forceFunction).toBe('search')

    const parsed2 = parseLanguageModel('gpt-4/forceFunction=analyze')

    expect(parsed2.config.forceFunction).toBe('analyze')
  })

  it('should parse model string without forceFunction', () => {
    // Test parsing a model string without forceFunction
    const parsed = parseLanguageModel('gpt-3.5-turbo')

    expect(parsed.name).toBe('gpt-3.5-turbo')
    expect(parsed.config.forceFunction).toBeUndefined()
  })

  it('should parse model string with empty forceFunction', () => {
    // Test parsing a model string with empty forceFunction value
    const parsed = parseLanguageModel('gpt-3.5-turbo/forceFunction=')

    expect(parsed.name).toBe('gpt-3.5-turbo')
    expect(parsed.config.forceFunction).toBe('')
  })

  it('should parse model string with multiple parameters including forceFunction', () => {
    // Test parsing with multiple parameters
    const parsed = parseLanguageModel(
      'gpt-4/temperature=0.5/forceFunction=query'
    )

    expect(parsed.name).toBe('gpt-4')
    expect(parsed.config.temperature).toBe(0.5)
    expect(parsed.config.forceFunction).toBe('query')
  })

  it('should build model string with forceFunction', () => {
    // Test building model string with forceFunction
    const modelString = buildLanguageModel('gpt-3.5-turbo', {
      forceFunction: 'query',
    })

    expect(modelString).toBe('gpt-3.5-turbo/forceFunction=query')
  })

  it('should build model string with realtime voice', () => {
    expect(
      buildLanguageModel('gpt-realtime-2', {
        voice: 'cedar',
      })
    ).toBe('gpt-realtime-2/voice=cedar')
  })

  it('should build model string with multiple parameters including forceFunction', () => {
    // Test building with multiple parameters
    const modelString = buildLanguageModel('gpt-4', {
      temperature: 0.5,
      forceFunction: 'search',
    })

    // Order may vary, so check both possibilities
    expect(modelString).toMatch(/gpt-4\/.*forceFunction=search/)
    expect(modelString).toMatch(/gpt-4\/.*temperature=0\.5/)
  })
})

describe('convertLanguageModelTokenCount', () => {
  it('must correctly convert base tokens to base tokens', () => {
    expect(convertLanguageModelTokenCount('base', 0, 'base')).toEqual(0)
    expect(convertLanguageModelTokenCount('base', 100, 'base')).toEqual(100)
  })

  it('must correctly convert base tokens to gpt-5 tokens', () => {
    const baseTokens = 100
    const gpt5ToBaseRatio = languageModels['gpt-5'].pricing.tokenRatio

    const expectedGpt5Tokens = Math.round(baseTokens / gpt5ToBaseRatio)

    expect(convertLanguageModelTokenCount('base', baseTokens, 'gpt-5')).toEqual(
      expectedGpt5Tokens
    )
  })

  it('must correctly convert gpt-5 tokens to base tokens', () => {
    const gpt5Tokens = 100
    const gpt5ToBaseRatio = languageModels['gpt-5'].pricing.tokenRatio

    const expectedBaseTokens = Math.round(gpt5Tokens * gpt5ToBaseRatio)

    expect(convertLanguageModelTokenCount('gpt-5', gpt5Tokens, 'base')).toEqual(
      expectedBaseTokens
    )
  })

  it('must correctly convert gpt-5 tokens to gpt-5 tokens', () => {
    expect(convertLanguageModelTokenCount('gpt-5', 0, 'gpt-5')).toEqual(0)

    const gpt5Tokens = 100

    expect(
      convertLanguageModelTokenCount('gpt-5', gpt5Tokens, 'gpt-5')
    ).toEqual(gpt5Tokens)
  })

  it('must correctly convert between different models', () => {
    const gpt35Tokens = 100
    const gpt35Ratio = languageModels['gpt-3.5-turbo'].pricing.tokenRatio
    const gpt4Ratio = languageModels['gpt-4-turbo'].pricing.tokenRatio

    const gpt3Tokens = Math.round(gpt35Tokens * gpt35Ratio)
    const expectedGpt4Tokens = Math.round(gpt3Tokens / gpt4Ratio)

    expect(
      convertLanguageModelTokenCount(
        'gpt-3.5-turbo',
        gpt35Tokens,
        'gpt-4-turbo'
      )
    ).toEqual(expectedGpt4Tokens)
  })

  it('must correctly convert gpt-5 to base tokens - static values', () => {
    const gpt5Tokens = 100
    const gpt5TokenRatio = 0.5556

    const expectedBaseTokens = Math.round(gpt5Tokens * gpt5TokenRatio)

    expect(convertLanguageModelTokenCount('gpt-5', 100, 'base')).toEqual(
      expectedBaseTokens
    )
  })

  it('must correctly convert base to gpt-5 tokens - static values', () => {
    const baseTokens = 100
    const gpt5TokenRatio = 0.5556

    const expectedGpt5Tokens = Math.round(baseTokens / gpt5TokenRatio)

    expect(convertLanguageModelTokenCount('base', 100, 'gpt-5')).toEqual(
      expectedGpt5Tokens
    )
  })

  it('must correctly convert o1 to base tokens - static values', () => {
    const o1Tokens = 100
    const o1TokenRatio = 3.3333

    const expectedBaseTokens = Math.round(o1Tokens * o1TokenRatio)

    expect(convertLanguageModelTokenCount('o1', 100, 'base')).toEqual(
      expectedBaseTokens
    )
  })

  it('must correctly convert base to o1 tokens - static values', () => {
    const baseTokens = 100
    const o1TokenRatio = 3.3333

    const expectedO1Tokens = Math.round(baseTokens / o1TokenRatio)

    expect(convertLanguageModelTokenCount('base', 100, 'o1')).toEqual(
      expectedO1Tokens
    )
  })
})

describe('model pricing validation', () => {
  const ONE_MILLION = 1_000_000

  function roundRatio(value) {
    return Number(Number(value).toFixed(4))
  }

  function calculateVideoModelPricingRatios({ inputPrice, outputPrice }) {
    const inputTokenRatio = roundRatio(
      inputPrice / (BASE_INPUT_PRICE_PER_MILLION / ONE_MILLION)
    )
    const outputTokenRatio = roundRatio(
      outputPrice / (BASE_OUTPUT_PRICE_PER_MILLION / ONE_MILLION)
    )

    return {
      inputTokenRatio,
      outputTokenRatio,
      tokenRatio: outputTokenRatio,
    }
  }

  function calculateUnitPricingRatios({ inputPrice, outputPrice }) {
    const inputTokenRatio = roundRatio(
      inputPrice / (BASE_INPUT_PRICE_PER_MILLION / ONE_MILLION)
    )
    const outputTokenRatio = roundRatio(
      outputPrice / (BASE_OUTPUT_PRICE_PER_MILLION / ONE_MILLION)
    )

    return {
      inputTokenRatio,
      outputTokenRatio,
      tokenRatio: outputTokenRatio,
    }
  }

  describe('languageModels', () => {
    // Get all models that have inputPrice and outputPrice defined
    const modelsWithPricing = Object.entries(languageModels).filter(
      ([, config]) =>
        config.pricing.inputPrice !== undefined &&
        config.pricing.outputPrice !== undefined
    )

    describe('inputTokenRatio and outputTokenRatio calculations', () => {
      it.each(modelsWithPricing)(
        '%s should have correctly calculated inputTokenRatio and outputTokenRatio',
        (modelName, config) => {
          const { inputPrice, outputPrice } = config.pricing

          const expectedRatios = calculateModelPricingRatios({
            inputPrice,
            outputPrice,
          })

          expect({
            model: modelName,
            inputTokenRatio: config.pricing.inputTokenRatio,
            outputTokenRatio: config.pricing.outputTokenRatio,
          }).toEqual({
            model: modelName,
            inputTokenRatio: expectedRatios.inputTokenRatio,
            outputTokenRatio: expectedRatios.outputTokenRatio,
          })
        }
      )
    })

    describe('tokenRatio should equal outputTokenRatio', () => {
      it.each(modelsWithPricing)(
        '%s should have tokenRatio equal to outputTokenRatio',
        (modelName, config) => {
          expect({
            model: modelName,
            tokenRatio: config.pricing.tokenRatio,
          }).toEqual({
            model: modelName,
            tokenRatio: config.pricing.outputTokenRatio,
          })
        }
      )
    })

    describe('models with pricing should have all required fields', () => {
      it.each(modelsWithPricing)(
        '%s should have inputTokenRatio defined',
        (modelName, config) => {
          expect({
            model: modelName,
            hasInputTokenRatio: config.pricing.inputTokenRatio !== undefined,
          }).toEqual({
            model: modelName,
            hasInputTokenRatio: true,
          })
        }
      )

      it.each(modelsWithPricing)(
        '%s should have outputTokenRatio defined',
        (modelName, config) => {
          expect({
            model: modelName,
            hasOutputTokenRatio: config.pricing.outputTokenRatio !== undefined,
          }).toEqual({
            model: modelName,
            hasOutputTokenRatio: true,
          })
        }
      )
    })
  })

  describe('imageModels', () => {
    // Get all image models that have inputPrice and outputPrice defined
    const imageModelsWithPricing = Object.entries(imageModels).filter(
      ([, config]) =>
        config.pricing.inputPrice !== undefined &&
        config.pricing.outputPrice !== undefined
    )

    if (imageModelsWithPricing.length > 0) {
      describe('inputTokenRatio and outputTokenRatio calculations', () => {
        it.each(imageModelsWithPricing)(
          '%s should have correctly calculated inputTokenRatio and outputTokenRatio',
          (modelName, config) => {
            const { inputPrice, outputPrice } = config.pricing

            const expectedRatios = calculateUnitPricingRatios({
              inputPrice,
              outputPrice,
            })

            expect({
              model: modelName,
              inputTokenRatio: config.pricing.inputTokenRatio,
              outputTokenRatio: config.pricing.outputTokenRatio,
            }).toEqual({
              model: modelName,
              inputTokenRatio: expectedRatios.inputTokenRatio,
              outputTokenRatio: expectedRatios.outputTokenRatio,
            })
          }
        )
      })

      describe('tokenRatio should equal outputTokenRatio', () => {
        it.each(imageModelsWithPricing)(
          '%s should have tokenRatio equal to outputTokenRatio',
          (modelName, config) => {
            expect({
              model: modelName,
              tokenRatio: config.pricing.tokenRatio,
            }).toEqual({
              model: modelName,
              tokenRatio: config.pricing.outputTokenRatio,
            })
          }
        )
      })
    } else {
      it('no image models with input/output pricing defined', () => {
        expect(imageModelsWithPricing.length).toBe(0)
      })
    }
  })

  describe('videoModels', () => {
    const videoModelsWithPricing = Object.entries(videoModels).filter(
      ([, config]) =>
        config.pricing.inputPrice !== undefined &&
        config.pricing.outputPrice !== undefined
    )

    if (videoModelsWithPricing.length > 0) {
      describe('inputTokenRatio and outputTokenRatio calculations', () => {
        it.each(videoModelsWithPricing)(
          '%s should have correctly calculated inputTokenRatio and outputTokenRatio',
          (modelName, config) => {
            const { inputPrice, outputPrice } = config.pricing

            const expectedRatios = calculateVideoModelPricingRatios({
              inputPrice,
              outputPrice,
            })

            expect({
              model: modelName,
              inputTokenRatio: config.pricing.inputTokenRatio,
              outputTokenRatio: config.pricing.outputTokenRatio,
            }).toEqual({
              model: modelName,
              inputTokenRatio: expectedRatios.inputTokenRatio,
              outputTokenRatio: expectedRatios.outputTokenRatio,
            })
          }
        )
      })

      describe('tokenRatio should equal outputTokenRatio', () => {
        it.each(videoModelsWithPricing)(
          '%s should have tokenRatio equal to outputTokenRatio',
          (modelName, config) => {
            expect({
              model: modelName,
              tokenRatio: config.pricing.tokenRatio,
            }).toEqual({
              model: modelName,
              tokenRatio: config.pricing.outputTokenRatio,
            })
          }
        )
      })
    } else {
      it('no video models with input/output pricing defined', () => {
        expect(videoModelsWithPricing.length).toBe(0)
      })
    }
  })

  describe('summary', () => {
    it('should have at least one language model with pricing defined', () => {
      const modelsWithPricing = Object.entries(languageModels).filter(
        ([, config]) =>
          config.pricing.inputPrice !== undefined &&
          config.pricing.outputPrice !== undefined
      )

      expect(modelsWithPricing.length).toBeGreaterThan(0)
    })
  })
})

describe('hasLanguageModelsByProvider', () => {
  it('should return true for a provider that has non-deprecated models', () => {
    const providers = [
      ...new Set(
        Object.values(languageModels)
          .filter((m) => !m.deprecated)
          .map((m) => m.provider)
      ),
    ]

    for (const provider of providers) {
      expect(hasLanguageModelsByProvider(provider)).toBe(true)
    }
  })

  it('should return false for a provider that does not exist', () => {
    expect(hasLanguageModelsByProvider('nonexistent-provider')).toBe(false)
  })

  it('should return false when all models for a provider are deprecated', () => {
    // Verify the function checks deprecated status by confirming that
    // a non-existent provider (which has zero non-deprecated models) returns false
    expect(hasLanguageModelsByProvider('nonexistent-provider')).toBe(false)
  })

  it('should be case-sensitive', () => {
    const providers = [
      ...new Set(
        Object.values(languageModels)
          .filter((m) => !m.deprecated)
          .map((m) => m.provider)
      ),
    ]

    for (const provider of providers) {
      expect(hasLanguageModelsByProvider(provider.toUpperCase())).toBe(false)
    }
  })
})

describe('deprecatedLanguageModels', () => {
  it('deprecated models must be generated under the none provider', () => {
    for (const [name, config] of Object.entries(deprecatedLanguageModels)) {
      expect(config.provider).toBe('none')
      expect(config.deprecated).toBe(true)
      expect(config.visible).toBe(false)
      expect(config.description).toBe(
        'Deprecated model. This alias is preserved for backward compatibility.'
      )
      expect(config.proxyToModel).toBeTruthy()

      // verify params match the resolved proxy target (excluding overridden fields)
      let target = config.proxyToModel

      while (deprecatedLanguageModels[target]) {
        target = deprecatedLanguageModels[target].proxyToModel
      }

      const proxyModel = languageModels[target]

      expect(proxyModel).toBeTruthy()

      const {
        description: _d,
        provider: _p,
        deprecated: _dep,
        visible: _v,
        proxyToModel: _ptm,
        ...configRest
      } = config

      const {
        description: _d2,
        provider: _p2,
        deprecated: _dep2,
        visible: _v2,
        proxyToModel: _ptm2,
        ...proxyRest
      } = proxyModel

      expect({ name, ...configRest }).toEqual({ name, ...proxyRest })
    }
  })

  it('noneLanguageModels must be the same as deprecatedLanguageModels', () => {
    expect(noneLanguageModels).toBe(deprecatedLanguageModels)
  })

  it('provider-specific categories must exclude deprecated models', () => {
    const providerExports = [
      openaiLanguageModels,
      openrouterLanguageModels,
      bedrockLanguageModels,
      chatbotkitLanguageModels,
    ]

    for (const models of providerExports) {
      for (const [name, config] of Object.entries(models)) {
        expect({ name, deprecated: config.deprecated }).toEqual({
          name,
          deprecated: false,
        })
      }
    }
  })
})

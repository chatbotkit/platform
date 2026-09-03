import { languageModels } from '@/config/models'

import {
  bedrockLanguageModel,
  groqLanguageModel,
  languageModel,
  mistralLanguageModel,
  openaiLanguageModel,
  vercelLanguageModel,
  vertexLanguageModel,
} from '@/schemas/languageModel'

describe('languageModel schema', () => {
  it('should accept null', () => {
    const { error } = languageModel.validate(null)

    expect(error).toBeUndefined()
  })

  it('should accept empty string', () => {
    const { error } = languageModel.validate('')

    expect(error).toBeUndefined()
  })

  it('should accept a valid language model name', () => {
    const { error } = languageModel.validate('base')

    expect(error).toBeUndefined()
  })

  it('should accept a valid language model with config', () => {
    const { error } = languageModel.validate('base/temperature=0.5')

    expect(error).toBeUndefined()
  })

  it('should accept a valid custom model with all required fields', () => {
    const { error } = languageModel.validate(
      'custom/name=my-model/provider=openai/credentials=abc123'
    )

    expect(error).toBeUndefined()
  })

  it('should reject an unrecognized model name', () => {
    const { error } = languageModel.validate('totally-invalid-model')

    expect(error).toBeDefined()
  })

  it('should reject a non-string value', () => {
    const { error } = languageModel.validate(123)

    expect(error).toBeDefined()
  })

  it('should reject a custom model missing required fields', () => {
    const { error } = languageModel.validate('custom/provider=openai')

    expect(error).toBeDefined()
  })

  it('should accept a custom model with a valid endpoint', () => {
    const { error } = languageModel.validate(
      'custom/name=my-model/provider=openai/credentials=abc123/endpoint=https:%2F%2Fapi.example.com%2F'
    )

    expect(error).toBeUndefined()
  })

  it('should accept a custom model with a null endpoint', () => {
    const { error } = languageModel.validate(
      'custom/name=my-model/provider=openai/credentials=abc123/endpoint='
    )

    expect(error).toBeUndefined()
  })

  it('should reject a custom model with an http endpoint', () => {
    const { error } = languageModel.validate(
      'custom/name=my-model/provider=openai/credentials=abc123/endpoint=http:%2F%2Fapi.example.com%2F'
    )

    expect(error).toBeDefined()
  })

  it('should reject a custom model with an invalid endpoint', () => {
    const { error } = languageModel.validate(
      'custom/name=my-model/provider=openai/credentials=abc123/endpoint=not-a-url'
    )

    expect(error).toBeDefined()
  })

  it('should accept a custom model with features', () => {
    const { error } = languageModel.validate(
      'custom/name=my-model/provider=openai/credentials=abc123/features=chat,functions'
    )

    expect(error).toBeUndefined()
  })

  it('should accept all non-deprecated language models', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      if (config.deprecated || name === 'custom') {
        continue
      }

      const { error } = languageModel.validate(name)

      expect({ name, error: error?.message }).toEqual({
        name,
        error: undefined,
      })
    }
  })
})

describe('openaiLanguageModel schema', () => {
  it('should accept null', () => {
    const { error } = openaiLanguageModel.validate(null)

    expect(error).toBeUndefined()
  })

  it('should accept empty string', () => {
    const { error } = openaiLanguageModel.validate('')

    expect(error).toBeUndefined()
  })

  it('should accept a valid OpenAI model', () => {
    const { error } = openaiLanguageModel.validate(
      'custom/name=my-model/provider=openai/credentials=abc123'
    )

    expect(error).toBeUndefined()
  })

  it('should accept a valid OpenAI model with config', () => {
    const { error } = openaiLanguageModel.validate(
      'custom/name=my-model/provider=openai/credentials=abc123/temperature=1'
    )

    expect(error).toBeUndefined()
  })

  it('should reject an unrecognized model name', () => {
    const { error } = openaiLanguageModel.validate('totally-invalid-model')

    expect(error).toBeDefined()
  })

  it('should reject a non-OpenAI provider model', () => {
    // Find a non-openai model if one exists
    const nonOpenaiModel = Object.entries(languageModels).find(
      ([name, config]) =>
        config.provider !== 'openai' &&
        !config.deprecated &&
        name !== 'custom' &&
        name !== 'base'
    )

    if (nonOpenaiModel) {
      const { error } = openaiLanguageModel.validate(nonOpenaiModel[0])

      expect(error).toBeDefined()
    }
  })

  it('should accept all OpenAI provider models', () => {
    for (const [name, config] of Object.entries(languageModels)) {
      if (config.provider !== 'openai' || config.deprecated) {
        continue
      }

      const { error } = openaiLanguageModel.validate(name)

      expect({ name, error: error?.message }).toEqual({
        name,
        error: undefined,
      })
    }
  })
})

describe('mistralLanguageModel schema', () => {
  it('should accept null', () => {
    const { error } = mistralLanguageModel.validate(null)

    expect(error).toBeUndefined()
  })

  it('should accept empty string', () => {
    const { error } = mistralLanguageModel.validate('')

    expect(error).toBeUndefined()
  })

  it('should reject a non-Mistral model', () => {
    const { error } = mistralLanguageModel.validate('claude-4.6-sonnet')

    expect(error).toBeDefined()
  })

  it('should reject an unrecognized model name', () => {
    const { error } = mistralLanguageModel.validate('totally-invalid-model')

    expect(error).toBeDefined()
  })
})

describe('groqLanguageModel schema', () => {
  it('should accept null', () => {
    const { error } = groqLanguageModel.validate(null)

    expect(error).toBeUndefined()
  })

  it('should accept empty string', () => {
    const { error } = groqLanguageModel.validate('')

    expect(error).toBeUndefined()
  })

  it('should reject a non-Groq model', () => {
    const { error } = groqLanguageModel.validate('claude-4.6-sonnet')

    expect(error).toBeDefined()
  })

  it('should reject an unrecognized model name', () => {
    const { error } = groqLanguageModel.validate('totally-invalid-model')

    expect(error).toBeDefined()
  })
})

describe('vertexLanguageModel schema', () => {
  it('should accept null', () => {
    const { error } = vertexLanguageModel.validate(null)

    expect(error).toBeUndefined()
  })

  it('should accept empty string', () => {
    const { error } = vertexLanguageModel.validate('')

    expect(error).toBeUndefined()
  })

  it('should reject a non-Vertex model', () => {
    const { error } = vertexLanguageModel.validate('claude-4.6-sonnet')

    expect(error).toBeDefined()
  })

  it('should reject an unrecognized model name', () => {
    const { error } = vertexLanguageModel.validate('totally-invalid-model')

    expect(error).toBeDefined()
  })
})

describe('bedrockLanguageModel schema', () => {
  it('should accept null', () => {
    const { error } = bedrockLanguageModel.validate(null)

    expect(error).toBeUndefined()
  })

  it('should accept empty string', () => {
    const { error } = bedrockLanguageModel.validate('')

    expect(error).toBeUndefined()
  })

  it('should reject a non-Bedrock model', () => {
    const { error } = bedrockLanguageModel.validate('claude-4.6-sonnet')

    expect(error).toBeDefined()
  })

  it('should reject an unrecognized model name', () => {
    const { error } = bedrockLanguageModel.validate('totally-invalid-model')

    expect(error).toBeDefined()
  })
})

describe('vercelLanguageModel schema', () => {
  it('should accept null', () => {
    const { error } = vercelLanguageModel.validate(null)

    expect(error).toBeUndefined()
  })

  it('should accept empty string', () => {
    const { error } = vercelLanguageModel.validate('')

    expect(error).toBeUndefined()
  })

  it('should reject a non-Vercel model', () => {
    const { error } = vercelLanguageModel.validate('gpt-5.4')

    expect(error).toBeDefined()
  })

  it('should reject an unrecognized model name', () => {
    const { error } = vercelLanguageModel.validate('totally-invalid-model')

    expect(error).toBeDefined()
  })
})

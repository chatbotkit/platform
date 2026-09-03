// @ts-check
import schema from '@/lib/joi.schema'
import {
  isBedrockModel,
  isCloudflareModel,
  isGroqModel,
  isMistralModel,
  isOpenAIModel,
  isVercelModel,
  isVertexModel,
  parseLanguageModel,
} from '@/lib/model.utils'

export const openaiLanguageModel = schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      if (!isOpenAIModel(value)) {
        throw new Error('Invalid model')
      }
    }

    return value
  }, 'model')

export const mistralLanguageModel = schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      if (!isMistralModel(value)) {
        throw new Error('Invalid model')
      }
    }

    return value
  }, 'model')

export const groqLanguageModel = schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      if (!isGroqModel(value)) {
        throw new Error('Invalid model')
      }
    }

    return value
  }, 'model')

export const vertexLanguageModel = schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      if (!isVertexModel(value)) {
        throw new Error('Invalid model')
      }
    }

    return value
  }, 'model')

export const bedrockLanguageModel = schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      if (!isBedrockModel(value)) {
        throw new Error('Invalid model')
      }
    }

    return value
  }, 'model')

export const vercelLanguageModel = schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      if (!isVercelModel(value)) {
        throw new Error('Invalid model')
      }
    }

    return value
  }, 'model')

export const cloudflareLanguageModel = schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      if (!isCloudflareModel(value)) {
        throw new Error('Invalid model')
      }
    }

    return value
  }, 'model')

export const languageModel = schema
  .string()
  .allow(null, '')
  .custom((value) => {
    if (value) {
      parseLanguageModel(value)
    }

    return value
  }, 'model')

export default languageModel

// @ts-check
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import {
  baseLanguageModel,
  defaultImageModel,
  defaultLanguageModel,
  defaultRerankModel,
  defaultVideoModel,
  imageModels,
  languageModels,
  rerankModels,
  speechToTextModels,
  textToSpeechModels,
  videoModels,
} from '@/config/models'

import debug, { assert } from '@/lib/debug'
import schema from '@/lib/joi.schema'
import { omit } from '@/lib/object'
import { redactSecret } from '@/lib/redact.entropy'
import { build, parse } from '@/lib/structstr'

import externalUrlSchema from '@/schemas/externalUrl'

/**
 * @typedef {import('@/lib/model.types').AnyLanguageModel} AnyLanguageModel
 * @typedef {import('@/lib/model.types').AnyImageModel} AnyImageModel
 * @typedef {import('@/lib/model.types').AnyVideoModel} AnyVideoModel
 * @typedef {import('@/lib/model.types').AnyRerankModel} AnyRerankModel
 * @typedef {import('@/lib/model.types').AnySpeechToTextModel} AnySpeechToTextModel
 * @typedef {import('@/lib/model.types').AnyTextToSpeechModel} AnyTextToSpeechModel
 */

// --- Use Type Mappings ---

/**
 * Maps the language models to their corresponding use types.
 *
 * @type {Object.<string, string>}
 */
export const languageModelToUseTypeMapping = Object.fromEntries(
  Object.entries(languageModels).map(([key, { provider }]) => [
    key,
    provider.toUpperCase() +
      '_' +
      key.toUpperCase().replace(/[-.]/g, '_') +
      '_TOKEN',
  ])
)

/**
 * Maps the image models to their corresponding use types.
 *
 * @type {Object.<string, string>}
 */
export const imageModelToUseTypeMapping = Object.fromEntries(
  Object.entries(imageModels).map(([key, { provider }]) => [
    key,
    provider.toUpperCase() +
      '_' +
      key.toUpperCase().replace(/[-.]/g, '_') +
      '_TOKEN',
  ])
)

/**
 * Maps the video models to their corresponding use types.
 *
 * @type {Object.<string, string>}
 */
export const videoModelToUseTypeMapping = Object.fromEntries(
  Object.entries(videoModels).map(([key, { provider }]) => [
    key,
    provider.toUpperCase() +
      '_' +
      key.toUpperCase().replace(/[-.]/g, '_') +
      '_TOKEN',
  ])
)

/**
 * Maps the rerank models to their corresponding use types.
 *
 * @type {Object.<string, string>}
 */
export const rerankModelToUseTypeMapping = Object.fromEntries(
  Object.entries(rerankModels).map(([key, { provider }]) => [
    key,
    provider.toUpperCase() +
      '_' +
      key.toUpperCase().replace(/[-.]/g, '_') +
      '_TOKEN',
  ])
)

/**
 * Maps the speech-to-text models to their corresponding use types.
 *
 * @type {Object.<string, string>}
 */
export const speechToTextModelToUseTypeMapping = Object.fromEntries(
  Object.entries(speechToTextModels).map(([key, { provider }]) => [
    key,
    provider.toUpperCase() +
      '_' +
      key.toUpperCase().replace(/[-.]/g, '_') +
      '_TOKEN',
  ])
)

/**
 * Maps the text-to-speech models to their corresponding use types.
 *
 * @type {Object.<string, string>}
 */
export const textToSpeechModelToUseTypeMapping = Object.fromEntries(
  Object.entries(textToSpeechModels).map(([key, { provider }]) => [
    key,
    provider.toUpperCase() +
      '_' +
      key.toUpperCase().replace(/[-.]/g, '_') +
      '_TOKEN',
  ])
)

/**
 * Maps the audio models to their corresponding use types.
 *
 * @type {Object.<string, string>}
 */
export const audioModelToUseTypeMapping = {
  ...speechToTextModelToUseTypeMapping,
  ...textToSpeechModelToUseTypeMapping,
}

/**
 * Maps the use types to their corresponding language models.
 *
 * @type {Object.<string, string>}
 */
export const useTypeToLanguageModelMapping = Object.fromEntries(
  Object.entries(languageModelToUseTypeMapping).map(([key, value]) => [
    value,
    key,
  ])
)

/**
 * Maps the use types to their corresponding image models.
 *
 * @type {Object.<string, string>}
 */
export const useTypeToImageModelMapping = Object.fromEntries(
  Object.entries(imageModelToUseTypeMapping).map(([key, value]) => [value, key])
)

/**
 * Maps the use types to their corresponding video models.
 *
 * @type {Object.<string, string>}
 */
export const useTypeToVideoModelMapping = Object.fromEntries(
  Object.entries(videoModelToUseTypeMapping).map(([key, value]) => [value, key])
)

/**
 * Maps the use types to their corresponding rerank models.
 *
 * @type {Object.<string, string>}
 */
export const useTypeToRerankModelMapping = Object.fromEntries(
  Object.entries(rerankModelToUseTypeMapping).map(([key, value]) => [
    value,
    key,
  ])
)

/**
 * Maps the use types to their corresponding speech-to-text models.
 *
 * @type {Object.<string, string>}
 */
export const useTypeToSpeechToTextModelMapping = Object.fromEntries(
  Object.entries(speechToTextModelToUseTypeMapping).map(([key, value]) => [
    value,
    key,
  ])
)

/**
 * Maps the use types to their corresponding text-to-speech models.
 *
 * @type {Object.<string, string>}
 */
export const useTypeToTextToSpeechModelMapping = Object.fromEntries(
  Object.entries(textToSpeechModelToUseTypeMapping).map(([key, value]) => [
    value,
    key,
  ])
)

/**
 * Maps the use types to their corresponding audio models.
 *
 * @type {Object.<string, string>}
 */
export const useTypeToAudioModelMapping = Object.fromEntries(
  Object.entries(audioModelToUseTypeMapping).map(([key, value]) => [value, key])
)

// --- Language Models ---

/**
 * @param {string} model
 * @returns {number}
 */
export function getLanguageModelDefaultTokenRatio(model) {
  const { name } = parseLanguageModel(model)

  const config = languageModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio },
  } = config

  assert(tokenRatio, `Model ${name} does not have a token ratio`)

  return tokenRatio
}

/**
 * @param {string} model
 * @returns {number}
 */
export function getLanguageModelInputTokenRatio(model) {
  const { name } = parseLanguageModel(model)

  const config = languageModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio, inputTokenRatio = tokenRatio },
  } = config

  return inputTokenRatio
}

/**
 * @param {string} model
 * @returns {number}
 */
export function getLanguageModelOutputTokenRatio(model) {
  const { name } = parseLanguageModel(model)

  const config = languageModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio, outputTokenRatio = tokenRatio },
  } = config

  return outputTokenRatio
}

/**
 * @param {string} model
 * @param {'default'|'output'|'input'} [type='default']
 * @returns {number}
 */
export function getLanguageModelTokenRatio(model, type = 'default') {
  let tokenRatio = 1

  switch (type) {
    case 'default': {
      tokenRatio = getLanguageModelDefaultTokenRatio(model)

      break
    }

    case 'output': {
      tokenRatio = getLanguageModelOutputTokenRatio(model)

      break
    }

    case 'input': {
      tokenRatio = getLanguageModelInputTokenRatio(model)

      break
    }

    default: {
      assertUnreachable(type)
    }
  }

  return tokenRatio
}

/**
 * @param {string} sourceModel
 * @param {number} sourceCount
 * @param {'default'|'output'|'input'} [type='default']
 * @returns {number}
 * @throws {Error}
 */
export function getBaseLanguageModelTokenCount(
  sourceModel,
  sourceCount,
  type = 'default'
) {
  debug(`getting base model token count`, {
    sourceModel,
    sourceCount,
    type,
  }).log('model.getBaseModelTokenCount')

  if (sourceModel === baseLanguageModel) {
    return sourceCount
  }

  if (sourceCount === 0) {
    return 0
  }

  const tokenRatio = getLanguageModelTokenRatio(sourceModel, type)

  const count = Math.max(1, Math.round(sourceCount * tokenRatio))

  debug(`base model token count`, {
    sourceModel,
    sourceCount,
    tokenRatio,
    count,
  }).log('model.getBaseModelTokenCount')

  return count
}

/**
 * @param {string} sourceModel
 * @param {number} sourceCount
 * @param {string} targetModel
 * @param {'default'|'output'|'input'} [type='default']
 * @returns {number}
 * @throws {Error}
 */
export function convertLanguageModelTokenCount(
  sourceModel,
  sourceCount,
  targetModel,
  type = 'default'
) {
  debug(`converting token count`, {
    sourceModel,
    sourceCount,
    targetModel,
    type,
  }).log('model.convertTokenCount')

  if (sourceModel === targetModel) {
    return sourceCount
  }

  if (sourceCount === 0) {
    return 0
  }

  const baseTokens = getBaseLanguageModelTokenCount(
    sourceModel,
    sourceCount,
    type
  )

  const { name: targetModelName } = parseLanguageModel(targetModel)

  const targetModelConfig = languageModels[targetModelName]

  assert(targetModelConfig, `Model ${targetModelName} is not recognized`)

  const {
    pricing: {
      tokenRatio: _tokenRatio,
      inputTokenRatio = _tokenRatio,
      outputTokenRatio = _tokenRatio,
    },
  } = targetModelConfig

  let tokenRatio = 1

  switch (type) {
    case 'default': {
      tokenRatio = _tokenRatio

      break
    }

    case 'output': {
      tokenRatio = outputTokenRatio

      break
    }

    case 'input': {
      tokenRatio = inputTokenRatio

      break
    }

    default: {
      assertUnreachable(type)
    }
  }

  assert(tokenRatio, `Model ${targetModelName} does not have a token ratio`)

  const convertedTokens = Math.max(1, Math.round(baseTokens / tokenRatio))

  debug(`converted tokens`, {
    sourceModel,
    sourceCount,
    baseTokens,
    targetModel,
    tokenRatio,
    convertedTokens,
  }).log('model.convertTokenCount')

  return convertedTokens
}

/**
 * @param {string} model
 * @returns {string}
 * @throws {Error}
 */
export function languageModelToUseType(model) {
  const { name } = parseLanguageModel(model)

  const type = languageModelToUseTypeMapping[name]

  if (!type) {
    throw new Error(`Unrecognized model ${name}`)
  }

  return type
}

/**
 * @param {string} model
 * @returns {string}
 */
export function languageModelToBaseModel(model) {
  const { name } = parseLanguageModel(model)

  if (name.startsWith('org-')) {
    return name
  } else {
    return name.replace(/^text-/, '').replace(/-\d+$/, '')
  }
}

// --- Image Models ---

/**
 * @param {string} model
 * @returns {number}
 */
export function getImageModelDefaultTokenRatio(model) {
  const { name } = parseImageModel(model)

  const config = imageModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio },
  } = config

  assert(tokenRatio, `Model ${name} does not have a token ratio`)

  return tokenRatio
}

/**
 * @param {string} model
 * @returns {number}
 */
export function getImageModelInputTokenRatio(model) {
  const { name } = parseImageModel(model)

  const config = imageModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio, inputTokenRatio = tokenRatio },
  } = config

  return inputTokenRatio
}

/**
 * @param {string} model
 * @returns {number}
 */
export function getImageModelOutputTokenRatio(model) {
  const { name } = parseImageModel(model)

  const config = imageModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio, outputTokenRatio = tokenRatio },
  } = config

  return outputTokenRatio
}

/**
 * @param {string} model
 * @param {'default'|'output'|'input'} [type='default']
 * @returns {number}
 */
export function getImageModelTokenRatio(model, type = 'default') {
  let tokenRatio = 1

  switch (type) {
    case 'default': {
      tokenRatio = getImageModelDefaultTokenRatio(model)

      break
    }

    case 'output': {
      tokenRatio = getImageModelOutputTokenRatio(model)

      break
    }

    case 'input': {
      tokenRatio = getImageModelInputTokenRatio(model)

      break
    }

    default: {
      assertUnreachable(type)
    }
  }

  return tokenRatio
}

/**
 * @param {string} sourceModel
 * @param {number} sourceCount
 * @param {'default'|'output'|'input'} [type='default']
 * @returns {number}
 * @throws {Error}
 */
export function getBaseImageModelTokenCount(
  sourceModel,
  sourceCount,
  type = 'default'
) {
  debug(`getting base model token count`, {
    sourceModel,
    sourceCount,
    type,
  }).log('model.getBaseModelTokenCount')

  if (sourceCount === 0) {
    return 0
  }

  const tokenRatio = getImageModelTokenRatio(sourceModel, type)

  const count = Math.max(1, Math.round(sourceCount * tokenRatio))

  debug(`base model token count`, {
    sourceModel,
    sourceCount,
    type,
    tokenRatio,
    count,
  }).log('model.getBaseModelTokenCount')

  return count
}

/**
 * @param {string} sourceModel
 * @param {number} sourceCount
 * @param {string} targetModel
 * @returns {number}
 * @throws {Error}
 */
export function convertImageModelTokenCount(
  sourceModel,
  sourceCount,
  targetModel
) {
  debug(`converting token count`, {
    sourceModel,
    sourceCount,
    targetModel,
  }).log('model.convertTokenCount')

  const baseTokens = getBaseImageModelTokenCount(sourceModel, sourceCount)

  const { name } = parseImageModel(targetModel)

  const config = imageModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio },
  } = config

  assert(tokenRatio, `Model ${name} does not have a token ratio`)

  return Math.max(1, Math.round(baseTokens / tokenRatio))
}

/**
 * @param {string} model
 * @returns {string}
 * @throws {Error}
 */
export function imageModelToUseType(model) {
  const { name } = parseImageModel(model)

  const type = imageModelToUseTypeMapping[name]

  if (!type) {
    throw new Error(`Unrecognized model ${name}`)
  }

  return type
}

/**
 * @param {string} model
 * @returns {string}
 */
export function imageModelToBaseModel(model) {
  const { name } = parseImageModel(model)

  if (name.startsWith('org-')) {
    return name
  } else {
    return name.replace(/^text-/, '').replace(/-\d+$/, '')
  }
}

// --- Video Models ---

/**
 * @param {string} model
 * @returns {number}
 */
export function getVideoModelDefaultTokenRatio(model) {
  const { name } = parseVideoModel(model)

  const config = videoModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio },
  } = config

  assert(tokenRatio, `Model ${name} does not have a token ratio`)

  return tokenRatio
}

/**
 * @param {string} model
 * @returns {number}
 */
export function getVideoModelInputTokenRatio(model) {
  const { name } = parseVideoModel(model)

  const config = videoModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio, inputTokenRatio = tokenRatio },
  } = config

  return inputTokenRatio
}

/**
 * @param {string} model
 * @returns {number}
 */
export function getVideoModelOutputTokenRatio(model) {
  const { name } = parseVideoModel(model)

  const config = videoModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio, outputTokenRatio = tokenRatio },
  } = config

  return outputTokenRatio
}

/**
 * @param {string} model
 * @param {'default'|'output'|'input'} [type='default']
 * @returns {number}
 */
export function getVideoModelTokenRatio(model, type = 'default') {
  let tokenRatio = 1

  switch (type) {
    case 'default': {
      tokenRatio = getVideoModelDefaultTokenRatio(model)

      break
    }

    case 'output': {
      tokenRatio = getVideoModelOutputTokenRatio(model)

      break
    }

    case 'input': {
      tokenRatio = getVideoModelInputTokenRatio(model)

      break
    }

    default: {
      assertUnreachable(type)
    }
  }

  return tokenRatio
}

/**
 * @param {string} sourceModel
 * @param {number} sourceCount
 * @param {'default'|'output'|'input'} [type='default']
 * @returns {number}
 * @throws {Error}
 */
export function getBaseVideoModelTokenCount(
  sourceModel,
  sourceCount,
  type = 'default'
) {
  debug(`getting base model token count`, {
    sourceModel,
    sourceCount,
    type,
  }).log('model.getBaseModelTokenCount')

  if (sourceCount === 0) {
    return 0
  }

  const tokenRatio = getVideoModelTokenRatio(sourceModel, type)

  const count = Math.max(1, Math.round(sourceCount * tokenRatio))

  debug(`base model token count`, {
    sourceModel,
    sourceCount,
    type,
    tokenRatio,
    count,
  }).log('model.getBaseModelTokenCount')

  return count
}

/**
 * @param {string} model
 * @returns {string}
 * @throws {Error}
 */
export function videoModelToUseType(model) {
  const { name } = parseVideoModel(model)

  const type = videoModelToUseTypeMapping[name]

  if (!type) {
    throw new Error(`Unrecognized model ${name}`)
  }

  return type
}

// --- Rerank Models ---

/**
 * @param {string} model
 * @returns {number}
 */
export function getRerankModelDefaultTokenRatio(model) {
  const { name } = parseRerankModel(model)

  const config = rerankModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio },
  } = config

  assert(tokenRatio, `Model ${name} does not have a token ratio`)

  return tokenRatio
}

/**
 * @param {string} model
 * @returns {number}
 */
export function getRerankModelInputTokenRatio(model) {
  const { name } = parseRerankModel(model)

  const config = rerankModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio, inputTokenRatio = tokenRatio },
  } = config

  return inputTokenRatio
}

/**
 * @param {string} model
 * @returns {number}
 */
export function getRerankModelOutputTokenRatio(model) {
  const { name } = parseRerankModel(model)

  const config = rerankModels[name]

  assert(config, `Model ${name} is not recognized`)

  const {
    pricing: { tokenRatio, outputTokenRatio = tokenRatio },
  } = config

  return outputTokenRatio
}

/**
 * @param {string} model
 * @param {'default'|'output'|'input'} [type='default']
 * @returns {number}
 */
export function getRerankModelTokenRatio(model, type = 'default') {
  let tokenRatio = 1

  switch (type) {
    case 'default': {
      tokenRatio = getRerankModelDefaultTokenRatio(model)

      break
    }

    case 'output': {
      tokenRatio = getRerankModelOutputTokenRatio(model)

      break
    }

    case 'input': {
      tokenRatio = getRerankModelInputTokenRatio(model)

      break
    }

    default: {
      assertUnreachable(type)
    }
  }

  return tokenRatio
}

/**
 * @param {string} sourceModel
 * @param {number} sourceCount
 * @param {'default'|'output'|'input'} [type='default']
 * @returns {number}
 * @throws {Error}
 */
export function getBaseRerankModelTokenCount(
  sourceModel,
  sourceCount,
  type = 'default'
) {
  debug(`getting base model token count`, {
    sourceModel,
    sourceCount,
    type,
  }).log('model.getBaseModelTokenCount')

  if (sourceCount === 0) {
    return 0
  }

  const tokenRatio = getRerankModelTokenRatio(sourceModel, type)

  const count = Math.max(1, Math.round(sourceCount * tokenRatio))

  debug(`base model token count`, {
    sourceModel,
    sourceCount,
    type,
    tokenRatio,
    count,
  }).log('model.getBaseModelTokenCount')

  return count
}

/**
 * @param {string} model
 * @returns {string}
 * @throws {Error}
 */
export function rerankModelToUseType(model) {
  const { name } = parseRerankModel(model)

  const type = rerankModelToUseTypeMapping[name]

  if (!type) {
    throw new Error(`Unrecognized model ${name}`)
  }

  return type
}

// --- Audio Models ---

/**
 * @param {string} model
 * @returns {string}
 * @throws {Error}
 */
export function speechToTextModelToUseType(model) {
  const { name } = parseSpeechToTextModel(model)

  const type = speechToTextModelToUseTypeMapping[name]

  if (!type) {
    throw new Error(`Unrecognized model ${name}`)
  }

  return type
}

/**
 * @param {string} model
 * @returns {string}
 * @throws {Error}
 */
export function textToSpeechModelToUseType(model) {
  const { name } = parseTextToSpeechModel(model)

  const type = textToSpeechModelToUseTypeMapping[name]

  if (!type) {
    throw new Error(`Unrecognized model ${name}`)
  }

  return type
}

/**
 * @param {string} model
 * @returns {string}
 * @throws {Error}
 */
export function audioModelToUseType(model) {
  const type =
    speechToTextModelToUseTypeMapping[model] ||
    textToSpeechModelToUseTypeMapping[model]

  if (!type) {
    throw new Error(`Unrecognized model ${model}`)
  }

  return type
}

// --- Model Parsing ---

/**
 * @todo why are we redefining the model types when they can be imported
 *
 * @typedef {{
 *   maxTokens?: number,
 *   temperature?: number,
 *   interactionMaxMessages?: number,
 *   thresholdStrategy?: 'compact'|'truncate',
 *   frequencyPenalty?: number,
 *   presencePenalty?: number,
 *   reasoningEffort?: 'auto'|'low'|'medium'|'high',
 *   interpreter?: boolean,
 *   image?: boolean,
 *   audio?: boolean,
 *   video?: boolean,
 *   file?: boolean,
 *   seed?: number,
 *   forceFunction?: string,
 *   voice?: string,
 *   requiresUserTurnBeforeToolCall?: boolean,
 * }} LanguageModelBaseConfig
 *
 * @typedef {LanguageModelBaseConfig & {
 *   region?: 'us'|'eu',
 * }} LanguageModelPredefinedConfig
 *
 * @typedef {LanguageModelBaseConfig & {
 *   name: string,
 *   provider: string,
 *   features?: string,
 *   credentials: string,
 *   endpoint?: string
 * }} LanguageModelCustomConfig
 *
 * @typedef {LanguageModelPredefinedConfig|LanguageModelCustomConfig} LanguageModelConfig
 */

const languageModelBaseConfigSchema = schema.object().keys({
  maxTokens: schema.number().min(1),
  interactionMaxMessages: schema.number().min(2),
  thresholdStrategy: schema.string().valid('compact', 'truncate'),
  temperature: schema.number().min(0).max(2),
  frequencyPenalty: schema.number().min(-2).max(2),
  presencePenalty: schema.number().min(-2).max(2),
  reasoningEffort: schema.string().valid('auto', 'low', 'medium', 'high'),
  interpreter: schema.boolean(),
  image: schema.boolean(),
  audio: schema.boolean(),
  video: schema.boolean(),
  file: schema.boolean(),
  seed: schema.number().min(0), // @note not really used
  forceFunction: schema.string().allow(null, ''),
  voice: schema.string().allow(null, ''),
  requiresUserTurnBeforeToolCall: schema.boolean(),
  requiresUserTurnAsLastMessage: schema.boolean(),
})

const languageModelPredefinedConfigSchema =
  // combined
  languageModelBaseConfigSchema.concat(
    schema.object().keys({
      region: schema.string().valid('us', 'eu'), // @todo validate based on the model capabilities
    })
  )

const languageModelCustomConfigSchema =
  // combined
  languageModelBaseConfigSchema.concat(
    schema.object().keys({
      name: schema.string().required().label('model.config.name'),
      provider: schema.string().required().label('model.config.provider'),
      features: schema.string().allow(null, '').label('model.config.features'),
      credentials: schema.string().required().label('model.config.credentials'),
      endpoint: externalUrlSchema
        .allow(null, '')
        .label('model.config.endpoint'),
    })
  )

const languageModelValidationSchema = schema.object().keys({
  name: schema
    .string()
    .required()
    .label('model.name')
    .custom((value) => {
      if (!Object.keys(languageModels).includes(value)) {
        throw new Error(`model ${value} is unrecognized`)
      }

      if (languageModels[value].deprecated) {
        if (!languageModels[value].proxyToModel) {
          throw new Error(`model ${value} is deprecated`)
        }
      }

      return value
    }, 'name'),
  config: schema
    .object()
    .when('name', {
      is: 'custom',
      then: languageModelCustomConfigSchema,
      otherwise: languageModelPredefinedConfigSchema,
    })
    .required()
    .label('model.config'),
})

/**
 * @param {string} model
 * @returns {{name: string, config: LanguageModelConfig}}
 * @throws {Error}
 */
export function parseLanguageModel(model) {
  debug(`parsing language model`, { model })

  model = model || defaultLanguageModel

  let { name, config } = parse(model, defaultLanguageModel)

  const { error, value } = languageModelValidationSchema.validate({
    name,
    config,
  })

  if (error) {
    throw error
  }

  name = value.name
  config = value.config

  return { name, config }
}

/**
 * @param {string} name
 * @param {LanguageModelConfig} config
 * @returns {string}
 * @throws {Error}
 */
export function buildLanguageModel(name, config) {
  debug(`building language model`, { name, config })

  const { error, value } = languageModelValidationSchema.validate({
    name,
    config,
  })

  if (error) {
    throw error
  }

  name = value.name
  config = value.config

  const details = build(name, config, languageModels[name])

  return details
}

/**
 * @param {{name: string, config: LanguageModelConfig}} parsedModel
 * @param {AnyLanguageModel & LanguageModelConfig} [parentConfig]
 * @returns {{name: string, config: AnyLanguageModel & LanguageModelConfig, originalName: string, originalConfig: LanguageModelConfig}}
 * @throws {Error}
 */
export function revealLanguageModel({ name, config }, parentConfig) {
  const originalName = name
  const originalConfig = config

  let revealedName = name

  let revealedConfig = {
    // we use the base model as the default...

    ...languageModels[name],

    // ...then we override it with the parentConfig

    ...omit(parentConfig, ['name']),

    // ...finally we override it with the config

    ...omit(config, ['name']),
  }

  // @note features describe a model's capabilities. When a model proxies to
  // another - an alias, or a custom/BYOK model - the proxy target is the real
  // model being called, so its capabilities must survive the merge. We UNION
  // the base (target) features with the inherited (parent) and explicit
  // (config) features rather than letting any of them override the others.
  // Otherwise a wrapper strips features the underlying model actually has - e.g.
  // a `custom/.../name=gpt-5.4-mini` model would lose 'responses' and get routed
  // to chat completions, which 400s on tools + reasoning_effort.

  revealedConfig.features = Array.from(
    new Set([
      ...(languageModels[name]?.features || []),
      ...(parentConfig?.features || []),
      ...('features' in config ? config.features?.split(',') || [] : []),
    ])
  )

  // handle custom models

  if (name === 'custom') {
    // @ts-expect-error because name only exists in custom models
    if (!config.name) {
      throw new Error(`Missing model name in the custom model configuration`)
    }

    // @ts-expect-error because name only exists in custom models
    revealedConfig.proxyToModel = config.name

    // @ts-expect-error because provider only exists in custom models
    revealedConfig.provider = config.provider

    // @ts-expect-error because credentials only exists in custom models
    revealedConfig.credentials = config.credentials

    // @ts-expect-error because endpoint only exists in custom models
    revealedConfig.endpoint = config.endpoint

    // @note features are unioned generically above (including the proxy
    // target's once resolved); a custom model with no resolvable features still
    // falls back to chat/functions
    if (revealedConfig.features.length === 0) {
      revealedConfig.features = ['chat', 'functions']
    }

    if ('name' in config && config.name in languageModels) {
      revealedConfig.maxTokens = languageModels[config.name].maxTokens
      revealedConfig.maxInputTokens = languageModels[config.name].maxInputTokens
      revealedConfig.maxOutputTokens =
        languageModels[config.name].maxOutputTokens
    }
  }

  // handle proxy models

  if (revealedConfig.proxyToModel) {
    name = revealedConfig.proxyToModel

    delete revealedConfig.proxyToModel // @note deleted because we don't want to back-reference the proxy model

    delete revealedConfig.provider // @note deleted because we must adopt the provider of the proxy model

    // merge both models

    const result = revealLanguageModel({ name, config }, revealedConfig)

    revealedName = result.name
    revealedConfig = result.config
  }

  return {
    name: revealedName,
    config: revealedConfig,
    originalName,
    originalConfig,
  }
}

/**
 * @param {string} model
 * @returns {ReturnType<typeof revealLanguageModel>}
 */
export function parseAndRevealLanguageModel(model) {
  return revealLanguageModel(parseLanguageModel(model))
}

/**
 * Returns a copy of the model string that is safe to serve to clients.
 *
 * Custom models embed a `credentials` secret directly in their model string.
 * This masks it with the same redaction primitive we use for hub conversation
 * messages, so the secret never reaches the browser while the rest of the
 * model stays inspectable. Predefined models - which carry no secrets - are
 * returned untouched.
 *
 * @param {string} model
 * @returns {string}
 */
export function redactLanguageModel(model) {
  if (!model) {
    return model
  }

  const { name, config } = parse(model, defaultLanguageModel)

  if (name !== 'custom' || !config.credentials) {
    return model
  }

  return build(name, {
    ...config,
    credentials: redactSecret(String(config.credentials)),
  })
}

/**
 * @typedef {{
 *   size?: 'auto'|'1024x1024'|'1536x1024'|'1024x1536'|'256x256'|'512x512',
 *   region?: 'us'|'eu'
 * }} ImageModelConfig
 */

const imageModelValidationSchema = schema.object().keys({
  name: schema
    .string()
    .valid(...Object.keys(imageModels))
    .required(),
  config: schema
    .object()
    .keys({
      n: schema.number().min(1).max(3),
      size: schema
        .string()
        .valid(
          'auto',
          '1024x1024',
          '1536x1024',
          '1024x1536',
          '256x256',
          '512x512'
        ),
      region: schema.string().valid('us', 'eu'), // @todo validate based on the model capabilities
    })
    .required(),
})

/**
 * @param {string} model
 * @returns {{name: string, config: ImageModelConfig}}
 * @throws {Error}
 */
export function parseImageModel(model) {
  model = model || defaultImageModel

  let { name, config } = parse(model, defaultImageModel)

  const { error, value } = imageModelValidationSchema.validate({
    name,
    config,
  })

  if (error) {
    throw error
  }

  name = value.name
  config = value.config

  return { name, config }
}

/**
 * @param {string} name
 * @param {ImageModelConfig} config
 * @returns {string}
 * @throws {Error}
 */
export function buildImageModel(name, config) {
  const { error, value } = imageModelValidationSchema.validate({
    name,
    config,
  })

  if (error) {
    throw error
  }

  name = value.name
  config = value.config

  const details = build(name, config, imageModels[name])

  return details
}

/**
 * @param {{name: string, config: ImageModelConfig}} parsedModel
 * @param {AnyImageModel} [imageModel]
 * @returns {{name: string, config: AnyImageModel & ImageModelConfig, originalName: string, originalConfig: ImageModelConfig}}
 */
export function revealImageModel({ name, config }, imageModel) {
  const originalName = name
  const originalConfig = config

  let newName = name

  let newConfig = {
    ...(imageModel
      ? (({ proxyToModel: _, ...o }) => o)(imageModel)
      : undefined),

    ...imageModels[name],

    ...config,
  }

  if (newConfig.proxyToModel) {
    name = newConfig.proxyToModel

    const result = revealImageModel({ name, config }, newConfig)

    newName = result.name
    newConfig = result.config
  }

  return { name: newName, config: newConfig, originalName, originalConfig }
}

/**
 * @param {string} model
 * @returns {ReturnType<typeof revealImageModel>}
 */
export function parseAndRevealImageModel(model) {
  return revealImageModel(parseImageModel(model))
}

/**
 * @typedef {{
 *   n?: number,
 *   aspectRatio?: string,
 *   resolution?: string,
 *   duration?: number,
 *   fps?: number,
 *   seed?: number,
 *   region?: 'us'|'eu'
 * }} VideoModelConfig
 */

const videoModelValidationSchema = schema.object().keys({
  name: schema
    .string()
    .valid(...Object.keys(videoModels))
    .required(),
  config: schema
    .object()
    .keys({
      n: schema.number().min(1).max(3),
      aspectRatio: schema.string(),
      resolution: schema.string(),
      duration: schema.number().min(1),
      fps: schema.number().min(1),
      seed: schema.number(),
      region: schema.string().valid('us', 'eu'),
    })
    .required(),
})

/**
 * @param {string} model
 * @returns {{name: string, config: VideoModelConfig}}
 * @throws {Error}
 */
export function parseVideoModel(model) {
  model = model || defaultVideoModel

  let { name, config } = parse(model, defaultVideoModel)

  const { error, value } = videoModelValidationSchema.validate({
    name,
    config,
  })

  if (error) {
    throw error
  }

  name = value.name
  config = value.config

  return { name, config }
}

/**
 * @param {string} name
 * @param {VideoModelConfig} config
 * @returns {string}
 * @throws {Error}
 */
export function buildVideoModel(name, config) {
  const { error, value } = videoModelValidationSchema.validate({
    name,
    config,
  })

  if (error) {
    throw error
  }

  name = value.name
  config = value.config

  const details = build(name, config, videoModels[name])

  return details
}

/**
 * @param {{name: string, config: VideoModelConfig}} parsedModel
 * @param {AnyVideoModel} [videoModel]
 * @returns {{name: string, config: AnyVideoModel & VideoModelConfig, originalName: string, originalConfig: VideoModelConfig}}
 */
export function revealVideoModel({ name, config }, videoModel) {
  const originalName = name
  const originalConfig = config

  let newName = name

  let newConfig = {
    ...(videoModel
      ? (({ proxyToModel: _, ...o }) => o)(videoModel)
      : undefined),

    ...videoModels[name],

    ...config,
  }

  if (newConfig.proxyToModel) {
    name = newConfig.proxyToModel

    const result = revealVideoModel({ name, config }, newConfig)

    newName = result.name
    newConfig = result.config
  }

  return { name: newName, config: newConfig, originalName, originalConfig }
}

/**
 * @param {string} model
 * @returns {ReturnType<typeof revealVideoModel>}
 */
export function parseAndRevealVideoModel(model) {
  return revealVideoModel(parseVideoModel(model))
}

/**
 * @typedef {{
 *   maxRecords?: number,
 *   region?: 'us'|'eu'
 * }} RerankModelConfig
 */

const rerankModelValidationSchema = schema.object().keys({
  name: schema
    .string()
    .valid(...Object.keys(rerankModels))
    .required(),
  config: schema
    .object()
    .keys({
      maxRecords: schema.number().integer().min(1),
      region: schema.string().valid('us', 'eu'),
    })
    .required(),
})

/**
 * @param {string} model
 * @returns {{name: string, config: RerankModelConfig}}
 * @throws {Error}
 */
export function parseRerankModel(model) {
  model = model || defaultRerankModel

  let { name, config } = parse(model, defaultRerankModel)

  const { error, value } = rerankModelValidationSchema.validate({
    name,
    config,
  })

  if (error) {
    throw error
  }

  name = value.name
  config = value.config

  return { name, config }
}

/**
 * @param {string} name
 * @param {RerankModelConfig} config
 * @returns {string}
 * @throws {Error}
 */
export function buildRerankModel(name, config) {
  const { error, value } = rerankModelValidationSchema.validate({
    name,
    config,
  })

  if (error) {
    throw error
  }

  name = value.name
  config = value.config

  const details = build(name, config, rerankModels[name])

  return details
}

/**
 * @param {{name: string, config: RerankModelConfig}} parsedModel
 * @param {AnyRerankModel} [rerankModel]
 * @returns {{name: string, config: AnyRerankModel & RerankModelConfig, originalName: string, originalConfig: RerankModelConfig}}
 */
export function revealRerankModel({ name, config }, rerankModel) {
  const originalName = name
  const originalConfig = config

  let newName = name

  let newConfig = {
    ...(rerankModel
      ? (({ proxyToModel: _, ...o }) => o)(rerankModel)
      : undefined),

    ...rerankModels[name],

    ...config,
  }

  if (newConfig.proxyToModel) {
    name = newConfig.proxyToModel

    const result = revealRerankModel({ name, config }, newConfig)

    newName = result.name
    newConfig = result.config
  }

  return { name: newName, config: newConfig, originalName, originalConfig }
}

/**
 * @param {string} model
 * @returns {ReturnType<typeof revealRerankModel>}
 */
export function parseAndRevealRerankModel(model) {
  return revealRerankModel(parseRerankModel(model))
}

/**
 * @typedef {{}} SpeechToTextModelConfig
 */

const speechToTextModelValidationSchema = schema.object().keys({
  name: schema
    .string()
    .valid(...Object.keys(speechToTextModels))
    .required(),
  config: schema.object().keys({}).required(),
})

/**
 * @param {string} model
 * @returns {{name: string, config: SpeechToTextModelConfig}}
 * @throws {Error}
 */
export function parseSpeechToTextModel(model) {
  let { name, config } = parse(model)

  const { error, value } = speechToTextModelValidationSchema.validate({
    name,
    config,
  })

  if (error) {
    throw error
  }

  name = value.name
  config = value.config

  return { name, config }
}

/**
 * @param {{name: string, config: SpeechToTextModelConfig}} parsedModel
 * @param {AnySpeechToTextModel} [speechToTextModel]
 * @returns {{name: string, config: AnySpeechToTextModel & SpeechToTextModelConfig, originalName: string, originalConfig: SpeechToTextModelConfig}}
 */
export function revealSpeechToTextModel({ name, config }, speechToTextModel) {
  const originalName = name
  const originalConfig = config

  let newName = name

  let newConfig = {
    ...(speechToTextModel
      ? (({ proxyToModel: _, ...o }) => o)(speechToTextModel)
      : undefined),

    ...speechToTextModels[name],

    ...config,
  }

  if (newConfig.proxyToModel) {
    name = newConfig.proxyToModel

    const result = revealSpeechToTextModel({ name, config }, newConfig)

    newName = result.name
    newConfig = result.config
  }

  return { name: newName, config: newConfig, originalName, originalConfig }
}

/**
 * @param {string} model
 * @returns {ReturnType<typeof revealSpeechToTextModel>}
 */
export function parseAndRevealSpeechToTextModel(model) {
  return revealSpeechToTextModel(parseSpeechToTextModel(model))
}

/**
 * @typedef {{}} TextToSpeechModelConfig
 */

const textToSpeechModelValidationSchema = schema.object().keys({
  name: schema
    .string()
    .valid(...Object.keys(textToSpeechModels))
    .required(),
  config: schema.object().keys({}).required(),
})

/**
 * @param {string} model
 * @returns {{name: string, config: TextToSpeechModelConfig}}
 * @throws {Error}
 */
export function parseTextToSpeechModel(model) {
  let { name, config } = parse(model)

  const { error, value } = textToSpeechModelValidationSchema.validate({
    name,
    config,
  })

  if (error) {
    throw error
  }

  name = value.name
  config = value.config

  return { name, config }
}

/**
 * @param {{name: string, config: TextToSpeechModelConfig}} parsedModel
 * @param {AnyTextToSpeechModel} [textToSpeechModel]
 * @returns {{name: string, config: AnyTextToSpeechModel & TextToSpeechModelConfig, originalName: string, originalConfig: TextToSpeechModelConfig}}
 */
export function revealTextToSpeechModel({ name, config }, textToSpeechModel) {
  const originalName = name
  const originalConfig = config

  let newName = name

  let newConfig = {
    ...(textToSpeechModel
      ? (({ proxyToModel: _, ...o }) => o)(textToSpeechModel)
      : undefined),

    ...textToSpeechModels[name],

    ...config,
  }

  if (newConfig.proxyToModel) {
    name = newConfig.proxyToModel

    const result = revealTextToSpeechModel({ name, config }, newConfig)

    newName = result.name
    newConfig = result.config
  }

  return { name: newName, config: newConfig, originalName, originalConfig }
}

/**
 * @param {string} model
 * @returns {ReturnType<typeof revealTextToSpeechModel>}
 */
export function parseAndRevealTextToSpeechModel(model) {
  return revealTextToSpeechModel(parseTextToSpeechModel(model))
}

// --- Model Capabilities ---

/**
 * @param {string} model
 * @param {(string|RegExp)[]} models
 * @returns {boolean}
 */
export function isModel(model, models) {
  try {
    const { name } = parseAndRevealLanguageModel(model)

    return models.some((m) => {
      if (m instanceof RegExp) {
        return m.test(name)
      } else {
        return m === name
      }
    })
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isOpenAIModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'openai'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isMistralModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'mistral'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isGroqModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'groq'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isDeepseekModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'deepseek'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isOpenrouterModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'openrouter'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isPerplexityModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'perplexity'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isVertexModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'vertex'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isBedrockModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'bedrock'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isZaiModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'zai'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isMoonshotModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'moonshot'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isQwenModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'qwen'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isVercelModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'vercel'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isCloudflareModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.provider === 'cloudflare'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function isClaudeModel(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.family === 'claude'
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelSupportsChat(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('chat')
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelSupportsFunctions(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('functions')
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelSupportsInterpreter(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('interpreter')
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelHasInterpreterEnabled(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return (
      config.features.includes('interpreter') && config.interpreter === true
    )
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelSupportsImageInput(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('image')
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelHasImageInputEnabled(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('image') && config.image === true
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelSupportsAudioInput(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('audio')
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelHasAudioInputEnabled(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('audio') && config.audio === true
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelSupportsVideoInput(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('video')
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelHasVideoInputEnabled(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('video') && config.video === true
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelSupportsFileInput(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('file')
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelHasFileInputEnabled(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('file') && config.file === true
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelSupportsReasoningEffort(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('reasoning')
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelSupportsRealtime(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('realtime')
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelSupportsResponses(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.features.includes('responses')
  } catch {
    return false
  }
}

/**
 * @param {string} model
 * @returns {boolean}
 */
export function modelRequiresUserTurnBeforeToolCall(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.requiresUserTurnBeforeToolCall === true
  } catch {
    return false
  }
}

/**
 * Returns true if the model requires that the last message in the conversation
 * is a user message. Models with this constraint reject requests where the
 * final message has role 'assistant' (i.e. they do not support prefill).
 *
 * @param {string} model
 * @returns {boolean}
 */
export function modelRequiresUserTurnAsLastMessage(model) {
  try {
    const { config } = parseAndRevealLanguageModel(model)

    return config.requiresUserTurnAsLastMessage === true
  } catch {
    return false
  }
}

/**
 * @param {string} provider
 * @returns {boolean}
 */
export function hasLanguageModelsByProvider(provider) {
  return Object.values(languageModels).some(
    (model) => model.provider === provider && !model.deprecated
  )
}

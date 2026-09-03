/**
 * Platform use type constants for non-model usage tracking. These are the
 * fixed use types that are not derived from model config.
 *
 * Model-derived use types (e.g., OPENAI_GPT_4O_TOKEN) are dynamically
 * constructed from the model config in lib/model.js and do not need to be
 * listed here.
 */
export const UseType = {
  // conversations
  CHATBOTKIT_CONVERSATION: 'CHATBOTKIT_CONVERSATION',
  CHATBOTKIT_MESSAGE: 'CHATBOTKIT_MESSAGE',

  // media
  CHATBOTKIT_IMAGE: 'CHATBOTKIT_IMAGE',
  CHATBOTKIT_VIDEO: 'CHATBOTKIT_VIDEO',
  CHATBOTKIT_AUDIO: 'CHATBOTKIT_AUDIO',

  // fetch
  CHATBOTKIT_FETCH: 'CHATBOTKIT_FETCH',

  // email
  CHATBOTKIT_EMAIL: 'CHATBOTKIT_EMAIL',

  // base tokens
  CHATBOTKIT_BASE_TOKEN: 'CHATBOTKIT_BASE_TOKEN',
  CHATBOTKIT_CUSTOM_TOKEN: 'CHATBOTKIT_CUSTOM_TOKEN',
} as const

/**
 * Type representing valid use type keys from the UseType constant object.
 */
export type UseTypeKey = keyof typeof UseType

/**
 * Type representing valid use type values from the UseType constant object.
 */
export type UseTypeValue = (typeof UseType)[UseTypeKey]

import { languageModels } from '@/config/models'

const testLanguageModels = {
  'gpt-4o': {
    ...languageModels.custom,
    provider: 'openai',
    family: 'gpt-4o',
    features: ['chat', 'functions', 'image'],
    maxTokens: 128_000,
    maxInputTokens: 124_000,
    maxOutputTokens: 4_000,
  },
  'gpt-3.5-turbo-instruct': {
    ...languageModels.custom,
    provider: 'openai',
    family: 'gpt-3.5-turbo',
    features: [],
    maxTokens: 4_096,
    maxInputTokens: 3_072,
    maxOutputTokens: 1_024,
  },
  'gpt-5.4-mini': {
    ...languageModels.custom,
    provider: 'openai',
    family: 'gpt-5',
    features: ['chat', 'functions', 'image', 'reasoning', 'responses'],
  },
  'gpt-realtime-2': {
    ...languageModels.custom,
    provider: 'openai',
    family: 'gpt-realtime',
    features: ['chat', 'functions', 'reasoning', 'realtime'],
    voice: 'cedar',
    availableVoices: ['cedar'],
  },
}

/**
 * Installs model metadata needed by deterministic OpenAI conversation tests.
 * Call this only after evaluating provider support so these fixtures cannot
 * make live tests eligible to run.
 */
export function installOpenAITestLanguageModels() {
  const installedNames = Object.keys(testLanguageModels).filter(
    (name) => !(name in languageModels)
  )

  for (const name of installedNames) {
    languageModels[name] = testLanguageModels[name]
  }

  return () => {
    for (const name of installedNames) {
      delete languageModels[name]
    }
  }
}

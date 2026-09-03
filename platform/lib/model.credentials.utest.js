import { getSafeModelStore } from '@/lib/model.context'
import { resolveProviderCredential } from '@/lib/model.credentials'

jest.mock('@/lib/model.context', () => ({
  getSafeModelStore: jest.fn(() => ({})),
  getModelStore: jest.fn(() => ({})),
}))

const OFFICIAL_URL = 'https://openrouter.ai/api/v1/chat/completions'

describe('resolveProviderCredential', () => {
  describe('BYOK / platform resolution', () => {
    // @note regression coverage: a BYOK-only provider (no platform
    // env key) used to throw a raw ZodError before the store key was consulted,
    // which broke BYOK entirely and crashed the conversation in Sentry.
    it('uses the BYOK store key when no platform env key exists', () => {
      expect(
        resolveProviderCredential({
          label: 'OpenRouter',
          storeKey: 'sk-byok',
          storeUrl: undefined,
          envKey: undefined,
        })
      ).toBe('sk-byok')
    })

    it('falls back to the platform env key when no store key is set', () => {
      expect(
        resolveProviderCredential({
          label: 'OpenAI',
          storeKey: undefined,
          storeUrl: undefined,
          envKey: 'sk-platform',
        })
      ).toBe('sk-platform')
    })

    it('prefers the store key over the platform key', () => {
      expect(
        resolveProviderCredential({
          label: 'OpenAI',
          storeKey: 'sk-byok',
          storeUrl: undefined,
          envKey: 'sk-platform',
        })
      ).toBe('sk-byok')
    })

    it('throws a UserConfigError (not a ZodError) when neither key is available', () => {
      expect(() =>
        resolveProviderCredential({
          label: 'OpenRouter',
          storeKey: undefined,
          storeUrl: undefined,
          envKey: undefined,
        })
      ).toThrow(/OpenRouter API key is not configured/)
    })

    it('treats a whitespace-only store key as absent and falls back to platform', () => {
      expect(
        resolveProviderCredential({
          label: 'OpenAI',
          storeKey: '   ',
          storeUrl: undefined,
          envKey: 'sk-platform',
        })
      ).toBe('sk-platform')
    })
  })

  describe('custom-endpoint credential isolation', () => {
    it('uses the BYOK store key with a custom endpoint and no platform key', () => {
      expect(
        resolveProviderCredential({
          label: 'OpenRouter',
          storeKey: 'sk-byok',
          storeUrl: 'https://custom.example.com',
          envKey: undefined,
        })
      ).toBe('sk-byok')
    })

    it('rejects a custom endpoint that resolves to platform credentials', () => {
      expect(() =>
        resolveProviderCredential({
          label: 'OpenRouter',
          storeKey: undefined,
          storeUrl: 'https://custom.example.com',
          envKey: 'sk-platform',
        })
      ).toThrow(/Custom endpoint requires custom credentials/)
    })

    // @note the key concern: setting the custom URL to the provider's OFFICIAL
    // endpoint must not bypass isolation - the platform key still must not leak.
    it('rejects a custom endpoint equal to the official URL without a custom key', () => {
      expect(() =>
        resolveProviderCredential({
          label: 'OpenRouter',
          storeKey: undefined,
          storeUrl: OFFICIAL_URL,
          envKey: 'sk-platform',
        })
      ).toThrow(/Custom endpoint requires custom credentials/)
    })

    it('rejects a whitespace-only custom key paired with a custom endpoint', () => {
      expect(() =>
        resolveProviderCredential({
          label: 'OpenRouter',
          storeKey: '   ',
          storeUrl: OFFICIAL_URL,
          envKey: 'sk-platform',
        })
      ).toThrow(/Custom endpoint requires custom credentials/)
    })

    // @note a "custom" key that is byte-for-byte the platform key must not be a
    // way to send platform credentials to a user-controlled URL.
    it('rejects a custom key identical to the platform key', () => {
      expect(() =>
        resolveProviderCredential({
          label: 'OpenRouter',
          storeKey: 'sk-platform',
          storeUrl: OFFICIAL_URL,
          envKey: 'sk-platform',
        })
      ).toThrow(/Custom endpoint requires custom credentials/)
    })

    it('allows a distinct custom key against the official URL', () => {
      expect(
        resolveProviderCredential({
          label: 'OpenRouter',
          storeKey: 'sk-byok',
          storeUrl: OFFICIAL_URL,
          envKey: 'sk-platform',
        })
      ).toBe('sk-byok')
    })

    it('ignores a whitespace-only custom URL (no isolation needed)', () => {
      expect(
        resolveProviderCredential({
          label: 'OpenAI',
          storeKey: undefined,
          storeUrl: '   ',
          envKey: 'sk-platform',
        })
      ).toBe('sk-platform')
    })
  })
})

/**
 * Wiring proof: every provider getter delegates to resolveProviderCredential
 * with its own (storeKey, storeUrl, envKey) trio. tsc cannot catch a transposed
 * store field (e.g. deepseek reading store.openrouterKey) because both are valid
 * Store members, so this executes each getter to prove the trio is correct.
 */
const PROVIDERS = [
  ['openai', 'getOpenAIKey', 'OPENAI_MODELS_API_KEY', 'openaiKey', 'openaiUrl'], // prettier-ignore
  ['vercel', 'getVercelAPIKey', 'VERCEL_MODELS_API_KEY', 'vercelKey', 'vercelUrl'], // prettier-ignore
  ['cloudflare', 'getCloudflareAPIKey', 'CLOUDFLARE_MODELS_API_KEY', 'cloudflareKey', 'cloudflareUrl'], // prettier-ignore
  ['bedrock', 'getBedrockAPIKey', 'BEDROCK_MODELS_API_KEY', 'bedrockKey', 'bedrockUrl'], // prettier-ignore
  ['vertex', 'getVertexModelsAPIKey', 'VERTEX_MODELS_API_KEY', 'vertexKey', 'vertexUrl'], // prettier-ignore
  ['openrouter', 'getOpenRouterAPIKey', 'OPENROUTER_MODELS_API_KEY', 'openrouterKey', 'openrouterUrl'], // prettier-ignore
  ['perplexity', 'getPerplexityAPIKey', 'PERPLEXITY_MODELS_API_KEY', 'perplexityKey', 'perplexityUrl'], // prettier-ignore
  ['deepseek', 'getDeepseekAPIKey', 'DEEPSEEK_MODELS_API_KEY', 'deepseekKey', 'deepseekUrl'], // prettier-ignore
  ['groq', 'getGroqAPIKey', 'GROQ_MODELS_API_KEY', 'groqKey', 'groqUrl'], // prettier-ignore
  ['mistral', 'getMistralAPIKey', 'MISTRAL_MODELS_API_KEY', 'mistralKey', 'mistralUrl'], // prettier-ignore
]

describe.each(PROVIDERS)(
  'getter wiring: %s',
  (mod, getterName, envVar, storeKeyField, storeUrlField) => {
    let getter
    const original = process.env[envVar]

    beforeAll(async () => {
      getter = (await import(`./model.provider.${mod}`))[getterName]
    })

    afterEach(() => {
      if (original === undefined) {
        delete process.env[envVar]
      } else {
        process.env[envVar] = original
      }

      jest.clearAllMocks()
    })

    it('uses the BYOK store key when no platform env key exists', () => {
      delete process.env[envVar]
      getSafeModelStore.mockReturnValue({ [storeKeyField]: 'byok-key' })

      expect(getter()).toBe('byok-key')
    })

    it('falls back to the platform env key', () => {
      process.env[envVar] = 'platform-key'
      getSafeModelStore.mockReturnValue({})

      expect(getter()).toBe('platform-key')
    })

    it('refuses platform credentials for a custom endpoint', () => {
      process.env[envVar] = 'platform-key'
      getSafeModelStore.mockReturnValue({
        [storeUrlField]: 'https://user-controlled.example.com',
      })

      expect(() => getter()).toThrow(
        /Custom endpoint requires custom credentials/
      )
    })
  }
)

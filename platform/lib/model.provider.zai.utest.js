import { getZaiAPIKey } from '@/lib/model.provider.zai'

jest.mock('@/lib/model.context', () => ({
  getSafeModelStore: jest.fn(() => ({})),
  getModelStore: jest.fn(() => ({})),
}))

import { getSafeModelStore } from '@/lib/model.context'

// @note Z.AI is BYOK-only: there is NO platform env key. These tests assert
// that BYOK works and that a missing credential cleanly errors instead of
// falling back to any platform key.

describe('getZaiAPIKey (BYOK-only)', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('uses the BYOK store key', () => {
    getSafeModelStore.mockReturnValue({ zaiKey: 'byok-key' })

    expect(getZaiAPIKey()).toBe('byok-key')
  })

  it('throws a UserConfigError when no BYOK key is set (no platform fallback)', () => {
    getSafeModelStore.mockReturnValue({})

    expect(() => getZaiAPIKey()).toThrow(/Z\.AI API key is not configured/)
  })

  it('does NOT fall back to a platform env key', () => {
    // Even if a lookalike env var is set, the provider never reads it.
    process.env.ZAI_MODELS_API_KEY = 'platform-key'
    getSafeModelStore.mockReturnValue({})

    expect(() => getZaiAPIKey()).toThrow(/Z\.AI API key is not configured/)

    delete process.env.ZAI_MODELS_API_KEY
  })

  it('allows a BYOK key against a custom endpoint', () => {
    getSafeModelStore.mockReturnValue({
      zaiKey: 'byok-key',
      zaiUrl: 'https://custom.example.com/v1/chat/completions',
    })

    expect(getZaiAPIKey()).toBe('byok-key')
  })

  it('refuses a custom endpoint with no BYOK key', () => {
    getSafeModelStore.mockReturnValue({
      zaiUrl: 'https://custom.example.com/v1/chat/completions',
    })

    expect(() => getZaiAPIKey()).toThrow(
      /Custom endpoint requires custom credentials/
    )
  })
})

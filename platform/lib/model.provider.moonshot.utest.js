import { getMoonshotAPIKey } from '@/lib/model.provider.moonshot'

jest.mock('@/lib/model.context', () => ({
  getSafeModelStore: jest.fn(() => ({})),
  getModelStore: jest.fn(() => ({})),
}))

import { getSafeModelStore } from '@/lib/model.context'

// @note Moonshot is BYOK-only: there is NO platform env key. These tests assert
// that BYOK works and that a missing credential cleanly errors instead of
// falling back to any platform key.

describe('getMoonshotAPIKey (BYOK-only)', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('uses the BYOK store key', () => {
    getSafeModelStore.mockReturnValue({ moonshotKey: 'byok-key' })

    expect(getMoonshotAPIKey()).toBe('byok-key')
  })

  it('throws a UserConfigError when no BYOK key is set (no platform fallback)', () => {
    getSafeModelStore.mockReturnValue({})

    expect(() => getMoonshotAPIKey()).toThrow(
      /Moonshot API key is not configured/
    )
  })

  it('does NOT fall back to a platform env key', () => {
    // Even if a lookalike env var is set, the provider never reads it.
    process.env.MOONSHOT_MODELS_API_KEY = 'platform-key'
    getSafeModelStore.mockReturnValue({})

    expect(() => getMoonshotAPIKey()).toThrow(
      /Moonshot API key is not configured/
    )

    delete process.env.MOONSHOT_MODELS_API_KEY
  })

  it('allows a BYOK key against a custom endpoint', () => {
    getSafeModelStore.mockReturnValue({
      moonshotKey: 'byok-key',
      moonshotUrl: 'https://custom.example.com/v1/chat/completions',
    })

    expect(getMoonshotAPIKey()).toBe('byok-key')
  })

  it('refuses a custom endpoint with no BYOK key', () => {
    getSafeModelStore.mockReturnValue({
      moonshotUrl: 'https://custom.example.com/v1/chat/completions',
    })

    expect(() => getMoonshotAPIKey()).toThrow(
      /Custom endpoint requires custom credentials/
    )
  })
})

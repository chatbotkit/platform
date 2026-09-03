import { getQwenAPIKey } from '@/lib/model.provider.qwen'

jest.mock('@/lib/model.context', () => ({
  getSafeModelStore: jest.fn(() => ({})),
  getModelStore: jest.fn(() => ({})),
}))

import { getSafeModelStore } from '@/lib/model.context'

// @note Qwen is BYOK-only: there is NO platform env key. These tests assert
// that BYOK works and that a missing credential cleanly errors instead of
// falling back to any platform key.

describe('getQwenAPIKey (BYOK-only)', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('uses the BYOK store key', () => {
    getSafeModelStore.mockReturnValue({ qwenKey: 'byok-key' })

    expect(getQwenAPIKey()).toBe('byok-key')
  })

  it('throws a UserConfigError when no BYOK key is set (no platform fallback)', () => {
    getSafeModelStore.mockReturnValue({})

    expect(() => getQwenAPIKey()).toThrow(/Qwen API key is not configured/)
  })

  it('does NOT fall back to a platform env key', () => {
    // Even if a lookalike env var is set, the provider never reads it.
    process.env.QWEN_MODELS_API_KEY = 'platform-key'
    getSafeModelStore.mockReturnValue({})

    expect(() => getQwenAPIKey()).toThrow(/Qwen API key is not configured/)

    delete process.env.QWEN_MODELS_API_KEY
  })

  it('allows a BYOK key against a custom endpoint', () => {
    getSafeModelStore.mockReturnValue({
      qwenKey: 'byok-key',
      qwenUrl: 'https://custom.example.com/v1/chat/completions',
    })

    expect(getQwenAPIKey()).toBe('byok-key')
  })

  it('refuses a custom endpoint with no BYOK key', () => {
    getSafeModelStore.mockReturnValue({
      qwenUrl: 'https://custom.example.com/v1/chat/completions',
    })

    expect(() => getQwenAPIKey()).toThrow(
      /Custom endpoint requires custom credentials/
    )
  })
})

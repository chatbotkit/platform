/**
 * @jest-environment node
 */

describe('platform configuration', () => {
  const original = process.env.PLATFORM_MAX_TOKENS_PER_MONTH
  const originalTtl = process.env.PLATFORM_CREDENTIAL_CACHE_TTL

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PLATFORM_MAX_TOKENS_PER_MONTH
    } else {
      process.env.PLATFORM_MAX_TOKENS_PER_MONTH = original
    }

    if (originalTtl === undefined) {
      delete process.env.PLATFORM_CREDENTIAL_CACHE_TTL
    } else {
      process.env.PLATFORM_CREDENTIAL_CACHE_TTL = originalTtl
    }

    jest.resetModules()
  })

  it('should leave a self-hosted deployment uncapped by default', async () => {
    delete process.env.PLATFORM_MAX_TOKENS_PER_MONTH
    jest.resetModules()

    const { default: platform } = await import('@/config/platform')

    expect(platform.maxTokensPerMonth).toBe(Infinity)
  })

  it('should honour an operator-defined capacity cap', async () => {
    process.env.PLATFORM_MAX_TOKENS_PER_MONTH = '12345'
    jest.resetModules()

    const { default: platform } = await import('@/config/platform')

    expect(platform.maxTokensPerMonth).toBe(12345)
  })

  it('should read credentials on every request by default', async () => {
    delete process.env.PLATFORM_CREDENTIAL_CACHE_TTL
    jest.resetModules()

    const { default: platform } = await import('@/config/platform')

    expect(platform.credentialCacheTtl).toBe(0)
  })

  it('should honour an operator-defined credential cache window', async () => {
    process.env.PLATFORM_CREDENTIAL_CACHE_TTL = '30'
    jest.resetModules()

    const { default: platform } = await import('@/config/platform')

    expect(platform.credentialCacheTtl).toBe(30)
  })

  it('should reject a malformed credential cache window', async () => {
    process.env.PLATFORM_CREDENTIAL_CACHE_TTL = 'soon'
    jest.resetModules()

    await expect(import('@/config/platform')).rejects.toThrow()
  })
})

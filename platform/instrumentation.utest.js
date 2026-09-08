/**
 * @jest-environment node
 */

jest.mock('@chatbotkit-dev/observability/next/server', () => ({
  onRequestError: jest.fn(),
  register: jest.fn(),
}))

jest.mock('@chatbotkit-dev/relay', () => ({
  __esModule: true,
  default: { listen: jest.fn() },
}))

jest.mock('@/lib/clock', () => {
  // @note importing the clock reaches Node-only request and queue modules
  if (process.env.NEXT_RUNTIME === 'edge') {
    throw new Error("Module not found: Can't resolve 'crypto'")
  }

  return { startClock: jest.fn() }
})

describe('instrumentation runtime boundary', () => {
  const originalRuntime = process.env.NEXT_RUNTIME

  afterEach(() => {
    if (originalRuntime === undefined) {
      delete process.env.NEXT_RUNTIME
    } else {
      process.env.NEXT_RUNTIME = originalRuntime
    }

    jest.restoreAllMocks()
  })

  it('registers Edge observability without importing the Node-only clock', async () => {
    process.env.NEXT_RUNTIME = 'edge'

    await jest.isolateModulesAsync(async () => {
      const { register, onRequestError } = await import('./instrumentation')
      const observability = await import(
        '@chatbotkit-dev/observability/next/server'
      )

      await register()

      expect(observability.register).toHaveBeenCalledTimes(1)
      expect(onRequestError).toBe(observability.onRequestError)
    })
  })

  it('starts the clock and relay when registering the Node runtime', async () => {
    process.env.NEXT_RUNTIME = 'nodejs'

    jest.spyOn(console, 'log').mockImplementation(() => {})

    await jest.isolateModulesAsync(async () => {
      const { register } = await import('./instrumentation')
      const { startClock } = await import('@/lib/clock')
      const { default: relay } = await import('@chatbotkit-dev/relay')
      const observability = await import(
        '@chatbotkit-dev/observability/next/server'
      )

      await register()

      expect(startClock).toHaveBeenCalledTimes(1)
      expect(relay.listen).toHaveBeenCalledTimes(1)
      expect(observability.register).toHaveBeenCalledTimes(1)
    })
  })
})

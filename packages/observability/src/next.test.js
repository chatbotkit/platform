import { onRouterTransitionStart } from './next/client'
import { withObservabilityConfig } from './next/config'
import { onRequestError, register } from './next/server'

describe('community Next.js observability', () => {
  it('provides no-op framework hooks', async () => {
    await expect(register()).resolves.toBeUndefined()
    await expect(onRequestError()).resolves.toBeUndefined()
    expect(onRouterTransitionStart('/next', 'push')).toBeUndefined()
  })

  it('leaves the Next.js build configuration unchanged', async () => {
    const config = { reactStrictMode: true }

    await expect(withObservabilityConfig(config)).resolves.toBe(config)
  })
})

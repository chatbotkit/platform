async function loadConfig(nodeEnv) {
  const previous = process.env.NODE_ENV
  let config

  try {
    process.env.NODE_ENV = nodeEnv

    await jest.isolateModulesAsync(async () => {
      config = (await import('./actions.config')).default
    })

    return config
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = previous
    }
  }
}

describe('Server Actions origin policy', () => {
  it('does not turn configured production domains into cross-origin permissions', async () => {
    const config = await loadConfig('production')

    expect(config.experimental.serverActions.allowedOrigins).toEqual([])
  })

  it('retains the local development proxy exceptions without trusting deployment domains', async () => {
    const config = await loadConfig('development')

    expect(config.experimental.serverActions.allowedOrigins).toEqual(
      [...Array(10)].flatMap((_, i) => [
        `localhost:808${i}`,
        `localhost:909${i}`,
      ])
    )
  })
})

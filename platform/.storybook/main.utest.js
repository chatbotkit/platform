describe('storybook webpack config', () => {
  it('strips the node: protocol before webpack resolves requests', async () => {
    const { default: storybookConfig } = await import('./main.ts')

    const compiler = {
      hooks: {
        normalModuleFactory: {
          tap: jest.fn((_pluginName, registerFactory) => {
            registerFactory({
              hooks: {
                beforeResolve: {
                  tap: jest.fn((_hookName, handleResolve) => {
                    const resolveData = { request: 'node:async_hooks' }

                    handleResolve(resolveData)

                    expect(resolveData.request).toBe('async_hooks')
                  }),
                },
              },
            })
          }),
        },
      },
    }

    const webpackConfig = await storybookConfig.webpackFinal({
      resolve: {
        modules: [],
        fallback: {},
        extensions: ['.js'],
      },
      module: {
        rules: [],
      },
      plugins: [],
    })

    const stripNodeProtocolPlugin = webpackConfig.plugins.find(
      (plugin) => plugin?.constructor?.name === 'StripNodeProtocol'
    )

    expect(stripNodeProtocolPlugin).toBeDefined()

    stripNodeProtocolPlugin.apply(compiler)
  })
})
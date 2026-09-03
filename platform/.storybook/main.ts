import type { StorybookConfig } from '@storybook/nextjs'

import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const config: StorybookConfig = {
  stories: [
    '../app/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../pages/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../stories/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../hooks/**/*.stories.@(js|jsx|ts|tsx|mdx)',
    '../components/**/*.stories.@(js|jsx|ts|tsx|mdx)',
  ],

  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-onboarding',
    '@storybook/addon-interactions',
  ],

  framework: {
    name: '@storybook/nextjs',
    options: {},
  },

  docs: {
    autodocs: 'tag',
  },

  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },

  env: (config) => ({
    ...config,

    APP_MANIFESTS_JSON: JSON.stringify([]),
    SITE_URL: 'http://localhost:6006',
  }),

  webpackFinal: async (config) => {
    const webpack = require('webpack')

    config.plugins = config.plugins || []
    config.plugins.push(
      new (class StripNodeProtocol {
        apply(compiler: {
          hooks: {
            normalModuleFactory: {
              tap: (
                name: string,
                fn: (factory: {
                  hooks: {
                    beforeResolve: {
                      tap: (
                        name: string,
                        fn: (resolveData: { request: string }) => void
                      ) => void
                    }
                  }
                }) => void
              ) => void
            }
          }
        }) {
          compiler.hooks.normalModuleFactory.tap(
            'StripNodeProtocol',
            (factory) => {
              factory.hooks.beforeResolve.tap(
                'StripNodeProtocol',
                (resolveData) => {
                  if (resolveData.request.startsWith('node:')) {
                    resolveData.request = resolveData.request.slice(5)
                  }
                }
              )
            }
          )
        }
      })()
    )

    // @note the prisma client (real and generated) is reachable from browser
    // bundles through page -> api route -> lib -> prisma imports and its
    // runtime requires node built-ins (node:url) which are not available in
    // the browser, so it must be mocked as a whole - resolve.alias does not
    // work here because the nextjs framework resolves @/ requests through the
    // tsconfig paths mechanism before aliases are consulted, so the requests
    // are rewritten before resolution instead

    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /prisma[\\/]generated[\\/]prisma/,
        require.resolve('./mocks/prisma-generated.js')
      ),
      new webpack.NormalModuleReplacementPlugin(
        /^@\/prisma\/client$/,
        require.resolve('./mocks/prisma-client.ts')
      ),
      // @note lib/scope.server throws at import time when bundled into the
      // browser, and storybook does not tree-shake the server-only parts of
      // pages the way next does
      new webpack.NormalModuleReplacementPlugin(
        /(^|[\\/])scope\.server$/,
        require.resolve('./mocks/empty.ts')
      )
    )

    // Handle absolute imports

    if (config.resolve) {
      config.resolve.modules = [
        ...(config.resolve.modules || []),

        'node_modules',
      ]

      // Add fallbacks for Node.js built-in modules

      config.resolve.alias = {
        ...config.resolve.alias,

        '@/prisma/client': require.resolve('./mocks/prisma-client.ts'),
      }

      config.resolve.fallback = {
        ...config.resolve.fallback,

        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        util: false,
        buffer: false,
        events: false,
        child_process: false,
        dns: false,
        async_hooks: require.resolve('./mocks/async_hooks.ts'),
        module: false,
      }

      // Add YAML file extension

      config.resolve.extensions = [
        ...(config.resolve.extensions || []),
        '.yaml',
        '.yml',
      ]
    }

    // Add YAML loader

    config.module = config.module || {}
    config.module.rules = config.module.rules || []
    config.module.rules.push({
      test: /\.ya?ml$/,
      use: require.resolve('../webpack/loaders/yaml.js'),
    })

    // Inject environment variables into client-side code using DefinePlugin to
    // ensure they are available to test that affect pages

    config.plugins.push(
      new webpack.DefinePlugin({
        'process.env': JSON.stringify({
          // model providers
          OPENAI_MODELS_API_KEY: 'dummy',
          OPENROUTER_MODELS_API_KEY: 'dummy',
          DEEPSEEK_MODELS_API_KEY: 'dummy',
          BEDROCK_MODELS_API_KEY: 'dummy',
          CLOUDFLARE_MODELS_ACCOUNT_ID: 'dummy',
          CLOUDFLARE_MODELS_API_KEY: 'dummy',
          GROQ_MODELS_API_KEY: 'dummy',
          MISTRAL_MODELS_API_KEY: 'dummy',
          VERTEX_MODELS_API_KEY: 'dummy',
          PERPLEXITY_MODELS_API_KEY: 'dummy',
          VERCEL_MODELS_API_KEY: 'dummy',
          // @note the swappable modules used to need stubs here - object
          // storage, PII redaction, the relay, the vector store, batch and the
          // sandbox each read their environment at import, so storybook could
          // not load a component that transitively reached one without this
          // deployment's credentials. That is the exact failure
          // packages/AGENTS.md warns about: a vendor's variables
          // ending up stubbed in the application's storybook configuration.
          // They all resolve on first use now, so the stubs are gone.
          // @note the public placeholder from .env.example - storybook
          // never encrypts, but the module validates the key on first use
          CLOAK_ENCRYPTION_KEY:
            'k1.aesgcm256.wnSMNGJsU_KupqT7qVHpQd5paEj9DAigJiRkM_to-cI=',
        }),
      })
    )

    return config
  },
}

export default config

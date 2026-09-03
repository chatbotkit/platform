 
// @ts-check
import deepmerge from 'deepmerge'
import fs from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'node:url'
import path from 'path'

const require = createRequire(import.meta.url)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// define merge options to handle function merging

function merge(a, b) {
  const result = deepmerge(a, b)

  const functions = {
    webpack: { type: 'cascade' },
    headers: { type: 'async', default: [] },
    rewrites: { type: 'async', default: {} },
    redirects: { type: 'async', default: [] },
  }

  for (const fnName of Object.keys(functions)) {
    let fnA = a?.[fnName]
    let fnB = b?.[fnName]

    if (!fnA && !fnB) {
      continue
    }

    if (functions[fnName].type === 'cascade') {
      result[fnName] = (...args) => {
        const resultA = fnA?.(...args)
        const resultB = fnB?.(...args)

        return resultA ?? resultB
      }
    } else if (functions[fnName].type === 'async') {
      const defaultValue = functions[fnName].default

      fnA ??= () => defaultValue
      fnB ??= () => defaultValue

      result[fnName] = async (...args) => {
        let resA = await fnA(...args)

        if (Array.isArray(resA) && !Array.isArray(defaultValue)) {
          throw new Error(`Expected ${fnName} to return an array`)
        }

        let resB = await fnB(...args)

        if (Array.isArray(resB) && !Array.isArray(defaultValue)) {
          throw new Error(`Expected ${fnName} to return an array`)
        }

        return deepmerge(resA, resB)
      }
    } else {
      const defaultValue = functions[fnName].default

      fnA ??= () => defaultValue
      fnB ??= () => defaultValue

      result[fnName] = (...args) => {
        let resA = fnA(...args)

        if (Array.isArray(resA) && !Array.isArray(defaultValue)) {
          throw new Error(`Expected ${fnName} to return an array`)
        }

        let resB = fnB(...args)

        if (Array.isArray(resB) && !Array.isArray(defaultValue)) {
          throw new Error(`Expected ${fnName} to return an array`)
        }

        return deepmerge(resA, resB)
      }
    }
  }

  return result
}

export default async () => {
  // load all config files at next.config.d and merge them into one object

  async function loadDirectoryConfigs() {
    const importedConfigs = await Promise.all(
      fs
        .readdirSync('./next.config.d')
        .filter((file) => file.endsWith('.config.js'))
        .map(async (file) => {
          const importedModule = await import(`./next.config.d/${file}`)

          // handle ES module default exports

          const config = importedModule.default || importedModule

          return {
            file,
            index: Number.isFinite(config?.index) ? config.index : Infinity,
            config,
          }
        })
    )

    const sortedConfigs = importedConfigs.sort((a, b) => {
      if (a.index !== b.index) {
        return a.index - b.index
      }

      return a.file.localeCompare(b.file)
    })

    for (const { file, index } of sortedConfigs) {
      // eslint-disable-next-line no-console
      console.log(
        `[next.config.js] loading config: ${file}${
          Number.isFinite(index) ? ` (index: ${index})` : ''
        }`
      )
    }

    return sortedConfigs.reduce((acc, { config }) => {
      const { index: _index, ...rest } = config

      return merge(acc, rest)
    }, {})
  }

  const directoryConfigs = await loadDirectoryConfigs()

  /**
   * The Next.js configuration.
   *
   * @type {import('next').NextConfig}
   */
  const nextConfig = merge(directoryConfigs, {
    poweredByHeader: false,

    reactStrictMode: true,

    pageExtensions: ['ts', 'tsx', 'js', 'jsx'],

    webpack(config, options) {
      // @note Strip the `node:` protocol prefix from import requests so that
      // Prisma v7 generated files (which use `node:path`, `node:process`, etc.)
      // resolve correctly in all webpack compilation targets (RSC, pages, client).
      // Node.js treats `node:X` and `X` identically, so this is safe.
      {
        config.plugins.push(
          new (class StripNodeProtocol {
            apply(compiler) {
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
      }

      // @note `pages/**/*.utest.*` and `*.stories.*` files match
      // `pageExtensions` and are compiled as routes; page-data collection
      // executes them (jest globals) and rejects them (no component default
      // export), and their imports drag test-only code into client bundles.
      // Replace each with an empty page module at compile time.
      // @todo consider a long-term solution
      {
        config.plugins.push(
          new options.webpack.NormalModuleReplacementPlugin(
            /[\\/]pages[\\/].*\.(utest|stories)\.[cm]?[jt]sx?$/,
            require.resolve('./webpack/stubs/empty-page.js')
          )
        )
      }

      // setup aliases
      {
        // @note only alias crypto to webcrypto on client builds where Node's
        // native crypto module doesn't exist
        if (!options.isServer) {
          config.resolve.alias['crypto'] = require.resolve('./lib/webcrypto.ts')
        }
      }

      // @note Prevent @prisma/client/runtime/client.mjs from being bundled in
      // client-side (browser) builds. This file imports many Node.js builtins
      // (crypto, async_hooks, fs, module, etc.) that don't exist in the browser.
      // Prisma never executes client-side, so providing an empty module is safe
      // and avoids having to shim every Node.js API it references.
      {
        if (!options.isServer) {
          config.resolve.alias['@prisma/client/runtime/client$'] = false
        }
      }

      // @note undici (the egress dispatcher behind lib/egress.core.ts) is
      // server-only but is reached from client compilations through shared
      // modules; its Node internals (diagnostics_channel, node:sqlite, dns)
      // have no browser equivalent, so the whole package resolves to an empty
      // module there.
      {
        if (!options.isServer) {
          config.resolve.alias['undici$'] = false
        }
      }

      // setup resolver
      {
        config.resolve.fallback = {
          ...config.resolve?.fallback,

          fs: false,

          // @note lib/egress.core.ts imports node:dns and is reached from
          // client compilations through shared modules; it never runs in the
          // browser, so the request resolves to an empty module.
          dns: false,

          async_hooks: require.resolve('./polyfills/async-hooks.js'),
        }
      }

      // setup additional loaders
      {
        config.module.rules.push({
          test: /\.ya?ml$/,
          use: require.resolve('./webpack/loaders/yaml.js'),
        })

        config.module.rules.push({
          test: /\.json\.gz$/,
          use: require.resolve('./webpack/loaders/json-gz.cjs'),
        })

        config.module.rules.push({
          test: /\.svg$/i,
          issuer: /\.[jt]sx?$/,
          use: ['@svgr/webpack'],
        })

        config.module.rules.push({
          test: /\.(manifest)$/,
          use: ['json-loader'],
        })

        config.module.rules.push({
          test: /\.md$/,
          resourceQuery: /frontmatter/,
          use: require.resolve('./webpack/loaders/md-frontmatter.js'),
        })

        config.module.rules.push({
          test: /\.(md|txt|html)$/,
          resourceQuery: { not: [/.+/] },
          use: 'raw-loader',
        })

        config.module.rules.push({
          test: /\.(ttf|eot|woff|woff2)$/,
          use: [
            {
              loader: 'url-loader',
              options: {
                encoding: false,
                mimetype: false,
                generator: (content) => {
                  return content
                },
              },
            },
          ],
        })

        // @note this is a workaround for the wasm loader
        {
          config.module.rules.push({
            test: /resvg\/resvg-wasm\/index_bg\.wasm$/,
            use: [
              {
                loader: 'url-loader',
                options: {
                  encoding: false,
                  mimetype: false,
                  generator: (content) => {
                    return content
                  },
                },
              },
            ],
          })
        }

        // @todo export in own library
        {
          const path = require('path')

          // Handle TypeScript files from shared package

          config.module.rules.push({
            test: /\.(?:tsx?|jsx?)$/,
            include: [path.resolve(path.join(__dirname, '../../shared'))],
            exclude: /node_modules/,
            use: [options.defaultLoaders.babel],
          })

          // Handle TypeScript files from workspace packages

          config.module.rules.push({
            test: /\.(?:tsx?|jsx?)$/,
            include: [path.resolve(path.join(__dirname, '../packages'))],
            exclude: /node_modules/,
            use: [options.defaultLoaders.babel],
          })
        }

        // @note add obfuscator for all yaml files
        // @note disabled because it is causing issues
        // {
        //   if (!options.isServer && process.env.NODE_ENV === 'production') {
        //     config.module.rules.push({
        //       test: /\.ya?ml$/,
        //       enforce: 'post',
        //       use: {
        //         loader: WebpackObfuscator.loader,
        //         options: {
        //           rotateStringArray: true,
        //         },
        //       },
        //     })
        //   }
        // }
      }

      // reconfigure entry
      {
        const originalEntry = config.entry

        config.entry = async () => {
          const entries = await originalEntry()

          // polyfills

          if (entries['main.js']) {
            // load polyfills only in the server
            // @todo this is only added for consistency but it does not work
            {
              if (options.isServer) {
                if (!entries['main.js'].includes('./polyfills/server.js')) {
                  entries['main.js'].unshift('./polyfills/server.js')
                }
              }
            }

            // load polyfills only in the client
            {
              if (!options.isServer) {
                if (!entries['main.js'].includes('./polyfills/client.js')) {
                  entries['main.js'].unshift('./polyfills/client.js')
                }
              }
            }
          }

          return entries
        }
      }

      // ignore some warnings
      {
        if (options.isServer) {
          if (!config.ignoreWarnings) {
            config.ignoreWarnings = []
          }

          // open telemetry
          {
            // @note opentelemetry is causing a lot of warnings when
            // bundlePageExternals is enabled and as per some external sources
            // it is best to ignore them for now until the issue is resolved

            // @see https://github.com/open-telemetry/opentelemetry-js/issues/4173#issuecomment-1822938936

            // @todo reconsider this in the future

            config.ignoreWarnings.push({ module: /opentelemetry/ })
          }
        }
      }

      // fail fast on stale chunks
      {
        // @note On a stale deployment the browser requests chunk filenames the
        // CDN no longer serves and the fetch hangs until this timeout elapses
        // (production reports the "timeout:" variant). The webpack
        // default is 120s - far too long to leave a user staring at a dead page.
        // Lower it on client builds so the failure surfaces quickly and our
        // recovery (components/ChunkErrorListener + the error boundaries) can
        // reload onto the current deployment promptly.
        if (!options.isServer) {
          config.output.chunkLoadTimeout = 30_000
        }
      }

      return config
    },
  })

  let exportConfig = nextConfig

  // stats
  {
    if (process.env.NODE_ENV === 'development') {
      exportConfig.rewrites?.().then((config) => {
        // eslint-disable-next-line no-console
        console.log(
          `* [next.config.js] rewrites:`,
          Object.fromEntries(
            Object.entries(config).map(([key, value]) => {
              return [key, value.length]
            })
          )
        )
      })

      exportConfig.redirects?.().then((config) => {
        // eslint-disable-next-line no-console
        console.log(`[next.config.js] redirects:`, config.length)
      })
    }
  }

  // OBSERVABILITY
  {
    const { withObservabilityConfig } = await import(
      '@chatbotkit-dev/observability/next/config'
    )

    exportConfig = await withObservabilityConfig(exportConfig)
  }

  // SOURCE MAP SECURITY GUARD
  {
    // @note this plugin acts as a final safety net to catch if ANY plugin
    // accidentally generates source maps with sourcesContent. It does NOT
    // generate source maps itself - it only validates that any existing source
    // maps don't contain source code. This guards against accidental additions
    // by other plugins that may generate source maps.

    // @note BUILD_SOURCEMAPS=full is the single explicit opt-in that embeds
    // source content in the emitted maps (for self-hosted builds of public
    // source); any other value than unset/nosources/full fails the build

    const buildSourcemaps = process.env.BUILD_SOURCEMAPS || 'nosources'

    if (buildSourcemaps !== 'nosources' && buildSourcemaps !== 'full') {
      throw new Error(
        `[next.config.js] invalid BUILD_SOURCEMAPS value '${buildSourcemaps}' - expected 'nosources' or 'full'`
      )
    }

    const fullSourcemaps = buildSourcemaps === 'full'

    if (fullSourcemaps) {
      // eslint-disable-next-line no-console
      console.log(
        `[next.config.js] BUILD_SOURCEMAPS=full - source maps will include source content`
      )

      exportConfig.productionBrowserSourceMaps = true
    }

    const previousWebpack = exportConfig.webpack

    exportConfig.webpack = (config, options) => {
      const modifiedConfig = previousWebpack
        ? previousWebpack(config, options)
        : config

      if (!options.dev) {
        // @note the no-source-content policy holds for every observability
        // provider; this assignment runs after every other webpack mutator, so
        // it wins
        modifiedConfig.devtool = fullSourcemaps
          ? 'source-map'
          : 'nosources-source-map'

        if (!fullSourcemaps) {
          const {
            ValidateSourceMapsPlugin,
          } = require('./webpack/plugins/validate-sourcemaps')

          modifiedConfig.plugins.unshift(
            new ValidateSourceMapsPlugin({ phase: 'guard' })
          )
        }
      }

      return modifiedConfig
    }
  }

  // BUILD ANALYZER
  {
    if (process.env.ANALYZE_BUILD) {
      const { default: withBundleAnalyzer } = await import(
        '@next/bundle-analyzer'
      )
      const analyzer = withBundleAnalyzer()

      exportConfig = analyzer({
        ...exportConfig,
      })
    } else {
      // eslint-disable-next-line no-console
      console.log(`[next.config.js] build analyzer is not configured`)
    }
  }

  return exportConfig
}

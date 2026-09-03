const { createRequire } = require('module')
const { resolve } = require('path')

const require2 = createRequire(__filename)

// @note resolve plugins from local node_modules to ensure v3, not v4

const resolvePath = (name) => {
  try {
    return require2.resolve(name, {
      paths: [resolve(__dirname, 'node_modules')],
    })
  } catch {
    // fallback for plugins that are hoisted
    return require2.resolve(name)
  }
}

/**
 * PostCSS configuration for Next.js and Storybook.
 *
 * @note this file uses .cjs extension (CommonJS) because:
 * - PostCSS loader (used by Storybook webpack) doesn't properly handle ESM when
 *   loaded via cosmiconfig/import-fresh
 * - Next.js works fine with both ESM (.js) and CJS (.cjs)
 * - Using .cjs ensures compatibility with both build tools
 *
 * @note we use absolute plugin paths (resolvePath) because:
 * - Workspace members may use different Tailwind CSS major versions
 * - String plugin names like 'tailwindcss' may resolve from the workspace root
 * - Absolute paths force resolution from platform/node_modules to ensure v3
 * - See .storybook/main.ts: webpack aliases also force v3 resolution
 */
module.exports = {
  // Order is important, first to last.

  plugins: {
    [resolvePath('postcss-import')]: {},

    [resolvePath('tailwindcss/nesting')]: {},

    [resolvePath('tailwindcss')]: {},

    [resolvePath('autoprefixer')]: {},

    [resolvePath('postcss-functions')]: {
      functions: {
        /**
         * The function is used to resolve the correct URL for the any given url
         * string. This is useful for resolving the correct URL for any given
         * asset, especially when the site is hosted in a subdirectory.
         *
         * @param {*} input
         * @returns string
         */
        baseurl(input) {
          let url = input.slice(1, -1)

          if (process.env.NEXT_BASE_PATH) {
            url = `${process.env.NEXT_BASE_PATH}/${url}`.replace(/\/+/g, '/')
          }

          return `url('${url}')`
        },
      },
    },
  },
}

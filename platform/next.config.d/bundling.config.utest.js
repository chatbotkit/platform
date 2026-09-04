/* eslint-disable @typescript-eslint/no-require-imports */

const config = require('./bundling.config').default

function compile(options) {
  return config.webpack({ externals: [] }, options)
}

function externalFor(externals, request) {
  return externals.find((entry) => entry?.[request])?.[request]
}

describe('bundling.config', () => {
  it('externalizes the optional ws native addons on the node server build', () => {
    const { externals } = compile({ isServer: true, nextRuntime: 'nodejs' })

    // @note the request must reach Node's require so it throws when the
    // addon is absent and ws falls back to JS; an empty webpack module
    // would satisfy the require and leave ws calling undefined functions
    expect(externalFor(externals, 'bufferutil')).toBe('commonjs bufferutil')
    expect(externalFor(externals, 'utf-8-validate')).toBe(
      'commonjs utf-8-validate'
    )
  })

  it.each([
    ['client', { isServer: false }],
    ['edge', { isServer: true, nextRuntime: 'edge' }],
  ])('leaves the %s build untouched', (_, options) => {
    const { externals } = compile(options)

    expect(externals).toEqual([])
  })
})

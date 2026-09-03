/* eslint-disable no-console */
// @note the console is the community implementation's output, so the test
// has to touch it
import observability from './index'

// @note the community implementation reports to the console and traces
// nothing. These pin the contract rather than the output format.

describe('community observability', () => {
  const original = { error: console.error, warn: console.warn, log: console.log }

  let seen

  beforeEach(() => {
    seen = []

    const record =
      (kind) =>
      (...args) => {
        seen.push(`${kind}:${args.map(String).join(' ')}`)
      }

    console.error = record('error')
    console.warn = record('warn')
    console.log = record('log')
  })

  afterEach(() => {
    console.error = original.error
    console.warn = original.warn
    console.log = original.log

    delete process.env.DEBUG
  })

  it('satisfies the contract', () => {
    for (const member of [
      'captureException',
      'captureMessage',
      'setTag',
      'startSpan',
      'getTracePropagationData',
      'captureFrameworkError',
      'assertConfigured',
    ]) {
      expect(typeof (observability)[member]).toBe('function')
    }
  })

  it('reports an exception', async () => {
    await observability.captureException(new Error('boom'))

    expect(seen.some((line) => line.startsWith('error:'))).toBe(true)
  })

  it('propagates no trace data', () => {
    expect(observability.getTracePropagationData()).toEqual({})
  })

  it('returns a usable span that does nothing when not debugging', () => {
    const span = observability.startSpan({ name: 'work' })

    span.setAttribute('a', 1)
    span.finish()

    expect(seen).toEqual([])
  })

  it('reports span timing when debugging', () => {
    process.env.DEBUG = '1'

    const span = observability.startSpan({ name: 'work', op: 'db' })

    span.finish()

    expect(seen.some((line) => line.includes('span "work"'))).toBe(true)
  })

  it('needs no configuration', async () => {
    await expect(observability.assertConfigured()).resolves.toBeUndefined()
  })
})

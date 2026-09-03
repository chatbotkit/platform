import { jest } from '@jest/globals'

import { authenticate, discardFailedDeliveries, publish } from './index'

// @note the seam is the global fetch a publish goes out on. Everything else -
// the secret, the deduplication window - runs for real, because it is the whole
// of what this package is.

const originalFetch = global.fetch

function delivery(url) {
  return { request: new Request(url), body: new ArrayBuffer(0) }
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 })

  process.env.QUEUE_SECRET = 'deployment-secret'
})

afterEach(() => {
  global.fetch = originalFetch
})

const message = {
  url: 'https://api.example.com/api/v1/thing',
  localUrl: 'http://localhost:8080/api/v1/thing',
  payload: { type: 'test' },
}

describe('publish', () => {
  // @note the local address, not the public one. A queue delivering in-process
  // should not leave the machine, and on a laptop the public address does not
  // resolve at all.
  it('delivers to the local address', async () => {
    await publish(message)

    const [target] = global.fetch.mock.calls[0]

    expect(new URL(target).origin).toBe('http://localhost:8080')
    expect(new URL(target).pathname).toBe('/api/v1/thing')
  })

  it('posts the payload as json', async () => {
    await publish(message)

    const [, init] = global.fetch.mock.calls[0]

    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ type: 'test' })
  })

  // @note the secret is the deployment's, read from the environment. It
  // authenticates the platform to itself and the platform checks it, so this
  // package only attaches it.
  it('attaches the deployment delivery secret', async () => {
    await publish(message)

    const [target] = global.fetch.mock.calls[0]

    expect(new URL(target).searchParams.get('secret')).toBe('deployment-secret')
  })

  it('takes the first of several so a rotation stays valid', async () => {
    process.env.QUEUE_SECRET = 'next , current'

    await publish({ ...message, deduplicationId: undefined })

    const [target] = global.fetch.mock.calls[0]

    expect(new URL(target).searchParams.get('secret')).toBe('next')
  })

  it('still delivers when none is configured', async () => {
    delete process.env.QUEUE_SECRET

    await publish(message)

    const [target] = global.fetch.mock.calls[0]

    expect(new URL(target).searchParams.get('secret')).toBeNull()
  })

  it('suppresses a repeat of the same deduplication id', async () => {
    await publish({ ...message, deduplicationId: 'once' })
    await publish({ ...message, deduplicationId: 'once' })

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not suppress messages without one', async () => {
    await publish(message)
    await publish(message)

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  // @note dropped rather than rejected. Throwing would make every caller that
  // passes an option this cannot honour fail in development while working in
  // production - see the note at the top of the module.
  it('accepts and ignores the options it cannot honour', async () => {
    await expect(
      publish({
        ...message,
        delayInSeconds: 600,
        retries: 5,
        flow: { key: 'k', parallel: 1 },
        callbacks: { success: 'https://x/ok', failure: 'https://x/no' },
      })
    ).resolves.toBeUndefined()

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  // @note a delivery that fails while the publisher is still waiting is worth
  // surfacing - in development that is usually the route not existing. One that
  // fails later is swallowed, because by then nothing is listening.
  it('surfaces a delivery that fails immediately', async () => {
    global.fetch.mockRejectedValue(new Error('connection refused'))

    await expect(publish(message)).rejects.toThrow('connection refused')
  })
})

describe('authenticate', () => {
  // @note this queue attaches nothing of its own, so anything reaching it has
  // already failed the platform's shared-secret check
  it('refuses, because it has no proof of its own to check', async () => {
    await expect(
      authenticate(delivery('http://localhost:8080/x'))
    ).resolves.toMatchObject({ authenticated: false })
  })

  it('does not mark the refusal as unexpected', async () => {
    const result = await authenticate(delivery('http://localhost:8080/x'))

    expect(result.unexpected).toBeUndefined()
  })
})

describe('the environment', () => {
  it('is not read at import', async () => {
    delete process.env.QUEUE_SECRET

    await expect(import('./index')).resolves.toBeDefined()
  })
})

describe('failed deliveries', () => {
  // @note nothing is kept, so nothing is stuck - the caller is asking for
  // something to be forgotten that already is
  it('discards without complaint', async () => {
    await expect(discardFailedDeliveries(['a', 'b'])).resolves.toBeUndefined()
  })

  it('accepts an empty list', async () => {
    await expect(discardFailedDeliveries([])).resolves.toBeUndefined()
  })
})

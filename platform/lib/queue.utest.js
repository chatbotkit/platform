// @note this suite used to assert the whole QStash message - the callbacks, the
// flow control, the deduplication id normalisation - and the direct fetch path
// beside it. All of that moved into whichever queue module is installed, along
// with its own tests.
//
// What is left is the platform's half: which of its own hosts a route resolves
// against, that a delivery outcome is reported to the API host whatever the
// message was addressed to, and that the shared delivery secret is checked here
// rather than by the queue.

import { queue, withQueue } from '@/lib/queue'

const provider = {
  publish: jest.fn(),
  authenticate: jest.fn(),
}

jest.mock('@chatbotkit-dev/queue', () => ({
  __esModule: true,

  default: {
    publish: (...args) => provider.publish(...args),
    authenticate: (...args) => provider.authenticate(...args),
  },
}))

jest.mock('@/config/queue', () => ({
  SECRETS: ['test-secret', 'rotating-secret'],
}))

jest.mock('@/lib/host', () => ({
  getExternalAPIHostURL: () => 'https://external.api.com',
  getLocalAPIHostURL: () => 'http://localhost:8080',
}))

// @note only `defer` is overridden - `@/lib/defer` also exports the wrapper
// `withAny` builds every handler on, and replacing the whole module takes that
// away too.
jest.mock('@/lib/defer', () => ({
  ...jest.requireActual('@/lib/defer'),

  defer: (fn) => (typeof fn === 'function' ? fn() : fn),
}))

beforeEach(() => {
  jest.clearAllMocks()

  provider.publish.mockResolvedValue(undefined)
})

describe('queue', () => {
  // @note both addresses are resolved here because only the platform knows its
  // own hosts, and only the installed queue knows which of the two it can
  // deliver from
  it('resolves a route against both the public and the local host', async () => {
    await queue('/api/v1/test/endpoint', { data: 1 })

    expect(provider.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://external.api.com/api/v1/test/endpoint',
        localUrl: 'http://localhost:8080/api/v1/test/endpoint',
        payload: { data: 1 },
      })
    )
  })

  // @note the case worth keeping from the old suite. A message may be addressed
  // to the web host and its outcome still belongs on the API host, so the
  // callbacks are built here rather than derived from the message url.
  it('keeps the outcome callbacks on the api host for a full url route', async () => {
    await queue(new URL('https://chatbotkit.com/system/queue'), { data: 1 })

    expect(provider.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://chatbotkit.com/system/queue',

        callbacks: {
          success: 'https://external.api.com/api/system/queue/callback/post',
          failure:
            'https://external.api.com/api/system/queue/callback/failure/post',
        },
      })
    )
  })

  it('passes the delivery options through untouched', async () => {
    const options = {
      deduplicationId: 'unique-id',
      delayInSeconds: 300,
      retries: 3,
      flow: { key: 'k', rate: 10, period: '1m', parallel: 2 },
    }

    await queue('/api/v1/test', {}, options)

    expect(provider.publish).toHaveBeenCalledWith(
      expect.objectContaining(options)
    )
  })

  it('lets a failure to publish reach the caller', async () => {
    provider.publish.mockRejectedValue(new Error('queue is down'))

    await expect(queue('/api/v1/test', {})).rejects.toThrow('queue is down')
  })
})

describe('withQueue', () => {
  function deliver(url, init) {
    return withQueue(async () => new Response('ok'))(new Request(url, init))
  }

  const post = { method: 'POST', body: '{}' }

  // @note the shared secret authenticates the platform to itself - the trigger
  // scripts use it - so it has nothing to do with which queue is installed and
  // is checked before one is consulted
  it('accepts the delivery secret without consulting the queue', async () => {
    const response = await deliver(
      'https://api.example.com/api/v1/test?secret=test-secret',
      post
    )

    expect(response.status).toBe(200)
    expect(provider.authenticate).not.toHaveBeenCalled()
  })

  it('accepts any of the configured secrets, so one can be rotated', async () => {
    const response = await deliver(
      'https://api.example.com/api/v1/test?secret=rotating-secret',
      post
    )

    expect(response.status).toBe(200)
  })

  it('refuses a wrong secret without asking the queue', async () => {
    const response = await deliver(
      'https://api.example.com/api/v1/test?secret=nope',
      post
    )

    expect(response.status).toBe(403)
    expect(provider.authenticate).not.toHaveBeenCalled()
  })

  it('asks the queue when no secret is presented', async () => {
    provider.authenticate.mockResolvedValue({ authenticated: true })

    const response = await deliver('https://api.example.com/api/v1/test', post)

    expect(response.status).toBe(200)
    // @note the body is asserted as present rather than by constructor - under
    // jsdom the ArrayBuffer the request yields comes from a different realm
    // than the one this file can name, so `expect.any(ArrayBuffer)` never
    // matches however correct the value is.

    const [delivery] = provider.authenticate.mock.calls[0]

    expect(delivery.request).toBeInstanceOf(Request)
    expect(delivery.body).toBeDefined()
  })

  it('refuses when the queue does not recognise the delivery', async () => {
    provider.authenticate.mockResolvedValue({
      authenticated: false,
      reason: 'no signature was presented',
    })

    const response = await deliver('https://api.example.com/api/v1/test', post)

    expect(response.status).toBe(403)
  })

  // @note the body can only be read once, and it is the thing a signature is
  // computed over - so it is read here and handed to both the check and the
  // handler
  it('still gives the handler a readable body', async () => {
    provider.authenticate.mockResolvedValue({ authenticated: true })

    const handler = jest.fn(async (req) => {
      expect(await req.json()).toEqual({ hello: 'world' })

      return new Response('ok')
    })

    await withQueue(handler)(
      new Request('https://api.example.com/api/v1/test', {
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
      })
    )

    expect(handler).toHaveBeenCalled()
  })
})

/**
 * @jest-environment node
 */
import { lookup } from 'node:dns'

import fetch from '@/lib/fetch'

import {
  EgressError,
  createEgressDispatcher,
  getEgressDispatcher,
  getSelfDeployment,
  guardedLookup,
  isSelfDestination,
} from '@/lib/egress.core'

jest.mock('node:dns', () => ({
  lookup: jest.fn(),
}))

jest.mock('@/config/site', () => ({
  siteUrl: 'https://cbk.example',
  staticUrl: 'https://static.cbk.example',
  widgetUrl: 'https://cbk.example',
  apiUrl: 'https://api.cbk.example',
}))

jest.mock('@/config/origins', () => ({
  appMainOrigin: 'https://apps.cbk.example',
  appLabsOrigin: undefined,
}))

jest.mock('@/lib/env', () => ({
  __esModule: true,
  isDevelopment: false,
}))

describe('guardedLookup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function answer(addresses) {
    lookup.mockImplementation((hostname, options, callback) => {
      callback(null, addresses)
    })
  }

  it('passes public answers through', async () => {
    answer([{ address: '93.184.216.34', family: 4 }])

    const result = await new Promise((resolve, reject) =>
      guardedLookup('example.com', {}, (err, address, family) =>
        err ? reject(err) : resolve({ address, family })
      )
    )

    expect(result).toEqual({ address: '93.184.216.34', family: 4 })
    expect(lookup).toHaveBeenCalledWith(
      'example.com',
      expect.objectContaining({ all: true }),
      expect.any(Function)
    )
  })

  it('returns every address when the caller asked for all', async () => {
    answer([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ])

    const result = await new Promise((resolve, reject) =>
      guardedLookup('example.com', { all: true }, (err, addresses) =>
        err ? reject(err) : resolve(addresses)
      )
    )

    expect(result).toHaveLength(2)
  })

  it('refuses a name that resolves to a private address', async () => {
    answer([{ address: '10.0.0.5', family: 4 }])

    await expect(
      new Promise((resolve, reject) =>
        guardedLookup('internal.attacker.example', {}, (err, address) =>
          err ? reject(err) : resolve(address)
        )
      )
    ).rejects.toBeInstanceOf(EgressError)
  })

  it('refuses a name that mixes a public and a private answer', async () => {
    // @note otherwise the private one is reachable by retrying until the
    // client happens to pick it
    answer([
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ])

    await expect(
      new Promise((resolve, reject) =>
        guardedLookup('rebinding.attacker.example', {}, (err, address) =>
          err ? reject(err) : resolve(address)
        )
      )
    ).rejects.toThrow(/169\.254\.169\.254/)
  })

  it('refuses a name with a mapped-IPv6 private answer', async () => {
    answer([{ address: '::ffff:127.0.0.1', family: 6 }])

    await expect(
      new Promise((resolve, reject) =>
        guardedLookup('mapped.attacker.example', {}, (err, address) =>
          err ? reject(err) : resolve(address)
        )
      )
    ).rejects.toBeInstanceOf(EgressError)
  })

  it('propagates resolver errors', async () => {
    lookup.mockImplementation((hostname, options, callback) => {
      callback(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }))
    })

    await expect(
      new Promise((resolve, reject) =>
        guardedLookup('nope.example', {}, (err, address) =>
          err ? reject(err) : resolve(address)
        )
      )
    ).rejects.toMatchObject({ code: 'ENOTFOUND' })
  })
})

describe('createEgressDispatcher', () => {
  it('refuses literal forbidden addresses before any connection is attempted', async () => {
    const dispatcher = createEgressDispatcher()

    for (const url of [
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/',
      'http://[::ffff:10.0.0.1]/',
      'http://0x7f000001/', // @note the URL parser canonicalises this to 127.0.0.1
      'http://2130706433/', // @note and this
      'http://0177.0.0.1/',
      'http://127.1/',
    ]) {
      const error = await fetch(url, { dispatcher }).then(
        () => null,
        (e) => e
      )

      // @note asserted on the message: undici surfaces the connector's
      // error as `cause`, and under jest's module realm that is a plain
      // Error carrying the EgressError text rather than the instance
      expect({ url, error: String(error?.cause?.message) }).toEqual({
        url,
        error: expect.stringMatching(
          /egress to .* is not allowed: not a public address/
        ),
      })
    }

    await dispatcher.close()
  })

  it('refuses a name that resolves to a forbidden address', async () => {
    lookup.mockImplementation((hostname, options, callback) => {
      callback(null, [{ address: '192.168.0.10', family: 4 }])
    })

    const dispatcher = createEgressDispatcher()

    const error = await fetch('http://intranet.attacker.example/', {
      dispatcher,
    }).then(
      () => null,
      (e) => e
    )

    expect(error).not.toBeNull()
    expect(String(error.cause?.message)).toMatch(
      /egress to intranet\.attacker\.example is not allowed: resolves to 192\.168\.0\.10/
    )

    await dispatcher.close()
  })

  it('refuses a private address reached through an automatic redirect', async () => {
    const guardedDispatcher = createEgressDispatcher()
    const redirectedUrls = []

    // Synthesize only the public response so the test stays offline. Fetch
    // follows the Location itself; later hops use the real guarded dispatcher.
    const dispatcher = {
      dispatch(options, handler) {
        const url = new URL(options.path, options.origin)

        redirectedUrls.push(url.toString())

        if (url.hostname !== 'public.example') {
          return guardedDispatcher.dispatch(options, handler)
        }

        queueMicrotask(() => {
          handler.onConnect(() => {})
          handler.onResponseStarted()
          handler.onHeaders(
            302,
            [
              Buffer.from('location'),
              Buffer.from('http://127.0.0.1/private'),
            ],
            () => {},
            'Found'
          )
          handler.onComplete([])
        })

        return true
      },
    }

    const error = await fetch('http://public.example/start', {
      dispatcher,
    }).then(
      () => null,
      (e) => e
    )

    expect(redirectedUrls).toEqual([
      'http://public.example/start',
      'http://127.0.0.1/private',
    ])
    expect(String(error?.cause?.message)).toMatch(
      /egress to 127\.0\.0\.1 is not allowed: not a public address/
    )

    await guardedDispatcher.close()
  })
})

describe('getSelfDeployment', () => {
  const site = jest.requireMock('@/config/site')

  afterEach(() => {
    site.siteUrl = 'https://cbk.example'
  })

  it('lists every configured origin as host:port', () => {
    const self = getSelfDeployment()

    expect([...self.hosts].sort()).toEqual([
      'api.cbk.example:443',
      'apps.cbk.example:443',
      'cbk.example:443',
      'static.cbk.example:443',
    ])
    expect(self.loopback).toBe(false)
  })

  it('marks a site on a *.localhost name as living on loopback', () => {
    site.siteUrl = 'http://cbk.localhost:31000'

    const self = getSelfDeployment()

    expect(self.hosts).toContain('cbk.localhost:31000')
    expect(self.loopback).toBe(true)
  })
})

describe('isSelfDestination', () => {
  it('matches a configured host on its port only', () => {
    const self = { hosts: new Set(['10.0.0.5:3000']), loopback: false }

    expect(isSelfDestination('10.0.0.5', 3000, self)).toBe(true)
    expect(isSelfDestination('10.0.0.5', 80, self)).toBe(false)
    expect(isSelfDestination('10.0.0.6', 3000, self)).toBe(false)
  })

  it('matches a bracketed IPv6 host either way', () => {
    const self = { hosts: new Set(['::1:31000']), loopback: false }

    expect(isSelfDestination('::1', 31000, self)).toBe(true)
    expect(isSelfDestination('[::1]', 31000, self)).toBe(true)
  })

  it('treats loopback destinations as self only where the site is loopback', () => {
    const local = { hosts: new Set(['cbk.localhost:31000']), loopback: true }
    const hosted = { hosts: new Set(['cbk.example:443']), loopback: false }

    for (const hostname of ['127.0.0.1', '::1', 'localhost', 'cbk-storage.localhost']) {
      expect({ hostname, self: isSelfDestination(hostname, 31900, local) }).toEqual({ hostname, self: true })
      expect({ hostname, self: isSelfDestination(hostname, 31900, hosted) }).toEqual({ hostname, self: false })
    }

    // @note private is not loopback: the rest of the stack's network stays out
    expect(isSelfDestination('172.18.0.5', 31900, local)).toBe(false)
    expect(isSelfDestination('169.254.169.254', 80, local)).toBe(false)
  })
})

describe('createEgressDispatcher for the deployment itself', () => {
  const http = jest.requireActual('node:http')

  let server
  let port

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.end('self')
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

    port = server.address().port
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('connects to a configured host even at a loopback address', async () => {
    const dispatcher = createEgressDispatcher(
      {},
      { hosts: new Set([`127.0.0.1:${port}`]), loopback: false }
    )

    const response = await fetch(`http://127.0.0.1:${port}/`, { dispatcher })

    expect(await response.text()).toBe('self')

    await dispatcher.close()
  })

  it('refuses the same address where it is not a configured host', async () => {
    const dispatcher = createEgressDispatcher(
      {},
      { hosts: new Set(['cbk.example:443']), loopback: false }
    )

    const error = await fetch(`http://127.0.0.1:${port}/`, { dispatcher }).then(
      () => null,
      (e) => e
    )

    expect(String(error?.cause?.message)).toMatch(
      /egress to 127\.0\.0\.1 is not allowed: not a public address/
    )

    await dispatcher.close()
  })

  it('connects to any loopback destination where the site lives on loopback', async () => {
    // @note the Studio case: the site is cbk.localhost, the request arrived
    // on 127.0.0.1 and the platform fetches the URL it built from that
    const dispatcher = createEgressDispatcher(
      {},
      { hosts: new Set(['cbk.localhost:31000']), loopback: true }
    )

    const response = await fetch(`http://127.0.0.1:${port}/`, { dispatcher })

    expect(await response.text()).toBe('self')

    await dispatcher.close()
  })

  it('resolves a *.localhost name through the plain resolver where the site lives on loopback', async () => {
    // @note the store's name inside a Compose network answers with a private
    // address the guarded resolver would refuse
    lookup.mockImplementation((hostname, options, callback) => {
      if (options.all) {
        callback(null, [{ address: '127.0.0.1', family: 4 }])
      } else {
        callback(null, '127.0.0.1', 4)
      }
    })

    const dispatcher = createEgressDispatcher(
      {},
      { hosts: new Set(['cbk.localhost:31000']), loopback: true }
    )

    const response = await fetch(`http://cbk-storage.localhost:${port}/`, {
      dispatcher,
    })

    expect(await response.text()).toBe('self')
    expect(lookup).toHaveBeenCalledWith(
      'cbk-storage.localhost',
      expect.anything(),
      expect.any(Function)
    )

    await dispatcher.close()
  })

  it('still refuses private destinations where the site lives on loopback', async () => {
    lookup.mockImplementation((hostname, options, callback) => {
      callback(null, [{ address: '172.18.0.5', family: 4 }])
    })

    const dispatcher = createEgressDispatcher(
      {},
      { hosts: new Set(['cbk.localhost:31000']), loopback: true }
    )

    const literal = await fetch('http://169.254.169.254/latest/meta-data/', {
      dispatcher,
    }).then(
      () => null,
      (e) => e
    )
    const named = await fetch('http://intranet.attacker.example/', {
      dispatcher,
    }).then(
      () => null,
      (e) => e
    )

    expect(String(literal?.cause?.message)).toMatch(
      /egress to 169\.254\.169\.254 is not allowed: not a public address/
    )
    expect(String(named?.cause?.message)).toMatch(
      /resolves to 172\.18\.0\.5, which is not a public address/
    )

    await dispatcher.close()
  })
})

describe('getEgressDispatcher', () => {
  const env = jest.requireMock('@/lib/env')

  afterEach(() => {
    env.isDevelopment = false
  })

  it('returns one dispatcher for the process outside development', () => {
    const a = getEgressDispatcher()
    const b = getEgressDispatcher()

    expect(a).toBeDefined()
    expect(b).toBe(a)
  })

  it('returns nothing in development, where the application lives on localhost', () => {
    env.isDevelopment = true

    expect(getEgressDispatcher()).toBeUndefined()
  })
})

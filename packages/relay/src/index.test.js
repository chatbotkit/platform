import { assertConfigured, channelUrl, listen, resetEnv } from './index'

// @note two states are worth testing: unset, where refusing legibly is the
// whole job (a deployment with no relay is a normal state; one that fails
// without naming what to set is a support ticket), and set, where the address
// has to match the route the shipped server answers on.

const ORIGINAL_RELAY_URL = process.env.RELAY_URL

function withRelayUrl(value) {
  if (value === undefined) {
    delete process.env.RELAY_URL
  } else {
    process.env.RELAY_URL = value
  }

  resetEnv()
}

afterEach(() => {
  withRelayUrl(ORIGINAL_RELAY_URL)
})

describe('channelUrl', () => {
  describe('without RELAY_URL', () => {
    beforeEach(() => {
      withRelayUrl(undefined)
    })

    it('refuses with NOT_CONFIGURED', () => {
      expect(() => channelUrl('channel-1', 'client')).toThrow(
        expect.objectContaining({ relay: true, code: 'NOT_CONFIGURED' })
      )
    })

    it('names the variable and the contract rather than a package to install', () => {
      let error

      try {
        channelUrl('channel-1', 'client')
      } catch (thrown) {
        error = thrown
      }

      expect(error.message).toMatch(/RELAY_URL/)
      expect(error.message).toMatch(
        /@chatbotkit-dev\/relay.*RelayProvider.*@chatbotkit-dev\/relay-spec/
      )
    })

    it('says which channel and side it could not address', () => {
      expect(() => channelUrl('channel-1', 'runner')).toThrow(
        expect.objectContaining({
          detail: expect.stringContaining('channel-1'),
        })
      )
    })

    // @note the brand is what the platform detects errors with - structurally,
    // never `instanceof` - so a missing one is silently a different failure path
    it('brands the error so the platform recognises it', () => {
      let error

      try {
        channelUrl('c', 's')
      } catch (thrown) {
        error = thrown
      }

      expect(error).toBeInstanceOf(Error)
      expect(error.relay).toBe(true)
      expect(typeof error.code).toBe('string')
    })
  })

  describe('with RELAY_URL', () => {
    it('builds the channel route with the side', () => {
      withRelayUrl('http://localhost:3001')

      expect(channelUrl('realtime-abc-def', 'client')).toBe(
        'ws://localhost:3001/channel/realtime-abc-def?side=client'
      )
    })

    it('derives wss from https', () => {
      withRelayUrl('https://relay.example.com')

      expect(channelUrl('realtime-abc-def', 'runner')).toBe(
        'wss://relay.example.com/channel/realtime-abc-def?side=runner'
      )
    })

    it('accepts a websocket origin as given', () => {
      withRelayUrl('ws://relay:3001')

      expect(channelUrl('realtime-abc-def', 'runner')).toBe(
        'ws://relay:3001/channel/realtime-abc-def?side=runner'
      )
    })

    it('subscribes a side to lifecycle events on request', () => {
      withRelayUrl('http://localhost:3001')

      expect(channelUrl('realtime-abc-def', 'client', { events: true })).toBe(
        'ws://localhost:3001/channel/realtime-abc-def?side=client&events=1'
      )
    })

    it('refuses an origin that yields no websocket address', () => {
      withRelayUrl('ftp://relay.example.com')

      expect(() => channelUrl('channel-1', 'client')).toThrow(
        expect.objectContaining({ relay: true, code: 'NOT_CONFIGURED' })
      )
    })

    it('refuses a value that is not a URL', () => {
      withRelayUrl('localhost:3001')

      expect(() => channelUrl('channel-1', 'client')).toThrow(
        expect.objectContaining({ relay: true, code: 'NOT_CONFIGURED' })
      )
    })
  })
})

describe('assertConfigured', () => {
  it('fails the deployment readiness check when unset', async () => {
    withRelayUrl(undefined)

    await expect(assertConfigured()).rejects.toThrow(/RELAY_URL/)
  })

  it('resolves when set', async () => {
    withRelayUrl('http://localhost:3001')

    await expect(assertConfigured()).resolves.toBeUndefined()
  })
})

describe('listen', () => {
  const ORIGINAL_RELAY_PORT = process.env.RELAY_PORT

  afterEach(() => {
    if (ORIGINAL_RELAY_PORT === undefined) {
      delete process.env.RELAY_PORT
    } else {
      process.env.RELAY_PORT = ORIGINAL_RELAY_PORT
    }
  })

  it('does nothing without RELAY_PORT', async () => {
    delete process.env.RELAY_PORT

    await expect(listen()).resolves.toBeUndefined()
  })

  it('refuses a value that is not a port', async () => {
    process.env.RELAY_PORT = 'three'

    await expect(listen()).rejects.toThrow(/RELAY_PORT/)
  })
})

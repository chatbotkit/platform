import { assertConfigured, channelUrl } from './index'

// @note this default refuses, so what is worth testing is that it refuses
// legibly. A deployment with no relay is a normal state; one that fails without
// naming what satisfies the contract is a support ticket.

describe('channelUrl', () => {
  it('refuses with NOT_CONFIGURED', () => {
    expect(() => channelUrl('channel-1', 'client')).toThrow(
      expect.objectContaining({ relay: true, code: 'NOT_CONFIGURED' })
    )
  })

  it('names the contract rather than a package to install', () => {
    let error

    try {
      channelUrl('channel-1', 'client')
    } catch (thrown) {
      error = thrown
    }

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

describe('assertConfigured', () => {
  it('fails the deployment readiness check', async () => {
    await expect(assertConfigured()).rejects.toThrow(/RelayProvider/)
  })
})

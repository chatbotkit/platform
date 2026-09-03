/**
 * @jest-environment node
 */
import { checkAuthRate } from '@/lib/auth.rate'
import {
  getContextRequestHost,
  getContextRequestIpAddress,
} from '@/lib/context.store'
import { getPortalAuthProviders } from '@/lib/portal.auth'
import { isPortalHostname } from '@/lib/portal.hostname'

import { checkSigninRate, getDispatchHost, getProviders } from './[...nextauth]'

jest.mock('next-auth/next', () => ({ default: jest.fn() }))
jest.mock('@/lib/auth.adapter', () => ({ __esModule: true, default: {} }))
jest.mock('@/lib/auth.callbacks', () => ({ __esModule: true, default: {} }))
jest.mock('@/lib/auth.options', () => ({ __esModule: true, default: {} }))
jest.mock('@/lib/auth.providers', () => ({ __esModule: true, default: [] }))
jest.mock('@/lib/context.store', () => ({
  getContextFrontendHost: jest.fn(),
  getContextNextApiRequest: jest.fn(),
  getContextNextApiResponse: jest.fn(),
  getContextRequestHost: jest.fn(),
  getContextRequestIpAddress: jest.fn(),
}))
jest.mock('@/lib/method', () => ({ withAny: (fn) => fn }))
jest.mock('@/lib/partner.auth', () => ({}))
jest.mock('@/lib/partner.helpers', () => ({ isPartnerHost: () => false }))
jest.mock('@/lib/portal.auth', () => ({ getPortalAuthProviders: jest.fn() }))
jest.mock('@/lib/portal.hostname', () => ({ isPortalHostname: jest.fn(() => false) }))

jest.mock('@/lib/auth.rate', () => {
  const actual = jest.requireActual('@/lib/auth.rate')

  return {
    ...actual,
    checkAuthRate: jest.fn(),
  }
})

describe('NextAuth sign-in abuse controls', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    checkAuthRate.mockResolvedValue(true)
    getContextRequestIpAddress.mockReturnValue('203.0.113.7')
  })

  it('throttles code issuance per address and per email', async () => {
    await checkSigninRate({
      method: 'POST',
      query: { nextauth: ['signin', 'email'] },
      body: { email: 'victim@example.com' },
      headers: {
        'x-real-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.9',
      },
    })

    expect(checkAuthRate).toHaveBeenCalledWith('signin-email-issue', [
      expect.objectContaining({ identity: '203.0.113.7' }),
      expect.objectContaining({ identity: 'victim@example.com' }),
    ])
  })

  it('throttles code verification per address and per email', async () => {
    await checkSigninRate({
      method: 'GET',
      query: {
        nextauth: ['callback', 'email'],
        email: 'victim@example.com',
        token: 'abc123',
      },
      headers: {
        'x-real-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.9',
      },
    })

    expect(checkAuthRate).toHaveBeenCalledWith('signin-email-verify', [
      expect.objectContaining({ identity: '203.0.113.7' }),
      expect.objectContaining({ identity: 'victim@example.com' }),
    ])
  })

  it('keys the per-email budget on the normalized identifier', async () => {
    for (const email of ['Victim@Example.com', 'victim@example.com,2']) {
      await checkSigninRate({
        method: 'GET',
        query: { nextauth: ['callback', 'email'], email, token: 'abc123' },
        headers: {},
      })
    }

    for (const call of checkAuthRate.mock.calls) {
      expect(call[1][1]).toEqual(
        expect.objectContaining({ identity: 'victim@example.com' })
      )
    }
  })

  it('skips the per-email budget for an identifier next-auth rejects', async () => {
    await checkSigninRate({
      method: 'POST',
      query: { nextauth: ['signin', 'email'] },
      body: { email: 'not-an-email' },
      headers: {},
    })

    expect(checkAuthRate).toHaveBeenCalledWith('signin-email-issue', [
      expect.objectContaining({ identity: '203.0.113.7' }),
      expect.objectContaining({ identity: null }),
    ])
  })

  it('reports denial from the limiter', async () => {
    checkAuthRate.mockResolvedValue(false)

    await expect(
      checkSigninRate({
        method: 'GET',
        query: { nextauth: ['callback', 'email'], email: 'v@example.com' },
        headers: {},
      })
    ).resolves.toBe(false)
  })

  it('leaves session, csrf and provider reads alone', async () => {
    for (const nextauth of [
      ['session'],
      ['csrf'],
      ['providers'],
      ['callback', 'google'],
    ]) {
      await expect(
        checkSigninRate({ method: 'GET', query: { nextauth }, headers: {} })
      ).resolves.toBe(true)
    }

    expect(checkAuthRate).not.toHaveBeenCalled()
  })

  it('does not count a GET of the sign-in page as issuance', async () => {
    await checkSigninRate({
      method: 'GET',
      query: { nextauth: ['signin', 'email'] },
      headers: {},
    })

    expect(checkAuthRate).not.toHaveBeenCalled()
  })
})

describe('auth surface dispatch host', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('dispatches on the serving Host header', () => {
    // @note behind the portal gateway the asserted frontend host is the
    // customer's domain; only the Host header names the portal host the
    // dispatch tables recognise

    getContextRequestHost.mockReturnValue('zelektro.glimps.group')

    const host = getDispatchHost({
      headers: { host: 'zelektro-glimps-group.chatbotkit.agency' },
    })

    expect(host).toBe('zelektro-glimps-group.chatbotkit.agency')
  })

  it('falls back to the context request host without a Host header', () => {
    getContextRequestHost.mockReturnValue('fallback.example.com')

    expect(getDispatchHost({ headers: {} })).toBe('fallback.example.com')
  })

  it('serves portal providers for a portal host', async () => {
    const portalProviders = [{ id: 'email' }]

    isPortalHostname.mockImplementation(
      (host) => host === 'zelektro-glimps-group.chatbotkit.agency'
    )
    getPortalAuthProviders.mockResolvedValue(portalProviders)

    await expect(
      getProviders('zelektro-glimps-group.chatbotkit.agency')
    ).resolves.toBe(portalProviders)

    expect(getPortalAuthProviders).toHaveBeenCalledWith(
      'zelektro-glimps-group.chatbotkit.agency'
    )
  })

  it('serves the platform providers for an unrecognised host', async () => {
    await expect(getProviders('zelektro.glimps.group')).resolves.toEqual([])

    expect(getPortalAuthProviders).not.toHaveBeenCalled()
  })
})

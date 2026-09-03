/**
 * @jest-environment node
 */
import {
  executeInContext,
  setContextRequestIpAddress,
} from '@/lib/context.store'
import { slidingWindow } from '@/lib/ratelimit'

import {
  OAUTH_TOKEN_PER_CLIENT,
  OAUTH_TOKEN_PER_IP,
  SIGNIN_EMAIL_VERIFY_PER_EMAIL,
  checkAuthRate,
  getClientAddress,
  normalizeSigninEmail,
} from './auth.rate'

jest.mock('@/lib/env', () => ({
  isDevelopment: false,
}))

jest.mock('@/lib/ratelimit', () => ({
  slidingWindow: jest.fn(),
}))

describe('auth.rate', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    slidingWindow.mockResolvedValue({ success: true })
  })

  describe('getClientAddress', () => {
    it('prefers the verified client address from context', async () => {
      await executeInContext(async () => {
        setContextRequestIpAddress('192.0.2.25')

        expect(
          getClientAddress({ headers: { 'x-real-ip': '203.0.113.7' } })
        ).toBe('192.0.2.25')
      })
    })

    it('does not trust client address headers outside the request context', () => {
      expect(
        getClientAddress({
          headers: {
            'x-real-ip': '203.0.113.7',
            'x-forwarded-for': '10.0.0.1',
          },
          socket: { remoteAddress: '198.51.100.9' },
        })
      ).toBe('198.51.100.9')

      expect(
        getClientAddress({
          headers: { 'x-forwarded-for': '198.51.100.9' },
        })
      ).toBe('unknown')
    })

    it('falls back to the socket address, then unknown', () => {
      expect(
        getClientAddress({ headers: {}, socket: { remoteAddress: '::1' } })
      ).toBe('::1')

      expect(getClientAddress({ headers: {} })).toBe('unknown')
    })
  })

  describe('normalizeSigninEmail', () => {
    it('folds every variant next-auth delivers to one inbox onto one key', () => {
      for (const variant of [
        'victim@example.com',
        '  Victim@Example.COM ',
        'victim@example.com,1',
        'victim@example.com,anything,else',
      ]) {
        expect(normalizeSigninEmail(variant)).toBe('victim@example.com')
      }
    })

    it('returns null for anything next-auth would reject', () => {
      for (const bad of [
        undefined,
        null,
        42,
        '',
        'no-at-sign',
        'two@at@signs.com',
        'quoted"@example.com',
        '@example.com',
        'victim@',
        'victim@localhost',
      ]) {
        expect(normalizeSigninEmail(bad)).toBeNull()
      }
    })
  })

  describe('checkAuthRate', () => {
    it('consumes one token per identity under the scope', async () => {
      const allowed = await checkAuthRate('oauth-token', [
        { identity: '203.0.113.7', limit: OAUTH_TOKEN_PER_IP },
        { identity: 'Client-A', limit: OAUTH_TOKEN_PER_CLIENT },
      ])

      expect(allowed).toBe(true)
      expect(slidingWindow).toHaveBeenCalledTimes(2)
      expect(slidingWindow).toHaveBeenCalledWith(
        'auth-rate:oauth-token:203.0.113.7',
        OAUTH_TOKEN_PER_IP.tokens,
        OAUTH_TOKEN_PER_IP.window
      )
      expect(slidingWindow).toHaveBeenCalledWith(
        'auth-rate:oauth-token:client-a',
        OAUTH_TOKEN_PER_CLIENT.tokens,
        OAUTH_TOKEN_PER_CLIENT.window
      )
    })

    it('skips missing identities instead of counting them', async () => {
      await checkAuthRate('signin-email-verify', [
        { identity: '203.0.113.7', limit: OAUTH_TOKEN_PER_IP },
        { identity: null, limit: SIGNIN_EMAIL_VERIFY_PER_EMAIL },
        { identity: undefined, limit: SIGNIN_EMAIL_VERIFY_PER_EMAIL },
      ])

      expect(slidingWindow).toHaveBeenCalledTimes(1)
    })

    it('denies when any identity is over its limit', async () => {
      slidingWindow
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false })

      const allowed = await checkAuthRate('signin-email-verify', [
        { identity: '203.0.113.7', limit: OAUTH_TOKEN_PER_IP },
        {
          identity: 'victim@example.com',
          limit: SIGNIN_EMAIL_VERIFY_PER_EMAIL,
        },
      ])

      expect(allowed).toBe(false)
    })

    it('still charges every identity when an earlier one is denied', async () => {
      // @note otherwise an attacker who is already over the per-address limit
      // could probe a target email without the per-email counter moving
      slidingWindow
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({ success: true })

      await checkAuthRate('signin-email-verify', [
        { identity: '203.0.113.7', limit: OAUTH_TOKEN_PER_IP },
        {
          identity: 'victim@example.com',
          limit: SIGNIN_EMAIL_VERIFY_PER_EMAIL,
        },
      ])

      expect(slidingWindow).toHaveBeenCalledTimes(2)
    })
  })
})

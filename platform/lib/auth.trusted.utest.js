/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { TRUSTED_SIGNIN_PROVIDER_ID } from '@/lib/auth.trusted.consts'

import { randomUUID } from 'node:crypto'

const GATE_KEYS = [
  'NEXTAUTH_TRUSTED_SIGNIN',
  'TARGET_ENV',
  'NEXTAUTH_GOOGLE_APP_ID',
  'NEXTAUTH_AZURE_AD_CLIENT_ID',
  'NEXTAUTH_GITHUB_APP_ID',
  'LIMITS_CONFIG',
]

// @note the gate memoises its parse, so every case runs against a fresh copy
// of the module under its own environment

function withEnv(env, fn) {
  let result

  jest.isolateModules(() => {
    const previous = {}

    for (const key of GATE_KEYS) {
      previous[key] = process.env[key]

      if (env[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = env[key]
      }
    }

    try {
      result = fn(require('./auth.trusted'))
    } finally {
      for (const key of GATE_KEYS) {
        if (previous[key] === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = previous[key]
        }
      }
    }
  })

  return result
}

function enabled(env) {
  return withEnv(env, (mod) => mod.isTrustedSigninEnabled())
}

describe('auth.trusted', () => {
  describe('isTrustedSigninEnabled', () => {
    it('is off when the variable is unset', () => {
      expect(enabled({})).toBe(false)
    })

    it('is off when the variable is empty', () => {
      expect(enabled({ NEXTAUTH_TRUSTED_SIGNIN: '' })).toBe(false)
    })

    it('is on only for the literal true', () => {
      expect(enabled({ NEXTAUTH_TRUSTED_SIGNIN: 'true' })).toBe(true)
    })

    it.each(['1', 'yes', 'TRUE', 'on', 'false'])(
      'refuses the value %j',
      (value) => {
        expect(() => enabled({ NEXTAUTH_TRUSTED_SIGNIN: value })).toThrow()
      }
    )

    it.each(['production', 'staging'])(
      'refuses to enable with TARGET_ENV=%s',
      (targetEnv) => {
        expect(() =>
          enabled({ NEXTAUTH_TRUSTED_SIGNIN: 'true', TARGET_ENV: targetEnv })
        ).toThrow(/must not be set when TARGET_ENV/)
      }
    )

    it.each([
      'NEXTAUTH_GOOGLE_APP_ID',
      'NEXTAUTH_AZURE_AD_CLIENT_ID',
      'NEXTAUTH_GITHUB_APP_ID',
      'LIMITS_CONFIG',
    ])('refuses to enable alongside %s', (key) => {
      expect(() =>
        enabled({ NEXTAUTH_TRUSTED_SIGNIN: 'true', [key]: 'x' })
      ).toThrow(new RegExp(`must not be set alongside ${key}`))
    })

    it('names every shared-deployment key it found', () => {
      expect(() =>
        enabled({
          NEXTAUTH_TRUSTED_SIGNIN: 'true',
          NEXTAUTH_GOOGLE_APP_ID: 'x',
          LIMITS_CONFIG: '{}',
        })
      ).toThrow(/NEXTAUTH_GOOGLE_APP_ID, LIMITS_CONFIG/)
    })

    it('stays off alongside a hosted TARGET_ENV and shared keys when unset', () => {
      expect(
        enabled({ TARGET_ENV: 'production', NEXTAUTH_GOOGLE_APP_ID: 'x' })
      ).toBe(false)
    })

    it('enables alongside a development TARGET_ENV', () => {
      expect(
        enabled({ NEXTAUTH_TRUSTED_SIGNIN: 'true', TARGET_ENV: 'development' })
      ).toBe(true)
    })
  })

  describe('assertTrustedSigninEnv', () => {
    it('passes silently when unset', () => {
      expect(() =>
        withEnv({}, (mod) => mod.assertTrustedSigninEnv())
      ).not.toThrow()
    })

    it('throws a named error at boot for a hosted environment', () => {
      expect(() =>
        withEnv(
          { NEXTAUTH_TRUSTED_SIGNIN: 'true', TARGET_ENV: 'production' },
          (mod) => mod.assertTrustedSigninEnv()
        )
      ).toThrow(/NEXTAUTH_TRUSTED_SIGNIN/)
    })
  })

  describe('getTrustedProviders', () => {
    it('contributes nothing when off', () => {
      expect(withEnv({}, (mod) => mod.getTrustedProviders())).toEqual([])
    })

    it('contributes an email-type provider using the browser token when on', async () => {
      const { providers, context } = withEnv(
        { NEXTAUTH_TRUSTED_SIGNIN: 'true' },
        (mod) => ({
          providers: mod.getTrustedProviders(),
          context: require('./context.store'),
        })
      )
      const [provider, ...rest] = providers

      // @note next-auth keeps the overrides under `options` and merges them
      // over the defaults when the handler initialises
      const merged = { ...provider, ...provider.options }

      expect(rest).toEqual([])
      expect(merged.id).toBe(TRUSTED_SIGNIN_PROVIDER_ID)
      expect(merged.type).toBe('email')

      const token = randomUUID()

      await context.executeInContext(async () => {
        context.setContextNextApiRequest({ body: { trustedToken: token } })
        await expect(merged.generateVerificationToken()).resolves.toBe(token)
      })

      await expect(merged.generateVerificationToken()).rejects.toThrow()

      await expect(
        merged.sendVerificationRequest({
          identifier: 'alice@example.com',
          url: 'http://localhost/x',
          token,
        })
      ).resolves.toBeUndefined()
    })
  })
})

/**
 * @jest-environment node
 */
import { UserAuthError } from '@/lib/error'
import { tryVerify } from '@/lib/jwt'
import { getSecretManager } from '@/lib/secret.manager'
import { getSecretValueAndType } from '@/lib/secret.value'

import { mintSecret } from './secret.mint'

jest.mock('@/lib/scope.server', () => ({}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: () => ({ log: () => {} }),
}))

jest.mock('@/prisma/types', () => ({
  __esModule: true,
  SecretType: {
    plain: 'plain',
    basic: 'basic',
    bearer: 'bearer',
    jwt: 'jwt',
    oauth: 'oauth',
    template: 'template',
    reference: 'reference',
  },
  SecretKind: {
    shared: 'shared',
    personal: 'personal',
  },
}))

jest.mock('@/lib/error', () => {
  class UserAuthError extends Error {}

  return { __esModule: true, UserAuthError }
})

jest.mock('@/lib/jwt', () => ({ __esModule: true, tryVerify: jest.fn() }))

jest.mock('@/lib/secret.value', () => ({
  __esModule: true,
  getSecretValueAndType: jest.fn(),
}))

// @note @/lib/secret.authorize is deliberately NOT mocked - the real
// authorizationRequiredResponse / getSecretAuthorizationUrl run so the authorize
// url genuinely comes from the resolved secret manager.
jest.mock('@/lib/secret.manager', () => ({
  __esModule: true,
  getSecretManager: jest.fn(),
}))

const AUTH_URL = 'https://chatbotkit.com/secrets/secret-1/manager/authenticate'

const secret = { id: 'secret-1', kind: 'shared', type: 'oauth' }

beforeEach(() => {
  jest.clearAllMocks()

  // by default tokens are not Pipedream-brokered
  tryVerify.mockResolvedValue(null)

  // the (real) authorize machinery asks the resolved manager for the url
  getSecretManager.mockReturnValue({
    getAuthUrl: jest.fn().mockResolvedValue(new URL(AUTH_URL)),
  })
})

describe('mintSecret', () => {
  it('mints an oauth token with scheme, header and expiry', async () => {
    getSecretValueAndType.mockResolvedValue({
      value: 'Bearer ya29.abc',
      type: 'bearer',
      baseType: 'oauth',
      expiresAt: 1782950400000,
    })

    const res = await mintSecret(secret)

    expect(res.status).toBe(200)
    // returns the token and its expiry only - no secret metadata, scheme or header
    await expect(res.json()).resolves.toEqual({
      token: 'ya29.abc',
      expiresAt: 1782950400000,
    })
  })

  it('mints a jwt token', async () => {
    getSecretValueAndType.mockResolvedValue({
      value: 'Bearer signed.jwt.here',
      type: 'bearer',
      baseType: 'jwt',
      expiresAt: 123,
    })

    const res = await mintSecret(secret)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      token: 'signed.jwt.here',
      expiresAt: 123,
    })
  })

  it.each(['bearer', 'basic', 'plain'])(
    'refuses to mint a static %s secret (use the proxy)',
    async (baseType) => {
      getSecretValueAndType.mockResolvedValue({
        value: 'Token abc',
        type: baseType,
        baseType,
      })

      const res = await mintSecret(secret)

      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toMatchObject({
        error: 'not_mintable',
      })
    }
  )

  it('refuses to mint a platform (Pipedream-brokered) secret', async () => {
    getSecretValueAndType.mockResolvedValue({
      value: 'Bearer cbk.signed.jwt',
      type: 'bearer',
      baseType: 'oauth',
    })

    // the resolved token is an inert CBK-signed Pipedream token
    tryVerify.mockResolvedValue({ type: 'pipedream_access_token' })

    const res = await mintSecret(secret)

    expect(res.status).toBe(409)

    const body = await res.json()

    expect(body.error).toBe('not_mintable')
    expect(body.message).toMatch(/platform/i)
  })

  it('returns authorization_required with the authorize url when the secret is unauthenticated', async () => {
    getSecretValueAndType.mockRejectedValue(new UserAuthError('no value'))

    const res = await mintSecret(
      { ...secret, kind: 'personal' },
      { contact: { id: 'contact-1' } }
    )

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({
      error: 'authorization_required',
      url: AUTH_URL,
    })
  })

  it('refuses to mint a shared secret in a contact context (no shared-token leak)', async () => {
    const res = await mintSecret(secret, { contact: { id: 'contact-1' } })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({ error: 'not_mintable' })

    // the guard must short-circuit before any value is resolved, so a shared
    // token is never even read in a contact context
    expect(getSecretValueAndType).not.toHaveBeenCalled()
  })

  it('returns authorization_required when the secret resolves to no value', async () => {
    getSecretValueAndType.mockResolvedValue(null)

    const res = await mintSecret(secret)

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({
      error: 'authorization_required',
    })
  })

  it('rethrows non-auth errors', async () => {
    getSecretValueAndType.mockRejectedValue(new Error('boom'))

    await expect(mintSecret(secret)).rejects.toThrow('boom')
  })
})

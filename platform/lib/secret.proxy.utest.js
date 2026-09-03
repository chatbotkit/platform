/**
 * @jest-environment node
 */
import { UserAuthError } from '@/lib/error'
import { getSecretManager } from '@/lib/secret.manager'
import { swapSecrets } from '@/lib/secret.value'

import call from '@/lib/call'

import { executeSecretProxy, isAllowedEgressUrl } from './secret.proxy'

jest.mock('@/lib/scope.server', () => ({}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: () => ({ log: () => {} }),
}))

jest.mock('@/lib/error', () => {
  class UserAuthError extends Error {}

  return { __esModule: true, UserAuthError }
})

jest.mock('@/lib/call', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/secret.value', () => ({
  __esModule: true,
  swapSecrets: jest.fn(),
}))

jest.mock('@/lib/secret.manager', () => ({
  __esModule: true,
  getSecretManager: jest.fn(),
}))

jest.mock('@/prisma/types', () => ({
  __esModule: true,
  SecretKind: {
    shared: 'shared',
    personal: 'personal',
  },
}))

const secret = { id: 'secret-1', userId: 'user-1' }

function upstream(body, init) {
  return new Response(body, init)
}

beforeEach(() => {
  jest.clearAllMocks()

  // by default swapSecrets echoes the headers it was given
  swapSecrets.mockImplementation(async (headers) => headers)

  call.mockResolvedValue(upstream('ok', { status: 200 }))
})

describe('isAllowedEgressUrl', () => {
  describe('allows public destinations', () => {
    it.each([
      'https://api.example.com',
      'http://example.com/path?q=1',
      'https://sub.example.co.uk',
      'https://172.15.0.1', // just below the private range
      'https://172.32.0.1', // just above the private range
      'https://8.8.8.8',
      'https://[2606:4700:4700::1111]', // public IPv6
    ])('%s', (url) => {
      expect(isAllowedEgressUrl(url)).toBe(true)
    })
  })

  describe('blocks loopback / private / link-local / metadata', () => {
    it.each([
      'http://localhost',
      'https://localhost:3000',
      'http://foo.localhost',
      'http://service.internal',
      'http://db.local',
      'http://127.0.0.1',
      'http://127.5.5.5',
      'http://0.0.0.0',
      'http://10.0.0.5',
      'http://192.168.1.1',
      'http://172.16.0.1',
      'http://172.31.255.255',
      'http://169.254.169.254', // cloud metadata
      'http://[::1]', // IPv6 loopback (brackets)
      'http://[fe80::1]', // IPv6 link-local
      'http://[fd00::1]', // IPv6 unique-local
    ])('%s', (url) => {
      expect(isAllowedEgressUrl(url)).toBe(false)
    })
  })

  // @note drift guards for the SSRF-allowlist bypass: encoded / alternate IP
  // literals the platform resolver still expands to an internal address but
  // which a purely textual hostname check misses
  describe('blocks encoded / alternate IP literals (SSRF bypass guards)', () => {
    it.each([
      'http://2130706433', // bare-decimal -> 127.0.0.1
      'http://0x7f000001', // hex -> 127.0.0.1
      'http://0177.0.0.1', // octal / leading-zero -> 127.0.0.1
      'http://127.1', // short-form -> 127.0.0.1
      'http://[::ffff:169.254.169.254]', // IPv4-mapped IPv6 -> cloud metadata
      'http://[::ffff:7f00:1]', // IPv4-mapped IPv6 -> loopback
    ])('%s', (url) => {
      expect(isAllowedEgressUrl(url)).toBe(false)
    })
  })

  describe('blocks non-http(s) schemes and garbage', () => {
    it.each([
      'ftp://example.com',
      'file:///etc/passwd',
      'gopher://example.com',
      'not a url',
      '',
    ])('%s', (url) => {
      expect(isAllowedEgressUrl(url)).toBe(false)
    })
  })
})

describe('executeSecretProxy', () => {
  it('rejects a disallowed destination with 400 and never calls out', async () => {
    const res = await executeSecretProxy('user-1', secret, {
      url: 'http://169.254.169.254/latest/meta-data',
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: 'invalid_destination',
    })
    expect(swapSecrets).not.toHaveBeenCalled()
    expect(call).not.toHaveBeenCalled()
  })

  it('injects the linked secret and performs the call', async () => {
    call.mockResolvedValue(upstream('hello', { status: 201 }))

    const res = await executeSecretProxy('user-1', secret, {
      method: 'POST',
      url: 'https://api.example.com/things',
      body: '{"a":1}',
    })

    expect(swapSecrets).toHaveBeenCalledTimes(1)

    const [, optionsArg] = swapSecrets.mock.calls[0]

    expect(optionsArg).toMatchObject({
      userId: 'user-1',
      secretId: 'secret-1',
      abilityId: null,
    })

    expect(call).toHaveBeenCalledTimes(1)

    const [urlArg, callOptions] = call.mock.calls[0]

    expect(urlArg).toBe('https://api.example.com/things')
    expect(callOptions.method).toBe('POST')
    expect(callOptions.body).toBe('{"a":1}')

    expect(res.status).toBe(201)
    await expect(res.text()).resolves.toBe('hello')
  })

  it('disables redirect following on the egress call (SSRF hardening)', async () => {
    await executeSecretProxy('user-1', secret, {
      url: 'https://api.example.com',
    })

    const [, callOptions] = call.mock.calls[0]

    expect(callOptions.redirect).toBe('manual')
  })

  it('blocks an upstream redirect (opaque) with 502 redirect_blocked', async () => {
    // undici returns an opaque-redirect (status 0) under redirect: 'manual'
    call.mockResolvedValue({
      status: 0,
      type: 'opaqueredirect',
      headers: new Headers(),
    })

    const res = await executeSecretProxy('user-1', secret, {
      url: 'https://api.example.com',
    })

    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toMatchObject({
      error: 'redirect_blocked',
    })
  })

  it('auto-injects ${SECRET_DEFAULT} into Authorization when absent', async () => {
    await executeSecretProxy('user-1', secret, {
      url: 'https://api.example.com',
    })

    const [headersArg] = swapSecrets.mock.calls[0]

    expect(headersArg.get('authorization')).toBe('${SECRET_DEFAULT}')
  })

  it('does not auto-inject when a header already references a secret', async () => {
    await executeSecretProxy('user-1', secret, {
      url: 'https://api.example.com',
      headers: { 'X-Api-Key': '${SECRET_DEFAULT}' },
    })

    const [headersArg] = swapSecrets.mock.calls[0]

    expect(headersArg.has('authorization')).toBe(false)
    expect(headersArg.get('x-api-key')).toBe('${SECRET_DEFAULT}')
  })

  it('does not override an explicit Authorization header', async () => {
    await executeSecretProxy('user-1', secret, {
      url: 'https://api.example.com',
      headers: { Authorization: 'Bearer literal' },
    })

    const [headersArg] = swapSecrets.mock.calls[0]

    expect(headersArg.get('authorization')).toBe('Bearer literal')
  })

  it('never echoes Authorization or hop-by-hop headers in the response', async () => {
    call.mockResolvedValue(
      upstream('body', {
        status: 200,
        headers: {
          authorization: 'super-secret',
          'content-encoding': 'gzip',
          'transfer-encoding': 'chunked',
          'x-safe': 'keep-me',
        },
      })
    )

    const res = await executeSecretProxy('user-1', secret, {
      url: 'https://api.example.com',
    })

    expect(res.headers.get('authorization')).toBeNull()
    expect(res.headers.get('content-encoding')).toBeNull()
    expect(res.headers.get('transfer-encoding')).toBeNull()
    expect(res.headers.get('x-safe')).toBe('keep-me')
  })

  it('passes the contact through to swapSecrets', async () => {
    const contact = { id: 'contact-1' }

    await executeSecretProxy(
      'user-1',
      { ...secret, kind: 'personal' },
      { url: 'https://api.example.com' },
      { contact }
    )

    const [, optionsArg] = swapSecrets.mock.calls[0]

    expect(optionsArg.contact).toBe(contact)
  })

  it('refuses a shared secret in a contact context (no contact-scoped shared use)', async () => {
    const res = await executeSecretProxy(
      'user-1',
      { ...secret, kind: 'shared' },
      { url: 'https://api.example.com' },
      { contact: { id: 'contact-1' } }
    )

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({
      error: 'forbidden_secret_kind',
    })

    // the guard short-circuits before any egress - the shared credential is
    // never injected or sent
    expect(swapSecrets).not.toHaveBeenCalled()
    expect(call).not.toHaveBeenCalled()
  })

  describe('unauthenticated secret', () => {
    it('returns 409 authorization_required with the authorize url', async () => {
      swapSecrets.mockRejectedValue(new UserAuthError('no value'))

      getSecretManager.mockReturnValue({
        getAuthUrl: jest
          .fn()
          .mockResolvedValue(
            new URL(
              'https://chatbotkit.com/secrets/secret-1/manager/authenticate'
            )
          ),
      })

      const res = await executeSecretProxy('user-1', secret, {
        url: 'https://api.example.com',
      })

      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toMatchObject({
        error: 'authorization_required',
        url: 'https://chatbotkit.com/secrets/secret-1/manager/authenticate',
      })
      expect(call).not.toHaveBeenCalled()
    })

    it('returns 409 without a url when the secret cannot be authenticated here', async () => {
      swapSecrets.mockRejectedValue(new UserAuthError('no trusted context'))

      getSecretManager.mockReturnValue(null)

      const res = await executeSecretProxy('user-1', secret, {
        url: 'https://api.example.com',
      })

      expect(res.status).toBe(409)

      const body = await res.json()

      expect(body.error).toBe('authorization_required')
      expect(body.url).toBeUndefined()
    })
  })

  it('rethrows non-auth errors from swapSecrets', async () => {
    swapSecrets.mockRejectedValue(new Error('boom'))

    await expect(
      executeSecretProxy('user-1', secret, { url: 'https://api.example.com' })
    ).rejects.toThrow('boom')
  })
})

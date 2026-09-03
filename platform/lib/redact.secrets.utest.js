/**
 * @jest-environment node
 */
import { REDACTED, isSensitiveKey, scrubSecrets } from '@/lib/redact.secrets'

describe('redact.secrets', () => {
  it('recognises the credential-bearing key shapes', () => {
    for (const key of [
      'token',
      'accessToken',
      'access_token',
      'refresh_token',
      'refreshToken',
      'client_secret',
      'clientSecret',
      'authorization',
      'Authorization',
      'code',
      'id_token',
      'apiKey',
      'x-api-key',
      'password',
      'x-access-token',
    ]) {
      expect({ key, sensitive: isSensitiveKey(key) }).toEqual({ key, sensitive: true })
    }

    for (const key of ['userId', 'url', 'tokenUrl', 'hasClientSecret', 'tokenPrefix', 'scope']) {
      expect({ key, sensitive: isSensitiveKey(key) }).toEqual({ key, sensitive: false })
    }
  })

  it('scrubs an OAuth/MCP style payload without touching the rest', () => {
    const scrubbed = scrubSecrets({
      tokenUrl: 'https://idp.example/token',
      options: {
        accessToken: 'oaac-secret',
        refresh_token: 'oart-secret',
        clientSecret: 'cs',
        scope: 'mcp:tools',
      },
      headers: { Authorization: 'Bearer x', Accept: 'application/json' },
      result: { access_token: 'x', expires_in: 3600 },
      list: [{ code: 'authz-code', state: 's' }],
    })

    expect(scrubbed).toEqual({
      tokenUrl: 'https://idp.example/token',
      options: {
        accessToken: REDACTED,
        refresh_token: REDACTED,
        clientSecret: REDACTED,
        scope: 'mcp:tools',
      },
      headers: { Authorization: REDACTED, Accept: 'application/json' },
      result: { access_token: REDACTED, expires_in: 3600 },
      list: [{ code: REDACTED, state: 's' }],
    })
  })

  it('scrubs Headers instances and survives cycles', () => {
    const headers = new Headers({ authorization: 'Bearer x', accept: '*/*' })

    expect(scrubSecrets({ headers })).toEqual({
      headers: { authorization: REDACTED, accept: '*/*' },
    })

    const cyclic = { token: 't' }

    cyclic.self = cyclic

    expect(scrubSecrets(cyclic)).toEqual({ token: REDACTED, self: '[circular]' })
  })

  it('leaves errors and other class instances alone', () => {
    const error = new Error('boom')

    expect(scrubSecrets({ error }).error).toBe(error)
  })
})

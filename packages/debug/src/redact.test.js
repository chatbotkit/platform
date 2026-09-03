/**
 * Tests for the sensitive-value redaction layer.
 *
 * The production log gate is exercised by mocking the environment as
 * non-development BEFORE the module loads - the gate is computed at import
 * time. The redact()/redactString()/isSensitiveKey() primitives are
 * environment-independent and are tested directly.
 */

jest.mock('@chatbotkit-dev/env', () => ({
  isDevelopment: true,
  isStaging: false,
  isProduction: false,
  isTest: true,
}))

import { REDACTED, isSensitiveKey, log, redact, redactString } from './index'

describe('isSensitiveKey', () => {
  it.each([
    'authorization',
    'Authorization',
    'proxy-authorization',
    'cookie',
    'set-cookie',
    'password',
    'clientSecret',
    'client_secret',
    'accessToken',
    'access_token',
    'refresh_token',
    'x-api-key',
    'apiKey',
    'x-hub-signature',
    'x-twilio-signature',
    'credentials',
    'privateKey',
    'x-secret-header',
    'oauthToken',
  ])('treats %s as sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(true)
  })

  it.each([
    'tokenUrl',
    'authorizationUrl',
    'accessTokenExpiresAt',
    'tokenType',
    'authorName',
    'method',
    'url',
    'status',
    'email',
    'identifier',
    'body',
    'conversationId',
    'tokenEndpoint',
    'tokens',
    'maxTokens',
    'promptTokens',
  ])('treats %s as not sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(false)
  })
})

describe('redactString', () => {
  it('redacts bearer scheme credentials', () => {
    expect(redactString('Bearer sk-abc123.def')).toBe(`Bearer ${REDACTED}`)
    expect(redactString('sending Authorization: Bearer eyJx.yy.zz now')).toBe(
      `sending Authorization: Bearer ${REDACTED} now`
    )
  })

  it('redacts basic scheme credentials', () => {
    expect(redactString('Basic dXNlcjpwYXNz')).toBe(`Basic ${REDACTED}`)
  })

  it('redacts url userinfo passwords', () => {
    expect(redactString('https://user:hunter2@example.com/path')).toBe(
      `https://user:${REDACTED}@example.com/path`
    )
  })

  it('redacts sensitive query parameters', () => {
    expect(
      redactString('https://example.com/cb?code=abc123&state=xyz&next=1')
    ).toBe(`https://example.com/cb?code=${REDACTED}&state=${REDACTED}&next=1`)

    expect(
      redactString('https://example.com/x?access_token=t1&api_key=t2')
    ).toBe(`https://example.com/x?access_token=${REDACTED}&api_key=${REDACTED}`)

    expect(redactString('https://s3.example.com/f?sig=AAA&expires=9')).toBe(
      `https://s3.example.com/f?sig=${REDACTED}&expires=9`
    )
  })

  it('redacts credentials embedded in slash-delimited model strings', () => {
    expect(
      redactString(
        'custom/name=gpt-4o/provider=openai/credentials=sk-live-123/maxTokens=1000'
      )
    ).toBe(
      `custom/name=gpt-4o/provider=openai/credentials=${REDACTED}/maxTokens=1000`
    )
  })

  it('does not redact look-alike parameter names', () => {
    expect(redactString('https://example.com/?monkey=1&decode=2')).toBe(
      'https://example.com/?monkey=1&decode=2'
    )
  })

  it('leaves ordinary strings alone', () => {
    expect(redactString('fetching the dataset list')).toBe(
      'fetching the dataset list'
    )
  })
})

describe('redact', () => {
  it('redacts values under sensitive keys and preserves shape', () => {
    expect(
      redact({
        method: 'POST',
        url: 'https://example.com/hook',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer sk-live-123',
          'x-api-key': 'ak-42',
        },
      })
    ).toEqual({
      method: 'POST',
      url: 'https://example.com/hook',
      headers: {
        'content-type': 'application/json',
        authorization: REDACTED,
        'x-api-key': REDACTED,
      },
    })
  })

  it('redacts every leaf under a sensitive branch, including arrays', () => {
    expect(
      redact({
        secrets: [{ value: 'aaa', label: 'first' }, 'raw-token'],
      })
    ).toEqual({
      secrets: [{ value: REDACTED, label: REDACTED }, REDACTED],
    })
  })

  it('preserves booleans and null under sensitive keys', () => {
    expect(redact({ hasClientSecret: true, refreshToken: null })).toEqual({
      hasClientSecret: true,
      refreshToken: null,
    })
  })

  it('redacts numbers under sensitive keys but not elsewhere', () => {
    expect(redact({ pinToken: 123456, status: 200 })).toEqual({
      pinToken: REDACTED,
      status: 200,
    })
  })

  it('leaves token usage counts alone', () => {
    expect(
      redact({ tokens: 205, model: 'gpt-5.4-mini', type: 'input', debit: 11 })
    ).toEqual({ tokens: 205, model: 'gpt-5.4-mini', type: 'input', debit: 11 })
  })

  it('scrubs credential-shaped strings under non-sensitive keys', () => {
    expect(
      redact({ note: 'call used Bearer abc123', location: 'https://x.y/z' })
    ).toEqual({
      note: `call used Bearer ${REDACTED}`,
      location: 'https://x.y/z',
    })
  })

  it('survives circular references', () => {
    const value = { name: 'a' }

    value.self = value

    expect(() => redact(value)).not.toThrow()
  })
})

describe('non-interactive log output', () => {
  it('redacts sensitive keys in logged objects', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})

    try {
      log('request sent', {
        url: 'https://example.com',
        headers: { authorization: 'Bearer sk-live-9' },
      })

      const output = spy.mock.calls.flat().join(' ')

      expect(output).toContain(REDACTED)
      expect(output).not.toContain('sk-live-9')
      expect(output).toContain('https://example.com')
    } finally {
      spy.mockRestore()
    }
  })

  it('scrubs bare string arguments', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})

    try {
      log('token was Bearer abc.def.ghi')

      const output = spy.mock.calls.flat().join(' ')

      expect(output).not.toContain('abc.def.ghi')
      expect(output).toContain(REDACTED)
    } finally {
      spy.mockRestore()
    }
  })

  it('scrubs model credentials nested under a non-sensitive key', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})

    try {
      log('parsing language model', {
        model:
          'custom/name=gpt-4o/provider=openai/credentials=sk-live-9/maxTokens=1000',
      })

      const output = spy.mock.calls.flat().join(' ')

      expect(output).not.toContain('sk-live-9')
      expect(output).toContain(`credentials=${REDACTED}`)
    } finally {
      spy.mockRestore()
    }
  })
})

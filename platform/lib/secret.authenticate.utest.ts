import {
  canAuthenticateSecret,
  getSecretAuthenticationBlockReason,
} from './secret.authenticate'

const OAUTH_CONFIG = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  authorizationUrl: 'https://example.com/authorize',
  tokenUrl: 'https://example.com/token',
}

describe('getSecretAuthenticationBlockReason', () => {
  it('returns null for a fully configured oauth secret', () => {
    expect(
      getSecretAuthenticationBlockReason({
        kind: 'shared',
        type: 'oauth',
        config: OAUTH_CONFIG,
      })
    ).toBeNull()
  })

  it('returns null for a template secret naming its template', () => {
    expect(
      getSecretAuthenticationBlockReason({
        kind: 'shared',
        type: 'template',
        config: { template: '@platform/google' },
      })
    ).toBeNull()
  })

  it('explains that a missing secret must be saved first', () => {
    expect(getSecretAuthenticationBlockReason(null)).toMatch(/save this secret/i)
  })

  it('explains that personal secrets are authenticated per contact', () => {
    expect(
      getSecretAuthenticationBlockReason({
        kind: 'personal',
        type: 'oauth',
        config: OAUTH_CONFIG,
      })
    ).toMatch(/each contact/i)
  })

  it('explains that an unconfigured oauth secret needs its config', () => {
    expect(
      getSecretAuthenticationBlockReason({
        kind: 'shared',
        type: 'oauth',
        config: { clientId: 'client-id' },
      })
    ).toMatch(/finish configuring/i)
  })

  it('explains that a template secret needs finishing', () => {
    expect(
      getSecretAuthenticationBlockReason({
        kind: 'shared',
        type: 'template',
        config: {},
      })
    ).toMatch(/finish configuring/i)
  })

  it.each(['plain', 'basic', 'bearer', 'jwt', 'reference'])(
    'explains that %s secrets store a typed-in value',
    (type) => {
      expect(
        getSecretAuthenticationBlockReason({
          kind: 'shared',
          type,
          config: {},
        })
      ).toMatch(/value you type in/i)
    }
  )
})

describe('canAuthenticateSecret', () => {
  it('mirrors the block reason - true only when there is none', () => {
    expect(
      canAuthenticateSecret({
        kind: 'shared',
        type: 'oauth',
        config: OAUTH_CONFIG,
      })
    ).toBe(true)

    expect(canAuthenticateSecret({ kind: 'personal', type: 'oauth' })).toBe(
      false
    )
  })
})

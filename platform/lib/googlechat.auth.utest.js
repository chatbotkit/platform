import fetch from '@/lib/fetch'
import memcache from '@/lib/memcache'

import { verifyGoogleChatToken } from './googlechat.auth'

jest.mock('@/lib/fetch')
jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
}))
jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_KID = 'test-key-id'
const GOOGLE_CHAT_SA = 'chat@system.gserviceaccount.com'

function b64u(value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value)

  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function makeJwt(header, payload, sig = 'fakesig') {
  return `${b64u(header)}.${b64u(payload)}.${b64u(sig)}`
}

function makePayload(overrides = {}) {
  const now = Math.floor(Date.now() / 1000)

  return {
    iss: GOOGLE_CHAT_SA,
    aud: 'test-project-123',
    iat: now - 10,
    exp: now + 3590,
    sub: GOOGLE_CHAT_SA,
    ...overrides,
  }
}

const mockRawKey = { kid: MOCK_KID, kty: 'RSA', n: 'mod123', e: 'AQAB' }

const mockCachedKeys = { [MOCK_KID]: mockRawKey }

const mockCryptoKey = {}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()

  // default: cache hit - raw JWKS already in redis
  memcache.get.mockResolvedValue(mockCachedKeys)

  jest.spyOn(global.crypto.subtle, 'importKey').mockResolvedValue(mockCryptoKey)

  jest.spyOn(global.crypto.subtle, 'verify').mockResolvedValue(true)
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('verifyGoogleChatToken', () => {
  describe('token parsing', () => {
    it('throws when Authorization header is empty', async () => {
      await expect(verifyGoogleChatToken('')).rejects.toThrow(
        'Missing Bearer token'
      )
    })

    it('throws when Authorization header has no token after Bearer prefix', async () => {
      await expect(verifyGoogleChatToken('Bearer ')).rejects.toThrow(
        'Missing Bearer token'
      )
    })

    it('throws when token is not a valid JWT (missing parts)', async () => {
      await expect(verifyGoogleChatToken('Bearer onlyonepart')).rejects.toThrow(
        'Invalid JWT format'
      )
    })

    it('throws when token has only two parts', async () => {
      await expect(verifyGoogleChatToken('Bearer part1.part2')).rejects.toThrow(
        'Invalid JWT format'
      )
    })

    it('throws when JWT header is not decodable JSON', async () => {
      // valid base64url but not JSON
      const badHeader = b64u('not-json-!!!')

      await expect(
        verifyGoogleChatToken(`Bearer ${badHeader}.${b64u({})}.sig`)
      ).rejects.toThrow('Failed to decode JWT header')
    })

    it('throws when JWT header is missing kid', async () => {
      const header = { alg: 'RS256' } // no kid

      await expect(
        verifyGoogleChatToken(`Bearer ${makeJwt(header, makePayload())}`)
      ).rejects.toThrow('JWT header missing kid')
    })

    it('strips Bearer prefix case-insensitively', async () => {
      const jwt = makeJwt({ kid: MOCK_KID, alg: 'RS256' }, makePayload())

      // Should not throw for either casing
      await expect(
        verifyGoogleChatToken(`bearer ${jwt}`)
      ).resolves.toBeDefined()
    })
  })

  describe('JWKS / signing keys', () => {
    it('uses cached JWKS when available (no fetch call)', async () => {
      const jwt = makeJwt({ kid: MOCK_KID, alg: 'RS256' }, makePayload())

      await verifyGoogleChatToken(`Bearer ${jwt}`)

      expect(fetch).not.toHaveBeenCalled()
    })

    it('fetches JWKS from Google when cache misses', async () => {
      memcache.get.mockResolvedValue(null)

      fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          keys: [mockRawKey],
        }),
      })

      const jwt = makeJwt({ kid: MOCK_KID, alg: 'RS256' }, makePayload())

      await verifyGoogleChatToken(`Bearer ${jwt}`)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('chat@system.gserviceaccount.com')
      )
    })

    it('caches raw JWKS after fetching', async () => {
      memcache.get.mockResolvedValue(null)

      fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({ keys: [mockRawKey] }),
      })

      const jwt = makeJwt({ kid: MOCK_KID, alg: 'RS256' }, makePayload())

      await verifyGoogleChatToken(`Bearer ${jwt}`)

      expect(memcache.set).toHaveBeenCalledWith(
        'googlechat:jwks',
        { [MOCK_KID]: mockRawKey },
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('filters out encryption keys (use=enc) during JWKS fetch', async () => {
      memcache.get.mockResolvedValue(null)

      const encKey = { ...mockRawKey, kid: 'enc-key', use: 'enc' }

      fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({ keys: [encKey] }),
      })

      const jwt = makeJwt({ kid: MOCK_KID, alg: 'RS256' }, makePayload())

      await expect(verifyGoogleChatToken(`Bearer ${jwt}`)).rejects.toThrow(
        `Unknown JWT kid: ${MOCK_KID}`
      )
    })

    it('throws when kid is not found in signing keys', async () => {
      const jwt = makeJwt({ kid: 'unknown-kid', alg: 'RS256' }, makePayload())

      await expect(verifyGoogleChatToken(`Bearer ${jwt}`)).rejects.toThrow(
        'Unknown JWT kid: unknown-kid'
      )
    })
  })

  describe('signature verification', () => {
    it('throws when signature is invalid', async () => {
      global.crypto.subtle.verify.mockResolvedValue(false)

      const jwt = makeJwt({ kid: MOCK_KID, alg: 'RS256' }, makePayload())

      await expect(verifyGoogleChatToken(`Bearer ${jwt}`)).rejects.toThrow(
        'JWT signature verification failed'
      )
    })

    it('passes when signature is valid', async () => {
      global.crypto.subtle.verify.mockResolvedValue(true)

      const jwt = makeJwt({ kid: MOCK_KID, alg: 'RS256' }, makePayload())

      await expect(
        verifyGoogleChatToken(`Bearer ${jwt}`)
      ).resolves.toBeDefined()
    })
  })

  describe('payload validation', () => {
    it('throws when issuer is not the Google Chat service account', async () => {
      const jwt = makeJwt(
        { kid: MOCK_KID, alg: 'RS256' },
        makePayload({ iss: 'attacker@evil.iam.gserviceaccount.com' })
      )

      await expect(verifyGoogleChatToken(`Bearer ${jwt}`)).rejects.toThrow(
        'JWT issuer mismatch'
      )
    })

    it('throws when token is expired', async () => {
      const expiredPayload = makePayload({
        exp: Math.floor(Date.now() / 1000) - 60, // expired 60s ago
      })

      const jwt = makeJwt({ kid: MOCK_KID, alg: 'RS256' }, expiredPayload)

      await expect(verifyGoogleChatToken(`Bearer ${jwt}`)).rejects.toThrow(
        'JWT token has expired'
      )
    })

    it('does not throw for token without exp field', async () => {
      const payload = makePayload()

      delete payload.exp

      const jwt = makeJwt({ kid: MOCK_KID, alg: 'RS256' }, payload)

      await expect(
        verifyGoogleChatToken(`Bearer ${jwt}`)
      ).resolves.toBeDefined()
    })

    it('returns the decoded payload on success', async () => {
      const payload = makePayload({ custom_claim: 'test-value' })

      const jwt = makeJwt({ kid: MOCK_KID, alg: 'RS256' }, payload)

      const result = await verifyGoogleChatToken(`Bearer ${jwt}`)

      expect(result).toMatchObject({
        iss: GOOGLE_CHAT_SA,
        custom_claim: 'test-value',
      })
    })
  })

  describe('audience validation', () => {
    it('skips audience check when projectNumber is not provided', async () => {
      const jwt = makeJwt(
        { kid: MOCK_KID, alg: 'RS256' },
        makePayload({ aud: 'some-other-project' })
      )

      await expect(
        verifyGoogleChatToken(`Bearer ${jwt}`)
      ).resolves.toBeDefined()
    })

    it('skips audience check when projectNumber is null', async () => {
      const jwt = makeJwt(
        { kid: MOCK_KID, alg: 'RS256' },
        makePayload({ aud: 'anything' })
      )

      await expect(
        verifyGoogleChatToken(`Bearer ${jwt}`, { projectNumber: null })
      ).resolves.toBeDefined()
    })

    it('allows when aud string contains the projectNumber', async () => {
      const jwt = makeJwt(
        { kid: MOCK_KID, alg: 'RS256' },
        makePayload({ aud: 'test-project-123' })
      )

      await expect(
        verifyGoogleChatToken(`Bearer ${jwt}`, { projectNumber: '123' })
      ).resolves.toBeDefined()
    })

    it('allows when aud array contains an entry with the projectNumber', async () => {
      const jwt = makeJwt(
        { kid: MOCK_KID, alg: 'RS256' },
        makePayload({ aud: ['other-project', 'test-project-123'] })
      )

      await expect(
        verifyGoogleChatToken(`Bearer ${jwt}`, { projectNumber: '123' })
      ).resolves.toBeDefined()
    })

    it('throws when aud does not contain the projectNumber', async () => {
      const jwt = makeJwt(
        { kid: MOCK_KID, alg: 'RS256' },
        makePayload({ aud: 'completely-different-project' })
      )

      await expect(
        verifyGoogleChatToken(`Bearer ${jwt}`, { projectNumber: '123' })
      ).rejects.toThrow('JWT audience does not contain project number 123')
    })

    it('throws when aud is an array with no matching entry', async () => {
      const jwt = makeJwt(
        { kid: MOCK_KID, alg: 'RS256' },
        makePayload({ aud: ['project-aaa', 'project-bbb'] })
      )

      await expect(
        verifyGoogleChatToken(`Bearer ${jwt}`, { projectNumber: '123' })
      ).rejects.toThrow('JWT audience does not contain project number 123')
    })
  })
})

/**
 * @jest-environment node
 */
import fetch from '@/lib/fetch'
import memcache from '@/lib/memcache'

import { verifyBotFrameworkToken } from './microsoftteams.auth'

// -----------------------------------------------------------------------------
// Helpers: build minimal base64url-encoded JWT segments
// -----------------------------------------------------------------------------

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function makeToken(header, payload, signature = 'valid-signature') {
  return `${base64url(header)}.${base64url(payload)}.${signature}`
}

// -----------------------------------------------------------------------------
// Mocks
// -----------------------------------------------------------------------------

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

jest.mock('@/lib/fetch', () => jest.fn())

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
}))

// -----------------------------------------------------------------------------
// Shared constants
// -----------------------------------------------------------------------------

const VALID_APP_ID = 'test-app-id'
const VALID_KID = 'test-key-id'

const VALID_HEADER = { kid: VALID_KID, alg: 'RS256' }
const VALID_PAYLOAD = {
  iss: 'https://api.botframework.com',
  aud: VALID_APP_ID,
  exp: 9999999999, // year 2286 – effectively never expires in tests
}

// Default: cached JWKS so the network fetch path is NOT exercised.
// Individual test groups that test the fetch path override this.
function setupCachedKeys(verifyResult = true) {
  const rawJwk = {
    kid: VALID_KID,
    kty: 'RSA',
    n: 'AQAB',
    e: 'AQAB',
  }

  memcache.get.mockResolvedValue({ [VALID_KID]: rawJwk })

  jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue('mock-crypto-key')
  jest.spyOn(crypto.subtle, 'verify').mockResolvedValue(verifyResult)
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('verifyBotFrameworkToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Guard clauses – malformed or missing inputs
  // ---------------------------------------------------------------------------

  describe('input validation', () => {
    it('should return false when authHeader is empty string', async () => {
      const result = await verifyBotFrameworkToken('', VALID_APP_ID)

      expect(result).toBe(false)
    })

    it('should return false when authHeader is missing "Bearer" scheme', async () => {
      const token = makeToken(VALID_HEADER, VALID_PAYLOAD)

      const result = await verifyBotFrameworkToken(token, VALID_APP_ID)

      expect(result).toBe(false)
    })

    it('should return false for Basic auth instead of Bearer', async () => {
      const token = makeToken(VALID_HEADER, VALID_PAYLOAD)

      const result = await verifyBotFrameworkToken(
        `Basic ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })

    it('should return false when JWT does not have three segments', async () => {
      const result = await verifyBotFrameworkToken(
        'Bearer only.two',
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })

    it('should return false when JWT has four segments', async () => {
      const result = await verifyBotFrameworkToken(
        'Bearer one.two.three.four',
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Issuer validation – the most security-critical check
  // ---------------------------------------------------------------------------

  describe('issuer validation', () => {
    beforeEach(() => {
      setupCachedKeys(true)
    })

    it('should accept tokens issued by https://api.botframework.com', async () => {
      const token = makeToken(VALID_HEADER, {
        ...VALID_PAYLOAD,
        iss: 'https://api.botframework.com',
      })

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(true)
    })

    it('should accept tokens issued by the STS Windows Net tenant', async () => {
      const token = makeToken(VALID_HEADER, {
        ...VALID_PAYLOAD,
        iss: 'https://sts.windows.net/d6d49420-f39b-4df7-a1dc-d59a935871db/',
      })

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(true)
    })

    it('should accept tokens issued by the login.microsoftonline.com v2.0 endpoint', async () => {
      const token = makeToken(VALID_HEADER, {
        ...VALID_PAYLOAD,
        iss: 'https://login.microsoftonline.com/d6d49420-f39b-4df7-a1dc-d59a935871db/v2.0',
      })

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(true)
    })

    it('should reject tokens with an arbitrary issuer', async () => {
      const token = makeToken(VALID_HEADER, {
        ...VALID_PAYLOAD,
        iss: 'https://evil.example.com',
      })

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })

    it('should reject tokens whose issuer is a prefix of a valid issuer', async () => {
      const token = makeToken(VALID_HEADER, {
        ...VALID_PAYLOAD,
        iss: 'https://api.botframework.com.evil.com',
      })

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })

    it('should reject tokens with missing issuer', async () => {
      const payloadWithoutIss = { aud: VALID_APP_ID, exp: 9999999999 }
      const token = makeToken(VALID_HEADER, payloadWithoutIss)

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Audience validation
  // ---------------------------------------------------------------------------

  describe('audience validation', () => {
    beforeEach(() => {
      setupCachedKeys(true)
    })

    it('should accept tokens whose audience matches the expected app id', async () => {
      const token = makeToken(VALID_HEADER, VALID_PAYLOAD)

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(true)
    })

    it('should reject tokens whose audience does not match the expected app id', async () => {
      const token = makeToken(VALID_HEADER, {
        ...VALID_PAYLOAD,
        aud: 'wrong-app-id',
      })

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })

    it('should reject tokens with missing audience', async () => {
      const payloadWithoutAud = {
        iss: 'https://api.botframework.com',
        exp: 9999999999,
      }

      const token = makeToken(VALID_HEADER, payloadWithoutAud)

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Expiry validation
  // ---------------------------------------------------------------------------

  describe('expiry validation', () => {
    beforeEach(() => {
      setupCachedKeys(true)
    })

    it('should reject tokens whose exp claim is in the past', async () => {
      // exp = 1000000000 is 2001-09-09 – far in the past
      const token = makeToken(VALID_HEADER, {
        ...VALID_PAYLOAD,
        exp: 1000000000,
      })

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })

    it('should accept tokens whose exp claim is in the future', async () => {
      const token = makeToken(VALID_HEADER, {
        ...VALID_PAYLOAD,
        exp: 9999999999,
      })

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(true)
    })

    it('should accept tokens with no exp claim', async () => {
      const payloadWithoutExp = {
        iss: 'https://api.botframework.com',
        aud: VALID_APP_ID,
      }

      const token = makeToken(VALID_HEADER, payloadWithoutExp)

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Key ID validation
  // ---------------------------------------------------------------------------

  describe('key id validation', () => {
    it('should reject tokens when header has no kid', async () => {
      const rawJwk = {
        kid: VALID_KID,
        kty: 'RSA',
        n: 'AQAB',
        e: 'AQAB',
      }

      memcache.get.mockResolvedValue({ [VALID_KID]: rawJwk })
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue('mock-key')

      const headerWithoutKid = { alg: 'RS256' }
      const token = makeToken(headerWithoutKid, VALID_PAYLOAD)

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })

    it('should reject tokens when kid is not in the JWKS', async () => {
      const rawJwk = {
        kid: 'other-key-id',
        kty: 'RSA',
        n: 'AQAB',
        e: 'AQAB',
      }

      memcache.get.mockResolvedValue({ 'other-key-id': rawJwk })
      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue('mock-key')

      // Token refers to VALID_KID which is NOT in the JWKS
      const token = makeToken({ kid: VALID_KID, alg: 'RS256' }, VALID_PAYLOAD)

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Signature verification
  // ---------------------------------------------------------------------------

  describe('signature verification', () => {
    it('should return true when crypto.subtle.verify returns true', async () => {
      setupCachedKeys(true) // crypto.subtle.verify → true

      const token = makeToken(VALID_HEADER, VALID_PAYLOAD)

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(true)
      expect(crypto.subtle.verify).toHaveBeenCalledTimes(1)
    })

    it('should return false when crypto.subtle.verify returns false', async () => {
      setupCachedKeys(false) // crypto.subtle.verify → false

      const token = makeToken(VALID_HEADER, VALID_PAYLOAD)

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // JWKS caching
  // ---------------------------------------------------------------------------

  describe('JWKS caching', () => {
    it('should use the cached JWKS without hitting the network', async () => {
      setupCachedKeys(true)

      const token = makeToken(VALID_HEADER, VALID_PAYLOAD)

      await verifyBotFrameworkToken(`Bearer ${token}`, VALID_APP_ID)

      // memcache.get was called, fetch was NOT
      expect(memcache.get).toHaveBeenCalled()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should fetch and cache JWKS when the cache is empty', async () => {
      // Cache miss
      memcache.get.mockResolvedValue(null)

      // Mock the two fetch calls: OpenID config + JWKS
      fetch
        .mockResolvedValueOnce({
          json: async () => ({
            jwks_uri: 'https://login.botframework.com/v1/.well-known/keys',
          }),
        })
        .mockResolvedValueOnce({
          json: async () => ({
            keys: [{ kid: VALID_KID, kty: 'RSA', n: 'AQAB', e: 'AQAB' }],
          }),
        })

      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue('mock-key')
      jest.spyOn(crypto.subtle, 'verify').mockResolvedValue(true)
      memcache.set.mockResolvedValue(undefined)

      const token = makeToken(VALID_HEADER, VALID_PAYLOAD)

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(2)
      expect(memcache.set).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // Error resilience
  // ---------------------------------------------------------------------------

  describe('error resilience', () => {
    it('should return false when the token header is not valid JSON', async () => {
      // Encode an invalid JSON string as base64url for the header segment
      const badHeader = Buffer.from('not-json').toString('base64url')
      const token = `${badHeader}.${base64url(VALID_PAYLOAD)}.signature`

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })

    it('should return false when crypto.subtle.verify throws', async () => {
      memcache.get.mockResolvedValue({
        [VALID_KID]: { kid: VALID_KID, kty: 'RSA', n: 'AQAB', e: 'AQAB' },
      })

      jest.spyOn(crypto.subtle, 'importKey').mockResolvedValue('mock-key')
      jest
        .spyOn(crypto.subtle, 'verify')
        .mockRejectedValue(new Error('Crypto error'))

      const token = makeToken(VALID_HEADER, VALID_PAYLOAD)

      const result = await verifyBotFrameworkToken(
        `Bearer ${token}`,
        VALID_APP_ID
      )

      expect(result).toBe(false)
    })
  })
})

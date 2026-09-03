import { decrypt, encrypt } from '@/lib/cloak'
import memcache from '@/lib/memcache'
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generatePkcePair,
  retrievePkceVerifier,
  storePkceVerifier,
  verifyCodeChallenge,
} from '@/lib/oauth.pkce'

jest.mock('@/lib/cloak', () => ({
  encrypt: jest.fn(),
  decrypt: jest.fn(),
}))

jest.mock('@/lib/memcache', () => ({
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
}))

describe('generateCodeVerifier', () => {
  it('should generate a code verifier of correct length', () => {
    const verifier = generateCodeVerifier()

    // 32 bytes base64url encoded = 43 characters
    expect(verifier.length).toBe(43)
  })

  it('should generate unique code verifiers', () => {
    const verifier1 = generateCodeVerifier()
    const verifier2 = generateCodeVerifier()

    expect(verifier1).not.toBe(verifier2)
  })

  it('should only contain URL-safe characters', () => {
    const verifier = generateCodeVerifier()

    // Base64url uses only A-Z, a-z, 0-9, -, _
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('should not contain padding characters', () => {
    const verifier = generateCodeVerifier()

    expect(verifier).not.toContain('=')
  })
})

describe('generateCodeChallenge', () => {
  it('should generate a code challenge from verifier', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const challenge = await generateCodeChallenge(verifier)

    // SHA-256 hash base64url encoded = 43 characters
    expect(challenge.length).toBe(43)
  })

  it('should be deterministic for same input', async () => {
    const verifier = 'test-verifier-12345'
    const challenge1 = await generateCodeChallenge(verifier)
    const challenge2 = await generateCodeChallenge(verifier)

    expect(challenge1).toBe(challenge2)
  })

  it('should produce different challenges for different verifiers', async () => {
    const challenge1 = await generateCodeChallenge('verifier1')
    const challenge2 = await generateCodeChallenge('verifier2')

    expect(challenge1).not.toBe(challenge2)
  })

  it('should only contain URL-safe characters', async () => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)

    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('verifyCodeChallenge', () => {
  it('should return true for matching verifier and challenge', async () => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)

    expect(await verifyCodeChallenge(verifier, challenge)).toBe(true)
  })

  it('should return false for non-matching verifier', async () => {
    const verifier1 = generateCodeVerifier()
    const verifier2 = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier1)

    expect(await verifyCodeChallenge(verifier2, challenge)).toBe(false)
  })

  it('should return false for unsupported method', async () => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)

    // @ts-expect-error - testing invalid method
    expect(await verifyCodeChallenge(verifier, challenge, 'plain')).toBe(false)
  })
})

describe('generatePkcePair', () => {
  it('should return codeVerifier, codeChallenge, and method', async () => {
    const pair = await generatePkcePair()

    expect(pair).toHaveProperty('codeVerifier')
    expect(pair).toHaveProperty('codeChallenge')
    expect(pair).toHaveProperty('codeChallengeMethod')
  })

  it('should use S256 as the challenge method', async () => {
    const pair = await generatePkcePair()

    expect(pair.codeChallengeMethod).toBe('S256')
  })

  it('should generate valid verifier and challenge pair', async () => {
    const pair = await generatePkcePair()

    expect(
      await verifyCodeChallenge(pair.codeVerifier, pair.codeChallenge)
    ).toBe(true)
  })

  it('should generate unique pairs', async () => {
    const pair1 = await generatePkcePair()
    const pair2 = await generatePkcePair()

    expect(pair1.codeVerifier).not.toBe(pair2.codeVerifier)
    expect(pair1.codeChallenge).not.toBe(pair2.codeChallenge)
  })
})

describe('storePkceVerifier', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should store encrypted verifier in Redis and return an ID', async () => {
    encrypt.mockResolvedValue('encrypted-verifier')
    memcache.setex.mockResolvedValue('OK')

    const id = await storePkceVerifier('test-code-verifier')

    expect(id).toHaveLength(16) // generateRandomHex(16) returns 16 hex chars
    expect(encrypt).toHaveBeenCalledWith('test-code-verifier')
    expect(memcache.setex).toHaveBeenCalledWith(
      expect.stringContaining('oauth:pkce:verifier:'),
      900, // QUARTER_HOUR_IN_SECONDS
      'encrypted-verifier'
    )
  })

  it('should generate unique IDs for each call', async () => {
    encrypt.mockResolvedValue('encrypted')
    memcache.setex.mockResolvedValue('OK')

    const id1 = await storePkceVerifier('verifier1')
    const id2 = await storePkceVerifier('verifier2')

    expect(id1).not.toBe(id2)
  })

  it('should use correct Redis key format', async () => {
    encrypt.mockResolvedValue('encrypted')
    memcache.setex.mockResolvedValue('OK')

    const id = await storePkceVerifier('verifier')

    expect(memcache.setex).toHaveBeenCalledWith(
      `oauth:pkce:verifier:${id}`,
      expect.any(Number),
      expect.any(String)
    )
  })
})

describe('retrievePkceVerifier', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should retrieve and decrypt verifier from Redis', async () => {
    memcache.get.mockResolvedValue('encrypted-verifier')
    decrypt.mockResolvedValue('test-code-verifier')
    memcache.del.mockResolvedValue(1)

    const verifier = await retrievePkceVerifier('test-id')

    expect(verifier).toBe('test-code-verifier')
    expect(memcache.get).toHaveBeenCalledWith('oauth:pkce:verifier:test-id')
    expect(decrypt).toHaveBeenCalledWith('encrypted-verifier')
  })

  it('should delete verifier from Redis after retrieval', async () => {
    memcache.get.mockResolvedValue('encrypted-verifier')
    decrypt.mockResolvedValue('test-code-verifier')
    memcache.del.mockResolvedValue(1)

    await retrievePkceVerifier('test-id')

    expect(memcache.del).toHaveBeenCalledWith('oauth:pkce:verifier:test-id')
  })

  it('should return null when verifier not found', async () => {
    memcache.get.mockResolvedValue(null)

    const verifier = await retrievePkceVerifier('nonexistent-id')

    expect(verifier).toBeNull()
    expect(decrypt).not.toHaveBeenCalled()
    expect(memcache.del).not.toHaveBeenCalled()
  })

  it('should return null when decryption fails', async () => {
    memcache.get.mockResolvedValue('encrypted-verifier')
    memcache.del.mockResolvedValue(1)
    decrypt.mockRejectedValue(new Error('Decryption failed'))

    const verifier = await retrievePkceVerifier('test-id')

    expect(verifier).toBeNull()
  })

  it('should still delete verifier even when decryption fails', async () => {
    memcache.get.mockResolvedValue('encrypted-verifier')
    memcache.del.mockResolvedValue(1)
    decrypt.mockRejectedValue(new Error('Decryption failed'))

    await retrievePkceVerifier('test-id')

    expect(memcache.del).toHaveBeenCalledWith('oauth:pkce:verifier:test-id')
  })
})

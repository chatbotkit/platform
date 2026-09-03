import {
  createHmacHexDigest,
  generateRandomBytes,
  generateRandomHex,
  normalizePrivateKeyPemToPKCS8,
  timingSafeEqual,
  randomFloat,
  sha256,
  sha256B,
} from '@/lib/webcrypto'

function readDerLength(bytes, offset) {
  const first = bytes[offset++]

  if (first < 0x80) {
    return { length: first, offset }
  }

  const byteLength = first & 0x7f
  let length = 0

  for (let i = 0; i < byteLength; i++) {
    length = (length << 8) | bytes[offset++]
  }

  return { length, offset }
}

function readDerElement(bytes, offset, tag) {
  if (bytes[offset++] !== tag) {
    throw new Error(`unexpected DER tag`)
  }

  const lengthResult = readDerLength(bytes, offset)
  const start = lengthResult.offset
  const end = start + lengthResult.length

  return {
    value: bytes.slice(start, end),
    offset: end,
  }
}

function pemToBytes(pem, label) {
  const base64 = pem
    .replace(new RegExp(`-----BEGIN ${label}-----`, 'g'), '')
    .replace(new RegExp(`-----END ${label}-----`, 'g'), '')
    .replace(/\s/g, '')

  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

function bytesToPem(bytes, label) {
  const base64 = btoa(String.fromCharCode(...bytes))
  const lines = base64.match(/.{1,64}/g) || []

  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
}

function extractPkcs1FromPkcs8Pem(pem) {
  const privateKeyInfo = readDerElement(pemToBytes(pem, 'PRIVATE KEY'), 0, 0x30)
  let offset = 0

  offset = readDerElement(privateKeyInfo.value, offset, 0x02).offset
  offset = readDerElement(privateKeyInfo.value, offset, 0x30).offset

  return bytesToPem(
    readDerElement(privateKeyInfo.value, offset, 0x04).value,
    'RSA PRIVATE KEY'
  )
}

describe('normalizePrivateKeyPemToPKCS8', () => {
  it('must return PKCS#8 private keys unchanged', async () => {
    const { exportPKCS8, generateKeyPair } = await import('jose')
    const { privateKey } = await generateKeyPair('RS256', { extractable: true })
    const privateKeyPem = await exportPKCS8(privateKey)

    expect(normalizePrivateKeyPemToPKCS8(privateKeyPem)).toBe(privateKeyPem)
  })

  it('must wrap PKCS#1 RSA private keys as PKCS#8 private keys', async () => {
    const { exportPKCS8, generateKeyPair, importPKCS8 } = await import('jose')
    const { privateKey } = await generateKeyPair('RS256', { extractable: true })
    const privateKeyPem = await exportPKCS8(privateKey)
    const pkcs1PrivateKeyPem = extractPkcs1FromPkcs8Pem(privateKeyPem)
    const normalized = normalizePrivateKeyPemToPKCS8(pkcs1PrivateKeyPem)

    expect(normalized).toContain('-----BEGIN PRIVATE KEY-----')
    expect(normalized).not.toContain('-----BEGIN RSA PRIVATE KEY-----')
    await expect(importPKCS8(normalized, 'RS256')).resolves.toBeDefined()
  })

  it('must return unsupported PEM labels unchanged', () => {
    const publicKeyPem = [
      '-----BEGIN PUBLIC KEY-----',
      'Zm9v',
      '-----END PUBLIC KEY-----',
      '',
    ].join('\n')

    expect(normalizePrivateKeyPemToPKCS8(publicKeyPem)).toBe(publicKeyPem)
  })
})

describe('createHmacHexDigest', () => {
  it('must return the correct hex digest', async () => {
    expect(
      await createHmacHexDigest('sha512', 'mysecretkey', 'myawesomedata')
    ).toEqual(
      '91c14b8d3bcd48be0488bfb8d96d52db6e5f07e5fc677ced2c12916dc87580961f422f9543c786eebfb5797bc3febf796b929efac5c83b4ec69228927f21a03a'
    )
  })
})

describe('generateRandomHex', () => {
  it('must return exact length when passed even number', async () => {
    expect(await generateRandomHex(8)).toHaveLength(8)
  })

  it('must return exact length when passed odd number', async () => {
    expect(await generateRandomHex(9)).toHaveLength(9)
  })

  it('must return exact length when passed zero', async () => {
    expect(await generateRandomHex(0)).toHaveLength(0)
  })

  it('must return absolute length when passed negative number', async () => {
    expect(await generateRandomHex(-8)).toHaveLength(8)
  })
})

describe('sha256', () => {
  it('must return correct SHA-256 hash for known input', async () => {
    // @note testing with a known input-output pair to verify correct implementation
    expect(await sha256('hello world')).toEqual(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
    )
  })

  it('must handle empty string', async () => {
    // @note empty string should produce the SHA-256 hash of empty input
    expect(await sha256('')).toEqual(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
  })

  it('must handle UTF-8 characters correctly', async () => {
    // @note testing with unicode characters to ensure proper UTF-8 encoding
    expect(await sha256('🚀')).toEqual(
      'ebbc0b2870eb323f2b6cffa5c493ceef81ae7eb36afc73d4e0367301631daec5'
    )
  })
})

describe('sha256B', () => {
  it('must return a Uint8Array of correct length', async () => {
    // @note SHA-256 produces 32 bytes (256 bits)
    const result = await sha256B('hello world')

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(32)
  })

  it('must return correct bytes for known input', async () => {
    // @note testing with 'hello world' - the hex representation should match sha256
    const result = await sha256B('hello world')
    const hexString = Array.from(result)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    expect(hexString).toEqual(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
    )
  })

  it('must handle empty string', async () => {
    const result = await sha256B('')

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(32)
  })

  it('must be consistent with sha256 hex output', async () => {
    // @note the byte output converted to hex should match the sha256 string output
    const input = 'test input'
    const bytes = await sha256B(input)
    const hexFromBytes = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const hexDirect = await sha256(input)

    expect(hexFromBytes).toEqual(hexDirect)
  })
})

describe('randomFloat', () => {
  it('must return a number', () => {
    expect(typeof randomFloat()).toBe('number')
  })

  it('must return values in [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const value = randomFloat()

      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('must return 0 when all bytes are zero', () => {
    const originalGetRandomValues = crypto.getRandomValues

    crypto.getRandomValues = (array) => {
      array.fill(0)

      return array
    }

    try {
      expect(randomFloat()).toBe(0)
    } finally {
      crypto.getRandomValues = originalGetRandomValues
    }
  })

  it('must return the maximum value when all bytes are 0xFF', () => {
    const originalGetRandomValues = crypto.getRandomValues

    crypto.getRandomValues = (array) => {
      array.fill(0xff)

      return array
    }

    try {
      // (0xFF * 2^24 + 0xFF * 2^16 + 0xFF * 2^8 + 0xFF) / 2^32
      // = 4294967295 / 4294967296
      const result = randomFloat()

      expect(result).toBeCloseTo(4294967295 / 4294967296, 15)
      expect(result).toBeLessThan(1)
    } finally {
      crypto.getRandomValues = originalGetRandomValues
    }
  })

  it('must compute correctly for known byte values', () => {
    const originalGetRandomValues = crypto.getRandomValues

    crypto.getRandomValues = (array) => {
      array[0] = 0x80
      array[1] = 0x00
      array[2] = 0x00
      array[3] = 0x00

      return array
    }

    try {
      // 0x80000000 / 2^32 = 0.5
      expect(randomFloat()).toBe(0.5)
    } finally {
      crypto.getRandomValues = originalGetRandomValues
    }
  })

  it('must produce varying results across calls', () => {
    const results = new Set()

    for (let i = 0; i < 100; i++) {
      results.add(randomFloat())
    }

    // with 32 bits of entropy, 100 calls should all be unique
    expect(results.size).toBe(100)
  })
})

describe('generateRandomBytes', () => {
  it('must return a Uint8Array of the requested length', () => {
    const result = generateRandomBytes(32)

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(32)
  })

  it('must return empty array for zero length', () => {
    const result = generateRandomBytes(0)

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(0)
  })

  it('must return unique values on subsequent calls', () => {
    // @note while theoretically possible to get duplicates, it's astronomically unlikely for 32 bytes
    const result1 = generateRandomBytes(32)
    const result2 = generateRandomBytes(32)

    expect(Array.from(result1)).not.toEqual(Array.from(result2))
  })

  it('must handle various lengths', () => {
    expect(generateRandomBytes(1).length).toBe(1)
    expect(generateRandomBytes(16).length).toBe(16)
    expect(generateRandomBytes(64).length).toBe(64)
    expect(generateRandomBytes(128).length).toBe(128)
  })
})

describe('timingSafeEqual', () => {
  it('matches identical strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
  })

  it('rejects different strings of equal length', () => {
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
  })

  it('rejects different lengths', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })

  it('rejects non-strings rather than throwing', () => {
    expect(timingSafeEqual(undefined, 'abc')).toBe(false)
    expect(timingSafeEqual('abc', null)).toBe(false)
  })
})

// --- Types ---

export type HashAlgorithm = 'sha1' | 'sha256' | 'sha512'

export default crypto

// --- DER Helpers ---

function derLength(length: number): Uint8Array {
  if (length < 0x80) {
    return new Uint8Array([length])
  }

  const bytes: number[] = []

  while (length > 0) {
    bytes.unshift(length & 0xff)
    length >>= 8
  }

  return new Uint8Array([0x80 | bytes.length, ...bytes])
}

function derEncode(tag: number, value: Uint8Array): Uint8Array {
  const length = derLength(value.length)
  const output = new Uint8Array(1 + length.length + value.length)

  output[0] = tag
  output.set(length, 1)
  output.set(value, 1 + length.length)

  return output
}

function derSequence(...values: Uint8Array[]): Uint8Array {
  return derEncode(0x30, concatBytes(...values))
}

function concatBytes(...values: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    values.reduce((size, value) => size + value.length, 0)
  )

  let offset = 0

  for (const value of values) {
    output.set(value, offset)
    offset += value.length
  }

  return output
}

// --- PEM Helpers ---

function pemToBytes(pem: string, label: string): Uint8Array {
  const base64 = pem
    .replace(new RegExp(`-----BEGIN ${label}-----`, 'g'), '')
    .replace(new RegExp(`-----END ${label}-----`, 'g'), '')
    .replace(/\s/g, '')

  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

function bytesToPem(bytes: Uint8Array, label: string): string {
  const base64 = btoa(String.fromCharCode(...bytes))
  const lines = base64.match(/.{1,64}/g) || []

  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
}

// --- Private Key Helpers ---

export function normalizePrivateKeyPemToPKCS8(pem: string): string {
  if (/-----BEGIN PRIVATE KEY-----/.test(pem)) {
    return pem
  }

  if (!/-----BEGIN RSA PRIVATE KEY-----/.test(pem)) {
    return pem
  }

  const rsaPrivateKey = pemToBytes(pem, 'RSA PRIVATE KEY')
  const version = new Uint8Array([0x02, 0x01, 0x00])
  const rsaEncryptionAlgorithm = derSequence(
    new Uint8Array([
      0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    ]),
    new Uint8Array([0x05, 0x00])
  )
  const privateKeyInfo = derSequence(
    version,
    rsaEncryptionAlgorithm,
    derEncode(0x04, rsaPrivateKey)
  )

  return bytesToPem(privateKeyInfo, 'PRIVATE KEY')
}

// --- Random Helpers ---

/**
 * Generates cryptographically random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Generates a cryptographically secure random float in [0, 1)
 */
export function randomFloat(): number {
  const bytes = crypto.getRandomValues(new Uint8Array(4))

  return (
    (bytes[0] * 2 ** 24 + bytes[1] * 2 ** 16 + bytes[2] * 2 ** 8 + bytes[3]) /
    2 ** 32
  )
}

/**
 * Generates a random hexadecimal string of the specified length
 */
export async function generateRandomHex(length: number): Promise<string> {
  length = Math.abs(length)

  const byteLength = Math.ceil(length / 2)

  const randomValues = crypto.getRandomValues(new Uint8Array(byteLength))

  return Array.prototype.map
    .call(randomValues, (x: number) => x.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length)
}

// --- HMAC Helpers ---

/**
 * Creates an HMAC hex digest using the specified algorithm, secret, and data
 */
export async function createHmacHexDigest(
  algorithm: HashAlgorithm,
  secret: string,
  data: string
): Promise<string> {
  const algorithmName = {
    sha1: 'SHA-1',
    sha256: 'SHA-256',
    sha512: 'SHA-512',
  }[algorithm]

  const enc = new TextEncoder()

  const key = await crypto.subtle.importKey(
    'raw', // raw format of the key - should be Uint8Array
    enc.encode(secret),
    {
      name: 'HMAC',
      hash: { name: algorithmName },
    },
    false, // export = false
    ['sign', 'verify'] // what this key can do
  )

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data))

  return Array.prototype.map
    .call(new Uint8Array(signature), (x: number) =>
      x.toString(16).padStart(2, '0')
    )
    .join('')
}

// --- Hash Helpers ---

/**
 * Generates a SHA-256 hash of the given string
 */
export async function sha256(string: string): Promise<string> {
  const enc = new TextEncoder()

  const hash = await crypto.subtle.digest('SHA-256', enc.encode(string))

  return Array.prototype.map
    .call(new Uint8Array(hash), (x: number) => x.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generates a SHA-256 hash of the given string and returns the raw bytes
 */
export async function sha256B(string: string): Promise<Uint8Array> {
  const enc = new TextEncoder()

  const hash = await crypto.subtle.digest('SHA-256', enc.encode(string))

  return new Uint8Array(hash)
}

/**
 * Constant-time string comparison, for checking a digest or shared secret
 * against one supplied by a caller. Returns false on a length mismatch, which
 * leaks only the length.
 *
 * @note this lives here rather than beside any one provider because every
 * signature check needs it - the per-provider `*.signature` modules compute
 * their own digest and compare it with this.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false
  }

  if (a.length !== b.length) {
    return false
  }

  let result = 0

  for (let index = 0; index < a.length; index++) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return result === 0
}

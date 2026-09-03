import { generateKey } from '@chatbotkit-dev/cloak'

let decrypt
let decryptString
let encrypt
let encryptString
let getKeyForDecryption
let getKeyForEncryption
let getKeys
let isEncrypted

describe('fields', () => {
  let mockKeys
  let originalEncryptionKey

  beforeAll(async () => {
    mockKeys = await Promise.all([generateKey(), generateKey(), generateKey()])
    originalEncryptionKey = process.env.CLOAK_ENCRYPTION_KEY
    process.env.CLOAK_ENCRYPTION_KEY = mockKeys.join(',')

    jest.resetModules()
    ;({
      decrypt,
      decryptString,
      encrypt,
      encryptString,
      getKeyForDecryption,
      getKeyForEncryption,
      getKeys,
      isEncrypted,
    } = await import('@/lib/cloak'))
  })

  afterAll(() => {
    if (originalEncryptionKey === undefined) {
      delete process.env.CLOAK_ENCRYPTION_KEY
    } else {
      process.env.CLOAK_ENCRYPTION_KEY = originalEncryptionKey
    }
  })

  test('getKeys should return generated keys', () => {
    const keys = getKeys()

    expect(keys).toEqual(mockKeys)
  })

  test('getFieldKeyForEncryption should return the first generated key', async () => {
    const key = await getKeyForEncryption()

    expect(key).toBe(mockKeys[0])
  })

  test('getFieldKeyForDecryption should find the correct key from keychain', async () => {
    const value = await encrypt('testValue')
    const key = await getKeyForDecryption(value)

    expect(key).toBeDefined()
  })

  test('encryptField should encrypt the value using the first generated key', async () => {
    const value = 'plainText'
    const encryptedValue = await encrypt(value)

    expect(encryptedValue).toBeDefined()
    expect(encryptedValue).not.toBe(value)
  })

  test('decryptField should decrypt the value', async () => {
    const value = 'plainText'
    const encryptedValue = await encrypt(value)
    const decryptedValue = await decrypt(encryptedValue)

    expect(decryptedValue).toBe(value)
  })

  test('isEncrypted should return true for encrypted value', async () => {
    const value = 'plainText'
    const encryptedValue = await encrypt(value)
    const result = await isEncrypted(encryptedValue)

    expect(result).toBe(true)
  })

  test('isEncrypted should return false for plain text', async () => {
    const value = 'plainText'
    const result = await isEncrypted(value)

    expect(result).toBe(false)
  })

  test('should be able to encrypt with a specific key', async () => {
    const key = 'k1.aesgcm256.4ewSLbSkxyOrnQxzJusVjEEgqOh6oEKFnB4c7I4CN4A='
    const value = 'plainText'

    expect(await decryptString(await encryptString(value, key), key)).toBe(
      value
    )
  })
})

import {
  decryptString,
  encryptString,
  findKeyForMessage,
  generateKey,
  makeKeychain,
  parseCloakedString,
  parseKey,
} from './index'

import {
  decryptString as decryptString47ng,
  encryptString as encryptString47ng,
} from '@47ng/cloak'

test('Key generation', () => {
  const key = generateKey()

  expect(key.startsWith('k1.aesgcm256.')).toBeTruthy()
  expect(key.length).toEqual(57)
})

describe('v1 format', () => {
  test('Encrypt / decrypt', async () => {
    const key = 'k1.aesgcm256.2itF7YmMYIP4b9NNtKMhIx2axGi6aI50RcwGBiFq-VA='
    const expected = 'Hello, World !'
    const cipher = await encryptString(expected, key)
    const received = await decryptString(cipher, key)

    expect(received).toEqual(expected)
  })

  test('Encrypt / decrypt compatibility 001', async () => {
    const key = 'k1.aesgcm256.2itF7YmMYIP4b9NNtKMhIx2axGi6aI50RcwGBiFq-VA='
    const expected = 'Hello, World !'
    const cipher = await encryptString(expected, key)
    const received = await decryptString47ng(cipher, key)

    expect(received).toEqual(expected)
  })

  test('Encrypt / decrypt compatibility 002', async () => {
    const key = 'k1.aesgcm256.2itF7YmMYIP4b9NNtKMhIx2axGi6aI50RcwGBiFq-VA='
    const expected = 'Hello, World !'
    const cipher = await encryptString47ng(expected, key)
    const received = await decryptString(cipher, key)

    expect(received).toEqual(expected)
  })

  test('Encrypt / decrypt 4 MiB string', async () => {
    const key = 'k1.aesgcm256.2itF7YmMYIP4b9NNtKMhIx2axGi6aI50RcwGBiFq-VA='
    const expected = 'a'.repeat(4_194_304) // 2 ** 22 = 4 MiB
    const cipher = await encryptString(expected, key)
    const received = await decryptString(cipher, key)

    expect(received).toEqual(expected)
  })

  test('Encrypt empty string', async () => {
    const key = 'k1.aesgcm256.2itF7YmMYIP4b9NNtKMhIx2axGi6aI50RcwGBiFq-VA='
    const expected = ''
    const cipher = await encryptString(expected, key)
    const received = await decryptString(cipher, key)

    expect(received).toEqual(expected)
  })

  test('Decrypt known message (empty string)', async () => {
    const key = 'k1.aesgcm256.2itF7YmMYIP4b9NNtKMhIx2axGi6aI50RcwGBiFq-VA='
    const cipher =
      'v1.aesgcm256.710bb0e2.9tZkprVBt4L7ZW_U.GDrlM3U_P0UnHf38HvOCgQ=='
    const expected = ''
    const received = await decryptString(cipher, key)

    expect(received).toEqual(expected)
  })

  test('Decrypt known message', async () => {
    const key = 'k1.aesgcm256.2itF7YmMYIP4b9NNtKMhIx2axGi6aI50RcwGBiFq-VA='
    const cipher =
      'v1.aesgcm256.710bb0e2.F5wkSytfdVv4xvtN.8uNajc7ufhVmMFpDdzWgKMKhOY4ZR2OSv1DFjvnm'
    const expected = 'Hello, World !'
    const received = await decryptString(cipher, key)

    expect(received).toEqual(expected)
  })

  test('Decrypt known message from browser', async () => {
    const key = 'k1.aesgcm256.CO6hoJ8l1nAmXpuCcuNg-l5g3Nn63X36lBwhsNepUEY='
    const cipher =
      'v1.aesgcm256.4eb11c57.UAuPXcQZV_e40NP6.OvVOoWCXhMB_G-giNtAbDYZI0sfJomHUAW0vpxKV'
    const expected = 'Hello, World !'
    const received = await decryptString(cipher, key)

    expect(received).toEqual(expected)
  })

  test('Ciphertext & IV are rotated', async () => {
    const key = 'k1.aesgcm256.2itF7YmMYIP4b9NNtKMhIx2axGi6aI50RcwGBiFq-VA='
    const cipher1 = await encryptString('Hello, World !', key)
    const cipher2 = await encryptString('Hello, World !', key)

    expect(cipher1).not.toEqual(cipher2)
  })

  test('Fingerprinting & keychain', async () => {
    const keyA = 'k1.aesgcm256.2itF7YmMYIP4b9NNtKMhIx2axGi6aI50RcwGBiFq-VA='
    const keyB = 'k1.aesgcm256.caNwte-JDsVUATl3qCQgu9ZPuHAiJhWSOn0pcgGhwyE='
    const cipherA = await encryptString('Hello', keyA)
    const cipherB = await encryptString('Hello', keyB)
    const keychain = await makeKeychain([keyA, keyB])
    const keyForA = findKeyForMessage(cipherA, keychain)
    const keyForB = findKeyForMessage(cipherB, keychain)

    expect(keyForA).toEqual(await parseKey(keyA))

    expect(keyForB).toEqual(await parseKey(keyB))
  })

  test('Parse key', async () => {
    const key = 'k1.aesgcm256.2itF7YmMYIP4b9NNtKMhIx2axGi6aI50RcwGBiFq-VA='
    const parsedKey = await parseKey(key)
    const expected = 'Hello, World !'
    const cipher = await encryptString(expected, parsedKey)
    const received = await decryptString(cipher, parsedKey)

    expect(received).toEqual(expected)
  })

  test('Rejects ciphertext with invalid characters', () => {
    // @note ensures parseCloakedString returns false for malformed ciphertexts
    // instead of passing through to b64.decode which would throw an unexpected error
    const malformed =
      'v1.aesgcm256.710bb0e2.9tZkprVBt4L7ZW_U.!!!!!!!!!!!!!!!!!!!!!!!!!='

    expect(parseCloakedString(malformed)).toBe(false)
  })
})

describe('additional authenticated data', () => {
  const key = 'k1.aesgcm256.2itF7YmMYIP4b9NNtKMhIx2axGi6aI50RcwGBiFq-VA='

  test('round trips with matching AAD', async () => {
    const cipher = await encryptString('Hello', key, {
      additionalData: 'Secret.value',
    })
    const received = await decryptString(cipher, key, {
      additionalData: 'Secret.value',
    })

    expect(received).toEqual('Hello')
  })

  test('AAD is not carried in the message', async () => {
    const cipher = await encryptString('Hello', key, {
      additionalData: 'Secret.value',
    })

    expect(parseCloakedString(cipher)).toBeTruthy()
    expect(cipher).not.toContain('Secret')
  })

  test('rejects a different AAD', async () => {
    const cipher = await encryptString('Hello', key, {
      additionalData: 'Secret.value',
    })

    await expect(
      decryptString(cipher, key, { additionalData: 'SecretValue.value' })
    ).rejects.toThrow()
  })

  test('rejects a missing AAD', async () => {
    const cipher = await encryptString('Hello', key, {
      additionalData: 'Secret.value',
    })

    await expect(decryptString(cipher, key)).rejects.toThrow()
  })

  test('rejects an unexpected AAD on a message encrypted without one', async () => {
    const cipher = await encryptString('Hello', key)

    await expect(
      decryptString(cipher, key, { additionalData: 'Secret.value' })
    ).rejects.toThrow()
  })

  test('accepts raw bytes', async () => {
    const aad = new Uint8Array([1, 2, 3])
    const cipher = await encryptString('Hello', key, { additionalData: aad })
    const received = await decryptString(cipher, key, { additionalData: aad })

    expect(received).toEqual('Hello')
  })
})

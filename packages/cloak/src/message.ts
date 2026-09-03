import { decryptAesGcm, encryptAesGcm } from './ciphers/aes-gcm'
import type { ParsedCloakKey, TextCloakKey } from './key'
import { importKey, parseKey } from './key'

import { b64, utf8 } from '@47ng/codec'

export type CloakedString = string

export interface CloakOptions {
  /**
   * Additional authenticated data (AEAD). A string is UTF-8 encoded. The
   * value is not stored in the message; the same value must be supplied to
   * `decryptString` or decryption fails with an authentication error.
   */
  additionalData?: string | Uint8Array
}

function toAdditionalData(
  value: string | Uint8Array | undefined
): Uint8Array | undefined {
  if (value === undefined) {
    return undefined
  }

  return typeof value === 'string' ? new Uint8Array(utf8.encode(value)) : value
}

export function encodeEncryptedString(
  fingerprint: string,
  iv: Uint8Array,
  ciphertext: Uint8Array
) {
  return [
    'v1',
    'aesgcm256',
    fingerprint,
    b64.encode(iv),
    b64.encode(ciphertext),
  ].join('.')
}

export async function encryptString(
  input: string,
  key: TextCloakKey | ParsedCloakKey,
  options: CloakOptions = {}
): Promise<CloakedString> {
  if (typeof key === 'string') {
    key = await parseKey(key, 'encrypt')
  }

  const { text: ciphertext, iv } = await encryptAesGcm(key.key, input, {
    additionalData: toAdditionalData(options.additionalData),
  })

  return encodeEncryptedString(key.fingerprint, iv, ciphertext)
}

export const cloakedStringRegex =
  /^v1\.aesgcm256\.(?<fingerprint>[0-9a-fA-F]{8})\.(?<iv>[a-zA-Z0-9-_]{16})\.(?<ciphertext>[a-zA-Z0-9-_]{22,})={0,2}$/

function isBase64(str: string) {
  // @note validate all characters are valid base64url characters before checking padding
  if (!/^[a-zA-Z0-9-_]*={0,2}$/.test(str)) {
    return false
  }

  const len = str.length
  const firstPaddingChar = str.indexOf('=')

  return (
    firstPaddingChar === -1 ||
    firstPaddingChar === len - 1 ||
    (firstPaddingChar === len - 2 && str[len - 1] === '=')
  )
}

export function parseCloakedString(input: CloakedString) {
  const [version, algorithm, fingerprint, iv, ciphertext, nothing] =
    input.split('.')

  const isCloakedString =
    version === 'v1' &&
    algorithm === 'aesgcm256' &&
    /^[0-9a-f]{8}$/i.test(fingerprint) &&
    /^[a-zA-Z0-9-_]{16}$/.test(iv) &&
    isBase64(ciphertext) &&
    ciphertext.length >= 24 &&
    nothing === undefined

  if (isCloakedString === false) {
    return false
  } else {
    return {
      groups: {
        fingerprint,
        iv,
        ciphertext,
      },
    }
  }
}

export async function decryptString(
  input: CloakedString,
  key: TextCloakKey | ParsedCloakKey,
  options: CloakOptions = {}
): Promise<string> {
  const match = parseCloakedString(input)

  if (!match) {
    throw new Error(`Unknown message format`)
  }

  const iv = match.groups.iv
  const ciphertext = match.groups.ciphertext

  let aesKey: CryptoKey

  if (typeof key === 'string') {
    aesKey = await importKey(key, 'decrypt')
  } else {
    aesKey = key.key
  }

  return await decryptAesGcm(
    aesKey,
    {
      iv: b64.decode(iv),
      text: b64.decode(ciphertext),
    },
    {
      additionalData: toAdditionalData(options.additionalData),
    }
  )
}

export function getMessageKeyFingerprint(message: CloakedString) {
  const match = parseCloakedString(message)

  if (!match) {
    throw new Error('Unknown message format')
  }

  return match.groups.fingerprint
}

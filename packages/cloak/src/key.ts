import { b64, hex, utf8 } from '@47ng/codec'

export const FINGERPRINT_LENGTH = 8

export const cloakKeyRegex = /^k1\.aesgcm256\.(?<key>[a-zA-Z0-9-_]{43}=?)$/

export type TextCloakKey = string

export interface ParsedCloakKey {
  key: CryptoKey
  fingerprint: string
}

export function formatKey(raw: Uint8Array) {
  return ['k1', 'aesgcm256', b64.encode(raw)].join('.')
}

export async function parseKey(
  key: TextCloakKey,
  usage?: 'encrypt' | 'decrypt'
): Promise<ParsedCloakKey> {
  return {
    key: await importKey(key, usage),
    fingerprint: await getKeyFingerprint(key),
  }
}

export async function serializeKey(key: ParsedCloakKey): Promise<TextCloakKey> {
  return formatKey(await exportKey(key.key))
}

export function generateKey(): TextCloakKey {
  const keyLength = 32

  const key = crypto.getRandomValues(new Uint8Array(keyLength))

  return formatKey(key)
}

export async function exportCryptoKey(key: CryptoKey): Promise<TextCloakKey> {
  const algo = key.algorithm as AesKeyAlgorithm

  if (algo.name !== 'AES-GCM' || algo.length !== 256) {
    throw new Error('Unsupported key type')
  }

  return formatKey(await exportKey(key))
}

export async function importKey(
  key: TextCloakKey,
  usage?: 'encrypt' | 'decrypt'
): Promise<CryptoKey> {
  const match = key.match(cloakKeyRegex)

  if (!match) {
    throw new Error('Unknown key format')
  }

  const raw = b64.decode(match.groups!.key)

  return await crypto.subtle.importKey(
    'raw',
    new Uint8Array(raw),
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    usage ? [usage] : ['encrypt', 'decrypt']
  )
}

export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}

export async function getKeyFingerprint(key: TextCloakKey): Promise<string> {
  const data = utf8.encode(key)

  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(data))

  return hex.encode(new Uint8Array(hash)).slice(0, FINGERPRINT_LENGTH)
}

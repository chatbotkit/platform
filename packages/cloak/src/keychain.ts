import type { ParsedCloakKey, TextCloakKey } from './key'
import { parseKey, serializeKey } from './key'
import type { CloakedString } from './message'
import {
  decryptString,
  encryptString,
  getMessageKeyFingerprint,
} from './message'

export interface KeychainEntry {
  key: ParsedCloakKey
  createdAt: number // timestamp
  label?: string
}

interface SerializedKeychainEntry {
  key: TextCloakKey
  createdAt: number // timestamp
  label?: string
}

export type CloakKeychain = {
  [fingerprint: string]: KeychainEntry
}

export async function makeKeychain(
  keys: TextCloakKey[]
): Promise<CloakKeychain> {
  const keychain: CloakKeychain = {}

  for (const key of keys) {
    const parsedKey = await parseKey(key)

    keychain[parsedKey.fingerprint] = {
      key: parsedKey,
      createdAt: Date.now(),
    }
  }

  return keychain
}

export async function importKeychain(
  encryptedKeychain: CloakedString,
  masterKey: TextCloakKey
): Promise<CloakKeychain> {
  const json = await decryptString(encryptedKeychain, masterKey)
  const keys: SerializedKeychainEntry[] = JSON.parse(json)
  const keychain: CloakKeychain = {}

  for (const { key, ...rest } of keys) {
    const parsedKey = await parseKey(key)

    keychain[parsedKey.fingerprint] = {
      key: parsedKey,
      ...rest,
    }
  }

  return keychain
}

export async function exportKeychain(
  keychain: CloakKeychain,
  masterKey: TextCloakKey | ParsedCloakKey
): Promise<CloakedString> {
  const rawEntries: KeychainEntry[] = Object.values(keychain)
  const entries: SerializedKeychainEntry[] = []

  for (const entry of rawEntries) {
    entries.push({
      key: await serializeKey(entry.key),
      createdAt: entry.createdAt,
      label: entry.label,
    })
  }

  return await encryptString(JSON.stringify(entries), masterKey)
}

export function findKeyForMessage(
  message: CloakedString,
  keychain: CloakKeychain
): ParsedCloakKey {
  const fingerprint = getMessageKeyFingerprint(message)

  if (!(fingerprint in keychain)) {
    throw new Error('Key is not available')
  }

  return keychain[fingerprint].key
}

export function getKeyAge(
  fingerprint: string,
  keychain: CloakKeychain,
  now: number = Date.now()
) {
  if (!(fingerprint in keychain)) {
    throw new Error('Key is not available')
  }

  return now - keychain[fingerprint].createdAt
}

import type { ParsedCloakKey } from '@chatbotkit-dev/cloak'
import {
  decryptString as ckDecryptString,
  encryptString as ckEncryptString,
  findKeyForMessage as ckFindKeyForMessage,
  getMessageKeyFingerprint as ckGetMessageKeyFingerprint,
  makeKeychain as ckMakeKeychain,
} from '@chatbotkit-dev/cloak'

import { z } from 'zod'

export { decryptString, encryptString } from '@chatbotkit-dev/cloak'

const env = z
  .object({
    CLOAK_ENCRYPTION_KEY: z.string(),
  })
  .parse(process.env)

export async function isEncrypted(value: string): Promise<boolean> {
  try {
    const fingerprint = ckGetMessageKeyFingerprint(value)

    return !!fingerprint
  } catch {
    return false
  }
}

export function getKeys(): string[] {
  return env.CLOAK_ENCRYPTION_KEY.split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

export async function makeKeychain(): Promise<
  Awaited<ReturnType<typeof ckMakeKeychain>>
> {
  return await ckMakeKeychain(getKeys())
}

export async function getKeyForEncryption(): Promise<string> {
  return getKeys()[0]
}

export async function getKeyForDecryption(
  value: string
): Promise<ParsedCloakKey> {
  const keychain = await makeKeychain()

  return await ckFindKeyForMessage(value, keychain)
}

export async function encrypt(value: string): Promise<string> {
  const key = await getKeyForEncryption()

  return await ckEncryptString(value, key)
}

export async function decrypt(value: string): Promise<string> {
  const key = await getKeyForDecryption(value)

  return await ckDecryptString(value, key)
}

export async function encryptObject<T>(object: T): Promise<string> {
  return await encrypt(JSON.stringify(object))
}

export async function decryptObject<T>(value: string): Promise<T> {
  return JSON.parse(await decrypt(value))
}

export async function encryptRecord(
  record: Record<string, unknown>
): Promise<Record<string, unknown>> {
  record = { ...record }

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      record[key] = await encrypt(value)
    }
  }

  return record
}

export async function decryptRecord(
  record: Record<string, unknown>
): Promise<Record<string, unknown>> {
  record = { ...record }

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string' && (await isEncrypted(value))) {
      record[key] = await decrypt(value)
    }
  }

  return record
}

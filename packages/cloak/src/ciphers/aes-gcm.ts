import { utf8 } from '@47ng/codec'

export interface AesCipher {
  iv: Uint8Array
  text: Uint8Array
}

export interface AesGcmOptions {
  /**
   * Additional authenticated data. Not encrypted and not carried in the
   * ciphertext, but bound to it: decryption fails unless the exact same
   * bytes are supplied again. Callers use it to tie a ciphertext to its
   * context (a column, a record) so it cannot be moved somewhere else.
   */
  additionalData?: Uint8Array
}

export async function encryptAesGcm(
  key: CryptoKey,
  message: string,
  options: AesGcmOptions = {}
): Promise<AesCipher> {
  const buf = utf8.encode(message)

  const iv = crypto.getRandomValues(new Uint8Array(12))

  const cipherText = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      ...(options.additionalData
        ? { additionalData: new Uint8Array(options.additionalData) }
        : {}),
    },
    key,
    new Uint8Array(buf)
  )

  return {
    text: new Uint8Array(cipherText),
    iv,
  }
}

export async function decryptAesGcm(
  key: CryptoKey,
  cipher: AesCipher,
  options: AesGcmOptions = {}
): Promise<string> {
  const buf = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(cipher.iv),
      ...(options.additionalData
        ? { additionalData: new Uint8Array(options.additionalData) }
        : {}),
    },
    key,
    new Uint8Array(cipher.text)
  )

  return utf8.decode(new Uint8Array(buf))
}

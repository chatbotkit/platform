import { Base64, isValid as _isValid } from 'js-base64'

export { encode, decode } from 'js-base64'

export function isValid(data: unknown): boolean {
  return _isValid(data) && data !== ''
}

export function encodeUint8Array(
  data: Uint8Array,
  urlSafe: boolean = false
): string {
  return Base64.fromUint8Array(data, urlSafe)
}

export function decodeUint8Array(data: string): Uint8Array {
  return Base64.toUint8Array(data)
}

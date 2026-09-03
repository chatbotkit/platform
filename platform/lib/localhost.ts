import { tryGetRootDomain } from '@/lib/domain'

/**
 * Determines if the given input represents a localhost URL or hostname
 */
export function isLocalhost(input: string): boolean {
  // @note handle empty or invalid input

  if (!input || typeof input !== 'string') {
    return false
  }

  // @note extract hostname from potential URL by removing protocol and path/query/hash

  let hostname = input.trim()

  // @note handle empty string after trimming

  if (!hostname) {
    return false
  }

  // @note remove protocol (http://, https://, etc.)

  if (hostname.includes('://')) {
    hostname = hostname.split('://')[1] || ''
  }

  // @note remove path, query params, and hash

  hostname = hostname.split('/')[0].split('?')[0].split('#')[0]

  // @note remove port number

  hostname = hostname.split(':')[0]

  // @note handle empty hostname after port removal

  if (!hostname) {
    return false
  }

  // @note remove trailing dots for IP addresses and hostnames

  hostname = hostname.replace(/\.+$/, '')

  // @note handle empty hostname after trailing dot removal

  if (!hostname) {
    return false
  }

  // @note tryDomain returns null for uppercase localhost, so handle case-insensitively

  const lowerHostname = hostname.toLowerCase()

  // @note check for localhost or 127.x.x.x addresses directly

  if (lowerHostname === 'localhost' || lowerHostname.startsWith('127.')) {
    return true
  }

  // @note try parsing through domain parser for edge cases

  const host = tryGetRootDomain(hostname)

  return host === 'localhost' || (host !== null && host.startsWith('127.'))
}

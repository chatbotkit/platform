import {
  RUNAS_TEAMID_COOKIE_NAME,
  RUNAS_TEAMNAME_COOKIE_NAME,
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'
import { siteUrl } from '@/config/site'

import { getContextRequestProtocol } from '@/lib/context.store'
import { parse, stringify } from '@/lib/cookie'
import { getHeader, setHeader } from '@/lib/header'

// Safari drops Secure cookies on plain-http origins (localhost included), so
// the attribute follows the request scheme, falling back to the site scheme

function runasCookieAttributes(): string {
  const protocol =
    getContextRequestProtocol() || new URL(siteUrl).protocol.slice(0, -1)

  return `Path=/; ${protocol === 'https' ? 'Secure; ' : ''}SameSite=Lax`
}

export function runasCookie(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}; ${runasCookieAttributes()}`
}

export function expiredRunasCookie(name: string): string {
  return `${name}=; ${runasCookieAttributes()}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

export function withoutTeamAndUserRunasCookies(fn) {
  return async function (req, ...args) {
    const cookie = getHeader(req, 'cookie')

    const cookies = parse(cookie || '')

    cookies.remove(RUNAS_TEAMID_COOKIE_NAME)
    cookies.remove(RUNAS_TEAMNAME_COOKIE_NAME)
    cookies.remove(RUNAS_USERID_COOKIE_NAME)
    cookies.remove(RUNAS_USERNAME_COOKIE_NAME)

    const header = stringify(cookies)

    setHeader(req, 'cookie', header)

    return await fn(req, ...args)
  }
}

export function withoutUserRunasCookies(fn) {
  return async function (req, ...args) {
    const cookie = getHeader(req, 'cookie')

    const cookies = parse(cookie || '')

    cookies.remove(RUNAS_USERID_COOKIE_NAME)
    cookies.remove(RUNAS_USERNAME_COOKIE_NAME)

    const header = stringify(cookies)

    setHeader(req, 'cookie', header)

    return await fn(req, ...args)
  }
}

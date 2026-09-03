import {
  RUNAS_TEAMID_COOKIE_NAME,
  RUNAS_TEAMNAME_COOKIE_NAME,
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'

import { parse, stringify } from '@/lib/cookie'
import { getHeader, setHeader } from '@/lib/header'

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

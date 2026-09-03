import { appSlugs } from '@/config/apps'

import { isAppHostname } from '@/lib/app.helpers'
import {
  API_AUDIENCE,
  APP_AUDIENCE,
  ENDUSER_BOT_SESSION_CREATE_AUDIENCE,
  ENDUSER_CONVERSATION_AUDIENCE,
  ENDUSER_INTEGRATION_WIDGET_SESSION_CREATE_AUDIENCE,
  NONE_AUDIENCE,
  USER_AUDIENCE,
} from '@/lib/audience.consts'
import {
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import debug, { assert } from '@/lib/debug'
import { match as globMatch } from '@/lib/glob'
import { tryVerify as tryVerifyJwt } from '@/lib/jwt'
import { throwNotAuthorized } from '@/lib/response'

/**
 * Token payload interface
 */
export interface TokenPayload {
  aud: string
  sub?: string
  exp?: number

  userId?: string

  conversationId?: string

  botId?: string

  widgetIntegrationId?: string

  allowedRoutes?: string[]

  options?: Record<string, unknown>

  [key: string]: unknown
}

/**
 * Request type with optional URL property
 */
export interface Req {
  url?: string
}

/**
 * Route matcher type - can be string, RegExp, or Glob pattern
 */
export type RouteMatcher = string | RegExp | Glob

/**
 * Payload verifier function type
 */
export type PayloadVerifier = (req: Req) => TokenPayload

/**
 * Payload verifier factory function type
 */
export type PayloadVerifierFactory = (payload: TokenPayload) => PayloadVerifier

export function isSecretKey(token: string): boolean {
  return token.startsWith('sk-')
}

export function isOAuthAccessToken(token: string): boolean {
  return token.startsWith('oaac-')
}

export function isOAuthRefreshToken(token: string): boolean {
  return token.startsWith('oart-')
}

export function isJwtToken(token: string): boolean {
  return token.split('.').length === 3
}

/**
 * Encapsulates glob pattern matching for route validation
 */
export class Glob {
  #patterns: string[]

  constructor(patterns: string | string[], prefixes: string[] = []) {
    this.#patterns = Array.isArray(patterns) ? patterns : [patterns]

    if (prefixes.length > 0) {
      this.#patterns = prefixes.flatMap((prefix) =>
        this.#patterns.map((pattern) => {
          let op = ''

          if (pattern.startsWith('!')) {
            op = '!'
            pattern = pattern.slice(1)
          }

          if (!pattern.startsWith(prefix)) {
            pattern = prefix + pattern
          }

          return op + pattern
        })
      )
    }
  }

  test(route: string): boolean {
    return globMatch(route, this.#patterns)
  }
}

export function validateReq(req: Req, allowedRoutes: RouteMatcher[]): void {
  debug(`validateReq`, { url: req.url, allowedRoutes }).log('token.validateReq')

  assert(!!req.url, 'Request url is required')

  const url = req.url || ''

  let route: string

  if (/^https?:\/\//.test(url)) {
    route = new URL(url).pathname
  } else {
    route = url
  }

  const stringMatchRoutes = allowedRoutes
    .filter((r): r is string => typeof r === 'string')
    .some((r) => r === route)

  const regexMatchRoutes = allowedRoutes
    .filter((r): r is RegExp => r instanceof RegExp)
    .some((r) => r.test(route))

  const globMatchRoutes = allowedRoutes
    .filter((r): r is Glob => r instanceof Glob)
    .some((r) => r.test(route))

  if (!stringMatchRoutes && !regexMatchRoutes && !globMatchRoutes) {
    throwNotAuthorized(`Request is not matching allowed routes`)
  }
}

export const payloadVerifiers: Record<string, PayloadVerifierFactory> = {
  default: () => () => {
    return throwNotAuthorized(`Default token audience used`)
  },

  /**
   * Associated with default permissions which do not allow any access to
   * resources.
   */
  [NONE_AUDIENCE]: (payload) => (req) => {
    const allowedRoutes: RouteMatcher[] = []

    validateReq(req, allowedRoutes)

    return payload
  },

  /**
   * Associated with any authenticated user with full access to their own data
   * and the ability to perform actions on their own behalf.
   */
  [USER_AUDIENCE]: (payload) => (req) => {
    // @note if allowedRoutes is specified in the payload, restrict token usage
    // to only those routes that match the glob patterns

    const allowedRoutes: RouteMatcher[] = payload.allowedRoutes
      ? Array.isArray(payload.allowedRoutes)
        ? [new Glob(payload.allowedRoutes, ['/'])]
        : [] // @note if invalid format, block all routes
      : [new RegExp(`.+`)]

    validateReq(req, allowedRoutes)

    return payload
  },

  /**
   * Associated with permissions for API access to resources.
   */
  [API_AUDIENCE]: (payload) => (req) => {
    const allowedRoutes: RouteMatcher[] = payload.allowedRoutes
      ? Array.isArray(payload.allowedRoutes)
        ? [new Glob(payload.allowedRoutes, ['/api/v1/', '/v1/'])]
        : [] // @note if invalid format, block all routes
      : [new RegExp(`/(api/v1|v1)/.+`)]

    validateReq(req, allowedRoutes)

    return payload
  },

  /**
   * Associated with permissions for specific applications and their resources.
   */
  [APP_AUDIENCE]: (payload) => (req) => {
    const allowedRoutes: RouteMatcher[] = []

    // @note a custom frontend domain is public identity while the request
    // host retains the app or portal hostname used for internal routing -
    // behind the portal gateway the frontend host is the customer's domain,
    // so preferring it would leave the allowlist empty and reject every
    // portal session

    const host = [getContextFrontendHost(), getContextRequestHost()].find(
      (candidate) => candidate && isAppHostname(candidate)
    )

    if (host) {
      allowedRoutes.push('/')
      allowedRoutes.push(new RegExp(`^/(${appSlugs.join('|')})/.+`))
    }

    validateReq(req, allowedRoutes)

    return payload
  },

  /**
   * Associated with mechanisms that allow end-users to interact with some types
   * related to conversations. This is used typically for widgets and other
   * client-side applications.
   */
  [ENDUSER_CONVERSATION_AUDIENCE]: (payload) => (req) => {
    const { conversationId } = payload

    if (!conversationId) {
      throw new Error(`Conversation id is required`)
    }

    const allowedRoutes: RouteMatcher[] = [
      // v1
      `/api/v1/url/unfurl`, // @todo more protection required here
      `/api/v1/conversation/${conversationId}/initiate`,
      `/api/v1/conversation/${conversationId}/complete`,
      `/api/v1/conversation/${conversationId}/send`,
      `/api/v1/conversation/${conversationId}/receive`,
      `/api/v1/conversation/${conversationId}/contact/upsert`,
      `/api/v1/conversation/${conversationId}/attachment/upload`, // @todo more protection required here
      `/v1/url/unfurl`, // @todo more protection required here
      `/v1/conversation/${conversationId}/complete`,
      `/v1/conversation/${conversationId}/send`,
      `/v1/conversation/${conversationId}/receive`,
      `/v1/conversation/${conversationId}/contact/upsert`,
      `/v1/conversation/${conversationId}/attachment/upload`, // @todo more protection required here

      new RegExp(
        `^/api/v1/conversation/${conversationId}/message/.+?/(?:up|down)vote$`
      ),
      new RegExp(
        `^/v1/conversation/${conversationId}/message/.+?/(?:up|down)vote$`
      ),

      new RegExp(`^/api/v1/channel/[^/]+/publish$`), // @todo more protection required here
      new RegExp(`^/v1/channel/[^/]+/publish$`), // @todo more protection required here

      new RegExp(
        `^/api/v1/conversation/${conversationId}/message/.+?/synthesize$`
      ), // @todo more protection required here
      new RegExp(`^/v1/conversation/${conversationId}/message/.+?/synthesize$`), // @todo more protection required here
    ]

    validateReq(req, allowedRoutes)

    return payload
  },

  /**
   * Associated with mechanisms that allow end-users to create a new session
   * with a bot. This is used typically for widgets and other client-side
   * applications.
   */
  [ENDUSER_BOT_SESSION_CREATE_AUDIENCE]: (payload) => (req) => {
    const { botId } = payload

    if (!botId) {
      throw new Error(`Bot id is required`)
    }

    const allowedRoutes: RouteMatcher[] = [
      // v1
      `/api/v1/bot/${botId}/session/create`,
      `/v1/bot/${botId}/session/create`,
    ]

    validateReq(req, allowedRoutes)

    return payload
  },

  [ENDUSER_INTEGRATION_WIDGET_SESSION_CREATE_AUDIENCE]: (payload) => (req) => {
    const { widgetIntegrationId } = payload

    if (!widgetIntegrationId) {
      throw new Error(`Widget integration id is required`)
    }

    const allowedRoutes: RouteMatcher[] = [
      // v1
      `/api/v1/integration/widget/${widgetIntegrationId}/session/create`,
      `/v1/integration/widget/${widgetIntegrationId}/session/create`,
    ]

    validateReq(req, allowedRoutes)

    return payload
  },
}

export async function getPayloadVerifier(
  payload: TokenPayload
): Promise<PayloadVerifier> {
  const makeVerifier = payloadVerifiers[payload.aud] || payloadVerifiers.default

  return makeVerifier(payload)
}

export async function getJwtTokenVerifier(
  token: string
): Promise<PayloadVerifier | null> {
  const tokenPayload = await tryVerifyJwt(token)

  // @note return null for invalid tokens instead of throwing

  if (!tokenPayload) {
    return null
  }

  return await getPayloadVerifier(tokenPayload as TokenPayload)
}

export async function verifyToken(
  token: string,
  req: Req
): Promise<TokenPayload> {
  let verifier: PayloadVerifier | null = null

  if (isJwtToken(token)) {
    verifier = await getJwtTokenVerifier(token)
  }

  if (!verifier) {
    throwNotAuthorized(`Unrecognized token format`)
  }

  return verifier(req)
}

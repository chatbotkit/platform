// The outbound egress boundary for requests whose destination a user or a
// model chose. `lib/egress.fetch.ts` is the entry point callers use; this
// module is the address logic and the dispatcher behind it.
//
// Without a boundary those requests can reach the loopback interface, the
// private network the application runs in, the link-local range and, on
// cloud hosts, the instance metadata service that hands out credentials. A
// hostname check is not a boundary: an attacker's DNS name can resolve to
// 10.0.0.1, or resolve to a public address once and a private one on the next
// lookup.
//
// The check therefore happens where the connection is made. An undici
// `Agent` with a custom connector validates every literal address and every
// DNS answer at connect time, for every hop of every redirect, and the
// connection uses exactly the addresses it validated - so there is no gap
// between the check and the connect for rebinding to slip through. Node's
// global `fetch` accepts the agent as `dispatcher`, so callers keep the
// platform's ordinary fetch path.
//
// There is no allowlist and no switch: a request to an internal address is not
// something the application ever makes on a user's or model's behalf. The one
// exemption is the deployment itself. The platform fetches its own URLs like
// any other - proxied images, attachments, presigned objects - so the origins
// the operator configured (site, static, widget, API, app shells) connect
// unchecked, and where the site itself lives on loopback (development, the
// Community and Studio stacks) so does every loopback and `*.localhost`
// destination, which is where such a stack's store and relay answer. Being
// derived from configuration, that is not a switch: a hosted deployment's
// origins are public and gain nothing.
import { appLabsOrigin, appMainOrigin } from '@/config/origins'
import { apiUrl, siteUrl, staticUrl, widgetUrl } from '@/config/site'

import { isDevelopment } from '@/lib/env'
import { isForbiddenAddress, isIpAddress, isLoopbackAddress } from '@/lib/ip'

import { lookup as dnsLookup } from 'node:dns'
import type { LookupAddress, LookupOptions } from 'node:dns'
import type * as Undici from 'undici'
import type { Agent, Dispatcher } from 'undici'

export class EgressError extends Error {
  readonly egress = true as const

  readonly address: string

  constructor(address: string, reason: string) {
    super(`egress to ${address} is not allowed: ${reason}`)

    this.name = 'EgressError'
    this.address = address
  }
}

type LookupCallback = (
  err: (Error & { code?: string }) | null,
  address: string | LookupAddress[],
  family?: number
) => void

/**
 * A `dns.lookup` that refuses to answer with a forbidden address. Every
 * answer is checked and the whole lookup fails if any of them is forbidden,
 * so a name that mixes a public address with a private one cannot be used
 * to reach the private one on retry.
 */
export function guardedLookup(
  hostname: string,
  options: LookupOptions | number | undefined,
  callback: LookupCallback
): void {
  const lookupOptions: LookupOptions =
    typeof options === 'number' ? { family: options } : { ...(options || {}) }

  dnsLookup(hostname, { ...lookupOptions, all: true }, (err, addresses) => {
    if (err) {
      callback(err, [])

      return
    }

    const list = Array.isArray(addresses) ? addresses : [addresses]

    if (list.length === 0) {
      callback(
        Object.assign(new EgressError(hostname, 'no addresses'), {
          code: 'ENOTFOUND',
        }),
        []
      )

      return
    }

    const forbidden = list.find((entry) => isForbiddenAddress(entry.address))

    if (forbidden) {
      callback(
        new EgressError(
          hostname,
          `resolves to ${forbidden.address}, which is not a public address`
        ),
        []
      )

      return
    }

    if (lookupOptions.all) {
      callback(null, list)
    } else {
      callback(null, list[0].address, list[0].family)
    }
  })
}

/**
 * Whether a hostname names the machine itself: `localhost`, a `*.localhost`
 * name (resolved to loopback by browsers and the Compose stacks alike) or a
 * loopback address.
 */
export function isLoopbackHostname(hostname: string): boolean {
  const name = hostname.toLowerCase()

  return (
    name === 'localhost' ||
    name.endsWith('.localhost') ||
    isLoopbackAddress(name)
  )
}

export interface SelfDeployment {
  /** `hostname:port` of every origin the deployment answers on */
  hosts: Set<string>
  /** whether the site itself lives on loopback */
  loopback: boolean
}

function defaultPort(protocol: string): number {
  return protocol === 'https:' || protocol === 'wss:' ? 443 : 80
}

function toHostKey(hostname: string, port: number): string {
  return `${hostname.replace(/^\[|\]$/g, '').toLowerCase()}:${port}`
}

/**
 * The deployment as its configuration describes it. Read when a dispatcher
 * is created, so it reflects the origins the process started with.
 */
export function getSelfDeployment(): SelfDeployment {
  const hosts = new Set<string>()

  for (const origin of [
    siteUrl,
    staticUrl,
    widgetUrl,
    apiUrl,
    appMainOrigin,
    appLabsOrigin,
  ]) {
    if (!origin) {
      continue
    }

    try {
      const url = new URL(origin)

      hosts.add(
        toHostKey(url.hostname, Number(url.port) || defaultPort(url.protocol))
      )
    } catch {
      // not a url - not a host
    }
  }

  let loopback = false

  try {
    loopback = isLoopbackHostname(new URL(siteUrl).hostname)
  } catch {
    // not a url - not loopback
  }

  return { hosts, loopback }
}

/**
 * Whether a connection is to the deployment itself and so exempt from the
 * boundary: one of its configured hosts, or any loopback destination where
 * the site itself lives on loopback.
 */
export function isSelfDestination(
  hostname: string,
  port: number,
  self: SelfDeployment
): boolean {
  if (self.hosts.has(toHostKey(hostname, port))) {
    return true
  }

  return self.loopback && isLoopbackHostname(hostname.replace(/^\[|\]$/g, ''))
}

/**
 * Creates the dispatcher every guarded request goes through. Literal
 * addresses are checked in the connector - `net.connect` does not consult
 * `lookup` for them - and names are checked by `guardedLookup` at resolution.
 * Because undici follows redirects through the same dispatcher, each hop is
 * checked the same way. Connections to the deployment itself skip both
 * checks and resolve through the plain resolver, since on the Compose stacks
 * its own names answer from the private network.
 */
export function createEgressDispatcher(
  options: Agent.Options = {},
  self: SelfDeployment = getSelfDeployment()
): Dispatcher {
  // @note loaded here rather than at the top: undici is server-only and
  // this module is imported by code whose tests run under jsdom
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Agent, buildConnector } = require('undici') as typeof Undici

  const connectOptions =
    typeof options.connect === 'object' ? options.connect : {}

  const connect = buildConnector({
    ...connectOptions,
    lookup: guardedLookup,
  })

  const connectSelf = buildConnector({
    ...connectOptions,
    lookup: dnsLookup as typeof guardedLookup,
  })

  return new Agent({
    ...options,

    connect(connectOptions, callback) {
      const { hostname, port, protocol } = connectOptions

      if (
        isSelfDestination(hostname, Number(port) || defaultPort(protocol), self)
      ) {
        connectSelf(connectOptions, callback)

        return
      }

      if (isIpAddress(hostname) && isForbiddenAddress(hostname)) {
        callback(new EgressError(hostname, 'not a public address'), null)

        return
      }

      connect(connectOptions, callback)
    },
  })
}

let dispatcher: Dispatcher | undefined

/**
 * The process-wide dispatcher for user- and model-chosen destinations, or
 * undefined in development where the application itself lives on localhost.
 * `lib/egress.fetch.ts` passes it as `dispatcher` to `fetch`.
 */
export function getEgressDispatcher(): Dispatcher | undefined {
  if (isDevelopment) {
    return undefined
  }

  dispatcher ??= createEgressDispatcher()

  return dispatcher
}

/**
 * The given request options with the egress dispatcher applied, or the
 * options untouched where no dispatcher applies (development).
 */
export function withEgressDispatcher(
  init?: RequestInit
): RequestInit | undefined {
  const egress = getEgressDispatcher()

  if (!egress) {
    return init
  }

  // @note undici's option, accepted by Node's global fetch
  return { ...init, dispatcher: egress } as RequestInit
}

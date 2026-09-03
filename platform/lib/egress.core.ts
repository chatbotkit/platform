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
// something the application ever makes on a user's or model's behalf.
// Development is the one exemption, because that is where the application
// itself lives on localhost.

import { lookup as dnsLookup } from 'node:dns'
import type { LookupAddress, LookupOptions } from 'node:dns'

import type * as Undici from 'undici'
import type { Agent, Dispatcher } from 'undici'

import { isDevelopment } from '@/lib/env'
import { isForbiddenAddress, isIpAddress } from '@/lib/ip'

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
 * Creates the dispatcher every guarded request goes through. Literal
 * addresses are checked in the connector - `net.connect` does not consult
 * `lookup` for them - and names are checked by `guardedLookup` at resolution.
 * Because undici follows redirects through the same dispatcher, each hop is
 * checked the same way.
 */
export function createEgressDispatcher(
  options: Agent.Options = {}
): Dispatcher {
  // @note loaded here rather than at the top: undici is server-only and
  // this module is imported by code whose tests run under jsdom
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Agent, buildConnector } = require('undici') as typeof Undici

  const connect = buildConnector({
    ...(typeof options.connect === 'object' ? options.connect : {}),
    lookup: guardedLookup,
  })

  return new Agent({
    ...options,

    connect(connectOptions, callback) {
      const { hostname } = connectOptions

      if (isIpAddress(hostname) && isForbiddenAddress(hostname)) {
        callback(
          new EgressError(hostname, 'not a public address'),
          null
        )

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

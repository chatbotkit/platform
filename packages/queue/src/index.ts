/* eslint-disable no-restricted-globals */
// @note the community queue: the barebone one.
//
// It does the smallest thing that is really a queue - it calls the route back -
// and nothing else. A publish is an immediate `POST` to the local address,
// dispatched without being waited on, carrying a shared secret that
// `authenticate` checks on the way back in. That is the whole implementation,
// and it is enough to develop against: routes fire, handlers run, and the
// asynchronous shape of the code is exercised for real.
//
// What it does not have is the part that needs a process outliving the request:
//
//   delayInSeconds  - ignored. A delay needs something still running when the
//                     delay expires, and there is nothing here that is.
//
//   retries         - ignored. A failed delivery is not attempted again.
//
//   flow            - ignored. Messages are not ordered, rated or serialised
//                     against each other, so `parallel: 1` does not hold.
//
//   callbacks       - ignored. Nothing here observes whether a delivery
//                     succeeded, so there is no outcome to report.
//
// Each of those is accepted and dropped rather than rejected, which is a
// deliberate choice and the one worth arguing about. Throwing would make every
// caller that passes an option this cannot honour fail in development while
// working in production - which is worse than the surprise it prevents, since
// the surprise is documented here and the failure would not be. The contract
// marks `flow` advisory for exactly this reason.
//
// Deduplication *is* honoured, in process and for half an hour, because it is
// the one option that can be implemented without outliving anything.

import type {
  QueueAuthentication,
  QueueDelivery,
  QueuePublishOptions,
  QueueProvider,
} from '@chatbotkit-dev/queue-spec'

export type * from '@chatbotkit-dev/queue-spec'

const DEDUPLICATION_WINDOW_MS = 30 * 60 * 1000

/**
 * @note the delivery is raced against a one second timer and the loser is
 * abandoned, which is how a publish stays off the critical path of the request
 * that triggered it. The handler keeps running; nothing here observes whether
 * it succeeded.
 */
const DISPATCH_TIMEOUT_MS = 1000

/**
 * @note the secret is the deployment's, not this package's. It authenticates
 * the platform to itself - the route being called back checks it before any
 * queue is consulted - so it is read from the environment here rather than
 * invented, and it is deliberately not part of the contract.
 *
 * With none set, a delivery still goes out and is refused on arrival. That is
 * the honest failure: this package cannot prove a delivery is genuine without
 * something to prove it with, and silently accepting one would mean any request
 * to a queued route ran the handler.
 */
function getSecret(): string | undefined {
  const secret = process.env.QUEUE_SECRET

  return secret ? secret.split(',')[0].trim() : undefined
}

/** Deduplication ids seen recently, and when they stop counting. */
const seen = new Map<string, number>()

function isDuplicate(id: string, now: number): boolean {
  const until = seen.get(id)

  if (until !== undefined && until > now) {
    return true
  }

  // @note swept opportunistically rather than on a timer, because a package
  // with no process of its own has no business holding one open. The map only
  // grows while messages are being published, and every publish clears what has
  // expired.

  for (const [key, expiry] of seen) {
    if (expiry <= now) {
      seen.delete(key)
    }
  }

  seen.set(id, now + DEDUPLICATION_WINDOW_MS)

  return false
}

export async function publish(options: QueuePublishOptions): Promise<void> {
  const { localUrl, payload, deduplicationId } = options

  // @note `delayInSeconds`, `retries`, `flow` and `callbacks` are read and
  // dropped - see the note at the top of the file for why that is not an
  // oversight.

  if (deduplicationId && isDuplicate(deduplicationId, Date.now())) {
    return
  }

  const url = new URL(localUrl)

  const secret = getSecret()

  if (secret) {
    url.searchParams.set('secret', secret)
  }

  const delivery = fetch(url, {
    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify(payload),
  })

  // @note a failure that happens while we are still waiting reaches the caller;
  // one that happens after the dispatch window does not, because by then
  // nothing is listening and an unhandled rejection in a development server is
  // a process that exits in the middle of the work it just started. This
  // handler is what makes the late case safe without hiding the early one.

  delivery.catch(() => undefined)

  await Promise.race([
    delivery.then(() => undefined),

    new Promise<void>((resolve) => {
      setTimeout(resolve, DISPATCH_TIMEOUT_MS)
    }),
  ])
}

export async function authenticate(
  delivery: QueueDelivery
): Promise<QueueAuthentication> {
  // @note this implementation attaches nothing of its own to a delivery, so
  // there is nothing here to check. Anything reaching this method has already
  // failed the platform's shared-secret check, which is the only proof a
  // barebone queue has - so it is refused, and not reported: a request to a
  // queued route without the secret is somebody probing an endpoint.

  void delivery

  return {
    authenticated: false,
    reason: 'this queue authenticates deliveries with the shared secret only',
  }
}

/**
 * @note a no-op rather than a refusal, because nothing is kept. A delivery that
 * fails here is gone at the moment it fails - there is no store to put it in
 * and nothing that would retry it later - so the caller is asking for something
 * to be forgotten that already is.
 */
export async function discardFailedDeliveries(): Promise<void> {
  // pass
}

/**
 * @note nothing here can be misconfigured, so this resolves. It is worth being
 * explicit that a *generated* secret is not a misconfiguration - it is this
 * package working as designed on a single process. The failure it leads to,
 * every delivery being refused across two processes, is named in the README
 * because no check made from one process can see it.
 */
export async function assertConfigured(): Promise<void> {
  // pass
}

const provider: QueueProvider = {
  publish,
  authenticate,
  discardFailedDeliveries,
  assertConfigured,
}

export default provider

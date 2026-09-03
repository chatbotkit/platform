// @note the deferred work contract.
//
// The platform routinely needs something done that must not happen inside the
// request that asked for it: a conversation to be advanced, a workflow step to
// run after a delay, a webhook to be delivered. It does this by asking a queue
// to call one of its own HTTP routes back, later. Which queue, is a
// deployment's choice.
//
// This contract has two sides, which is what makes it different from every
// other module in this repository. Publishing a message is only half of it -
// the other half arrives later as an inbound request that has to be proved
// genuine, and the proof is whatever the queue that sent it uses. A contract
// with only `publish` would leave the platform verifying one particular
// vendor's signature header, which is precisely the coupling the module is
// meant to remove.
//
// So `publish` and `authenticate` are two ends of one mechanism and have to be
// implemented together. An implementation that signs with a shared secret
// checks that secret; one that signs with an asymmetric key verifies that
// signature. Neither is the platform's business.
//
// What is deliberately absent is a read side. There is no `receive`, no `ack`
// and no `poll`, because the platform never pulls work - it is called back. A
// backend that wants to be polled would need a worker process the platform does
// not have.

/**
 * Ordering and rate limiting for related messages.
 *
 * @note advisory in the same sense as `resources` on the sandbox contract. A
 * backend with no notion of ordering runs the messages anyway, in whatever
 * order it manages; nothing checks whether the constraint was honoured, and no
 * caller can tell the difference except under load.
 *
 * This is the option most likely to be silently absent, and the one where that
 * matters most - `parallel: 1` is how a caller asks for two messages about the
 * same conversation not to run at once. An implementation without it will run
 * them at once, and the caller has no way to find out.
 */
export interface QueueFlow {
  /** Grouping key - messages with the same key are processed together. */
  key: string

  /** Maximum number of messages to process per period. */
  rate?: number

  /** The period the rate applies over, e.g. `1s`, `1m`, `1h`. */
  period?: string

  /** Maximum concurrent messages with this key. `1` is sequential. */
  parallel?: number
}

export interface QueuePublishOptions {
  /**
   * The route to call back, absolute and reachable from the public internet.
   *
   * @note an implementation that delivers from outside the deployment - which
   * is most of them - has to use this one. It is also the address that ends up
   * in the queue's own records, so it must stay resolvable for as long as the
   * message might be retried.
   */
  url: string

  /**
   * The same route, reachable from the process publishing the message.
   *
   * @note the pair exists because the two kinds of implementation need
   * different answers and neither can derive the other. A hosted queue has to
   * reach the deployment from outside; something delivering in-process should
   * not leave the machine to do it, and on a developer's laptop the public
   * address does not resolve at all.
   */
  localUrl: string

  /** The message body, delivered as JSON. */
  payload: Record<string, unknown>

  /**
   * Suppresses a second message with the same id.
   *
   * @note how long the suppression lasts is the implementation's choice and is
   * not part of this contract, because the useful window differs by orders of
   * magnitude between backends. Callers should treat it as "not twice in quick
   * succession" rather than "exactly once".
   *
   * Implementations may restrict which characters an id can contain. One that
   * does must normalise rather than reject: the ids the platform derives are
   * built from external identifiers - resource names with slashes, timestamps
   * with colons - and a rejected id is a message that never gets sent.
   */
  deduplicationId?: string

  /** How long to wait before the first delivery attempt, in seconds. */
  delayInSeconds?: number

  /** How many times to retry a delivery that fails. */
  retries?: number

  flow?: QueueFlow

  /**
   * Where the queue should report the outcome of a delivery.
   *
   * @note advisory: an implementation that does not report outcomes ignores
   * these, and nothing checks whether they were used.
   *
   * They are supplied by the caller rather than derived from `url`, and the
   * difference is load bearing. A message may be addressed to a route on a
   * different host from the one that should hear about it - the platform
   * queues work to its web host and wants the outcome on its API host - so an
   * implementation deriving the callback origin from `url` reports to the wrong
   * place, silently, for exactly the messages that are least ordinary.
   */
  callbacks?: {
    success: string
    failure: string
  }
}

/**
 * An inbound delivery, as it arrives.
 *
 * @note the body is passed separately because it can only be read once, and the
 * caller has already read it - both to verify it and to hand it to the handler.
 * An implementation that needs the raw bytes to check a signature gets them
 * here rather than consuming the request.
 */
export interface QueueDelivery {
  request: Request

  body: ArrayBuffer
}

/**
 * Whether a delivery really came from the queue.
 *
 * @note a rejection carries whether it was *expected*, which is the distinction
 * the platform acts on and one only the implementation can draw. A wrong shared
 * secret is somebody probing an endpoint - routine, and not worth waking anyone
 * for. A missing signature header on a backend that always signs means the
 * delivery path itself is misconfigured, and nobody will find out any other
 * way.
 */
export type QueueAuthentication =
  | { authenticated: true }
  | {
      authenticated: false

      /** For logs. Never shown to whoever made the request. */
      reason: string

      /** Set when this failure should be reported rather than merely refused. */
      unexpected?: boolean
    }

export interface QueueProvider {
  /**
   * Asks for `url` to be called back with `payload`.
   *
   * @note resolves once the queue has accepted the message, not once the work
   * has been done - and on some implementations not even that, since a
   * publish that cannot block the request that triggered it may be dispatched
   * in the background. Callers must not treat this resolving as the work
   * having happened.
   */
  publish(options: QueuePublishOptions): Promise<void>

  /**
   * Decides whether an inbound delivery is genuine.
   *
   * @note this is the half that makes the contract two-sided. Whatever
   * `publish` attached - a signature, a token, nothing at all - is checked
   * here, and the platform is left knowing only whether to run the handler.
   *
   * @note this is consulted *after* the platform has checked its own shared
   * delivery secret, which is how trusted tooling triggers a queued route by
   * hand. An implementation whose only proof is that secret therefore refuses
   * everything it sees here, and correctly so - anything reaching it has
   * already failed the check that would have let it in.
   */
  authenticate(delivery: QueueDelivery): Promise<QueueAuthentication>

  /**
   * Forgets deliveries that will never succeed.
   *
   * @note the platform calls this when a delivery came back with a status that
   * retrying cannot fix - the route is gone, the caller is not allowed, the
   * request was rejected. Anything that might succeed later is deliberately
   * left alone.
   *
   * @note this is the only thing the contract says about deliveries a queue has
   * given up on, because it is the only thing the platform does with them.
   * Listing them and reading one back are operator questions, and an operator
   * is already talking to a particular backend - so those live on whichever
   * implementation is installed, next to the tooling that asks them, rather
   * than as contract surface every future backend has to answer for.
   *
   * The ids come from the queue's own failure report, so they mean nothing to
   * the platform beyond being handed back. Discarding one that is not there is
   * not an error.
   */
  discardFailedDeliveries(ids: string[]): Promise<void>

  /**
   * @note the convention every swappable module follows. See
   * packages/AGENTS.md.
   */
  assertConfigured(): Promise<void>
}

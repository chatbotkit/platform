// @note the platform's side of deferred work.
//
// The queue itself is now `@chatbotkit-dev/queue`, which pnpm resolves to either
// the barebone default or this deployment's backend. What is left here is the
// part that is genuinely the platform's: which of its own routes may be queued
// to, where those routes live, when a publish is allowed to hold up a response,
// and what a session looks like inside a queued handler.
//
// Two things deliberately did not move. `defer` decides whether the publish
// blocks the request that triggered it, which is a property of this
// application's request lifecycle rather than of any queue. And the session
// context established around a delivered handler is the platform's own notion
// of who is running - no backend has an opinion about it.
import queueProvider from '@chatbotkit-dev/queue'
import type { QueueAuthentication } from '@chatbotkit-dev/queue-spec'

import { SECRETS } from '@/config/queue'

import { QUEUE_AUDIENCE } from '@/lib/audience.consts'
import cuid from '@/lib/cuid'
import debug, { createSpan } from '@/lib/debug'
import { defer } from '@/lib/defer'
import { captureUnexpectedState } from '@/lib/error'
import { getExternalAPIHostURL, getLocalAPIHostURL } from '@/lib/host'
import { withAny } from '@/lib/method'
import { queryParam } from '@/lib/query.get'
import {
  captureUnknownException,
  notAuthorized,
  respondFromError,
} from '@/lib/response'
import { runInSessionContext, updateSessionStore } from '@/lib/session.context'
import type { Session } from '@/lib/session.get'

type QueueRoute =
  | `/api/system/${string}`
  | `/api/user/${string}`
  | `/api/v1/${string}`
  | '/api/session/queue'
  | '/api/oauth/queue'

/**
 * Flow control options for ordering and rate limiting queued messages.
 * Messages with the same flow key are processed according to these rules.
 */
interface FlowOptions {
  /** Grouping key - messages with the same key are processed together */
  key: string
  /** Maximum number of messages to process per period (rate limiting) */
  rate?: number
  /** Time period for rate limiting (e.g., '1s', '1m', '1h') */
  period?: string
  /** Maximum concurrent messages with this key (1 = sequential processing) */
  parallel?: number
}

/**
 * Options for queueing messages.
 *
 * @note there was a `useFetch` flag here choosing direct delivery over the
 * queue, defaulting to on in development. It is gone: which delivery path suits
 * the environment is the installed queue's decision, not a caller's, and no
 * caller ever set it.
 */
interface QueueOptions {
  /** Unique ID to prevent duplicate processing of the same message */
  deduplicationId?: string
  /** Delay before processing the message */
  delayInSeconds?: number
  /** Number of retry attempts on failure */
  retries?: number
  /** Flow control for ordering and parallelism of related messages */
  flow?: FlowOptions
}

/**
 * This function will queue a message to be processed by the system. The message
 * will be sent to the queueing system and will be processed asynchronously.
 */
export async function queue(
  route: QueueRoute | URL,
  payload: Record<string, unknown>,
  options?: QueueOptions
): Promise<void> {
  debug(`queue`, { route, payload, options }).log('queue.queue')

  const span = createSpan({ name: 'queue' })

  try {
    // @note both addresses are resolved here because only the platform knows
    // its own hosts, and only the installed queue knows which of the two it can
    // deliver from. See `QueuePublishOptions`.

    const url = new URL(route, getExternalAPIHostURL()).toString()

    const localUrl = new URL(route, getLocalAPIHostURL()).toString()

    // @note always on the API host, never derived from the route. A message may
    // be addressed to the web host, and its outcome still belongs here.

    const apiHost = getExternalAPIHostURL()

    const callbacks = {
      success: new URL('/api/system/queue/callback/post', apiHost).toString(),

      failure: new URL(
        '/api/system/queue/callback/failure/post',
        apiHost
      ).toString(),
    }

    debug(`publishing to queue`, { url, localUrl }).log('queue.queue')

    await defer(async () => {
      const publishSpan = createSpan({ name: 'queue.publish' })

      try {
        await queueProvider.publish({
          url,
          localUrl,
          payload,
          callbacks,
          ...options,
        })
      } finally {
        publishSpan.finish()
      }
    })
  } finally {
    span.finish()
  }
}

/**
 * The queue is a function that can be used to handle incoming requests from
 * the queueing system. It will parse the request body and call the provided
 * function with the parsed body.
 */
export function withQueue<TArgs extends unknown[]>(
  fn: (req: Request, ...args: TArgs) => Promise<Response>
) {
  return withAny<TArgs>(async function (req, ...args: TArgs) {
    // @note read once, here, and handed to both the check and the handler. The
    // body is the thing a signature is computed over, so an implementation that
    // verifies one needs the exact bytes rather than a re-read.

    const body = await req.arrayBuffer()

    // @note the deployment's own delivery secret is checked here rather than by
    // the queue, and that split is deliberate. It authenticates the platform to
    // itself - the trigger scripts use it, and the local delivery path attaches
    // it - so it has nothing to do with which queue is installed, and a queue
    // should not be handed a credential it did not issue.

    const presented = queryParam(req, 'secret')

    const result: QueueAuthentication = presented
      ? SECRETS.includes(presented)
        ? { authenticated: true }
        : {
            authenticated: false,
            reason: 'the presented delivery secret did not match',
          }
      : await queueProvider.authenticate({ request: req, body })

    if (!result.authenticated) {
      debug(`queue delivery refused`, { reason: result.reason }).log(
        'queue.withQueue.auth'
      )

      // @note only the failures the installed queue marks as unexpected are
      // reported. A wrong secret is somebody probing an endpoint; a missing or
      // invalid signature means the delivery path is misconfigured, and nobody
      // finds out about that any other way.

      if (result.unexpected) {
        await captureUnexpectedState(`queue delivery refused`, {
          url: req.url,
          reason: result.reason,
        })
      }

      return notAuthorized()
    }

    debug(`calling queue fn`).log('queue.withQueue')

    try {
      req = new Request(req.url, {
        method: req.method,

        headers: req.headers,

        body: ['HEAD', 'GET'].includes(req.method) ? undefined : body,
      })

      return await runInSessionContext(() => {
        updateSessionStore({
          id: `session-${cuid()}`,

          // @note we cannot assign the user because we do not know who is the
          // user that is making the request - it is a queue request

          // @note it is expected for the implementation to assign the user
          // when the request is being processed

          options: {},

          payload: {
            aud: QUEUE_AUDIENCE,
          },
        } as Session)

        return fn(req, ...args)
      })
    } catch (e) {
      await captureUnknownException(e)

      return respondFromError(e)
    }
  })
}

export default queue

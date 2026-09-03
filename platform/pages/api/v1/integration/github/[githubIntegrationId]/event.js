// @ts-check
import { buf2str } from '@chatbotkit-dev/buffer'

import prisma from '@/prisma/client'

import debug, { warn } from '@/lib/debug'
import { captureException } from '@/lib/error'
import { validateGithubRequest } from '@/lib/github.signature'
import { getHeader } from '@/lib/header'
import { logEvent } from '@/lib/log'
import { withAny } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  NOT_AUTHORIZED_STATUS,
  notAuthorized,
  notFound,
  ok,
} from '@/lib/response'

import { sendEvent } from '@/pages/api/v1/integration/github/[githubIntegrationId]/queue'

/**
 * GitHub webhook receiver. GitHub POSTs events here; we verify the HMAC
 * signature, fast-filter, acknowledge with 200 immediately, and hand the heavy
 * work to the queue. GitHub is lenient on timing but redelivers on non-2xx, so
 * we keep this path thin and always ack.
 */
export default withAny(async function (req) {
  debug(`received github event`).log('integration.github.event.withAny')

  const githubIntegrationId = requiredUrlParam(req, 'githubIntegrationId')

  const githubIntegration = await prisma.githubIntegration.findUnique({
    where: {
      id: githubIntegrationId,
    },
  })

  if (!githubIntegration) {
    return notFound()
  }

  const rawBody = await req.arrayBuffer()
  const rawBodyString = buf2str(rawBody)

  // validate request signature
  {
    // @note an unsigned delivery is unauthenticated: every field below,
    // including the sender, is attacker-controlled. Reject rather than trust it
    // - allowFrom downstream would be meaningless otherwise.
    if (!githubIntegration.webhookSecret) {
      warn(
        `missing webhook secret for github integration - rejecting delivery`
      ).log('integration.github.event.withAny')

      await logEvent({
        user: { id: githubIntegration.userId },
        type: 'integration.github.configuration.error',
        relations: {
          githubIntegrationId,
        },
        meta: {
          status: NOT_AUTHORIZED_STATUS,
          reason: 'There is no webhook secret configured.',
        },
      })

      return notAuthorized()
    }

    try {
      await validateGithubRequest(
        req,
        rawBodyString,
        githubIntegration.webhookSecret
      )

      debug(`github signature validation passed`).log(
        'integration.github.event.withAny'
      )
    } catch (error) {
      warn(`github signature validation failed`, {
        error: error.message,
      }).log('integration.github.event.withAny')

      await logEvent({
        user: { id: githubIntegration.userId },
        type: 'integration.github.configuration.error',
        relations: {
          githubIntegrationId,
        },
        meta: {
          status: NOT_AUTHORIZED_STATUS,
          reason: 'There is a signature verification error.',
        },
      })

      return notAuthorized()
    }
  }

  /** @type {any} */
  let payload

  try {
    payload = JSON.parse(rawBodyString)
  } catch (e) {
    await captureException(e)

    return notAuthorized()
  }

  const eventName = getHeader(req, 'x-github-event') || ''
  const deliveryId = getHeader(req, 'x-github-delivery') || undefined

  debug(`github event`, { eventName, action: payload?.action }).log(
    'integration.github.event.withAny'
  )

  // @note ping is sent once when the webhook is created
  if (eventName === 'ping') {
    return ok({ ok: true })
  }

  const sender = payload?.sender
  const repository = payload?.repository

  // @note recursion guard: ignore events from bots (including this app)
  if (
    sender?.type === 'Bot' ||
    (typeof sender?.login === 'string' && sender.login.endsWith('[bot]'))
  ) {
    debug(`ignoring bot sender to prevent recursion`, {
      sender: sender?.login,
    }).log('integration.github.event.withAny')

    return ok()
  }

  if (!repository) {
    return ok()
  }

  const owner = repository.owner?.login
  const repo = repository.name

  // @note the installation id rides in every event payload; we pass it through
  // to the queue and use it transiently to mint a token to reply
  const installationId = payload?.installation?.id

  switch (eventName) {
    /**
     * Comments on issues and (top-level) pull requests, and inline PR review
     * comments. These carry the @mention summon.
     */
    case 'issue_comment':
    case 'pull_request_review_comment': {
      if (payload.action !== 'created') {
        return ok()
      }

      const isPull =
        eventName === 'pull_request_review_comment' ||
        !!payload.issue?.pull_request

      const issueNumber =
        eventName === 'pull_request_review_comment'
          ? payload.pull_request?.number
          : payload.issue?.number

      if (!issueNumber) {
        return ok()
      }

      const body = payload.comment?.body?.trim() || ''

      // @note the queue performs the precise @mention check. We keep the
      // webhook thin: enqueue comments, drop empties.
      if (!body) {
        return ok()
      }

      await sendEvent(githubIntegrationId, {
        type: 'interact',
        payload: {
          deliveryId,
          installationId,
          eventName,
          action: payload.action,
          owner,
          repo,
          issueNumber,
          isPull,
          commentId: payload.comment?.id,
          senderLogin: sender?.login,
          // @note GitHub's own view of the sender's standing in the repo; the
          // queue checks it against allowFrom
          authorAssociation: payload.comment?.author_association,
          body,
          htmlUrl: payload.comment?.html_url,
        },
      })

      return ok()
    }

    default: {
      // pass
    }
  }

  return ok()
})

// @note required because we need the raw body for signature validation
export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * @manual GitHub Integration
 *
 * ## Event Webhook Endpoint
 *
 * Receives real-time events from GitHub (issue/PR comments) and summons the bot
 * when it is @mentioned. Configure this URL as the webhook for your GitHub App
 * or repository/org:
 *
 * ```
 * https://api.chatbotkit.com/v1/integration/github/{githubIntegrationId}/event
 * ```
 *
 * Subscribe to: `issue_comment`, `pull_request_review_comment`. Every request is
 * verified against the integration's `webhookSecret` using the
 * `x-hub-signature-256` HMAC. Events are acknowledged immediately and processed
 * asynchronously in the queue; GitHub redelivers on non-2xx (deduplicated via
 * the `x-github-delivery` id).
 *
 * Note that a PR's top-level comment arrives as `issue_comment` (a PR is an
 * issue in GitHub's model) - distinguished by `issue.pull_request` being set.
 */

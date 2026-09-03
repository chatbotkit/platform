// @ts-check
import { template as t } from '@chatbotkit-dev/template'

import messages from '@/config/messages'

import prisma from '@/prisma/client'

import { makeActivityMessagePair } from '@/lib/activity'
import { getConversationDetails } from '@/lib/bot.conversation'
import {
  createContactFingerprint,
  ensureTrustedContact,
} from '@/lib/contact.create'
import { setContextUser } from '@/lib/context.store'
import { createConversation } from '@/lib/conversation.create'
import { getStatefulConversationEngine } from '@/lib/conversation.engine'
import { hasConversation } from '@/lib/conversation.find'
import debug from '@/lib/debug'
import { captureException, captureInputError } from '@/lib/error'
import {
  assertAppCredentials,
  createCommentReaction,
  createIssueReaction,
  getAppSlug,
  getIssue,
  getPullRequestDiff,
  listIssueComments,
  mintInstallationToken,
  postIssueComment,
} from '@/lib/github.app'
import {
  githubSenderIsAllowed,
  parseGithubAllowFrom,
} from '@/lib/github.validation'
import { setupFrontendHostContext } from '@/lib/integration.context'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { throwLimitsReached, throwNotFound } from '@/lib/response'
import { updateSessionStore } from '@/lib/session.context'
import { resolveSessionDuration } from '@/lib/session.duration'
import { userToSessionUser } from '@/lib/user.session'
import { parseAsync } from '@/lib/zod.schema'

import { doSetup } from '@/pages/api/v1/integration/github/[githubIntegrationId]/setup'

import { z } from 'zod'

export const GITHUB_CONTACT_NAMESPACE = '8f8d6e1e-2c1a-4b0e-9c3a-2d6b1f0a9e77' // @note do not change

export const INTERACT_EVENT_TYPE = 'interact'
export const SETUP_EVENT_TYPE = 'setup'

/**
 * Payload schema for an `interact` event - an @mention summon from an issue/PR
 * comment. The installation id rides in the payload (read off the webhook) and
 * is used to mint the token to reply.
 */
export const InteractPayloadSchema = z.object({
  // delivery + dedupe
  deliveryId: z.string().optional(),

  // the installation that produced this event (used to mint the reply token)
  installationId: z.union([z.number(), z.string()]),

  // event identity
  eventName: z.string(), // 'issue_comment' | 'pull_request_review_comment'
  action: z.string().optional(),

  // repo + thread
  owner: z.string(),
  repo: z.string(),
  issueNumber: z.number(),
  isPull: z.boolean().optional(),

  // the triggering comment
  commentId: z.number().optional(),

  // actor + content
  senderLogin: z.string().optional(),

  // @note GitHub's own view of the sender's standing in the repository:
  // OWNER | MEMBER | COLLABORATOR | CONTRIBUTOR | FIRST_TIME_CONTRIBUTOR |
  // FIRST_TIMER | MANNEQUIN | NONE. Checked against allowFrom.
  authorAssociation: z.string().optional(),

  body: z.string().optional(),
  htmlUrl: z.string().optional(),
})

export const SetupPayloadSchema = z.object({}).passthrough()

/**
 * @typedef {{ type: 'interact', payload: z.infer<typeof InteractPayloadSchema> }} InteractEvent
 * @typedef {{ type: 'setup', payload: Record<string, unknown> }} SetupEvent
 */

/**
 * The stable session key for an issue/PR thread (one conversation per thread).
 *
 * @param {string} githubIntegrationId
 * @param {{ owner: string, repo: string, issueNumber: number }} payload
 * @returns {string}
 */
function getGithubSessionKey(
  githubIntegrationId,
  { owner, repo, issueNumber }
) {
  return `github-session-${githubIntegrationId}-${owner}/${repo}#${issueNumber}`
}

/**
 * @param {{ sessionKey: string }} options
 * @returns {Promise<string|null>}
 */
export async function resolveGithubSessionConversationId({ sessionKey }) {
  return await memcache.get(sessionKey)
}

/**
 * @param {{ sessionKey: string, conversationId: string, sessionDurationSecs: number }} options
 * @returns {Promise<void>}
 */
export async function setGithubSessionConversationId({
  sessionKey,
  conversationId,
  sessionDurationSecs,
}) {
  await memcache.set(sessionKey, conversationId, { ex: sessionDurationSecs })
}

/**
 * The handle the bot answers to - this integration's GitHub App slug. Resolved
 * from the App itself (cached by appId), falling back to the integration alias.
 * Used to detect explicit @mentions.
 *
 * @param {any} integration
 * @returns {Promise<string>}
 */
async function getBotHandle(integration) {
  try {
    const slug = await getAppSlug({
      appId: integration.appId,
      privateKey: integration.privateKey,
    })

    if (slug) {
      return slug.toLowerCase()
    }
  } catch (error) {
    debug('failed to resolve app slug', {
      error: /** @type {any} */ (error)?.message,
    }).log('integration.github.queue.getBotHandle')
  }

  return (integration.alias || 'chatbotkit').toLowerCase()
}

/**
 * Whether a comment body explicitly @mentions the bot.
 *
 * @param {string|undefined} body
 * @param {string} handle
 * @returns {boolean}
 */
function mentionsBot(body, handle) {
  if (!body) {
    return false
  }

  // matches @handle or @handle[bot], case-insensitive
  const pattern = new RegExp(`@${handle}(\\[bot\\])?\\b`, 'i')

  return pattern.test(body)
}

/**
 * Strips a leading bot @mention from the comment text.
 *
 * @param {string} body
 * @param {string} handle
 * @returns {string}
 */
function stripBotMention(body, handle) {
  return body.replace(new RegExp(`@${handle}(\\[bot\\])?\\b`, 'ig'), '').trim()
}

/**
 * Builds the activity context messages for a NEW conversation: the issue/PR
 * body, recent comments, and (for PRs) the diff.
 *
 * @param {string} token
 * @param {z.infer<typeof InteractPayloadSchema>} payload
 * @returns {Promise<any[]>}
 */
async function buildContextMessages(token, payload) {
  const { owner, repo, issueNumber, isPull } = payload

  const messages = []

  try {
    const issue = await getIssue({ token, owner, repo, issueNumber })

    const comments = await listIssueComments({
      token,
      owner,
      repo,
      issueNumber,
    })

    messages.push(
      ...makeActivityMessagePair(
        '_getGithubThreadContext',
        { owner, repo, issueNumber, isPull: !!isPull },
        {
          title: issue?.title,
          body: issue?.body,
          state: issue?.state,
          author: issue?.user?.login,
          comments: (comments || []).map((c) => ({
            author: c?.user?.login,
            body: c?.body,
          })),
        }
      )
    )

    if (isPull) {
      try {
        const diff = await getPullRequestDiff({
          token,
          owner,
          repo,
          pullNumber: issueNumber,
        })

        messages.push(
          ...makeActivityMessagePair(
            '_getGithubPullRequestDiff',
            { owner, repo, pullNumber: issueNumber },
            { diff }
          )
        )
      } catch (error) {
        debug('failed to fetch PR diff', {
          error: /** @type {any} */ (error)?.message,
        }).log('integration.github.queue.buildContextMessages')
      }
    }
  } catch (error) {
    debug('failed to fetch issue context', {
      error: /** @type {any} */ (error)?.message,
    }).log('integration.github.queue.buildContextMessages')
  }

  return messages
}

/**
 * Handles a summon: resolve/continue the conversation, run the bot engine over
 * the issue/PR thread, and post the reply back as a comment.
 *
 * @param {string} githubIntegrationId
 * @param {z.infer<typeof InteractPayloadSchema>} payload
 * @param {any} [context]
 * @returns {Promise<void>}
 */
export async function handleInteractEvent(
  githubIntegrationId,
  payload,
  context
) {
  debug('interact', { githubIntegrationId, payload }).log(
    'integration.github.queue.handleInteractEvent'
  )

  const integration = await prisma.githubIntegration.findUnique({
    where: { id: githubIntegrationId },
    include: {
      user: true, // @note required
      bot: true, // @note required
    },
  })

  if (!integration) {
    return throwNotFound(`GithubIntegration not found: ${githubIntegrationId}`)
  }

  if (!integration.bot) {
    debug('skipping - no bot configured').log(
      'integration.github.queue.handleInteractEvent'
    )

    return
  }

  if (!integration.appId || !integration.privateKey) {
    debug('skipping - integration has no GitHub App credentials').log(
      'integration.github.queue.handleInteractEvent'
    )

    return
  }

  const { owner, repo, issueNumber, commentId } = payload

  const handle = await getBotHandle(integration)

  const sessionKey = getGithubSessionKey(githubIntegrationId, payload)

  const { persist, ttlSecs } = resolveSessionDuration(
    integration.sessionDuration
  )

  let conversationId = persist
    ? await resolveGithubSessionConversationId({ sessionKey })
    : null

  const hasExistingConversation =
    !!conversationId && (await hasConversation(conversationId))

  // @note the bot only acts when explicitly @mentioned - every time, even on a
  // thread it already has a conversation for. GitHub issues are flat, so
  // continuing on every comment would make the bot reply to chatter between
  // humans. The persisted conversation still provides continuity across mentions.
  if (!mentionsBot(payload.body, handle)) {
    debug('skipping - not @mentioned').log(
      'integration.github.queue.handleInteractEvent'
    )

    return
  }

  // @note the user text is the (mention-stripped) comment body
  const text = stripBotMention(payload.body || '', handle)

  if (!text) {
    debug('skipping - empty text after normalization').log(
      'integration.github.queue.handleInteractEvent'
    )

    return
  }

  // check allowFrom restriction
  //
  // @note this runs after the @mention check so that ordinary repo chatter does
  // not log a block on every comment - only actual summon attempts do. It runs
  // before anything that spends the owner's resources or writes to GitHub.
  {
    const entries = parseGithubAllowFrom(integration.allowFrom || '')

    if (
      !githubSenderIsAllowed(
        {
          login: payload.senderLogin,
          authorAssociation: payload.authorAssociation,
          owner,
          repo,
        },
        entries
      )
    ) {
      debug(`sender not allowed`, {
        senderLogin: payload.senderLogin,
        authorAssociation: payload.authorAssociation,
        owner,
        repo,
      }).log('integration.github.queue.handleInteractEvent')

      await logEvent({
        user: { id: integration.userId },
        name: 'Sender Blocked',
        description: `A summon was blocked due to allowFrom restrictions.`,
        type: 'integration.github.blocked',
        relations: {
          githubIntegrationId: integration.id,
        },
        meta: {
          senderLogin: payload.senderLogin,
          authorAssociation: payload.authorAssociation,
          owner,
          repo,
          issueNumber,
        },
      })

      return
    }
  }

  if (!(await accountConversationalLimitsOk(integration.user))) {
    // @note the account is over its usage limits - post a pre-canned comment so
    // the user gets a visible signal instead of silence. Best-effort: a failed
    // post must not mask the underlying limit condition.
    try {
      const token = await mintInstallationToken({
        ...assertAppCredentials(integration),
        installationId: String(payload.installationId),
      })

      await postIssueComment({
        token,
        owner,
        repo,
        issueNumber,
        body: messages.limitsReachedReply,
      })

      return
    } catch (error) {
      debug(`limit reply post failed`, {
        error: /** @type {any} */ (error)?.message,
      }).log('integration.github.queue.handleInteractEvent')
    }

    return throwLimitsReached(`Limits exceeded`)
  }

  if (integration.user) {
    updateSessionStore({ user: userToSessionUser(integration.user) })

    setContextUser(integration.user)

    await setupFrontendHostContext(integration.user)
  }

  // @note mint a token for the installation that produced this event, using
  // this integration's own App credentials. The installation id rides in the
  // webhook payload - it is not stored.
  const token = await mintInstallationToken({
    ...assertAppCredentials(integration),
    installationId: String(payload.installationId),
  })

  // @note acknowledge with a reaction (the GitHub analog of a typing indicator)
  try {
    if (commentId) {
      await createCommentReaction({ token, owner, repo, commentId })
    } else {
      await createIssueReaction({ token, owner, repo, issueNumber })
    }
  } catch (error) {
    debug('failed to add ack reaction', {
      error: /** @type {any} */ (error)?.message,
    }).log('integration.github.queue.handleInteractEvent')
  }

  // @note create the conversation on first contact in this thread
  if (!hasExistingConversation) {
    const messages = await buildContextMessages(token, payload)

    let contactId

    if (integration.contactCollection && payload.senderLogin) {
      const contact = await ensureTrustedContact(
        { id: integration.userId },
        {
          nick: payload.senderLogin,

          meta: {
            app: 'github',

            github: {
              login: payload.senderLogin,
              owner,
            },
          },
        },
        createContactFingerprint(GITHUB_CONTACT_NAMESPACE, [
          owner,
          payload.senderLogin,
        ])
      )

      contactId = contact.id
    }

    const { id: cid } = await createConversation(integration.userId, {
      contactId,

      ...getConversationDetails(integration),

      messages,

      meta: {
        app: 'github',

        github: {
          integrationId: integration.id,
          installationId: payload.installationId,
          owner,
          repo,
          issueNumber,
          isPull: !!payload.isPull,
        },
      },
    })

    conversationId = cid

    if (persist) {
      await setGithubSessionConversationId({
        sessionKey,
        conversationId,
        sessionDurationSecs: ttlSecs,
      })
    }
  }

  if (!conversationId) {
    debug('skipping - no conversation resolved').log(
      'integration.github.queue.handleInteractEvent'
    )

    return
  }

  // @note GitHub issues/PRs are shared/public surfaces - never use private
  // user credentials for actions here (mirrors Slack's channel `untrusted`).
  const untrusted = true

  const engine = await getStatefulConversationEngine({
    conversationId,

    untrusted,

    options: {
      features: [
        // @note surface the current sender to the model for this turn only
        {
          name: 'userInfo',
          options: { externalId: payload.senderLogin, source: 'github' },
        },

        // @note the tasks run in a batch mode, i.e. background
        { name: 'batch' },

        // @note reliable current date/time awareness
        { name: 'time' },

        // @note breadcrumb checkpoints for slow/aborted long-running turns
        { name: 'timeoutMarks' },
      ],

      signal: context?.signal,

      markSignals: context?.markSignals,

      // prettier-ignore
      backstoryExtra: t`
# Runtime Context

This conversation is happening inside a GitHub ${payload.isPull ? 'pull request' : 'issue'} thread (${owner}/${repo}#${issueNumber}). Your response will be posted back as a GitHub comment, so write in GitHub-flavored markdown. This is a public/shared surface - other repository collaborators can read your response, so do not assume the current sender is the only reader.

You can only reply with comments; do not promise actions beyond commenting.
`,

      userId: integration.userId,
    },
  })

  try {
    await engine.send(text)

    const { text: reply } = await engine.receive()

    debug('reply', { reply: reply?.slice(0, 200) }).log(
      'integration.github.queue.handleInteractEvent'
    )

    if (reply) {
      await postIssueComment({ token, owner, repo, issueNumber, body: reply })
    }
  } catch (error) {
    await captureException(error)

    await logEvent({
      user: { id: integration.userId },
      name: 'GitHub Integration Failed',
      description: `Failed to process GitHub interaction for ${owner}/${repo}#${issueNumber}`,
      type: 'integration.github.failed',
      relations: {
        githubIntegrationId,
        conversationId,
      },
      meta: {
        reason: /** @type {any} */ (error)?.message,
        owner,
        repo,
        issueNumber,
      },
    })
  } finally {
    await engine.dispose()
  }
}

/**
 * @param {string} githubIntegrationId
 * @param {Record<string, unknown>} _payload
 * @returns {Promise<void>}
 */
export async function handleSetupEvent(githubIntegrationId, _payload) {
  debug('setup', { githubIntegrationId }).log(
    'integration.github.queue.handleSetupEvent'
  )

  const integration = await prisma.githubIntegration.findUnique({
    where: { id: githubIntegrationId },
    include: { user: true },
  })

  if (!integration) {
    return
  }

  // @note best-effort - a save with incomplete/invalid credentials should not
  // fail the queue job. The explicit Setup action surfaces probe failures.
  try {
    await doSetup(integration)
  } catch (error) {
    debug('setup probe failed', {
      error: /** @type {any} */ (error)?.message,
    }).log('integration.github.queue.handleSetupEvent')
  }
}

/**
 * Validates and enqueues an event for background processing.
 *
 * @param {string} githubIntegrationId
 * @param {InteractEvent|SetupEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(githubIntegrationId, event) {
  debug('sendEvent', {
    githubIntegrationId,
    eventType: event?.type,
  }).log('integration.github.queue.sendEvent')

  switch (true) {
    case event.type === INTERACT_EVENT_TYPE: {
      await parseAsync(InteractPayloadSchema, event.payload, captureInputError)

      break
    }

    case event.type === SETUP_EVENT_TYPE: {
      await parseAsync(SetupPayloadSchema, event.payload, captureInputError)

      break
    }
  }

  await queue(
    `/api/v1/integration/github/${githubIntegrationId}/queue`,
    event,
    {
      ...(event.type === INTERACT_EVENT_TYPE
        ? {
            // @note dedupe on GitHub's delivery id + comment id (GitHub
            // redelivers on non-2xx)
            deduplicationId: `github-${githubIntegrationId}-${event.type}-${
              event.payload.deliveryId ||
              `${event.payload.owner}-${event.payload.repo}-${event.payload.issueNumber}`
            }-${event.payload.commentId || 'thread'}`,

            flow: {
              // @note serialize per issue/PR thread so replies stay ordered.
              // keys must be [alphanumeric._-] only, so avoid `/` and `#`
              key: `github-${githubIntegrationId}-${event.type}-${event.payload.owner}-${event.payload.repo}-${event.payload.issueNumber}`,

              parallel: 1,
            },
          }
        : {}),
    }
  )
}

/**
 */
export default withQueueHandlerBounded('githubIntegrationId', {
  [INTERACT_EVENT_TYPE]: {
    handler: handleInteractEvent,
    schema: InteractPayloadSchema,
  },
  [SETUP_EVENT_TYPE]: {
    handler: handleSetupEvent,
    schema: SetupPayloadSchema,
  },
})

// @note do not generate manuals or docs for this internal endpoint

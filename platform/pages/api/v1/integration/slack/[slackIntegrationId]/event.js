// @ts-check
import { buf2str } from '@chatbotkit-dev/buffer'

import prisma from '@/prisma/client'

import debug, { warn } from '@/lib/debug'
import { captureException } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { withAny } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  NOT_AUTHORIZED_STATUS,
  notAuthorized,
  notFound,
  ok,
} from '@/lib/response'
import { validateSlackRequest } from '@/lib/slack.signature'

import { sendEvent } from '@/pages/api/v1/integration/slack/[slackIntegrationId]/queue'

/**
 * Evaluates whether the bot should respond to a message at the event level.
 *
 * This function ONLY handles fast, synchronous filtering that can complete
 * within Slack's 3-second timeout. It checks for:
 * - Explicit triggers (mentions, DMs) that always require processing
 * - Thread replies that need queue-side evaluation for continuation
 * - Basic autoRespond configuration (empty, @all)
 * - Quick determination if queue processing is needed
 *
 * Advanced filtering (AI-based decisions, LLM evaluation, thread continuation)
 * is handled in queue.js where we have unlimited processing time.
 *
 * @param {Object} options - The evaluation options
 * @param {string|null|undefined} options.autoRespond - The autoRespond configuration string
 * @param {string} options.eventType - The event type ('message' or 'app_mention')
 * @param {string} options.channelType - The channel type ('im', 'channel', 'group')
 * @param {boolean} options.isThreadReply - Whether this message is a reply in a thread
 * @returns {Promise<boolean>} - Whether to send this message to the queue for processing
 */
async function shouldRespond({
  autoRespond,
  eventType,
  channelType,
  isThreadReply,
}) {
  debug(`evaluating shouldRespond`, {
    autoRespond,
    eventType,
    channelType,
    isThreadReply,
  }).log('integration.slack.event.shouldRespond')

  // @note app mentions should ALWAYS be queued - users explicitly invoked the
  // bot

  if (eventType === 'app_mention') {
    debug(`queueing app_mention event`).log(
      'integration.slack.event.shouldRespond'
    )

    return true
  }

  // @note direct messages (IM) should ALWAYS be queued - users expect a
  // response when chatting directly

  if (channelType === 'im') {
    debug(`queueing direct message (IM)`).log(
      'integration.slack.event.shouldRespond'
    )

    return true
  }

  // @note thread replies should ALWAYS be queued - the queue handler will
  // check if there's an existing conversation and use shouldRespondInThread
  // to determine if the bot should continue the conversation. This enables
  // proper thread continuation even when autoRespond is empty.

  if (isThreadReply) {
    debug(`queueing thread reply for shouldRespondInThread evaluation`).log(
      'integration.slack.event.shouldRespond'
    )

    return true
  }

  // @note for channel messages, check autoRespond configuration default
  // behavior when autoRespond is null or empty - don't queue

  if (!autoRespond || autoRespond.trim() === '') {
    debug(`autoRespond is empty - not queueing message`).log(
      'integration.slack.event.shouldRespond'
    )

    return false
  }

  // @note handle @all magic keyword - queue everything

  if (autoRespond.trim() === '@all') {
    debug(`autoRespond is @all - queuing all messages`).log(
      'integration.slack.event.shouldRespond'
    )

    return true
  }

  // @note for @agent prefix or custom instructions, we need to queue the
  // message for AI-based evaluation. The queue can handle slow model
  // invocations without violating Slack's 3-second timeout.

  if (autoRespond.trim().startsWith('@agent ')) {
    debug(`queueing message for @agent evaluation`).log(
      'integration.slack.event.shouldRespond'
    )

    return true
  }

  // @note any other autoRespond value requires LLM evaluation in the queue

  debug(`queueing message for LLM-based autoRespond evaluation`).log(
    'integration.slack.event.shouldRespond'
  )

  return true
}

/**
 * We use the re-setup routine to fix common issues.
 *
 * @param {string} slackIntegrationId
 * @returns {Promise<void>}
 */
export async function setup(slackIntegrationId) {
  await sendEvent(slackIntegrationId, {
    type: 'setup',
    payload: {},
  })
}

/**
 * The following method handles all interactions from slack. Keep in mind that
 * the method needs to complete within 3 seconds. This is why we cannot simply
 * generate any response inline. The only way is to return immediately and carry
 * the conversation through a queue.
 *
 * Unfortunately not even a streaming event queue will help in this case. This
 * is because for the stream to continue we need to keep the connection open
 * which does not work well with the notion of returning the response no later
 * than 3 seconds after initiation. This is the also the reason why the queue
 * is not on edge.
 *
 * The only way using streaming queue is to also use qstash which is subject to
 * some delays - so answers will not be instantaneous.
 */
export default withAny(async function (req) {
  debug(`received slack event`).log('integration.slack.event.withAny')

  const slackIntegrationId = requiredUrlParam(req, 'slackIntegrationId')

  const slackIntegration = await prisma.slackIntegration.findUnique({
    where: {
      id: slackIntegrationId,
    },
  })

  if (!slackIntegration) {
    return notFound()
  }

  const rawBody = await req.arrayBuffer()
  const rawBodyString = buf2str(rawBody)

  /**
   * @todo use slack event type definitions to validate the payload correctly
   */
  let payload

  try {
    payload = JSON.parse(rawBodyString)
  } catch (e) {
    await captureException(e)

    await setup(slackIntegrationId)

    return notAuthorized()
  }

  debug(`slack event payload`, { payload }).log(
    'integration.slack.event.withAny'
  )

  switch (payload.type) {
    /**
     * Handle event callbacks from Slack
     */
    case 'event_callback': {
      // validate request signature
      {
        if (!slackIntegration.signingSecret) {
          warn(
            `missing signing secret for slack integration - bypassing validation`
          ).log('integration.slack.event.withAny')
        } else {
          try {
            await validateSlackRequest(
              req,
              rawBodyString,
              slackIntegration.signingSecret
            )

            debug(`slack signature validation passed`).log(
              'integration.slack.event.withAny'
            )
          } catch (error) {
            warn(`slack signature validation failed`, {
              error: error.message,
            }).log('integration.slack.event.withAny')

            await logEvent({
              user: { id: slackIntegration.userId },
              type: 'integration.slack.configuration.error',
              relations: {
                slackIntegrationId,
              },
              meta: {
                status: NOT_AUTHORIZED_STATUS,
                reason: 'There is a signature verification error.',
              },
            })

            await setup(slackIntegrationId)

            return notAuthorized()
          }
        }
      }

      // handle the event
      {
        const type = payload.event.type

        switch (type) {
          /**
           * Handle mentions and messages
           */
          case 'app_mention':
          case 'message': {
            const team = payload.team_id
            const user = payload.event.user

            // @note we are not interested in messages that do not have a user

            if (!user) {
              return ok()
            }

            const channelId = payload.event.channel
            const channelType = payload.event.channel_type || 'channel'

            const messageId = payload.event.client_msg_id

            // @note ts is the session key - for threads we use thread_ts, for
            // channel messages we use the message ts

            const ts = payload.event.thread_ts || payload.event.ts

            // @note threadTs is set when this message is a reply in a thread

            const threadTs = payload.event.thread_ts || undefined

            // @todo investigate under what circumstances text could be empty

            // @note keep the webhook path minimal to avoid extra Slack API
            // calls under the 3-second response deadline. Mention cleanup
            // happens later in the queue handler.

            const text = payload.event.text?.trim() || ''

            // @note extract files from the event. Slack sends file metadata
            // including id, name, mimetype, and url_private for each file.
            // Files require the files:read OAuth scope to access.

            const files = payload.event.files || []

            // @note we are not interested in messages that have neither text
            // nor files

            if (!text && files.length === 0) {
              return ok()
            }

            // @note for message events in channels, if the raw text starts with
            // a user mention, skip it. Slack will also send an app_mention
            // event for these, and we want to use that instead to ensure proper
            // handling of direct bot mentions (bypassing autoRespond LLM
            // evaluation). Slack user IDs can start with U (regular users) or W
            // (Enterprise Grid workspace users).

            if (
              type === 'message' &&
              ['channel', 'group'].includes(channelType) &&
              payload.event.text &&
              /^\s*<@[UW][A-Z0-9]+>/.test(payload.event.text)
            ) {
              debug(
                `skipping message event with user mention - app_mention will handle it`,
                {
                  type,
                  channelType,
                  rawText: payload.event.text?.slice(0, 50),
                }
              ).log('integration.slack.event.withAny')

              return ok()
            }

            // @note ignore events that are from another chat bot (prevents recursion)
            // @note Also check for bot_id and subtype
            // since some bot messages don't have bot_profile

            const isBotMessage =
              !!payload.event.bot_profile ||
              !!payload.event.bot_id ||
              payload.event.subtype === 'bot_message'

            if (isBotMessage) {
              debug(`ignoring bot message to prevent recursion`, {
                type,
                user,
                channelId,
                channelType,
                messageId,
                ts,
                text,
              }).log('integration.slack.event.withAny')

              return ok()
            }

            // @note check if we should respond based on autoRespond configuration

            const shouldRespondToMessage = await shouldRespond({
              autoRespond: slackIntegration.autoRespond,
              eventType: type,
              channelType: channelType,
              isThreadReply: !!threadTs,
            })

            if (!shouldRespondToMessage) {
              debug(`skipping message due to autoRespond filter`, {
                autoRespond: slackIntegration.autoRespond,
                type: type,
                channelType: channelType,
              }).log('integration.slack.event.withAny')

              return ok()
            }

            // @note keep in mind that we will be getting all of the events that
            // are happening on the channel thus further filtering is required to
            // ensure that we only reply to the ones we are interested in

            // @note only process events for supported channel types

            if (['im', 'channel', 'group'].includes(channelType)) {
              debug(`responding to ${type}`, {
                type,
                user,
                channelId,
                channelType,
                messageId,
                ts,
                text,
                files,
              }).log('integration.slack.event.withAny')

              await sendEvent(slackIntegrationId, {
                type: 'interact',
                payload: {
                  type,
                  team,
                  user,
                  channelId,
                  channelType,
                  messageId,
                  ts,
                  threadTs,
                  text,
                  files,
                },
              })
            }

            return ok()
          }

          /**
           * Default case - do nothing
           */
          default: {
            // pass
          }
        }
      }

      return ok()
    }

    /**
     * Handle URL verification challenge
     */
    case 'url_verification': {
      debug(`performing url verification`).log(
        'integration.slack.event.withAny'
      )

      return ok({ challenge: payload.challenge })
    }

    /**
     * Default case - do nothing
     */
    default: {
      // pass
    }
  }

  return ok()
})

/**
 * @note required because we need raw body for signature validation
 */
export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * @manual Slack Integration
 *
 * ## Event Webhook Endpoint
 *
 * Handle real-time events from Slack including mentions, messages, and user
 * interactions. This webhook endpoint is the core of the Slack integration,
 * receiving and processing all events that trigger bot responses and
 * conversations.
 *
 * The event endpoint must be configured in your Slack app settings under
 * "Event Subscriptions" as the Request URL. Slack sends HTTP POST requests to
 * this endpoint whenever subscribed events occur in your workspace, such as
 * when users mention the bot or send direct messages.
 *
 * ### Webhook URL Configuration
 *
 * Configure this URL in Slack app settings under "Event Subscriptions" →
 * "Request URL":
 *
 * ```
 * https://api.chatbotkit.com/v1/integration/slack/{slackIntegrationId}/event
 * ```
 *
 * Replace `{slackIntegrationId}` with your actual integration ID from
 * ChatBotKit.
 *
 * ### Event Subscription Requirements
 *
 * Subscribe to these bot events in your Slack app configuration:
 *
 * **Required Events:**
 * - `app_mention` - Triggered when users mention the bot with `@botname`
 * - `message.channels` - Messages in public channels where bot is present
 * - `message.groups` - Messages in private channels where bot is present
 * - `message.im` - Direct messages sent to the bot
 * - `message.mpim` - Group direct messages including the bot
 *
 * Without these subscriptions, the bot will not receive events and cannot
 * respond to users.
 *
 * ### How Event Processing Works
 *
 * **URL Verification**: When you first configure the webhook URL, Slack sends a
 *  `url_verification` challenge request. The endpoint automatically responds
 * with the challenge value to complete verification.
 *
 * **Event Callback Processing**: For each subscribed event, Slack sends an
 * `event_callback` payload containing:
 * - Event type (app_mention, message, etc.)
 * - User information
 * - Channel details
 * - Message content
 * - Timestamp for threading
 *
 * **Signature Validation**: Every request is validated using the signing secret
 * to ensure it genuinely comes from Slack. Invalid signatures are rejected with
 * a 403 Forbidden response.
 *
 * **Asynchronous Processing**: Events are queued for background processing to
 * meet Slack's 3-second response requirement. The endpoint acknowledges receipt
 * immediately and processes the conversation asynchronously.
 *
 * ### Supported Event Types
 *
 * **app_mention**: Triggered when users mention the bot in channels:
 * ```
 * @CustomerSupportBot How do I reset my password?
 * ```
 * The bot responds in a thread to keep channel conversations organized.
 *
 * **message (Direct Messages)**: Triggered when users send DMs to the bot:
 * - No @mention needed in DMs
 * - Bot responds directly in the conversation
 * - Each DM conversation maintains separate context
 *
 * **message (Threads)**: Triggered for messages in existing conversation
 * threads:
 * - Bot tracks thread context automatically
 * - Multiple users can participate in the same thread
 * - Thread history is preserved for context
 *
 * ### Auto-Response Configuration
 *
 * The Slack integration provides flexible control over when the bot responds to
 * messages through the `autoRespond` configuration field. This powerful feature
 * allows you to customize bot behavior for different use cases without writing
 * custom code.
 *
 * #### Default Behavior (null or empty)
 *
 * When `autoRespond` is not configured (null or empty string), the bot uses
 * conservative behavior:
 *
 * - **Always responds to**: Direct messages (DMs) and explicit @mentions
 * - **Ignores**: General channel messages without mentions
 * - **Use case**: Customer support bots that should only respond when directly
 *   addressed
 *
 * This is the recommended default for most use cases to prevent the bot from
 * interrupting conversations unless explicitly invoked.
 *
 * #### Respond to Everything (@all)
 *
 * Set `autoRespond` to `"@all"` to make the bot respond to every message in
 * channels where it's present:
 *
 * ```javascript
 * {
 *   "autoRespond": "@all"
 * }
 * ```
 *
 * - **Always responds to**: All messages in all channels, threads, and DMs
 * - **Use case**: Active monitoring bots, automated assistants that need to
 *   track all conversations
 * - **Warning**: Can be noisy in busy channels - use sparingly
 *
 * #### Agent-Based Filtering (@agent)
 *
 * Use the `@agent` prefix to provide custom instructions for an AI agent that
 * decides whether to respond:
 *
 * ```javascript
 * {
 *   "autoRespond": "@agent Only respond if the message contains a question about our product features"
 * }
 * ```
 *
 * The agent evaluates each message against your instructions and intelligently
 * decides whether the bot should respond. This provides flexible, context-aware
 * filtering without hardcoded rules.
 *
 * **Benefits:**
 * - Natural language instructions - no complex rules required
 * - Context-aware decisions based on message content
 * - Adapts to conversational nuances automatically
 *
 * **How it works:**
 * 1. Message arrives in a channel
 * 2. Agent evaluates message text against your instructions
 * 3. Bot responds only if agent determines it's appropriate
 * 4. Decision is made asynchronously in the background queue
 *
 * **Example instructions:**
 * - `@agent Respond only to technical questions about APIs`
 * - `@agent Only respond if someone asks for help or mentions a problem`
 * - `@agent Respond to messages about billing, pricing, or account issues`
 *
 * #### Custom LLM-Based Instructions
 *
 * Provide any custom text (without the `@agent` prefix) for LLM-based
 * evaluation:
 *
 * ```javascript
 * {
 *   "autoRespond": "Respond only to messages that contain questions or requests for assistance"
 * }
 * ```
 *
 * The system uses a fast, efficient language model to evaluate whether each
 * message matches your criteria. This is similar to `@agent` mode but
 * interprets your instructions as direct criteria rather than agent
 * instructions.
 *
 * **Difference from @agent:**
 * - Plain instructions are evaluated as filtering criteria
 * - @agent instructions provide context for agent decision-making
 * - Both use LLM evaluation but with different prompting approaches
 *
 * **Example custom instructions:**
 * - `Respond only to questions`
 * - `Respond to messages mentioning products or pricing`
 * - `Only respond if the message appears to need help`
 *
 * #### Filtering Priority and Logic
 *
 * The bot evaluates messages in this order:
 *
 * 1. **Always respond**: App mentions (`@botname`) and direct messages (DMs)
 *    regardless of `autoRespond` configuration
 * 2. **Check autoRespond**: For channel messages, apply the configured
 *    filtering logic
 * 3. **Queue evaluation**: Complex filtering (@agent and custom instructions)
 *    happens asynchronously to meet Slack's 3-second timeout
 *
 * **Important**: App mentions and DMs always trigger responses. The
 * `autoRespond` configuration only affects general channel messages.
 *
 * ### Event Filtering
 *
 * The endpoint automatically filters out certain events to prevent unnecessary
 * processing:
 *
 * **Ignored Events:**
 * - Messages without user information (system messages)
 * - Messages from other bots (prevents recursion)
 * - Empty messages or messages with only mentions
 * - Events in unsupported channel types
 *
 * This filtering ensures the bot only responds to genuine user interactions
 * while avoiding loops and processing irrelevant events.
 *
 * ### Response Time Requirements
 *
 * Slack requires webhook endpoints to respond within 3 seconds. The event
 * endpoint meets this requirement by:
 *
 * 1. **Immediate Acknowledgment**: Returns HTTP 200 OK immediately after validation
 * 2. **Queue Processing**: Sends events to background queue for async processing
 * 3. **Edge Runtime**: Uses edge functions for minimal latency
 * 4. **Delayed Response**: Bot responses are sent back to Slack via separate API calls
 *
 * This architecture ensures reliable event processing while meeting Slack's
 * strict timeout requirements.
 *
 * ### Error Handling and Retries
 *
 * **Authentication Failures**: When signature validation fails, the endpoint:
 * - Logs the authentication error
 * - Triggers automatic setup validation
 * - Returns 403 Forbidden to Slack
 * - Records event for troubleshooting
 *
 * **Malformed Payloads**: Invalid JSON or unexpected payload structures:
 * - Log the parsing error
 * - Trigger setup validation to check configuration
 * - Return 403 to indicate processing failure
 * - Prevent further attempts with bad data
 *
 * **Slack Retry Behavior**: When requests fail, Slack automatically retries:
 * - Retries up to 3 times with exponential backoff
 * - Marks endpoint as unhealthy after repeated failures
 * - Disables event delivery if endpoint remains unreachable
 * - Requires manual reactivation in Slack app settings
 *
 * ### Troubleshooting Event Delivery
 *
 * **Events Not Being Received:**
 * 1. Verify webhook URL is correctly configured in Slack
 * 2. Check that integration ID in URL matches your ChatBotKit integration
 * 3. Confirm required event subscriptions are enabled
 * 4. Review Slack app event delivery logs for errors
 * 5. Ensure signing secret in ChatBotKit matches Slack app settings
 *
 * **Authentication Errors:**
 * 1. Verify signing secret is correctly configured in ChatBotKit
 * 2. Ensure no extra spaces or characters in the secret
 * 3. Check that webhook requests are coming from Slack's IP ranges
 * 4. Review integration event logs for signature validation failures
 * 5. Try updating the integration to trigger credential re-validation
 *
 * **Bot Not Responding:**
 * 1. Check that events are being received (200 OK responses)
 * 2. Verify bot has required OAuth scopes
 * 3. Confirm bot token is valid and not expired
 * 4. Review background queue processing logs
 * 5. Test with a simple direct message to isolate the issue
 *
 * ### Security Considerations
 *
 * **Request Validation**: Every webhook request must include valid Slack
 * signature headers. Requests without proper signatures are rejected
 * immediately.
 *
 * **Signing Secret Rotation**: If you rotate your signing secret in Slack:
 * 1. Update the ChatBotKit integration with the new secret immediately
 * 2. Slack provides a grace period where both old and new secrets work
 * 3. Monitor for authentication errors during the transition
 * 4. Verify events are being processed successfully after rotation
 *
 * **Rate Limiting**: The endpoint handles high event volumes through:
 * - Efficient queue-based processing
 * - Automatic scaling based on load
 * - Graceful degradation under extreme load
 * - Event deduplication to prevent processing duplicates
 *
 * **Note:** The event endpoint processes all Slack events in real-time and must
 * remain highly available. Any downtime or errors can result in missed messages
 * and degraded user experience. Monitor endpoint health and event delivery
 * metrics closely for production integrations.
 *
 * For testing your event endpoint configuration, use Slack's event testing
 * tools in the app management interface or send test mentions and messages
 * from within Slack.
 */

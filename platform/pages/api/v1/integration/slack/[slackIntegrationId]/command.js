// @ts-check
import { buf2str } from '@chatbotkit-dev/buffer'

import prisma from '@/prisma/client'

import debug, { warn } from '@/lib/debug'
import { captureException } from '@/lib/error'
import { withAny } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, send } from '@/lib/response'
import { validateSlackRequest } from '@/lib/slack.signature'

import { sendEvent } from '@/pages/api/v1/integration/slack/[slackIntegrationId]/queue'

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
 *
 */
export default withAny(async function (req) {
  debug(`received slack command`).log('integration.slack.command.withAny')

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

  // validate request signature
  {
    if (!slackIntegration.signingSecret) {
      warn(
        `missing signing secret for slack integration - bypassing validation`
      ).log('integration.slack.command.withAny')
    } else {
      try {
        await validateSlackRequest(
          req,
          rawBodyString,
          slackIntegration.signingSecret
        )

        debug(`slack signature validation passed`).log(
          'integration.slack.command.withAny'
        )
      } catch (error) {
        warn(`slack signature validation failed`, { error: error.message }).log(
          'integration.slack.command.withAny'
        )

        await captureException(error)
        await setup(slackIntegrationId)

        return notAuthorized()
      }
    }
  }

  let payload

  try {
    payload = Object.fromEntries(new URLSearchParams(rawBodyString).entries())
  } catch (e) {
    await captureException(e)

    await setup(slackIntegrationId)

    return notAuthorized()
  }

  debug(`slack payload`, { payload }).log('integration.slack.command.withAny')

  const text = [payload.command, payload.text].filter(Boolean).join(' ').trim()

  await sendEvent(slackIntegrationId, {
    type: 'interact',
    payload: {
      type: 'command',
      team: payload.team_id,
      user: payload.user_id,
      channelId: payload.channel_id,
      channelType: 'command',
      messageId: payload.trigger_id,
      ts: payload.trigger_id,
      text: text,
      responseUrl: payload.response_url,
    },
  })

  return send('')
})

// @note required because we need raw body for signature validation
export const config = {
  api: {
    bodyParser: false,
  },
}

/**
 * @manual Slack Integration
 *
 * ## Slash Command Endpoint
 *
 * Process slash command interactions from Slack, enabling users to invoke your bot with a quick command syntax like `/botname your question`. Slash commands provide an ephemeral, private way for users to interact with the bot without posting visible messages in channels.
 *
 * The command endpoint must be configured in your Slack app settings under "Slash Commands" as the Request URL for each command you create. When users type a registered slash command, Slack sends a POST request to this endpoint with the command details and user input.
 *
 * ### Webhook URL Configuration
 *
 * Configure this URL in Slack app settings under "Slash Commands" → "Request URL":
 *
 * ```
 * https://api.chatbotkit.com/v1/integration/slack/{slackIntegrationId}/command
 * ```
 *
 * Replace `{slackIntegrationId}` with your actual integration ID from ChatBotKit.
 *
 * ### Creating a Slash Command
 *
 * In your Slack app configuration:
 *
 * 1. Navigate to "Slash Commands" section
 * 2. Click "Create New Command"
 * 3. Configure the command:
 *    - **Command**: `/yourcommand` (e.g., `/support`, `/ask`, `/help`)
 *    - **Request URL**: The webhook URL above
 *    - **Short Description**: Brief explanation shown in slash command list
 *    - **Usage Hint**: Example text shown to users (e.g., "ask a question")
 * 4. Save and reinstall the app to your workspace
 *
 * ### How Slash Commands Work
 *
 * **User Invocation**: Users type the command followed by their input:
 * ```
 * /support How do I reset my password?
 * ```
 *
 * **Immediate Response**: The endpoint acknowledges the command immediately with a 200 OK response containing empty string. This prevents Slack from showing a timeout error to the user.
 *
 * **Background Processing**: The command and text are queued for asynchronous processing. The bot generates a response and posts it back to Slack using the provided `response_url`.
 *
 * **Ephemeral Delivery**: Bot responses to slash commands are typically delivered as ephemeral messages (visible only to the user who invoked the command). This provides private, unobtrusive assistance.
 *
 * ### Use Cases for Slash Commands
 *
 * **Private Queries**: Users get assistance without posting publicly in channels:
 * ```
 * /help What is the vacation policy?
 * ```
 * Only the user sees the question and response.
 *
 * **Quick Information Lookup**: Fast access to information without context switching:
 * ```
 * /docs search authentication
 * ```
 * Bot searches documentation and returns results instantly.
 *
 * **Status Checks**: Query system status or personal information:
 * ```
 * /status check server health
 * ```
 * Get immediate status updates without navigating away from Slack.
 *
 * **Workflow Triggers**: Initiate processes or actions:
 * ```
 * /create ticket User authentication issue
 * ```
 * Kick off automated workflows through conversational commands.
 *
 * ### Best Practices
 *
 * **Command Naming**: Choose short, memorable command names that reflect their purpose:
 * - Good: `/help`, `/ask`, `/support`
 * - Avoid: `/chatbotkit-customer-support-assistant`
 *
 * **Usage Hints**: Provide clear, concise usage hints:
 * - Good: "ask a question or search for information"
 * - Avoid: "enter your query here to receive assistance from the AI"
 *
 * **Description**: Write descriptions that explain value, not mechanics:
 * - Good: "Get instant help with common questions"
 * - Avoid: "Sends your text to the ChatBotKit API for processing"
 *
 * ### Troubleshooting Slash Commands
 *
 * **Command Not Available:**
 * 1. Verify command is created in Slack app configuration
 * 2. Ensure app is installed/reinstalled after creating command
 * 3. Check that command name matches exactly (including leading /)
 * 4. Confirm user has permission to use slash commands
 *
 * **Command Timeout Errors:**
 * 1. Check endpoint is responding within 3 seconds
 * 2. Verify webhook URL is correctly configured
 * 3. Ensure integration ID in URL is correct
 * 4. Test endpoint availability and latency
 *
 * **No Response from Bot:**
 * 1. Verify signature validation is passing
 * 2. Check that background queue is processing commands
 * 3. Ensure bot token has necessary permissions
 * 4. Review queue processing logs for errors
 * 5. Test with event endpoint to isolate command-specific issues
 *
 * **Authentication Failures:**
 * 1. Confirm signing secret matches Slack app settings
 * 2. Check for extra whitespace or encoding issues in secret
 * 3. Verify request is genuinely from Slack (check IP ranges)
 * 4. Review authentication error logs in integration
 *
 * ### Limitations and Considerations
 *
 * **Input Length**: Slack limits slash command text to 4000 characters. Longer inputs are truncated.
 *
 * **Rate Limits**: Users can invoke slash commands rapidly. Implement rate limiting if needed to prevent abuse.
 *
 * **Visibility**: Slash command invocations and responses are private by default. Users cannot share responses with others unless you explicitly post public messages.
 *
 * **Multiple Commands**: You can register multiple slash commands pointing to the same endpoint. The command name is included in the payload so you can route different commands appropriately.
 *
 * **Ephemeral vs Public**: Responses sent via response_url can be either ephemeral (private to user) or in_channel (visible to everyone). Configure this in your bot's response logic based on use case.
 *
 * **Note:** Slash commands provide a complementary interaction method to mentions and direct messages. Users can choose the interaction style that best fits their workflow and privacy needs. Consider supporting all interaction methods for maximum flexibility.
 *
 * For information about other interaction methods, see the event webhook and interaction endpoint sections.
 */

/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Slack) */
// @ts-check
import { buf2str } from '@chatbotkit-dev/buffer'

import prisma from '@/prisma/client'

import { decrypt } from '@/lib/cloak'
import debug, { warn } from '@/lib/debug'
import { captureException } from '@/lib/error'
import fetch from '@/lib/fetch'
import { toText } from '@/lib/md.convert'
import { withAny } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, send } from '@/lib/response'
import { escapeSlackLinkText } from '@/lib/slack.markdown'
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
 * The following method handles all interactive component interactions from Slack.
 * This includes button clicks, select menu selections, and other interactive elements.
 * This endpoint should be configured in Slack app settings under "Interactivity & Shortcuts"
 * as the Request URL.
 *
 * Keep in mind that the method needs to complete within 3 seconds. This is why we cannot
 * simply generate any response inline. For complex operations, we return immediately and
 * carry the interaction through a queue, or use response_url for delayed responses.
 */
export default withAny(async function (req) {
  debug(`received slack interaction`).log(
    'integration.slack.interaction.withAny'
  )

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
      ).log('integration.slack.interaction.withAny')
    } else {
      try {
        await validateSlackRequest(
          req,
          rawBodyString,
          slackIntegration.signingSecret
        )

        debug(`slack signature validation passed`).log(
          'integration.slack.interaction.withAny'
        )
      } catch (error) {
        warn(`slack signature validation failed`, { error: error.message }).log(
          'integration.slack.interaction.withAny'
        )

        await captureException(error)
        await setup(slackIntegrationId)

        return notAuthorized()
      }
    }
  }

  let payload

  try {
    // @note slack sends interaction payloads as form-encoded data with a 'payload' parameter

    const formData = new URLSearchParams(rawBodyString)

    const payloadParam = formData.get('payload')

    if (!payloadParam) {
      throw new Error('No payload parameter found')
    }

    payload = JSON.parse(payloadParam)
  } catch (e) {
    await captureException(e)

    await setup(slackIntegrationId)

    return notAuthorized()
  }

  debug(`slack interaction payload`, { payload }).log(
    'integration.slack.interaction.withAny'
  )

  switch (payload.type) {
    case 'block_actions': {
      // @note handle interactive component actions like button clicks

      if (payload.actions && payload.actions[0]) {
        const action = payload.actions[0]

        // handle show references

        if (action.action_id === 'show_references') {
          const encryptedMessageId = action.value

          let messageId

          try {
            // @note decrypt the message ID to prevent tampering and enumeration

            messageId = await decrypt(encryptedMessageId)

            // @note retrieve references from message meta field

            const message = await prisma.message.findUnique({
              where: {
                id: messageId,
              },
              select: {
                meta: true,
              },
            })

            // @todo migrate to use slack.references field exclusively

            const references =
              message?.meta?.slack?.references || message?.meta?.slackReferences

            if (Array.isArray(references) && references.length > 0) {
              // @note format references as slack blocks for modal display

              const referencesBlocks = []

              // add header

              referencesBlocks.push({
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `📄 References (${references.length})`,
                  emoji: true,
                },
              })

              // add each reference

              references.forEach((ref, index) => {
                // @note escape special characters in reference name to prevent
                // breaking Slack mrkdwn link syntax (<url|text>)

                const escapedName = escapeSlackLinkText(ref.name) || 'Untitled'

                // @note convert description from markdown to plain text since
                // it may contain markdown formatting that conflicts with Slack mrkdwn

                const plainDescription = ref.description
                  ? toText(ref.description)
                  : null

                const referenceText = [
                  `*${index + 1}.* <${ref.url}|${escapedName}>`,
                  plainDescription ? `_${plainDescription}_` : null,
                ]
                  .filter(Boolean)
                  .join('\n')

                referencesBlocks.push({
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: referenceText,
                  },
                })

                // Add divider between references if not the last one
                if (index < references.length - 1) {
                  referencesBlocks.push({
                    type: 'divider',
                  })
                }
              })

              // @note use trigger_id to open a modal with references - this is the correct Slack pattern

              if (payload.trigger_id) {
                const modalView = {
                  type: 'modal',
                  title: {
                    type: 'plain_text',
                    text: 'References',
                    emoji: true,
                  },
                  close: {
                    type: 'plain_text',
                    text: 'Close',
                  },
                  blocks: referencesBlocks,
                }

                // open modal using Slack Web API

                const response = await fetch(
                  'https://slack.com/api/views.open',
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${slackIntegration.botToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      trigger_id: payload.trigger_id,
                      view: modalView,
                    }),
                  }
                )

                const result = await response.json()

                if (!result.ok) {
                  throw new Error(`Failed to open modal: ${result.error}`)
                }
              }

              // return immediate acknowledgment

              return send()
            } else {
              // @note references not found - show error modal

              debug(`no references found for message`, { messageId }).log(
                'integration.slack.interaction.withAny'
              )

              if (payload.trigger_id) {
                const errorModalView = {
                  type: 'modal',
                  title: {
                    type: 'plain_text',
                    text: 'No References',
                    emoji: true,
                  },
                  close: {
                    type: 'plain_text',
                    text: 'Close',
                  },
                  blocks: [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: '⚠️ References are no longer available.',
                      },
                    },
                  ],
                }

                await fetch('https://slack.com/api/views.open', {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${slackIntegration.botToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    trigger_id: payload.trigger_id,
                    view: errorModalView,
                  }),
                })
              }

              // return immediate acknowledgment

              return send()
            }
          } catch (error) {
            debug(`reference retrieval failed`, {
              message: error.message,
              messageId: messageId,
            }).log('integration.slack.interaction.withAny')

            await captureException(error)

            // @note show error modal

            if (payload.trigger_id) {
              const errorModalView = {
                type: 'modal',
                title: {
                  type: 'plain_text',
                  text: 'Error',
                  emoji: true,
                },
                close: {
                  type: 'plain_text',
                  text: 'Close',
                },
                blocks: [
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: '❌ Failed to retrieve references. Please try again.',
                    },
                  },
                ],
              }

              await fetch('https://slack.com/api/views.open', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${slackIntegration.botToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  trigger_id: payload.trigger_id,
                  view: errorModalView,
                }),
              })
            }

            // return immediate acknowledgment

            return send()
          }
        }

        // @note ratings button clicks

        if (action.action_id === 'upvote') {
          const token = action.value
          const actionType = action.action_id

          // @note send ratings event to queue for processing

          await sendEvent(slackIntegrationId, {
            type: 'ratings',
            payload: {
              token,
              action: actionType,
              channelId: payload.channel.id,
              slackIntegrationId,
            },
          })

          return send()
        }

        if (action.action_id === 'downvote') {
          const token = action.value

          // @note show dialog to collect downvote reason

          if (payload.trigger_id) {
            const downvoteModalView = {
              type: 'modal',
              callback_id: 'downvote_reason_modal',
              title: {
                type: 'plain_text',
                text: 'Downvote Feedback',
                emoji: true,
              },
              submit: {
                type: 'plain_text',
                text: 'Downvote',
              },
              close: {
                type: 'plain_text',
                text: 'Cancel',
              },
              private_metadata: JSON.stringify({
                token,
                channelId: payload.channel.id,
                slackIntegrationId,
              }),
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '👎 *Help us improve*\n\nPlease share why you found this response unsatisfactory. Your feedback helps us provide better assistance.',
                  },
                },
                {
                  type: 'input',
                  block_id: 'reason_input',
                  element: {
                    type: 'plain_text_input',
                    action_id: 'reason',
                    placeholder: {
                      type: 'plain_text',
                      text: 'Optional: Tell us what went wrong...',
                    },
                    multiline: true,
                    max_length: 500,
                  },
                  label: {
                    type: 'plain_text',
                    text: 'Reason for downvote',
                  },
                  optional: true,
                },
              ],
            }

            // @note open modal using Slack Web API

            const response = await fetch('https://slack.com/api/views.open', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${slackIntegration.botToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                trigger_id: payload.trigger_id,
                view: downvoteModalView,
              }),
            })

            const result = await response.json()

            if (!result.ok) {
              throw new Error(`Failed to open modal: ${result.error}`)
            }
          }

          return send()
        }
      }

      return send()
    }

    case 'shortcut':
    case 'message_action': {
      // @note route shortcuts and message actions through the queue as command-like interactions

      debug(`handling ${payload.type}`, {
        callback_id: payload.callback_id,
        trigger_id: payload.trigger_id,
      }).log('integration.slack.interaction.withAny')

      const team = payload.team?.id
      const user = payload.user?.id
      const channelId =
        payload.channel?.id ||
        payload.container?.channel_id ||
        `shortcut-${payload.user?.id || 'unknown'}`
      const messageId = payload.trigger_id || payload.message?.ts || channelId
      const quotedMessage = payload.message?.text?.trim()

      const text = [
        payload.callback_id
          ? `Shortcut: ${payload.callback_id}`
          : 'Shortcut invoked',
        quotedMessage ? `Selected message:\n${quotedMessage}` : null,
      ]
        .filter(Boolean)
        .join('\n\n')

      if (!team || !user) {
        debug(`missing team or user for shortcut interaction`, {
          team,
          user,
          callback_id: payload.callback_id,
        }).log('integration.slack.interaction.withAny')

        return send()
      }

      await sendEvent(slackIntegrationId, {
        type: 'interact',
        payload: {
          type: payload.type,
          team,
          user,
          channelId,
          channelType: 'command',
          messageId,
          ts: messageId,
          text,
          responseUrl: payload.response_url || undefined,
        },
      })

      return send()
    }

    case 'view_submission': {
      // @note handle modal submissions

      debug(`handling modal submission`, {
        view_id: payload.view?.id,
        callback_id: payload.view?.callback_id,
      }).log('integration.slack.interaction.withAny')

      // @note handle downvote reason modal submission

      if (payload.view?.callback_id === 'downvote_reason_modal') {
        try {
          const privateMetadata = JSON.parse(payload.view.private_metadata)

          const {
            token,
            channelId,
            slackIntegrationId: metaSlackIntegrationId,
          } = privateMetadata

          // @note extract reason from form submission

          const reasonValue =
            payload.view.state?.values?.reason_input?.reason?.value || ''

          // @note send ratings event to queue with reason

          await sendEvent(slackIntegrationId, {
            type: 'ratings',
            payload: {
              token,
              action: 'downvote',
              channelId,
              slackIntegrationId: metaSlackIntegrationId,
              reason: reasonValue.trim() || undefined,
            },
          })

          return send()
        } catch (error) {
          debug(`failed to process downvote modal submission`, {
            error: error.message,
          }).log('integration.slack.interaction.withAny')

          await captureException(error)

          // @note return error response to user

          return send({
            response_action: 'errors',
            errors: {
              reason_input:
                'Failed to process your feedback. Please try again.',
            },
          })
        }
      }

      return send()
    }

    case 'view_closed': {
      // @note handle modal cancellations

      debug(`handling modal closure`, {
        view_id: payload.view?.id,
        callback_id: payload.view?.callback_id,
      }).log('integration.slack.interaction.withAny')

      // @note modal was closed/cancelled - no action needed

      return send()
    }

    default: {
      debug(`unhandled interaction type: ${payload.type}`).log(
        'integration.slack.interaction.withAny'
      )

      return send()
    }
  }
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
 * ## Interactive Components Endpoint
 *
 * Handle interactive component actions from Slack, including button clicks, menu selections, modal submissions, and shortcuts. This endpoint processes all user interactions with rich UI elements added by the bot, such as reference citation buttons, feedback rating buttons, and modal dialogs.
 *
 * The interaction endpoint must be configured in your Slack app settings under "Interactivity & Shortcuts" as the Request URL. When users interact with buttons, dropdowns, or other interactive elements, Slack sends POST requests to this endpoint with the interaction details.
 *
 * ### Webhook URL Configuration
 *
 * Configure this URL in Slack app settings under "Interactivity & Shortcuts" → "Request URL":
 *
 * ```
 * https://api.chatbotkit.com/v1/integration/slack/{slackIntegrationId}/interaction
 * ```
 *
 * Replace `{slackIntegrationId}` with your actual integration ID from ChatBotKit.
 *
 * ### Supported Interaction Types
 *
 * **Block Actions (Button Clicks):**
 *
 * When users click interactive buttons attached to bot messages:
 *
 * - **Show References Button**: Displays a modal with citation sources for bot responses
 * - **Upvote Button (👍)**: Records positive feedback on bot response quality
 * - **Downvote Button (👎)**: Opens feedback modal to collect improvement suggestions
 *
 * **View Submissions (Modal Forms):**
 *
 * When users submit modal dialog forms:
 *
 * - **Downvote Reason Modal**: Collects detailed feedback explaining why a response was unhelpful
 * - Custom modal submissions from shortcuts or workflows
 *
 * **View Closed (Modal Cancellations):**
 *
 * When users close or cancel modal dialogs without submitting. These are acknowledged but don't trigger additional processing.
 *
 * **Shortcuts and Message Actions:**
 *
 * Global shortcuts and message actions are forwarded to the Slack queue as
 * command-style interactions, enabling bot responses and automations from
 * shortcut invocations.
 *
 * ### Reference Citations Feature
 *
 * When the `references` feature is enabled in your integration, bot responses include a "View References" button below messages that contain citations or source material.
 *
 * **How Reference Citations Work:**
 *
 * 1. **Response Generation**: Bot generates response with source citations
 * 2. **Reference Storage**: Citations are stored in Redis with a unique key
 * 3. **Button Attachment**: "View References" button is added to message with reference key
 * 4. **User Interaction**: User clicks button to see sources
 * 5. **Modal Display**: References modal opens showing formatted citation list
 *
 * **Reference Modal Format:**
 *
 * The modal displays each reference with:
 * - Numbered list of sources
 * - Clickable URLs to original documents
 * - Document titles or names
 * - Brief descriptions or excerpts (when available)
 * - Visual separators between references
 *
 * **Reference Expiration**: Citations are cached in Redis with time-based expiration (typically 24-48 hours). If references expire before a user clicks the button, the modal shows "References are no longer available" message.
 *
 * ### User Feedback Ratings Feature
 *
 * When the `ratings` feature is enabled, bot responses include thumbs up (👍) and thumbs down (👎) reaction buttons for immediate quality feedback.
 *
 * **Upvote (Thumbs Up) Flow:**
 *
 * 1. User clicks 👍 button below bot response
 * 2. Interaction queued for background processing
 * 3. Positive rating recorded with message token
 * 4. No modal or additional UI shown (immediate acknowledgment)
 *
 * **Downvote (Thumbs Down) Flow:**
 *
 * 1. User clicks 👎 button below bot response
 * 2. Feedback modal opens asking "Why was this response unsatisfactory?"
 * 3. User optionally provides detailed feedback (500 character limit)
 * 4. User clicks "Downvote" to submit or "Cancel" to dismiss
 * 5. Negative rating recorded with optional reason text
 * 6. Modal closes automatically after submission
 *
 * **Rating Privacy**: All ratings are associated with the message token and user ID but are not publicly visible in Slack. Analytics and quality metrics are available through ChatBotKit dashboards.
 *
 * ### Request Processing Flow
 *
 * **Payload Extraction:**
 * Slack sends interaction payloads as form-encoded data with a JSON payload parameter. The endpoint:
 * 1. Extracts URLSearchParams from raw request body
 * 2. Retrieves `payload` parameter value
 * 3. Parses JSON to get interaction details
 * 4. Validates request signature using signing secret
 *
 * **Signature Validation:**
 * Like all Slack webhooks, interaction requests must pass signature validation:
 * - Extract signature headers from request
 * - Compute expected signature using signing secret and timestamp
 * - Compare computed vs provided signatures
 * - Reject invalid signatures with 403 Forbidden
 *
 * **Type-Based Routing:**
 * Different interaction types (`block_actions`, `view_submission`, `view_closed`) are routed to appropriate handlers based on `payload.type` field.
 *
 * **Immediate Acknowledgment:**
 * All interactions must be acknowledged within 3 seconds to prevent timeout errors. The endpoint returns immediately while queuing complex operations for background processing.
 *
 * ### Response Time Requirements
 *
 * Slack requires interaction endpoints to respond within 3 seconds. The endpoint meets this by:
 *
 * 1. **Immediate Acknowledgment**: Returns response before processing completes
 * 2. **Async Processing**: Queues complex operations for background handling
 * 3. **Modal Operations**: Opens modals synchronously (fast operation)
 * 4. **Edge Runtime**: Uses edge functions for minimal cold start latency
 *
 * ### Error Handling
 *
 * **Missing References:**
 * When users click "View References" but citations have expired:
 * - Display modal with "References are no longer available" message
 * - Provide friendly explanation that data is temporary
 * - Log event for monitoring and debugging
 *
 * **Modal Opening Failures:**
 * If modal cannot be opened (invalid trigger_id, expired, or API error):
 * - Catch and log the error with details
 * - Show error modal explaining the issue
 * - Return acknowledgment to prevent user-visible timeout
 *
 * **Malformed Payloads:**
 * When payload parsing fails or structure is unexpected:
 * - Log parsing error with context
 * - Trigger automatic setup validation
 * - Return 403 Forbidden response
 * - Prevent further processing of invalid data
 *
 * **Rating Processing Failures:**
 * If rating event cannot be queued:
 * - Log error with message token and action type
 * - Return acknowledgment to user (fail gracefully)
 * - Retry in background if possible
 *
 * ### Trigger ID Lifecycle
 *
 * Slack provides a `trigger_id` with most interactions that's used to open modals:
 *
 * **Valid Duration**: Trigger IDs expire 3 seconds after the interaction occurs
 * **Single Use**: Each trigger ID can only be used once to open a modal
 * **Purpose**: Prevents unauthorized modal opening and ensures timely responses
 *
 * This tight deadline is why the endpoint must process interactions and open modals immediately rather than queuing them for later processing.
 *
 * ### Troubleshooting Interactions
 *
 * **Buttons Not Responding:**
 * 1. Verify webhook URL is configured in "Interactivity & Shortcuts"
 * 2. Check integration ID in URL matches your ChatBotKit integration
 * 3. Ensure signing secret is correctly configured
 * 4. Review interaction event logs for signature validation failures
 * 5. Test with simpler interactions (upvote) to isolate complex features
 *
 * **Modals Not Opening:**
 * 1. Check that trigger_id is present in interaction payload
 * 2. Verify bot token has `chat:write` scope
 * 3. Ensure modal is opened within 3 seconds of interaction
 * 4. Review Slack API response for specific error messages
 * 5. Test trigger ID expiration by clicking old buttons
 *
 * **References Not Displaying:**
 * 1. Verify `references` feature is enabled in integration settings
 * 2. Check Redis connectivity and data persistence
 * 3. Review reference key generation in bot response logic
 * 4. Verify reference expiration settings (TTL)
 * 5. Test with freshly generated responses
 *
 * **Ratings Not Recording:**
 * 1. Confirm `ratings` feature is enabled in integration settings
 * 2. Verify rating events are being queued successfully
 * 3. Check background queue processing logs
 * 4. Ensure message tokens are being generated correctly
 * 5. Review rating analytics to confirm data is being stored
 *
 * **Authentication Failures:**
 * 1. Verify signing secret matches Slack app settings exactly
 * 2. Check for whitespace or encoding issues in secret
 * 3. Confirm requests are genuinely from Slack IP ranges
 * 4. Review signature validation error logs for patterns
 * 5. Test with event endpoint to verify credentials work elsewhere
 *
 * ### Best Practices
 *
 * **Enable Complementary Features**: Use references and ratings together for comprehensive response quality feedback. References provide transparency while ratings capture sentiment.
 *
 * **Monitor Modal Performance**: Track how often references are viewed and ratings are provided. Low engagement may indicate unclear buttons or poor button placement.
 *
 * **Reference Expiration Policy**: Balance storage costs with user experience. 24-48 hour expiration provides good UX while preventing unbounded data growth.
 *
 * **Feedback Collection**: Review downvote reasons regularly to identify patterns in response quality issues and prioritize bot improvements.
 *
 * **Error Visibility**: Display user-friendly error messages in modals rather than silent failures. Users appreciate knowing what went wrong.
 *
 * ### Security Considerations
 *
 * **Signature Validation Required**: All interaction requests must pass signature validation. Never process unauthenticated requests.
 *
 * **Private Metadata Protection**: Modal private_metadata can contain sensitive information (tokens, IDs). Ensure this data is not logged or exposed inadvertently.
 *
 * **Rate Limiting**: Users can click buttons rapidly. Implement deduplication if needed to prevent duplicate rating recordings.
 *
 * **Token Security**: Message tokens used in ratings should be cryptographically secure random values to prevent guessing or manipulation.
 *
 * **Note:** Interactive components significantly enhance user experience by providing rich, app-like interfaces within Slack. The combination of references (transparency) and ratings (feedback) creates a quality improvement loop that helps continuously refine bot responses.
 *
 * For information about the initial bot responses that include these interactive components, see the event webhook endpoint section.
 */

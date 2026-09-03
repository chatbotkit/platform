/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Slack) */
// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import fetch from '@/lib/fetch'
import { logEvent } from '@/lib/log'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  notAuthorized,
  notFound,
  ok,
  respondFromError,
  throwConflict,
} from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @param {import('@/prisma/types').SlackIntegration & { user?: { id: string } }} slackIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(slackIntegration) {
  debug(`do setup`, { slackIntegration })

  if (
    slackIntegration.signingSecret == null ||
    !slackIntegration.signingSecret
  ) {
    return throwConflict(`No signingSecret specified`)
  }

  if (slackIntegration.botToken == null || !slackIntegration.botToken) {
    return throwConflict(`No botToken specified`)
  }

  // @note validate the bot token against Slack's auth.test endpoint
  {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${slackIntegration.botToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return throwConflict(
        `Failed to validate bot token: HTTP ${response.status}`
      )
    }

    const result = await response.json()

    if (!result.ok) {
      // @note log the invalid token event for monitoring
      await logEvent({
        user: { id: slackIntegration.userId },
        name: 'Slack Bot Token Invalid',
        description: `Bot token validation failed for Slack integration ${slackIntegration.id}`,
        type: 'integration.slack.auth.error',
        relations: {
          slackIntegrationId: slackIntegration.id,
        },
        meta: {
          error: result.error,
          integrationName: slackIntegration.name,
        },
      })

      const errorMessages = {
        not_authed:
          'Bot token is missing, invalid, or the app has been uninstalled from the workspace',
        invalid_auth: 'Bot token is invalid or has expired',
        account_inactive:
          'The Slack account associated with this token has been deactivated',
        token_revoked: 'The bot token has been explicitly revoked',
        token_expired: 'The bot token has expired',
      }

      const message =
        errorMessages[result.error] ||
        `Bot token validation failed: ${result.error}`

      return throwConflict(message)
    }

    debug(`bot token validated successfully`, {
      team: result.team,
      user: result.user,
      botId: result.bot_id,
    }).log('integration.slack.setup')
  }

  // @note validate the user token against Slack's auth.test endpoint if provided
  if (slackIntegration.userToken) {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${slackIntegration.userToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return throwConflict(
        `Failed to validate user token: HTTP ${response.status}`
      )
    }

    const result = await response.json()

    if (!result.ok) {
      // @note log the invalid token event for monitoring
      await logEvent({
        user: { id: slackIntegration.userId },
        name: 'Slack User Token Invalid',
        description: `User token validation failed for Slack integration ${slackIntegration.id}`,
        type: 'integration.slack.auth.error',
        relations: {
          slackIntegrationId: slackIntegration.id,
        },
        meta: {
          error: result.error,
          tokenType: 'user',
          integrationName: slackIntegration.name,
        },
      })

      const errorMessages = {
        not_authed:
          'User token is missing, invalid, or the user has revoked access',
        invalid_auth: 'User token is invalid or has expired',
        account_inactive:
          'The Slack account associated with this user token has been deactivated',
        token_revoked: 'The user token has been explicitly revoked',
        token_expired: 'The user token has expired',
      }

      const message =
        errorMessages[result.error] ||
        `User token validation failed: ${result.error}`

      return throwConflict(message)
    }

    debug(`user token validated successfully`, {
      team: result.team,
      user: result.user,
    }).log('integration.slack.setup')
  }
}

/**
 * @swagger
 *
 * /integration/slack/{slackIntegrationId}/setup:
 *   post:
 *     operationId: setupSlackIntegration
 *     summary: Setup Slack integration
 *     tags:
 *       - Slack Integration
 *     parameters:
 *       - in: path
 *         name: slackIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Slack integration
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The Slack integration was setup successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the setup Slack integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const slackIntegration =
      await prisma.slackIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'slackIntegrationId')
      )

    if (!slackIntegration) {
      return notFound()
    }

    if (slackIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    try {
      await doSetup(slackIntegration)
    } catch (e) {
      await captureError(e)

      return respondFromError(e)
    }

    return ok({ id: slackIntegration.id })
  })
)

/**
 * @manual Slack Integration
 *
 * ## Validating Integration Setup
 *
 * Verify that a Slack integration is properly configured with valid authentication credentials. The setup endpoint performs validation checks to ensure the signing secret and bot token are present and properly formatted before the integration can process events from Slack.
 *
 * This endpoint is primarily used internally during integration creation and updates, but can also be called manually to troubleshoot configuration issues or verify credentials after manual changes.
 *
 * ```http
 * POST /api/v1/integration/slack/{slackIntegrationId}/setup
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {}
 * ```
 *
 * ### Validation Checks
 *
 * The setup validation performs the following checks:
 *
 * **Signing Secret Validation:**
 * - Verifies that `signingSecret` field is not null or empty
 * - Confirms the value is properly formatted
 * - This credential is used to verify webhook requests from Slack
 *
 * **Bot Token Validation:**
 * - Verifies that `botToken` field is not null or empty
 * - Confirms the token starts with `xoxb-` (bot token prefix)
 * - This token is used to make API calls back to Slack
 *
 * If either validation fails, the endpoint returns a 409 Conflict error with a descriptive message indicating which credential is missing or invalid.
 *
 * ### When to Use Setup Validation
 *
 * **After Manual Credential Updates**: If you've updated authentication credentials in your database or through direct API calls, run setup validation to confirm the changes are correct.
 *
 * **Troubleshooting Authentication Failures**: When webhook requests are failing with authentication errors, use setup to verify credentials are properly configured.
 *
 * **Integration Health Checks**: Include setup validation in monitoring scripts to ensure critical integrations remain properly configured.
 *
 * **Post-Migration Verification**: After migrating integrations between environments or accounts, validate that credentials were transferred correctly.
 *
 * ### Automatic Setup Invocation
 *
 * The setup endpoint is automatically called in several scenarios:
 *
 * **During Update Operations**: When you update an integration using the update endpoint, setup validation runs automatically to ensure new credentials are valid.
 *
 * **After Authentication Failures**: When webhook requests fail signature validation, the system automatically triggers setup to diagnose and log configuration issues.
 *
 * **On Configuration Errors**: Various integration errors trigger automatic setup checks to help identify the root cause.
 *
 * ### Response
 *
 * **Success Response (200 OK):**
 * ```json
 * {
 *   "id": "slack_xyz789"
 * }
 * ```
 *
 * **Error Response (409 Conflict):**
 * ```json
 * {
 *   "error": "conflict",
 *   "message": "No signingSecret specified"
 * }
 * ```
 *
 * or
 *
 * ```json
 * {
 *   "error": "conflict",
 *   "message": "No botToken specified"
 * }
 * ```
 *
 * ### Troubleshooting Setup Failures
 *
 * **Missing Signing Secret**: The integration was created without a signing secret. Update the integration with the correct value from Slack app settings under "Basic Information" → "Signing Secret".
 *
 * **Missing Bot Token**: The integration was created without a bot token. Update the integration with the correct value from Slack app settings under "OAuth & Permissions" → "Bot User OAuth Token".
 *
 * **Empty Credentials**: Credentials were set to empty strings. Ensure you're passing the actual credential values, not placeholder strings.
 *
 * **Token Format Issues**: Bot tokens must start with `xoxb-`. If you're seeing format errors, verify you're using the bot token and not a user token (which starts with `xoxp-`).
 *
 * ### Security Considerations
 *
 * The setup endpoint only validates that credentials exist and are properly formatted. It does not:
 *
 * - Test connectivity to Slack's API
 * - Verify OAuth scope permissions
 * - Confirm webhook URL registration
 * - Validate team or workspace associations
 *
 * For comprehensive integration testing, send a test message through Slack and verify the bot responds correctly. This confirms that all components of the integration are working together.
 *
 * **Note:** Setup validation is a lightweight operation that completes quickly (typically under 100ms) and can be called frequently without impacting performance or triggering rate limits.
 */

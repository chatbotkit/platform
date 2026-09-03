/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Google OAuth) */
// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import fetch from '@/lib/fetch'
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
 * Validates a Google Chat integration by verifying that the service account
 * key can obtain an access token from Google's OAuth2 endpoint.
 *
 * @param {import('@/prisma/types').GooglechatIntegration} googlechatIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(googlechatIntegration) {
  debug(`do setup`, { id: googlechatIntegration.id })

  if (
    !googlechatIntegration.serviceAccountKey ||
    googlechatIntegration.serviceAccountKey === '********'
  ) {
    // @note setup without a key is a no-op - the bot simply cannot send replies
    return
  }

  let sa

  try {
    sa = JSON.parse(googlechatIntegration.serviceAccountKey)
  } catch {
    return throwConflict(
      `The service account key is not valid JSON. Please provide a valid Google service account JSON key.`
    )
  }

  if (!sa.client_email || !sa.private_key) {
    return throwConflict(
      `The service account key is missing required fields (client_email or private_key).`
    )
  }

  // @note validate by attempting a token exchange
  {
    const now = Math.floor(Date.now() / 1000)

    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/chat.bot',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }

    function base64url(data) {
      const bytes =
        typeof data === 'string' ? new TextEncoder().encode(data) : data

      let binary = ''

      for (const b of bytes) {
        binary += String.fromCharCode(b)
      }

      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    }

    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`

    let jwt

    try {
      const pemContent = sa.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s/g, '')

      const keyBytes = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0))

      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        keyBytes,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      )

      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(signingInput)
      )

      jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`
    } catch {
      return throwConflict(
        `Failed to sign JWT with the provided private key. Please verify the service account key is valid.`
      )
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    })

    if (!response.ok) {
      const text = await response.text()

      debug(`setup token error`, { text }).log(
        'integration.googlechat.setup.doSetup'
      )

      return throwConflict(
        `Failed to validate service account credentials. Please check that the service account key is correct and the Chat API is enabled for your project.`
      )
    }

    debug(`setup complete - credentials validated`).log(
      'integration.googlechat.setup.doSetup'
    )
  }
}

/**
 * @swagger
 *
 * /integration/googlechat/{googlechatIntegrationId}/setup:
 *   post:
 *     operationId: setupGooglechatIntegration
 *     summary: Setup Google Chat integration
 *     tags:
 *       - Google Chat Integration
 *     parameters:
 *       - in: path
 *         name: googlechatIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Google Chat integration
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
 *         description: The Google Chat integration was set up successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Google Chat Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const googlechatIntegration =
      await prisma.googlechatIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'googlechatIntegrationId')
      )

    if (!googlechatIntegration) {
      return notFound()
    }

    if (googlechatIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    try {
      await doSetup(googlechatIntegration)
    } catch (e) {
      await captureError(e)

      return respondFromError(e)
    }

    return ok({ id: googlechatIntegration.id })
  })
)

/**
 * @manual Google Chat Integration
 * @index 20
 *
 * ## Validating Integration Setup
 *
 * Validate the Google Chat integration credentials by verifying that the
 * configured service account key can be used to authenticate with Google Chat.
 * This ensures the integration has the proper permissions to send messages back
 * to Google Chat spaces and direct messages on behalf of your bot.
 *
 * This endpoint is primarily called automatically after `create` and `update`
 * operations, but can also be invoked manually to troubleshoot credential
 * issues or verify configuration after making changes outside of the standard
 * update flow.
 *
 * ```http
 * POST /api/v1/integration/googlechat/{googlechatIntegrationId}/setup
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {}
 * ```
 *
 * ### Validation Checks
 *
 * The setup validation checks that the configured service account key is
 * readable, belongs to a usable Google Cloud service account, and can be used
 * by ChatBotKit to send messages for the Chat app.
 *
 * If validation fails, the endpoint returns a 409 Conflict error with a
 * descriptive message explaining the specific issue found.
 *
 * ### When to Use Setup Validation
 *
 * **After Manual Credential Updates**: If you have updated the service account
 * key through the update endpoint or made other credential changes, run setup
 * validation to confirm the new credentials work correctly before relying on
 * them for production traffic.
 *
 * **Troubleshooting Message Delivery Failures**: When the bot stops responding
 * in Google Chat spaces, use setup validation to rule out credential expiry or
 * permission changes as the root cause.
 *
 * **Troubleshooting Space Responses**: If direct messages work but the bot does
 * not respond in a space, confirm that the Chat app has been added to that exact
 * space through Google Chat's "Add people & apps" or "Manage members" flow.
 * Google Chat does not send space interactions to apps that are merely enabled
 * in the Cloud configuration but not installed in the space.
 *
 * **Verifying New Service Accounts**: After rotating service accounts or
 * creating new ones in Google Cloud Console, validate the credentials are
 * properly configured for the Chat app's Google Cloud project.
 *
 * ### Response
 *
 * **Success Response (200 OK):**
 * ```json
 * {
 *   "id": "googlechat_xyz789"
 * }
 * ```
 *
 * **Error Response (409 Conflict - Invalid JSON):**
 * ```json
 * {
 *   "error": "conflict",
 *   "message": "The service account key is not valid JSON. Please provide a valid Google service account JSON key."
 * }
 * ```
 *
 * **Example Error Response (409 Conflict):**
 * ```json
 * {
 *   "error": "conflict",
 *   "message": "Failed to validate service account credentials."
 * }
 * ```
 *
 * ### Troubleshooting Setup Failures
 *
 * **Invalid JSON Format**: Download a fresh service account key JSON file
 * from Google Cloud Console (IAM & Admin - Service Accounts - Keys) and
 * provide the complete file contents as the `serviceAccountKey` field.
 *
 * **Incomplete Service Account Key**: Service account keys downloaded from
 * Google Cloud Console contain all required values. Keys manually constructed or
 * partially copied may be incomplete.
 *
 * **Credential Validation Failure**: Ensure the Google Cloud project has the
 * Chat API enabled and the service account belongs to that same project. No IAM
 * role assignment is required for a Chat-app service account. Also verify the
 * service account key has not been revoked or expired.
 *
 * **Note:** When the integration was created without a service account key,
 * setup validation is skipped as a no-op. The bot can still receive messages
 * but cannot send replies without valid credentials.
 */

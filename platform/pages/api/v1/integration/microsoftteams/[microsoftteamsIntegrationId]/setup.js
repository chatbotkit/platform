/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Microsoft login) */
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
 * Performs Bot Framework registration validation for a Microsoft Teams integration.
 *
 * @param {import('@/prisma/types').MicrosoftteamsIntegration} microsoftteamsIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(microsoftteamsIntegration) {
  debug(`do setup`, { microsoftteamsIntegration })

  if (
    microsoftteamsIntegration.botFrameworkAppId == null ||
    !microsoftteamsIntegration.botFrameworkAppId
  ) {
    return throwConflict(`No botFrameworkAppId specified`)
  }

  if (
    microsoftteamsIntegration.botFrameworkAppSecret == null ||
    !microsoftteamsIntegration.botFrameworkAppSecret
  ) {
    return throwConflict(`No botFrameworkAppSecret specified`)
  }

  // @note validate credentials by requesting an access token from Azure AD

  const tokenUrl = `https://login.microsoftonline.com/${microsoftteamsIntegration.tenantId || 'botframework.com'}/oauth2/v2.0/token`

  const params = new URLSearchParams()

  params.set('grant_type', 'client_credentials')
  params.set('client_id', microsoftteamsIntegration.botFrameworkAppId)
  params.set('client_secret', microsoftteamsIntegration.botFrameworkAppSecret)
  params.set('scope', 'https://api.botframework.com/.default')

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const text = await response.text()

    debug(`setup token error`, { text }).log(
      'integration.microsoftteams.setup.doSetup'
    )

    return throwConflict(
      `Failed to validate Bot Framework credentials. Please check your App ID, App Secret, and Tenant ID.`
    )
  }

  debug(`setup complete - credentials validated`).log(
    'integration.microsoftteams.setup.doSetup'
  )
}

/**
 * @swagger
 *
 * /integration/microsoftteams/{microsoftteamsIntegrationId}/setup:
 *   post:
 *     operationId: setupMicrosoftteamsIntegration
 *     summary: Set up a Microsoft Teams integration
 *     tags:
 *       - Microsoft Teams Integration
 *     parameters:
 *       - in: path
 *         name: microsoftteamsIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Microsoft Teams integration
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
 *         description: The Microsoft Teams integration was set up successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Microsoft Teams integration that was set up
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const microsoftteamsIntegration =
      await prisma.microsoftteamsIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'microsoftteamsIntegrationId')
      )

    if (!microsoftteamsIntegration) {
      return notFound()
    }

    if (microsoftteamsIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    try {
      await doSetup(microsoftteamsIntegration)
    } catch (e) {
      await captureError(e)

      return respondFromError(e)
    }

    return ok({ id: microsoftteamsIntegration.id })
  })
)

/**
 * @manual Microsoft Teams Integration
 * @index 10
 *
 * ## Setting Up and Validating Your Microsoft Teams Integration
 *
 * The setup endpoint validates your Microsoft Bot Framework credentials by
 * requesting an access token from Azure Active Directory. This confirms
 * that the App ID, App Secret, and Tenant ID stored in your integration are
 * correctly configured and that ChatBotKit can communicate with the Bot
 * Framework on your behalf.
 *
 * Setup is automatically triggered after every successful update to a Microsoft Teams
 * integration. You can also call it manually at any time to re-verify
 * credentials without making any other changes - useful after rotating
 * secrets in Azure or when troubleshooting authentication issues.
 *
 * ```http
 * POST /api/v1/integration/microsoftteams/{microsoftteamsIntegrationId}/setup
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * A successful response confirms that your credentials are valid:
 *
 * ```json
 * { "id": "teams_integration_xyz789" }
 * ```
 *
 * ## What Setup Validates
 *
 * The setup call performs a live credential check by requesting a client
 * credentials token from Microsoft's OAuth 2.0 token endpoint. It requires:
 *
 * - A non-empty `botFrameworkAppId` stored on the integration
 * - A non-empty `botFrameworkAppSecret` stored on the integration
 *
 * If the Tenant ID is omitted, the validation uses the `botframework.com`
 * authority, which supports multi-tenant bot registrations. If a Tenant ID
 * is present, it uses `login.microsoftonline.com/{tenantId}` instead.
 *
 * ## Troubleshooting Setup Failures
 *
 * If setup returns a `409 Conflict` error, the Bot Framework credential check
 * failed. Common causes and remedies:
 *
 * - **Missing App ID or Secret**: Update the integration with valid credentials
 *   before calling setup.
 * - **Incorrect App Secret**: The secret may have expired or been regenerated
 *   in Azure. Rotate a new secret, update the integration with the new value,
 *   then call setup again.
 * - **Wrong Tenant ID**: If your Azure Bot uses a single-tenant configuration,
 *   ensure the `tenantId` matches the Azure AD directory ID exactly. For
 *   multi-tenant bots, leave `tenantId` blank.
 * - **App permissions not granted**: Verify the App registration in Azure has
 *   the required API permissions for Bot Framework (`https://api.botframework.com/.default`).
 *
 * **Note:** Setup does not modify any integration settings - it only verifies
 * the credentials currently stored. To fix credential errors, use the update
 * endpoint first, then call setup to confirm.
 */

// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { conflict, notAuthorized, notFound, ok } from '@/lib/response'
import { canUseSecret } from '@/lib/secret.access'
import { ContactSecretManager, getSecretManager } from '@/lib/secret.manager'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /contact/{contactId}/secret/{secretId}/authenticate:
 *   post:
 *     operationId: authenticateContactSecret
 *     summary: Authenticate contact secret
 *     tags:
 *       - Contact Secret
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *           description: The ID of the contact the secret belongs to
 *       - in: path
 *         name: secretId
 *         required: true
 *         schema:
 *           type: string
 *           description: The ID of the secret to authenticate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The contact secret is about to be authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the secret to authenticate
 *                   type: string
 *                 url:
 *                   description: The URL to authenticate the secret
 *                   type: string
 *               required:
 *                 - id
 *                 - url
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const contact = await prisma.contact.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'contactId')
    )

    if (!contact) {
      return notFound()
    }

    if (contact.userId !== session.user.id) {
      return notAuthorized()
    }

    const secret = await prisma.secret.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'secretId')
    )

    if (!secret) {
      return notFound()
    }

    if (!(await canUseSecret(session.user, secret))) {
      return notAuthorized()
    }

    let secretManager

    {
      secretManager = getSecretManager(secret, {
        contact,
      })

      if (!secretManager) {
        return conflict(
          'Cannot authenticate secret for this secret configuration'
        )
      }
    }

    let url

    {
      switch (true) {
        case secretManager instanceof ContactSecretManager: {
          url = await secretManager.getAuthUrl(secret, {
            raw: true, // @note using raw because we don't want to create temp urls unnecessarily
          })

          break
        }

        default: {
          return conflict('Cannot obtain secret for this secret type')
        }
      }
    }

    return ok({ id: secret.id, url })
  })
)

/**
 * @manual Contact Secrets
 * @description Contact secrets provide secure authentication mechanisms for external service integrations, enabling contacts to connect their third-party accounts with AI agents through OAuth and API key authentication flows.
 * @category Objects/Contacts
 * @tags contact, secrets, authentication, oauth, integration
 * @index 30
 *
 * Contact secrets enable secure connections between contacts and external
 * services by managing authentication credentials and OAuth flows. This system
 * allows your AI agents to access external APIs and services on behalf of
 * individual contacts, providing personalized experiences that leverage users'
 * own accounts and data sources.
 *
 * The secret management system supports multiple authentication methods
 * including OAuth 2.0 authorization flows and API key-based authentication,
 * with built-in security features like access control validation and encrypted
 * credential storage.
 *
 * ## Authenticating Contact Secrets
 *
 * The authentication operation initiates the OAuth flow or credential exchange
 * process for a contact secret, returning an authentication URL that the
 * contact must visit to grant permissions. This endpoint is the first step
 * in connecting a contact's external account to your platform, enabling
 * subsequent API calls to be made on their behalf.
 *
 * To start the authentication process for a contact secret, send a POST
 * request to the authenticate endpoint:
 *
 * ```http
 * POST /api/v1/contact/{contactId}/secret/{secretId}/authenticate
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * ### Authentication Flow
 *
 * The authentication process varies based on the secret type:
 *
 * **OAuth Secrets**: For secrets configured with OAuth providers, the endpoint
 * returns an authorization URL where the contact must grant permissions. The
 * URL includes all necessary OAuth parameters including client ID, redirect
 * URI, scopes, and state parameter for security.
 *
 * **API Key Secrets**: For API key-based secrets, the endpoint validates
 * that the secret is properly configured and returns a direct authentication
 * URL or configuration interface.
 *
 * ### Response Format
 *
 * The endpoint returns the secret ID and authentication URL:
 *
 * ```json
 * {
 *   "id": "secret_abc123",
 *   "url": "https://provider.com/oauth/authorize?client_id=...&redirect_uri=...&state=..."
 * }
 * ```
 *
 * The contact should be redirected to this URL to complete the authentication
 * process. After successful authentication, the external provider will redirect
 * back to your platform with authorization credentials.
 *
 * ### Access Control
 *
 * The authentication endpoint enforces strict access control to ensure security:
 *
 * - The authenticated user must own the contact
 * - The secret must belong to the specified contact
 * - The secret must be accessible according to the defined access rules
 * - Users without proper access receive authorization errors
 *
 * ### Security Considerations
 *
 * The authentication flow includes several security mechanisms:
 *
 * - **State Parameter**: OAuth flows include a state parameter to prevent CSRF
 *   attacks
 * - **Access Validation**: The system verifies that the requesting user has
 *   permission to access the secret
 * - **Provider Verification**: Only registered and approved OAuth providers
 *   are supported
 * - **Credential Encryption**: All stored credentials are encrypted at rest
 *
 * ### Error Handling
 *
 * Common error scenarios include:
 *
 * - **Not Found**: Contact or secret doesn't exist
 * - **Not Authorized**: User doesn't have permission to authenticate the secret
 * - **Conflict**: Secret type doesn't support authentication or is already
 *   authenticated
 * - **Configuration Error**: Secret is missing required configuration (provider,
 *   callback URL, etc.)
 *
 * ### Post-Authentication
 *
 * After the contact completes authentication at the provider's authorization
 * URL, they are redirected back to your platform with credentials. The system
 * automatically:
 *
 * 1. Exchanges authorization codes for access tokens
 * 2. Stores encrypted credentials securely
 * 3. Marks the secret as verified and ready to use
 * 4. Makes the secret available for API calls on behalf of the contact
 *
 * **Important Notes:**
 *
 * - Authentication URLs are temporary and typically expire after a short period
 *   (usually 10-15 minutes)
 * - OAuth state parameters are single-use to prevent replay attacks
 * - Secrets must be created with appropriate provider and configuration before
 *   authentication
 * - Re-authenticating an existing secret will refresh credentials and
 *   permissions
 * - Some providers require specific scopes to be requested during authentication
 * - The contact must grant all requested permissions for authentication to
 *   succeed
 */

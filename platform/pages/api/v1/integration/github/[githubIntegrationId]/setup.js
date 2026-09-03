// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { listAppInstallations } from '@/lib/github.app'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * Probes the integration's GitHub App credentials. Listing the App's
 * installations requires a valid App JWT, so it only succeeds when the App ID
 * and private key are correct - which makes it a good basic health check.
 *
 * @param {any} integration
 * @returns {Promise<{ installations: number }>}
 */
export async function doSetup(integration) {
  debug('doSetup', { id: integration.id }).log(
    'integration.github.setup.doSetup'
  )

  if (!integration.appId || !integration.privateKey) {
    throw new UserInputError(
      'Set the App ID and private key before running setup.'
    )
  }

  let installations

  try {
    installations = await listAppInstallations({
      appId: integration.appId,
      privateKey: integration.privateKey,
    })
  } catch (error) {
    debug('doSetup probe failed', {
      error: /** @type {any} */ (error)?.message,
    }).log('integration.github.setup.doSetup')

    throw new UserInputError(
      'Could not authenticate with GitHub using the provided App ID and private key. Check the values and try again.'
    )
  }

  debug('doSetup ok', { installations: installations.length }).log(
    'integration.github.setup.doSetup'
  )

  return { installations: installations.length }
}

/**
 * @swagger
 *
 * /integration/github/{githubIntegrationId}/setup:
 *   post:
 *     operationId: setupGithubIntegration
 *     summary: Validate a GitHub integration's App credentials
 *     tags:
 *       - GitHub Integration
 *     parameters:
 *       - in: path
 *         name: githubIntegrationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The GitHub integration credentials are valid
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const githubIntegration =
      await prisma.githubIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'githubIntegrationId')
      )

    if (!githubIntegration) {
      return notFound()
    }

    if (githubIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    const result = await doSetup(githubIntegration)

    return ok({ id: githubIntegration.id, ...result })
  })
)

/**
 * @manual GitHub Integration
 * @description GitHub Integration enables seamless connection with GitHub repositories and enables OAuth-based bot commands for automated tasks and workflow automation.
 * @category Integrations/GitHub
 * @tags github, integration, oauth, setup
 * @index 50
 *
 * ## Validating GitHub Integration Credentials
 *
 * Before your GitHub integration can function, you must validate that the GitHub App credentials are correctly configured. The setup endpoint probes your integration by testing the App ID and private key against GitHub's API. This serves as a health check to ensure your authentication configuration is valid and your GitHub App has proper access permissions.
 *
 * This validation step is critical because GitHub App authentication requires precise configuration. The App ID, private key, and installation permissions must all be correctly set up. By running setup, you'll immediately discover any misconfiguration rather than encountering failures later during actual bot operations.
 *
 * To validate your GitHub integration credentials, send a POST request to the setup endpoint with the integration ID:
 *
 * ```http
 * POST /api/v1/integration/github/{githubIntegrationId}/setup
 * Content-Type: application/json
 * ```
 *
 * The endpoint will probe your GitHub App configuration by attempting to list your App's installations. A successful response confirms that:
 *
 * - Your GitHub App ID is correctly configured
 * - Your GitHub App private key is valid and properly formatted
 * - Your App has permission to list installations
 * - Your GitHub account has proper authorization
 *
 * **Response on Success:**
 *
 * ```json
 * {
 *   "id": "ghint_abc123xyz",
 *   "installations": 5
 * }
 * ```
 *
 * The `installations` field indicates how many GitHub installations your App currently has access to. This represents the repositories and organizations where your App is installed.
 *
 * **Common Validation Errors:**
 *
 * - **Invalid App ID or Private Key**: Double-check that you've copied the App ID and private key exactly from your GitHub App settings, including all special characters
 * - **Expired Private Key**: GitHub App private keys have limited validity. Regenerate a new private key in your GitHub App settings if needed
 * - **Missing Permissions**: Ensure your App has the necessary permissions for bot operations (typically read access to repositories, and access to pull requests/issues if needed)
 * - **Installation Not Found**: Verify that your GitHub App is actually installed in the target repositories or organization
 *
 * **Best Practices:**
 *
 * - **Validate Early**: Run setup immediately after configuring your GitHub App credentials to catch configuration errors early
 * - **Regenerate Keys Periodically**: For security, periodically regenerate your GitHub App private key and update your integration
 * - **Test with Small Scope**: Start with limited repository access during testing, then expand permissions as needed
 * - **Monitor Installations**: Keep track of how many installations your App has. Unexpected changes may indicate security issues
 *
 * **Important Considerations:**
 *
 * The setup endpoint validates static configuration (App ID and private key) but does not test actual command execution. After setup succeeds, test your specific bot commands with real conversations to ensure full end-to-end functionality. Setup validation is a prerequisite but not a guarantee that all bot features will work correctly.
 */

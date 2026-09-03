// @ts-check
import prisma from '@/prisma/client'

import { maskSecretConfig } from '@/lib/credential.mask'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /secret/{secretId}/fetch:
 *   get:
 *     operationId: fetchSecret
 *     summary: Fetch a secret
 *     tags:
 *       - Secret
 *     parameters:
 *       - in: path
 *         name: secretId
 *         required: true
 *         schema:
 *           description: The ID of the secret to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The secret was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     kind:
 *                       $ref: '#/components/schemas/SecretKind'
 *                     type:
 *                       $ref: '#/components/schemas/SecretType'
 *                     config:
 *                       description: The config of the secret (config.clientSecret is returned as '********' if configured, null otherwise)
 *                       type: object
 *                       additionalProperties: true
 *                     visibility:
 *                       $ref: '#/components/schemas/SecretVisibility'
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const secret = await prisma.secret.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'secretId'),
      {
        select: {
          // identifiers

          id: true,

          // ref

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

          blueprintId: true,

          // resource specific

          kind: true,

          type: true,

          config: true,

          visibility: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!secret) {
      return notFound()
    }

    if (secret.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (secret).userId)

    // @note config.clientSecret is returned as '********' when set - see
    // lib/credential.mask.ts
    return ok(
      makeJsonSafe({ ...secret, config: maskSecretConfig(secret.config) })
    )
  })
)

/**
 * @manual Secrets
 * @index 15
 *
 * ## Fetching Secret Details
 *
 * Retrieve detailed information about a specific secret using its unique identifier.
 * This endpoint returns the secret's metadata including its name, description, type,
 * visibility settings, and configuration, but never exposes the actual credential
 * value for security reasons.
 *
 * Fetching secret details is useful when you need to display secret information in
 * your user interface, update secret metadata, or verify secret configuration. The
 * response includes all non-sensitive information about the secret, making it safe
 * to use in client-side applications.
 *
 * To fetch a specific secret:
 *
 * ```http
 * GET /api/v1/secret/{secretId}/fetch
 * ```
 *
 * Replace `{secretId}` with the unique identifier of the secret you want to retrieve.
 * You can use either the secret's ID or its name in this parameter.
 *
 * **Response Fields:**
 * - `id` - Unique secret identifier
 * - `name` - Secret name for reference
 * - `description` - Human-readable description
 * - `kind` - Secret kind: `shared` or `personal`
 * - `type` - Authentication type: `plain`, `basic`, `bearer`, `oauth`, or `template`
 * - `visibility` - Access control: `private`, `protected`, or `public`
 * - `config` - Additional configuration options
 * - `blueprintId` - Associated blueprint (if any)
 * - `meta` - Custom metadata
 * - `createdAt` - Creation timestamp
 * - `updatedAt` - Last update timestamp
 *
 * **Important:** The secret value is never included in the response for security
 * reasons. To verify that a secret is properly configured and authenticated, use
 * the verify endpoint instead.
 */

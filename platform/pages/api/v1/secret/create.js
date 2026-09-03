// @ts-check
import prisma from '@/prisma/client'
import { SecretKind, SecretType, SecretVisibility } from '@/prisma/types'
import { SecretConfig } from '@/prisma/zod'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { conflict, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  kind: schema.string().valid(...Object.keys(SecretKind)),

  type: schema.string().valid(...Object.keys(SecretType)),

  value: schema.string().allow(null, ''),

  config: schema.object().zodSchema(SecretConfig).allow(null),

  visibility: schema.string().valid(...Object.keys(SecretVisibility)),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /secret/create:
 *   post:
 *     operationId: createSecret
 *     summary: Create secret
 *     tags:
 *       - Secret
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - type: object
 *                 properties:
 *                   kind:
 *                     $ref: '#/components/schemas/SecretKind'
 *                   type:
 *                     $ref: '#/components/schemas/SecretType'
 *                   value:
 *                     description: The value of the secret
 *                     type: string
 *                   config:
 *                     description: The config of the secret
 *                     type: object
 *                     additionalProperties: true
 *                   visibility:
 *                     $ref: '#/components/schemas/SecretVisibility'
 *     responses:
 *       200:
 *         description: The secret was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created secret
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        kind,

        type,

        value,

        config,

        visibility,

        meta,
      } = body

      if (kind === SecretKind.personal) {
        if (value) {
          return conflict('Personal secrets cannot have a value')
        }
      }

      const { id } = await prisma.secret.create({
        data: {
          userId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          // resource specific

          kind,

          type,

          ...(kind === SecretKind.shared ? { value } : { value: null }),

          config,

          visibility,

          // meta and others

          meta,
        },

        select: {
          id: true,
        },
      })

      return ok({ id })
    })
  )
)

/**
 * @manual Secrets
 * @description Secrets are secure credential storage for API keys, OAuth tokens, and other sensitive authentication data used by agents and integrations within the platform.
 * @category Resources/Secrets
 * @tags secrets, authentication, credentials, security
 * @index 1
 *
 * Secrets provide a secure way to store and manage sensitive credentials such as
 * API keys, OAuth tokens, username/password combinations, and bearer tokens. These
 * credentials can be used by AI agents, integrations, and skillsets to authenticate
 * with external services without exposing sensitive data in your code or
 * configuration files.
 *
 * Secrets support multiple authentication types including plain text, basic auth,
 * bearer tokens, and OAuth flows, making them versatile for various integration
 * scenarios.
 *
 * ## Creating Secrets
 *
 * Creating a secret allows you to securely store credentials that can be referenced
 * by name in your agents and integrations. When creating a secret, you need to
 * specify the secret type, visibility, and the actual credential value.
 *
 * Secrets can be either `shared` (stored on the platform) or `personal` (stored
 * locally by each user). Shared secrets are accessible to all users within your
 * organization, while personal secrets are user-specific.
 *
 * To create a new secret:
 *
 * ```http
 * POST /api/v1/secret/create
 * Content-Type: application/json
 *
 * {
 *   "name": "PaymentAPIKey",
 *   "description": "API key for payment gateway",
 *   "kind": "shared",
 *   "type": "bearer",
 *   "value": "sk_live_12345...",
 *   "visibility": "private"
 * }
 * ```
 *
 * **Available Secret Types:**
 * - `plain` - Simple text credentials
 * - `basic` - Username and password combinations
 * - `bearer` - API keys and bearer tokens
 * - `oauth` - OAuth tokens and refresh tokens
 * - `template` - Dynamic credential templates
 *
 * **Important Security Notes:**
 * - Secret values are encrypted at rest and never exposed in API responses
 * - Only `shared` secrets store values on the platform; `personal` secrets require
 *   user authentication
 * - Once created, secret values can be updated but never retrieved directly
 * - Use appropriate visibility settings to control access to secrets
 */

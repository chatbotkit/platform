// @ts-check
import prisma from '@/prisma/client'
import { SecretKind, SecretType, SecretVisibility } from '@/prisma/types'
import { SecretConfig } from '@/prisma/zod'

import { unmaskSecretConfig } from '@/lib/credential.mask'
import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { conflict, notAuthorized, notFound, ok } from '@/lib/response'
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
 * /secret/{secretId}/update:
 *   post:
 *     operationId: updateSecret
 *     summary: Update secret
 *     tags:
 *       - Secret
 *     parameters:
 *       - in: path
 *         name: secretId
 *         required: true
 *         schema:
 *           type: string
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
 *         description: The secret was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated secret
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
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

      const secret = await prisma.secret.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'secretId')
      )

      if (!secret) {
        return notFound()
      }

      if (secret.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.secret.update({
        where: {
          id: secret.id,
        },

        data: {
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

          ...(secret.kind === SecretKind.shared ? { value } : { value: null }),

          // @note fetch masks config.clientSecret; a config that echoes the
          // sentinel keeps the stored secret - see lib/credential.mask.ts
          config: unmaskSecretConfig(
            config,
            /** @type {any} */ (secret.config)
          ),

          visibility,

          // meta and others

          meta: getMeta(meta, secret.meta),
        },
      })

      return ok({ id: secret.id })
    })
  )
)

/**
 * @manual Secrets
 * @index 20
 *
 * ## Updating Secrets
 *
 * Update an existing secret's properties including its name, description, type, value,
 * and visibility settings. This endpoint allows you to modify secret configuration
 * without having to delete and recreate it, preserving any references to the secret
 * in your agents and integrations.
 *
 * When updating a secret, you can change most properties including the credential
 * value itself. This is useful when rotating API keys, updating OAuth tokens, or
 * modifying secret metadata. Only the secret owner can update a secret.
 *
 * To update a secret:
 *
 * ```http
 * POST /api/v1/secret/{secretId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "UpdatedPaymentKey",
 *   "description": "Updated payment gateway credentials",
 *   "type": "bearer",
 *   "value": "sk_live_new_key_67890...",
 *   "visibility": "private"
 * }
 * ```
 *
 * Replace `{secretId}` with the unique identifier or name of the secret you want to
 * update. You can update any combination of fields; only the fields you include in
 * the request body will be modified.
 *
 * **Updatable Fields:**
 * - `name` - Change the secret's reference name
 * - `description` - Update the description
 * - `kind` - Change between `shared` and `personal`
 * - `type` - Modify the authentication type
 * - `value` - Rotate or update the credential value (only for `shared` secrets)
 * - `config` - Update configuration options
 * - `visibility` - Change access control settings
 * - `blueprintId` - Associate with a different blueprint
 * - `meta` - Update custom metadata
 *
 * **Important Notes:**
 * - Secret values can only be updated for `shared` secrets; `personal` secrets require
 *   user authentication through the OAuth flow
 * - Updating a secret's value does not affect existing references, but agents will
 *   use the new value in subsequent operations
 * - Consider testing updated credentials before deploying to production agents
 */

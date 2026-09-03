// @ts-check
import { ONE_MONTH_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { isMaskSentinel } from '@/lib/credential.mask'
import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

import { sendEvent } from '@/pages/api/v1/integration/github/[githubIntegrationId]/queue'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  appId: schema.string().allow(null, ''),

  privateKey: schema.string().allow(null, ''),

  webhookSecret: schema.string().allow(null, ''),

  contactCollection: schema.boolean(),

  sessionDuration: schema
    .number()
    .min(0)
    .max(ONE_MONTH_IN_MILLISECONDS)
    .allow(null),

  allowFrom: schema.string().allow(null, ''),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/github/{githubIntegrationId}/update:
 *   post:
 *     operationId: updateGithubIntegration
 *     summary: Update a GitHub integration
 *     tags:
 *       - GitHub Integration
 *     parameters:
 *       - in: path
 *         name: githubIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the GitHub integration
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
 *               - $ref: '#/components/schemas/BotRef'
 *     responses:
 *       200:
 *         description: The GitHub integration was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the GitHub Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      let {
        alias,

        name,
        description,

        blueprintId: blueprint,

        botId: bot,

        appId,

        privateKey,

        webhookSecret,

        contactCollection,

        sessionDuration,

        allowFrom,

        meta,
      } = body

      // @note fetch returns the private key masked; a client saving the
      // fetched form back sends the sentinel, which means "keep what is
      // stored" - see lib/credential.mask.ts
      if (isMaskSentinel(privateKey)) {
        privateKey = undefined
      }

      if (isMaskSentinel(webhookSecret)) {
        webhookSecret = undefined
      }

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

      await prisma.githubIntegration.update({
        where: {
          id: githubIntegration.id,
        },

        data: {
          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          botId: bot?.id || bot,

          // resource specific

          appId,

          privateKey,

          // @note an integration with no webhook secret cannot verify inbound
          // deliveries, so a blank value is treated as "leave unchanged" rather
          // than as a request to clear it. Rotating means setting a new secret.
          webhookSecret: webhookSecret || undefined,

          contactCollection,

          sessionDuration,

          allowFrom,

          // meta and others

          meta: getMeta(meta, githubIntegration.meta),
        },
      })

      await sendEvent(githubIntegration.id, {
        type: 'setup',
        payload: {},
      })

      return ok({ id: githubIntegration.id })
    })
  )
)

/**
 * @manual GitHub Integration
 *
 * ## Updating Integration Configuration
 *
 * Modify an existing GitHub integration's configuration (bot, webhook secret,
 * and options). Updates take effect immediately.
 *
 * ```http
 * POST /api/v1/integration/github/{githubIntegrationId}/update
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "botId": "bot_def456",
 *   "webhookSecret": "rotated_secret"
 * }
 * ```
 */

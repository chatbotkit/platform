// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import skillsetIdSchema from '@/schemas/skillsetId'

import crypto from 'crypto'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  skillsetId: skillsetIdSchema('use'),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/skillserver/create:
 *   post:
 *     operationId: createSkillServerIntegration
 *     summary: Create SkillServer integration
 *     tags:
 *       - SkillServer Integration
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
 *                   skillsetId:
 *                     description: The ID of the skillset
 *                     type: string
 *     responses:
 *       200:
 *         description: The SkillServer integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the SkillServer Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        skillsetId: skillset,

        meta,
      } = body

      const { id } = await prisma.skillserverIntegration.create({
        data: {
          userId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          skillsetId: skillset?.id || skillset,

          // resource specific

          accessToken: crypto.randomBytes(32).toString('hex'),

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
 * @manual SkillServer Integration
 * @description SkillServer Integration exposes a ChatBotKit skillset as a text-first, self-describing HTTP API that any agent can read and invoke directly - a simpler alternative to the MCP Server integration that requires no MCP client.
 * @category Integrations/SkillServer
 * @tags skillserver, integration, skillset, agent, api, export
 * @index 61
 *
 * The SkillServer Integration lets you expose a skillset's abilities as a
 * plain-HTTP "skill server" that agents consume by reading a text manual and
 * then invoking abilities directly. It is a sibling of the MCP Server
 * integration: both publish a skillset to external consumers, but a skillserver
 * needs no MCP client, no JSON-RPC, and no handshake - just an HTTP request and
 * a static access token.
 *
 * ## Creating SkillServer Integrations
 *
 * Specify the skillset you want to expose. Its abilities become discoverable
 * through the manual endpoint and callable through the invoke endpoint.
 *
 * ```http
 * POST /api/v1/integration/skillserver/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Tools",
 *   "description": "Exposes customer support abilities",
 *   "skillsetId": "skillset_abc123"
 * }
 * ```
 *
 * The API returns the integration ID and generates a static access token used to
 * authenticate every runtime request:
 *
 * ```json
 * {
 *   "id": "skillserver_xyz789"
 * }
 * ```
 *
 * ## Authentication
 *
 * Unlike the MCP Server integration, a skillserver uses a single static access
 * token - the same model as a trigger integration's secret. Every runtime
 * request, including the manual, must present it as a bearer token:
 *
 * ```
 * Authorization: Bearer <accessToken>
 * ```
 *
 * Treat the token like an API key. It unlocks every ability in the linked
 * skillset, so distribute it only to trusted consumers and rotate it (by
 * recreating the integration) if it leaks.
 *
 * ## Runtime Surface
 *
 * Once created, the skillserver exposes two authenticated runtime endpoints
 * under its ID:
 *
 * - `GET  /integration/skillserver/{id}/manual` - a text manual describing the
 *   available abilities and how to call them
 * - `POST /integration/skillserver/{id}/invoke` - invoke an ability by name with
 *   its input
 *
 * The standard create, list, fetch, update, and delete endpoints manage the
 * integration itself and use normal session authentication.
 */

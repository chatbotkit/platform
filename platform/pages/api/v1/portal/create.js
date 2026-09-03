// @ts-check
import prisma from '@/prisma/client'
import { PortalConfig } from '@/prisma/zod'

import schema, { withSchema } from '@/lib/joi.handler'
import { withLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import slugSchema from '@/schemas/slug'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  slug: slugSchema,

  config: schema.object().zodSchema(PortalConfig).allow(null),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /portal/create:
 *   post:
 *     operationId: createPortal
 *     summary: Create portal
 *     tags:
 *       - Portal
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
 *                   slug:
 *                     description: The slug of the portal
 *                     type: string
 *                   config:
 *                     description: The config of the portal
 *                     type: object
 *                     additionalProperties: true
 *     responses:
 *       200:
 *         description: The portal was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created portal
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withLimits(
      ['database/portal'],
      withSchema(bodySchema, async function (_req, session, body) {
        const {
          alias,

          name,
          description,

          blueprintId: blueprint,

          slug,

          config,

          meta,
        } = body

        const { id } = await prisma.portal.create({
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

            slug,

            config,

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
)

/**
 * @manual Portals
 * @description Developer reference for portal configuration, including config shape, app options, user access matchers, and update behavior.
 * @category Resources/Portals
 * @tags portal, configuration, access-control, api
 * @index 1
 *
 * Portals are scoped access surfaces for ChatBotKit capabilities. From an API
 * perspective, a portal is a resource that binds:
 *
 * - an identity (`id`, `slug`, optional name/description)
 * - optional resource linkage (`blueprintId`)
 * - runtime behavior (`config`)
 * - optional metadata (`meta`)
 *
 * Use portals when you need controlled, isolated entry points for different
 * audiences while keeping one backend account and data plane.
 *
 * Typical developer scenarios include:
 *
 * - creating dedicated support or operations endpoints
 * - exposing different app sets per team/environment
 * - enforcing domain/email based access rules
 * - customizing layout/branding per deployment target
 *
 * This manual focuses on the `config` object and endpoint semantics used by
 * portal create/update APIs. Treat it as the implementation reference for
 * programmatic portal provisioning.

 * ## Portal Resource Lifecycle
 *
 * 1. Create a portal with `name`, `slug`, and optional `config`.
 * 2. Fetch/list to inspect current configuration/state.
 * 3. Update with the next full desired `config` object.
 * 4. Delete when the access surface is no longer needed.
 *
 * ## Portal Config Model
 *
 * The portal config object has three top-level sections:
 *
 * - `apps`: app slug to app-specific config object
 * - `users`: email matcher to access object
 * - `layout`: optional UI configuration
 *
 * Minimal example:
 *
 * ```http
 * POST /api/v1/portal/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Support Portal",
 *   "slug": "support-portal",
 *   "config": {
 *     "apps": {
 *       "chat": {},
 *       "inbox": {}
 *     },
 *     "users": {
 *       "*@company.com": {}
 *     },
 *     "layout": {
 *       "header": true,
 *       "footer": {
 *         "madeWith": false
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * ## App Configuration
 *
 * Common app slugs used in portals:
 *
 * - `chat`
 * - `task`
 * - `connect`
 * - `inbox`
 * - `usage`
 *
 * If an app slug is present in `config.apps`, it is exposed in that portal.
 *
 * ### Chat
 *
 * The chat app config commonly supports bot exposure, starter prompts, and
 * labeling fields.
 *
 * ```json
 * {
 *   "apps": {
 *     "chat": {
 *       "bots": ["bot_1", "bot_2"],
 *       "initialMessages": ["@bot welcome"],
 *       "title": "Expert Team",
 *       "description": "Talk to our assistant team"
 *     }
 *   }
 * }
 * ```
 *
 * ### Inbox
 *
 * Inbox filters can be configured to control sidebar filter visibility.
 *
 * ```json
 * {
 *   "apps": {
 *     "inbox": {
 *       "filters": {
 *         "integration": true,
 *         "safety": false,
 *         "console": false
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * ## User Access Matchers
 *
 * `config.users` supports exact emails and wildcard domains.
 *
 * ```json
 * {
 *   "users": {
 *     "admin@company.com": {},
 *     "*@company.com": {}
 *   }
 * }
 * ```
 *
 * ## Layout Configuration
 *
 * `config.layout` supports high-level UI behavior and branding.
 *
 * ```json
 * {
 *   "layout": {
 *     "header": true,
 *     "footer": {
 *       "privacy": "https://example.com/privacy",
 *       "terms": "https://example.com/terms",
 *       "madeWith": false
 *     },
 *     "sidebar": {
 *       "title": "Support Portal",
 *       "logo": "https://example.com/logo.svg",
 *       "icon": "https://example.com/icon.png",
 *       "link": "https://example.com"
 *     }
 *   }
 * }
 * ```
 *
 * ## Update Semantics
 *
 * On portal update, `config` is treated as a full object replacement. Send the
 * complete desired config object when calling update to avoid unintentionally
 * dropping existing values.
 */

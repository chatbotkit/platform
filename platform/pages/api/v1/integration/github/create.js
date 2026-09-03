// @ts-check
import { ONE_MONTH_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

import crypto from 'crypto'

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
 * /integration/github/create:
 *   post:
 *     operationId: createGithubIntegration
 *     summary: Create GitHub integration
 *     tags:
 *       - GitHub Integration
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
 *               - type: object
 *                 properties:
 *                   appId:
 *                     description: This integration's GitHub App id (signs the App JWT)
 *                     type: string
 *                   privateKey:
 *                     description: This integration's GitHub App private key (PEM)
 *                     type: string
 *                   webhookSecret:
 *                     description: The GitHub App webhook secret used to validate x-hub-signature-256
 *                     type: string
 *                   contactCollection:
 *                     description: Whether to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The session duration for the GitHub integration
 *                     type: number
 *                   allowFrom:
 *                     description: Restricts who can summon the bot. Comma or newline separated list of `@collaborators`, `@login`, `owner/repo`, `owner/*` or `*`. Defaults to `@collaborators`.
 *                     type: string
 *     responses:
 *       200:
 *         description: The GitHub integration was created successfully
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
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
      const {
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

      const { id } = await prisma.githubIntegration.create({
        data: {
          userId: session.user.id,

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

          // @note default to a strong random secret so the integration is ready
          // to verify webhooks out of the box; the user copies it into the
          // GitHub App and can rotate it later
          webhookSecret:
            webhookSecret || crypto.randomBytes(32).toString('hex'),

          contactCollection,

          sessionDuration,

          allowFrom,

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
 * @manual GitHub Integration
 * @description Integrate ChatBotKit with GitHub to deploy intelligent AI agents directly inside issues and pull requests. @mention the bot to summon it and let it reply in-thread.
 * @category Integrations
 * @tags github, integration, webhook, bot
 * @index 1
 *
 * ChatBotKit's GitHub integration lets you summon an AI agent from any issue or
 * pull request by @mentioning it. The agent replies in-thread as a comment.
 *
 * ## Creating a GitHub Integration
 *
 * To create a new GitHub integration, send a POST request with your
 * configuration:
 *
 * ```http
 * POST /api/v1/integration/github/create
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "name": "Repo Assistant",
 *   "description": "AI assistant for issues and pull requests",
 *   "botId": "bot_abc123",
 *   "appId": "123456",
 *   "privateKey": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
 *   "webhookSecret": "your_webhook_secret"
 * }
 * ```
 *
 * ### How it authenticates
 *
 * Each integration is its own GitHub App. Store the App's `appId` and
 * `privateKey` on the integration, and point the App's webhook at this
 * integration's event URL (below). The `webhookSecret` validates the
 * `x-hub-signature-256` header. The **installation id is not stored** - it
 * arrives in every event payload and is combined with the App key to mint a
 * short-lived token to reply.
 *
 * ### Webhook Configuration
 *
 * Set the GitHub App webhook URL to this integration's event endpoint:
 *
 * ```
 * https://api.chatbotkit.com/v1/integration/github/{githubIntegrationId}/event
 * ```
 *
 * Subscribe to these events: `issue_comment`, `pull_request_review_comment`.
 * Then install the App on the target org(s) and pick the repositories it may
 * access - GitHub enforces that scope, so the bot answers wherever it is
 * installed and @mentioned.
 *
 * **Warning:** The webhook secret is a sensitive credential. Never commit it to
 * version control. If compromised, rotate it in GitHub and update your
 * ChatBotKit integration immediately. Deliveries that arrive without a valid
 * `x-hub-signature-256` are rejected, so an integration with no webhook secret
 * configured will not process events at all.
 *
 * ## Restricting Who Can Summon the Bot
 *
 * Anyone able to comment on a repository where your App is installed can
 * @mention the bot, and on a public repository that is any GitHub account.
 * Because the resulting conversation runs against **your** account and its
 * limits, the `allowFrom` setting restricts who is actually answered. Summons
 * from anyone else are dropped and recorded in the integration's event log.
 *
 * New integrations default to `@collaborators`. The supported entries are:
 *
 * | Entry             | Matches                                              |
 * | ----------------- | ---------------------------------------------------- |
 * | `@collaborators`  | anyone GitHub reports as OWNER, MEMBER or COLLABORATOR |
 * | `@octocat`        | one specific login                                   |
 * | `chatbotkit/*`    | anyone commenting in any repository under an owner   |
 * | `chatbotkit/docs` | anyone commenting in one specific repository         |
 * | `*`               | everyone - only safe on private repositories         |
 *
 * Entries are comma or newline separated and any single match allows the
 * summon. An empty value blocks everyone.
 *
 * ```http
 * POST /api/v1/integration/github/{githubIntegrationId}/update
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "allowFrom": "@collaborators,@octocat"
 * }
 * ```
 *
 * **Note:** Login matching is advisory - GitHub logins can be renamed and a
 * freed login can be claimed by somebody else. `@collaborators` leans on
 * GitHub's own permission model and tracks your team automatically as people
 * join and leave, so prefer it over a hand-maintained list.
 */

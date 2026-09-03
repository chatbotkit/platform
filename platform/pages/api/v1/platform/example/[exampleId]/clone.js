// @ts-check
import prisma from '@/prisma/client'

import {
  importBlueprintResources,
  parseCategoryArrayResources,
  planImportOrder,
} from '@/lib/blueprint.import'
import { UnexpectedStateError, captureException } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { createRecord } from '@/lib/record'
import { conflict, notFound, ok, unprocessableEntity } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getStore } from '@/lib/store.types'

import examplesData from '@/examples'

export const bodySchema = schema.object({})

/**
 * @swagger
 *
 * /platform/example/{exampleId}/clone:
 *   post:
 *     operationId: clonePlatformExample
 *     summary: Clone a platform example
 *     tags:
 *       - Platform
 *     parameters:
 *       - in: path
 *         name: exampleId
 *         required: true
 *         schema:
 *           description: The ID (slug) of the example to clone
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
 *         description: The example was cloned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resources:
 *                   description: A map of resource types to arrays of created resources
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           description: The unique identifier of the resource
 *                           type: string
 *                         name:
 *                           description: The name of the resource
 *                           type: string
 *                         description:
 *                           description: The description of the resource
 *                           type: string
 *                       required:
 *                         - id
 *               required:
 *                 - resources
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {} = body

      const exampleId = requiredUrlParam(req, 'exampleId')

      const example = examplesData.find((example) => example.slug === exampleId)

      if (!example) {
        return notFound()
      }

      if (Array.isArray(example.files)) {
        return unprocessableEntity(
          'Projects cannot be cloned. Please visit the GitHub repository to access the source code.'
        )
      }

      // @note a hub example is a pointer to a published hub page, not a copy of
      // one - it carries no blueprint, no backstory and no model. Without this
      // guard it falls through to the legacy path below, which would happily
      // create a project holding an empty bot (backstory and model both default
      // to ''), so the failure is silent rather than loud. The hub page is what
      // clones it; the wizard hands hub examples to templates/hub for exactly
      // that reason.
      // @todo review if we should implement it
      if (example.hub) {
        return unprocessableEntity(
          `Hub examples cannot be cloned here - they point at a published hub page. Clone it from /hub/${example.hub.type}s/${example.hub.ref} instead.`
        )
      }

      const resourceMap = {}

      // handle blueprint-based examples

      const exampleBlueprint = example.blueprint

      if (exampleBlueprint) {
        // @note materialise through the same engine that clones a blueprint, so
        // an example lands under one definition of "copy": unknown fields are
        // rejected rather than silently dropped, generated credentials (a
        // trigger's `secret`) are minted, references are rewired, and the clone
        // policy leaves every schedule dormant. The hand-rolled loop this
        // replaced wrote each resource with a bare `prisma.create` inside a
        // swallow-all catch, so any node carrying a field that is not a column
        // vanished without a trace - which is how every scheduled trigger in the
        // catalogue went missing from its clone.

        /** @type {Record<string, Record<string, unknown>[]>} */
        const payload = {}

        for (const [token, node] of Object.entries(
          exampleBlueprint.resources
        )) {
          // @note oauth connections are reference-only - they hold third-party
          // tokens and are never copied. The blueprint clone endpoint leaves them
          // out of its buckets for the same reason and the import engine has no
          // category for them, so drop the node and let the clone policy null any
          // reference that pointed at it.
          if (node.type === 'oAuthConnection') {
            continue
          }

          if (!payload[node.type]) {
            payload[node.type] = []
          }

          payload[node.type].push({ id: token, ...node.data })
        }

        const parsed = parseCategoryArrayResources(payload)

        // @note an example with no resources still clones to an empty project;
        // any other parse failure means the catalogue entry is malformed
        if (!parsed.ok && parsed.reason !== 'empty') {
          await captureException(
            new UnexpectedStateError('Example resources are malformed', {
              exampleId,
              reason: parsed.reason,
              issues: parsed.issues,
            })
          )

          return conflict()
        }

        const plan = parsed.ok ? planImportOrder(parsed.nodesById) : null

        let created

        try {
          // @note one atomic transaction: the project, its resources and the
          // remapped design positions. A half-materialised example is worse than
          // none, which is exactly what the per-resource catch used to produce.
          created = await prisma.$transaction(async (tx) => {
            const blueprint = await tx.blueprint.create({
              data: {
                name: example.title,
                description: example.description,

                userId: session.user.id,
              },

              select: {
                id: true,
                name: true,
                description: true,
              },
            })

            let resources = {}
            let idMap = new Map()

            if (parsed.ok && plan) {
              const imported = await importBlueprintResources({
                tx,
                user: session.user,
                targetBlueprint: {
                  id: blueprint.id,
                  userId: session.user.id,
                  alias: null,
                },
                nodesById: parsed.nodesById,
                sortedNodeIds: plan.sortedNodeIds,
                importedNodeIds: plan.importedNodeIds,
                policy: 'clone',
              })

              resources = imported.resources
              idMap = imported.idMap
            }

            // @note remap the design positions from the document's tokens onto
            // the ids the import actually wrote, dropping any token that was not
            // materialised (an excluded oauth node, or a stale entry) so a
            // dangling key never survives into the new canvas config
            await tx.blueprint.update({
              where: {
                id: blueprint.id,
              },

              data: {
                config: {
                  positions: Object.fromEntries(
                    Object.entries(exampleBlueprint.positions || {}).flatMap(
                      ([token, position]) => {
                        const id = idMap.get(token)

                        return id ? [[id, position]] : []
                      }
                    )
                  ),

                  notes: exampleBlueprint.notes,
                },
              },
            })

            return { blueprint, resources }
          })
        } catch (error) {
          // @note the document is ours, so a validation or reference failure is
          // an inconsistency in the catalogue rather than caller error, and the
          // transaction guarantees nothing was committed. Capture it so a broken
          // example is loud instead of quietly cloning half of itself.
          await captureException(error)

          return conflict()
        }

        return ok({
          resources: {
            blueprint: [created.blueprint],

            ...created.resources,
          },
        })
      }

      // handle non-blueprint examples (legacy format)

      // @note legacy examples (widgets and other integrations) are wrapped in
      // a blueprint too so every clone lands in a blueprint named after the
      // example with all created resources assigned to it

      const blueprint = await prisma.blueprint.create({
        data: {
          name: example.title,
          description: example.description,

          userId: session.user.id,
        },

        select: {
          id: true,
          name: true,
          description: true,
        },
      })

      resourceMap.blueprint = [blueprint]

      // create dataset if exists

      if (example.dataset && !('id' in example.dataset)) {
        const dataset = await prisma.dataset.create({
          data: {
            name: example.dataset.name,
            description: example.dataset.description,

            blueprintId: blueprint.id,
            userId: session.user.id,
          },
          select: {
            id: true,
            name: true,
            description: true,
          },
        })

        resourceMap.dataset = [dataset]

        // create records via vector service

        const records = []

        if (example.dataset.records?.length) {
          const store = await getStore()

          for (const record of example.dataset.records) {
            const recordId = await createRecord({
              store: store,
              datasetId: dataset.id,
              text: record.text,
            })

            records.push({ id: recordId })
          }
        }

        if (records.length > 0) {
          resourceMap.record = records
        }
      }

      // create skillset if exists

      let skillsetId

      if (example.skillset && !('id' in example.skillset)) {
        const skillset = await prisma.skillset.create({
          data: {
            name: example.skillset.name,
            description: example.skillset.description,

            blueprintId: blueprint.id,
            userId: session.user.id,
          },
          select: {
            id: true,
            name: true,
            description: true,
          },
        })

        resourceMap.skillset = [skillset]
        skillsetId = skillset.id

        // create abilities

        const abilities = []

        for (const ability of example.skillset.abilities || []) {
          const createdAbility = await prisma.ability.create({
            data: {
              name: ability.name,
              description: ability.description,

              skillsetId: skillset.id,

              instruction: ability.instruction,

              blueprintId: blueprint.id,
              userId: session.user.id,
            },
            select: {
              id: true,
              name: true,
              description: true,
            },
          })

          abilities.push(createdAbility)
        }

        if (abilities.length > 0) {
          resourceMap.ability = abilities
        }
      }

      // create secrets if exist

      if (example.secrets?.length) {
        const secrets = []

        for (const secret of example.secrets) {
          const createdSecret = await prisma.secret.create({
            data: {
              name: secret.name,
              description: secret.description,

              value: secret.value,

              blueprintId: blueprint.id,
              userId: session.user.id,
            },
            select: {
              id: true,
              name: true,
              description: true,
            },
          })

          secrets.push(createdSecret)
        }

        if (secrets.length > 0) {
          resourceMap.secret = secrets
        }
      }

      // create bot

      const bot = await prisma.bot.create({
        data: {
          name: example.title,
          description: example.description,

          backstory: example.backstory,
          model: example.model,

          datasetId: resourceMap.dataset?.[0]?.id || null,
          skillsetId: skillsetId || null,

          blueprintId: blueprint.id,
          userId: session.user.id,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
      })

      resourceMap.bot = [bot]

      // create integration if specified

      if (example.integration && example.integration !== 'widget') {
        const integrationModel = `${example.integration}Integration`

        const integration = await prisma[integrationModel].create({
          data: {
            name: example.title,
            description: example.description,

            botId: bot.id,

            blueprintId: blueprint.id,
            userId: session.user.id,
          },
          select: {
            id: true,
            name: true,
            description: true,
          },
        })

        resourceMap[integrationModel] = [integration]
      } else if (example.theme) {
        // create widget integration

        const widget = await prisma.widgetIntegration.create({
          data: {
            name: example.title,
            description: example.description,

            botId: bot.id,

            intro: example.intro,
            theme:
              typeof example.theme === 'string'
                ? example.theme
                : JSON.stringify(example.theme),

            blueprintId: blueprint.id,
            userId: session.user.id,
          },
          select: {
            id: true,
            name: true,
            description: true,
          },
        })

        resourceMap.widgetIntegration = [widget]
      }

      return ok({ resources: resourceMap })
    })
  )
)

/**
 * @manual Platform Examples
 * @index 22
 *
 * ## Cloning Examples to Your Account
 *
 * Once you've found an example that fits your needs, you can clone it to your
 * account as a starting point for customization. Cloning creates copies of all
 * resources defined in the example, including bots, datasets, integrations, and
 * any dependencies, properly configured and ready to use.
 *
 * To clone an example:
 *
 * ```http
 * POST /api/v1/platform/example/{exampleId}/clone
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{exampleId}` with the ID (slug) of the example you want to clone.
 * For instance, to clone the customer support assistant example:
 *
 * ```http
 * POST /api/v1/platform/example/customer-support-assistant/clone
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * ## What Gets Cloned
 *
 * The cloning process intelligently handles both simple and complex examples:
 *
 * **Blueprint Examples**: Creates a complete agent configuration with all
 * settings, personality traits, and model selections preserved.
 *
 * **Integration Examples**: Sets up the necessary resources for the specific
 * integration type (bot, widget configuration, channel settings) with all
 * dependencies properly linked. These are also wrapped in a blueprint named
 * after the example, with every created resource assigned to it, so every
 * clone lands as a single blueprint.
 *
 * **Complex Examples**: For examples with multiple interconnected resources
 * (datasets, skills, integrations), the system performs topological sorting to
 * ensure dependencies are created in the correct order, then rewires all
 * references to point to your newly created resources.
 *
 * ## Clone Response Structure
 *
 * The response indicates which resources were created during the cloning
 * process:
 *
 * ```javascript
 * {
 *   "resources": {
 *     "blueprint": [
 *       {
 *         "id": "clr9x8f3k000008l8e5j9h2m4",
 *         "name": "Customer Support Assistant",
 *         "description": "Cloned from example"
 *       }
 *     ],
 *     "dataset": [
 *       {
 *         "id": "clr9x8f3k000108l8g7h3k5n1",
 *         "name": "Product Knowledge Base"
 *       }
 *     ]
 *   }
 * }
 * ```
 *
 * The `resources` object contains arrays grouped by resource type. Each created
 * resource includes its ID, name, and description, allowing you to immediately
 * access and further customize the cloned resources.
 *
 * ## Post-Clone Customization
 *
 * After cloning, the newly created resources are completely independent from
 * the original example. You can:
 *
 * - Modify configurations without affecting the template
 * - Add or remove abilities and integrations
 * - Customize conversation flows and responses
 * - Adjust personality traits and behavior
 * - Connect to your own data sources and APIs
 *
 * **Important:** The cloning process may take several seconds for complex
 * examples with many resources and dependencies. The operation has a 60-second
 * timeout limit. If cloning fails, check that all dependencies and prerequisites
 * are met (such as required secret types or subscription plan features).
 *
 * **Note:** Some examples may require specific integrations or abilities that
 * need additional configuration after cloning, such as API keys or OAuth
 * authentication. Review the cloned resource configurations to complete any
 * necessary setup steps.
 */

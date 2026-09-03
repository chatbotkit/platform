// @ts-check
import { getBlueprintAndCloneableResources } from '@/lib/blueprint.resources'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /blueprint/{blueprintId}/resource/list:
 *   get:
 *     operationId: listBlueprintResources
 *     summary: List the resources of a blueprint
 *     tags:
 *       - Blueprint Resources
 *     parameters:
 *       - in: path
 *         name: blueprintId
 *         required: true
 *         schema:
 *           description: The ID of the blueprint to clone
 *           type: string
 *     responses:
 *       200:
 *         description: Blueprint resources were retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the blueprint
 *                   type: string
 *                 resources:
 *                   description: A map of the resources
 *                   type: object
 *               required:
 *                 - id
 *                 - resources
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const blueprintAndResources = await getBlueprintAndCloneableResources(
      requiredUrlParam(req, 'blueprintId')
    )

    if (!blueprintAndResources) {
      return notFound()
    }

    const blueprint = blueprintAndResources.blueprint

    if (blueprint.userId !== session.user.id) {
      return notAuthorized()
    }

    const resources = {
      ...Object.fromEntries(
        Object.entries(blueprintAndResources.resources.basic).map(
          ([category, resources]) => {
            return [
              `${category}`,
              resources.map(({ id, name, description, meta, ...rest }) => {
                return {
                  id,

                  name,
                  description,

                  ...Object.fromEntries(
                    Object.entries(rest).filter(([key]) => {
                      return key.endsWith('Id') || key === 'state'
                    })
                  ),

                  meta,
                }
              }),
            ]
          }
        )
      ),

      ...Object.fromEntries(
        Object.entries(blueprintAndResources.resources.object).map(
          ([category, resources]) => {
            return [
              `${category}`,
              resources.map(({ id, name, description, meta, ...rest }) => {
                return {
                  id,

                  name,
                  description,

                  ...Object.fromEntries(
                    Object.entries(rest).filter(([key]) => {
                      return key.endsWith('Id') || key === 'state'
                    })
                  ),

                  meta,
                }
              }),
            ]
          }
        )
      ),

      ...Object.fromEntries(
        Object.entries(blueprintAndResources.resources.compliance || {}).map(
          ([category, resources]) => {
            return [
              `${category}`,
              resources.map(({ id, name, description, meta, ...rest }) => {
                return {
                  id,

                  name,
                  description,

                  ...Object.fromEntries(
                    Object.entries(rest).filter(([key]) => {
                      return key.endsWith('Id') || key === 'state'
                    })
                  ),

                  meta,
                }
              }),
            ]
          }
        )
      ),

      ...Object.fromEntries(
        Object.entries(blueprintAndResources.resources.oauth).map(
          ([category, resources]) => {
            return [
              `${category}`,
              resources.map(({ id, name, description, meta, ...rest }) => {
                return {
                  id,

                  name,
                  description,

                  ...Object.fromEntries(
                    Object.entries(rest).filter(([key]) => {
                      return key.endsWith('Id') || key === 'state'
                    })
                  ),

                  meta,
                }
              }),
            ]
          }
        )
      ),

      ...Object.fromEntries(
        Object.entries(blueprintAndResources.resources.integration).map(
          ([category, resources]) => {
            return [
              `${category}Integration`,
              resources.map(({ id, name, description, meta, ...rest }) => {
                return {
                  id,

                  name,
                  description,

                  ...Object.fromEntries(
                    Object.entries(rest).filter(([key]) => {
                      return key.endsWith('Id') || key === 'state'
                    })
                  ),

                  meta,
                }
              }),
            ]
          }
        )
      ),
    }

    return ok({
      id: blueprintAndResources.blueprint.id,
      resources: resources,
    })
  })
)

/**
 * @manual Blueprint Resources
 * @description Blueprint resources represent the collection of related components (bots, datasets, skillsets, integrations, etc.) that are organized within a blueprint, providing a comprehensive view of all assets in a specific configuration.
 * @category Blueprints
 * @tags blueprint, resources, organization
 * @index 35
 *
 * Understanding the resources contained within a blueprint is essential for managing complex AI configurations. The resource list endpoint provides a comprehensive inventory of all components associated with a blueprint, making it easy to audit, manage, and understand the full scope of a blueprint's contents.
 *
 * ## Listing Blueprint Resources
 *
 * The resource list operation retrieves a complete manifest of all resources associated with a specific blueprint. This includes both basic resources (bots, datasets, skillsets, abilities, secrets, files, portals) and integration resources (all types of integrations like widget, Slack, Discord, email, etc.).
 *
 * To retrieve all resources in a blueprint, make a GET request with the blueprint ID:
 *
 * ```http
 * GET /api/v1/blueprint/{blueprintId}/resource/list
 * ```
 *
 * The response provides a structured view of all resources organized by type. Each resource includes its essential properties such as ID, name, description, and any relevant relationship IDs (like datasetId, botId, etc.) that show how resources connect to each other.
 *
 * ### Response Structure
 *
 * The response organizes resources into categories for easy navigation:
 * - **Basic Resources**: bot, dataset, skillset, ability, secret, file, portal
 * - **Integration Resources**: widgetIntegration, slackIntegration, discordIntegration, telegramIntegration, whatsappIntegration, messengerIntegration, twilioIntegration, emailIntegration, triggerIntegration, sitemapIntegration, notionIntegration, extractIntegration, supportIntegration, mcpserverIntegration
 *
 * Each resource entry includes:
 * - **id**: Unique identifier for the resource
 * - **name**: Display name of the resource
 * - **description**: Detailed description of the resource's purpose
 * - **Relationship IDs**: References to related resources (e.g., a bot might have datasetId and skillsetId)
 * - **meta**: Additional metadata and custom properties
 *
 * ### Use Cases
 *
 * **Blueprint Auditing**: Review all components to ensure your blueprint contains the expected resources and verify that everything is properly configured.
 *
 * **Pre-Clone Planning**: Before cloning a blueprint, examine its resources to understand what will be duplicated and plan for any necessary post-clone configuration.
 *
 * **Dependency Mapping**: Identify relationships between resources by examining the relationship IDs, helping you understand how components interact within the blueprint.
 *
 * **Resource Management**: Use the resource list as a starting point for bulk operations or selective updates to specific resources within a blueprint.
 *
 * **Documentation**: Generate documentation or diagrams showing the structure and composition of your blueprint configurations.
 *
 * **Important:** The resource list only includes resources that are specifically associated with the blueprint through their blueprintId field. Resources in your account that are not linked to a blueprint will not appear in this list.
 */

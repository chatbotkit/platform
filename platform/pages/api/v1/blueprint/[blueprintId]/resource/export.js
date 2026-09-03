// @ts-check
import {
  JSON_EXPORT_BUCKETS,
  TERRAFORM_EXPORT_BUCKETS,
  exportResourceCategoryMap,
  exportResourceDocument,
} from '@/lib/blueprint.export'
import { getBlueprintAndCloneableResources } from '@/lib/blueprint.resources'
import { blueprintToTerraform } from '@/lib/blueprint.terraform'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok, send } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /blueprint/{blueprintId}/resource/export:
 *   get:
 *     operationId: exportBlueprintResources
 *     summary: Export blueprint resources
 *     description: |
 *       Export a blueprint and all its resources. The default format is JSON.
 *       Set the Accept header to `application/terraform+hcl` to export as
 *       Terraform HCL code.
 *     tags:
 *       - Blueprint Resources
 *     parameters:
 *       - in: path
 *         name: blueprintId
 *         required: true
 *         schema:
 *           description: The ID of the blueprint to export
 *           type: string
 *       - in: header
 *         name: Accept
 *         schema:
 *           description: The desired export format
 *           type: string
 *           enum:
 *             - application/json
 *             - application/terraform+hcl
 *           default: application/json
 *     responses:
 *       200:
 *         description: The blueprint was exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the blueprint
 *                   type: string
 *                 resources:
 *                   description: A map of the resources by category
 *                   type: object
 *               required:
 *                 - id
 *                 - resources
 *           application/terraform+hcl:
 *             schema:
 *               type: string
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

    const accept = req.headers.get('accept') || 'application/json'

    if (accept.includes('application/terraform+hcl')) {
      const document = exportResourceDocument({
        resources: blueprintAndResources.resources,
        sensitivity: 'public',
        buckets: TERRAFORM_EXPORT_BUCKETS,
      })

      const hcl = blueprintToTerraform(document)

      return send(hcl, {
        'Content-Type': 'application/terraform+hcl; charset=utf-8',
        'Content-Disposition': `attachment; filename="${blueprint.alias || blueprint.id}.tf"`,
      })
    }

    // @note default JSON export: category-grouped, sensitive fields stripped

    const resources = exportResourceCategoryMap({
      resources: blueprintAndResources.resources,
      sensitivity: 'public',
      buckets: JSON_EXPORT_BUCKETS,
    })

    return ok(
      makeJsonSafe({
        id: blueprint.id,
        resources,
      })
    )
  })
)

/**
 * @manual Blueprint Resources
 * @index 36
 *
 * ## Exporting Blueprint Resources
 *
 * The export endpoint downloads a complete snapshot of a blueprint and all its
 * associated resources in your choice of format. This is the primary mechanism
 * for backup, version control, cross-environment migration, and
 * infrastructure-as-code workflows.
 *
 * **Security note:** All sensitive credential fields are automatically stripped
 * from exported resources before the response is returned. This includes
 * integration tokens, signing secrets, bot tokens, access tokens, and API
 * secrets. You will need to re-enter these values when restoring or importing
 * the export into another environment.
 *
 * ### JSON Export (Default)
 *
 * By default, the export returns a JSON representation of the blueprint and
 * all its resources organized by category:
 *
 * ```http
 * GET /api/v1/blueprint/{blueprintId}/resource/export
 * ```
 *
 * The response payload contains the blueprint `id` and a `resources` object
 * whose keys are resource category names. Each category contains an array of
 * resource objects:
 *
 * ```json
 * {
 *   "id": "bp_abc123",
 *   "resources": {
 *     "bot": [
 *       { "name": "Support Bot", "description": "Main support agent", "datasetId": "ds_xyz" }
 *     ],
 *     "dataset": [
 *       { "name": "Knowledge Base", "description": "FAQ and documentation" }
 *     ],
 *     "widgetIntegration": [
 *       { "name": "Website Widget", "botId": "bot_abc" }
 *     ]
 *   }
 * }
 * ```
 *
 * Resource categories in the export follow the same grouping as the resource
 * list: basic resources (`bot`, `dataset`, `skillset`, `ability`, `secret`,
 * `file`, `portal`), object resources (`space`), compliance resources
 * (`policy`), and integration resources (all integration types such as
 * `widgetIntegration`, `slackIntegration`, `discordIntegration`, etc.).
 *
 * The JSON export is directly compatible with the import endpoint. You can
 * export a blueprint from one environment and import the `resources` field into
 * another blueprint in a different environment. All internal cross-references
 * (such as a bot's `datasetId`) are preserved and will be re-mapped to new IDs
 * during import.
 *
 * ### Terraform Export
 *
 * To export the blueprint as Terraform HCL code, set the `Accept` header to
 * `application/terraform+hcl`:
 *
 * ```http
 * GET /api/v1/blueprint/{blueprintId}/resource/export
 * Accept: application/terraform+hcl
 * ```
 *
 * The Terraform export generates a complete `.tf` file with provider
 * configuration and all resources defined using the ChatBotKit Terraform
 * provider. Cross-resource references (such as a bot referencing a dataset by
 * ID) are automatically converted into proper Terraform resource references
 * using `chatbotkit_<type>.<name>.id` syntax.
 *
 * This format is ideal for teams practicing infrastructure-as-code, enabling
 * blueprint configurations to be committed to version control, reviewed in pull
 * requests, and applied through standard Terraform pipelines.
 *
 * The response includes a `Content-Disposition` header with a suggested
 * filename based on the blueprint alias or ID (for example,
 * `customer-support-bot.tf`).
 *
 * ### Restore and Migration Workflow
 *
 * A typical backup and restore workflow looks like this:
 *
 * 1. **Export**: `GET /api/v1/blueprint/{sourceBlueprintId}/resource/export`
 * 2. Save the JSON response locally or in your version control system.
 * 3. **Create target**: `POST /api/v1/blueprint/create` to create a new blueprint.
 * 4. **Import**: `POST /api/v1/blueprint/{newBlueprintId}/resource/import` with
 *    the `resources` field from the saved export.
 * 5. Reconfigure any sensitive fields (tokens, signing secrets) on the newly
 *    created integrations.
 *
 * **Note:** The `id` values in the export payload are for reference only.
 * The import endpoint ignores them and generates new platform IDs for all
 * created resources.
 */

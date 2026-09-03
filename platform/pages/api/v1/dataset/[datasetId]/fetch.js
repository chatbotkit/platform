// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /dataset/{datasetId}/fetch:
 *   get:
 *     operationId: fetchDataset
 *     summary: Fetch a dataset
 *     tags:
 *       - Dataset
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           description: The ID of the dataset to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The dataset was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     reranker:
 *                       description: The reranker class for the dataset
 *                       type: string
 *                     recordMaxTokens:
 *                       description: The total number of tokens for each record
 *                       type: number
 *                     searchMinScore:
 *                       description: The minimum score to filter search results by
 *                       type: number
 *                     searchMaxRecords:
 *                       description: The total number of records to return during search
 *                       type: number
 *                     searchMaxTokens:
 *                       description: The total number of tokens to use during search
 *                       type: number
 *                     matchInstruction:
 *                       description: An instruction to include before found records
 *                       type: string
 *                     mismatchInstruction:
 *                       description: An instruction to include if no records where found
 *                       type: string
 *                     separators:
 *                       description: A list of separators to use when tokenizing text
 *                       type: string
 *                     visibility:
 *                       $ref: '#/components/schemas/DatasetVisibility'
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const dataset = await prisma.dataset.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'datasetId'),
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

          reranker: true,

          recordMaxTokens: true,

          searchMinScore: true,
          searchMaxRecords: true,
          searchMaxTokens: true,

          matchInstruction: true,
          mismatchInstruction: true,

          separators: true,

          visibility: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!dataset) {
      return notFound()
    }

    if (dataset.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (dataset).userId)

    return ok(makeJsonSafe(dataset))
  })
)

/**
 * @manual Datasets
 *
 * ## Retrieving a Specific Dataset
 *
 * Fetching detailed information about a specific dataset allows you to access
 * its complete configuration, search parameters, storage settings, and metadata.
 * This is essential for understanding how a dataset is configured, verifying
 * settings before modifications, or displaying dataset information in user
 * interfaces.
 *
 * The fetch operation returns comprehensive details about the dataset, including
 * all configuration options that were set during creation or subsequent updates.
 * This information can be used to replicate dataset configurations, audit
 * settings, or make informed decisions about dataset usage in your applications.
 *
 * To retrieve a specific dataset by its ID, send a GET request:
 *
 * ```http
 * GET /api/v1/dataset/{datasetId}/fetch
 * ```
 *
 * Replace `{datasetId}` with the actual dataset identifier (e.g., `dts_abc123xyz`).
 *
 * ### Response Details
 *
 * The response includes the complete dataset configuration:
 *
 * ```json
 * {
 *   "id": "dts_abc123xyz",
 *   "name": "SupportFAQs",
 *   "description": "Customer support frequently asked questions",
 *   "reranker": "rerank-v4-fast",
 *   "recordMaxTokens": 1000,
 *   "searchMinScore": 0.7,
 *   "searchMaxRecords": 5,
 *   "searchMaxTokens": 2000,
 *   "matchInstruction": "Use the following information to answer the question",
 *   "mismatchInstruction": "No relevant information found",
 *   "visibility": "private",
 *   "blueprintId": "bp_xyz789",
 *   "meta": {},
 *   "createdAt": "2024-01-15T10:30:00.000Z",
 *   "updatedAt": "2024-01-15T10:30:00.000Z"
 * }
 * ```
 *
 * ### Key Fields Explained
 *
 * - **reranker**: Optional reranking model for improved search relevance
 * - **recordMaxTokens**: Maximum token limit per individual record
 * - **searchMinScore**: Minimum similarity score threshold for search results
 * - **searchMaxRecords**: Maximum number of records returned in searches
 * - **searchMaxTokens**: Total token limit across all search results
 * - **matchInstruction**: System instruction when records are found
 * - **mismatchInstruction**: System instruction when no records match
 * - **visibility**: Access control level (private, protected, public)
 *
 * ### Common Use Cases
 *
 * - **Configuration Auditing**: Verify current settings before making updates
 * - **Dataset Cloning**: Retrieve configuration to replicate in new datasets
 * - **UI Display**: Show dataset settings in administrative interfaces
 * - **Integration Setup**: Confirm dataset parameters before connecting to bots
 * - **Debugging**: Diagnose search behavior by reviewing configuration
 *
 * **Authorization Note**: You can only fetch datasets that belong to your
 * account. Attempting to access datasets owned by other users will result in
 * an authorization error.
 */

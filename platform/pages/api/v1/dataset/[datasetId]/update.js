// @ts-check
import prisma from '@/prisma/client'
import { DatasetVisibility } from '@/prisma/types'

import debug from '@/lib/debug'
import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import notUsedSchema from '@/schemas/notUsed'
import rerankerSchema from '@/schemas/reranker'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  store: notUsedSchema,

  reranker: rerankerSchema,

  recordMaxTokens: schema.number().min(1).allow(null),

  searchMinScore: schema.number().min(0).allow(null),
  searchMaxRecords: schema.number().min(1).allow(null),
  searchMaxTokens: schema.number().min(1).allow(null),

  matchInstruction: schema.string().allow(null, ''),
  mismatchInstruction: schema.string().allow(null, ''),

  separators: schema.string().allow(null, ''),

  visibility: schema.string().valid(...Object.keys(DatasetVisibility)),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /dataset/{datasetId}/update:
 *   post:
 *     operationId: updateDataset
 *     summary: Update dataset
 *     tags:
 *       - Dataset
 *     parameters:
 *       - in: path
 *         name: datasetId
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
 *                   reranker:
 *                     description: The reranker class for the dataset
 *                     type: string
 *                   recordMaxTokens:
 *                     description: The total number of tokens to for each record
 *                     type: number
 *                   searchMinScore:
 *                     description: The minimum score to filter search results by
 *                     type: number
 *                   searchMaxRecords:
 *                     description: The total number of records to return during search
 *                     type: number
 *                   searchMaxTokens:
 *                     description: The total number of tokens to use during search
 *                     type: number
 *                   matchInstruction:
 *                     description: An instruction to include before found records
 *                     type: string
 *                   mismatchInstruction:
 *                     description: An instruction to include if no records where found
 *                     type: string
 *                   separators:
 *                     description: A list of separators to use when tokenizing text
 *                     type: string
 *                   visibility:
 *                     $ref: '#/components/schemas/DatasetVisibility'
 *     responses:
 *       200:
 *         description: The dataset was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated dataset
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

        reranker,

        recordMaxTokens,

        searchMinScore,
        searchMaxRecords,
        searchMaxTokens,

        matchInstruction,
        mismatchInstruction,

        separators,

        visibility,

        meta,
      } = body

      debug(`updating dataset`, {
        name,
        description,

        visibility,

        meta,
      })

      const dataset = await prisma.dataset.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'datasetId')
      )

      if (!dataset) {
        return notFound()
      }

      if (dataset.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.dataset.update({
        where: {
          id: dataset.id,
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

          reranker,

          recordMaxTokens,

          searchMinScore,
          searchMaxRecords,
          searchMaxTokens,

          matchInstruction,
          mismatchInstruction,

          separators,

          visibility,

          // meta and others

          meta: getMeta(meta, dataset.meta),
        },
      })

      return ok({ id: dataset.id })
    })
  )
)

/**
 * @manual Datasets
 *
 * ## Updating a Dataset
 *
 * Modifying an existing dataset allows you to refine its configuration, adjust
 * search parameters, update instructions, and change metadata without affecting
 * the underlying data records. This flexibility enables you to optimize dataset
 * performance and behavior as your application requirements evolve.
 *
 * Dataset updates are ideal for tuning search relevance, adjusting token limits
 * based on performance observations, refining match/mismatch instructions, or
 * updating organizational metadata. The update operation preserves all existing
 * records while applying new configuration settings that will affect future
 * search and retrieval operations.
 *
 * To update a dataset, send a POST request with the fields you want to modify:
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Updated FAQ Database",
 *   "description": "Comprehensive customer support FAQ with product information",
 *   "recordMaxTokens": 1500,
 *   "searchMaxRecords": 8,
 *   "searchMinScore": 0.75,
 *   "matchInstruction": "Answer using only the information provided below",
 *   "mismatchInstruction": "No relevant FAQ found for this question",
 *   "visibility": "protected"
 * }
 * ```
 *
 * Replace `{datasetId}` with your dataset's identifier (e.g., `dts_abc123xyz`).
 * You only need to include the fields you want to update-unchanged fields will
 * retain their current values.
 *
 * ### Updatable Fields
 *
 * The following properties can be modified after dataset creation:
 *
 * - **name**: Display name for the dataset
 * - **description**: Detailed description of contents and purpose
 * - **recordMaxTokens**: Maximum tokens per record chunk
 * - **searchMinScore**: Minimum similarity threshold for search results
 * - **searchMaxRecords**: Maximum number of records returned per search
 * - **searchMaxTokens**: Total token limit across all search results
 * - **matchInstruction**: Instructions when records are found
 * - **mismatchInstruction**: Instructions when no matching records exist
 * - **visibility**: Access control (private, protected, public)
 * - **reranker**: Reranking model for improving search relevance
 * - **separators**: Custom text separators for record chunking
 * - **blueprintId**: Associated blueprint for organization
 * - **meta**: Custom metadata for flexible categorization
 *
 * ### Response
 *
 * Upon successful update, the API returns the dataset ID:
 *
 * ```json
 * {
 *   "id": "dts_abc123xyz"
 * }
 * ```
 *
 * ### Common Update Scenarios
 *
 * **Tuning Search Relevance:**
 * Adjust `searchMinScore` and `searchMaxRecords` based on observed result
 * quality. Higher scores increase precision but may reduce recall.
 *
 * **Optimizing Token Usage:**
 * Modify `recordMaxTokens` and `searchMaxTokens` to balance context richness
 * with API costs and response time.
 *
 * **Refining Instructions:**
 * Update `matchInstruction` and `mismatchInstruction` to improve how AI
 * models utilize or handle the absence of dataset information.
 *
 * **Changing Visibility:**
 * Adjust access control as your dataset's sensitivity or sharing requirements
 * change over time.
 *
 * **Best Practices:**
 *
 * - Make incremental changes and test the impact before further adjustments
 * - Update instructions to be specific about how information should be used
 * - Monitor search performance after configuration changes
 * - Keep descriptions current as dataset content evolves
 * - Use metadata updates to maintain organizational clarity
 */

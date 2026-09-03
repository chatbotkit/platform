// @ts-check
import prisma from '@/prisma/client'
import { DatasetVisibility } from '@/prisma/types'

import debug from '@/lib/debug'
import schema, { withSchema } from '@/lib/joi.handler'
import { withLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getStore } from '@/lib/store.types'

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

  // @note datasets no longer choose a store - everything is backed by the one
  // vector store. Accepted and discarded so existing clients keep working.
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
 * /dataset/create:
 *   post:
 *     operationId: createDataset
 *     summary: Create dataset
 *     tags:
 *       - Dataset
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
 *                     description: The total number of tokens for each record
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
 *         description: The dataset was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created dataset
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withLimits(
      ['database/dataset'],
      withSchema(bodySchema, async function (_req, session, body) {
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

        debug(`creating dataset`, {
          name,
          description,

          reranker,

          matchInstruction,
          mismatchInstruction,

          searchMinScore,
          searchMaxRecords,
          searchMaxTokens,

          separators,

          visibility,

          meta,
        })

        const { id } = await prisma.dataset.create({
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

            meta,
          },

          select: {
            id: true,
          },
        })

        const storeClass = await getStore()

        await storeClass.createDataset({ datasetId: id })

        return ok({ id })
      })
    )
  )
)

/**
 * @manual Datasets
 * @description Datasets are structured collections of data that serve as knowledge bases for various applications, enabling efficient storage, retrieval, and management of information.
 * @category Resources/Datasets
 * @tags dataset
 * @index 1
 *
 * Datasets are essential components for building knowledge-driven AI applications,
 * allowing you to organize, store, and efficiently retrieve information that
 * powers intelligent conversations and automated workflows. A dataset acts as a
 * centralized repository for structured or unstructured data that can be queried,
 * searched, and referenced by bots, agents, and other AI-powered systems.
 *
 * ## Creating Datasets
 *
 * Creating a dataset is the foundational step in building a knowledge base for
 * your AI applications. When you create a dataset, you establish a container
 * that can hold records, files, and structured information that will be
 * searchable and retrievable by your conversational agents and applications.
 *
 * The dataset creation process allows you to configure various storage and
 * retrieval parameters that determine how your data is indexed, searched, and
 * presented to AI models. Careful consideration of these settings during creation
 * ensures optimal performance and relevance in your application's responses.
 *
 * To create a new dataset, send a POST request with the basic information and
 * optional configuration parameters:
 *
 * ```http
 * POST /api/v1/dataset/create
 * Content-Type: application/json
 *
 * {
 *   "name": "SupportFAQs",
 *   "description": "Customer support frequently asked questions and answers",
 *   "recordMaxTokens": 1000,
 *   "searchMaxRecords": 5,
 *   "visibility": "private"
 * }
 * ```
 *
 * ### Key Configuration Options
 *
 * - **name**: A descriptive identifier for your dataset
 * - **description**: Detailed explanation of the dataset's purpose and content
 * - **recordMaxTokens**: Maximum tokens per record for optimal chunking
 * - **searchMaxRecords**: Maximum number of records returned in search results
 * - **searchMaxTokens**: Maximum total tokens in search results
 * - **visibility**: Access control (private, protected, or public)
 * - **matchInstruction**: Instructions for when records match a query
 * - **mismatchInstruction**: Instructions for when no records match a query
 *
 * The API returns the newly created dataset's ID upon successful creation:
 *
 * ```json
 * {
 *   "id": "dts_abc123xyz"
 * }
 * ```
 *
 * **Important Considerations:**
 *
 * - **Token Limits**: Setting appropriate token limits helps balance context
 *   richness with response time and cost
 * - **Search Configuration**: Fine-tune search parameters based on your use
 *   case-more records provide broader context but may introduce noise
 *
 * **Best Practices:**
 *
 * - Use descriptive names that clearly indicate the dataset's content
 * - Set `recordMaxTokens` based on your content granularity (500-2000 tokens
 *   is typical)
 * - Consider visibility settings carefully, especially for sensitive data
 * - Link datasets to blueprints for organized project management
 */

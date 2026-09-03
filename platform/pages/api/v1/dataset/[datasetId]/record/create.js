// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { createRecord } from '@/lib/record'
import { notAuthorized, notFound, ok, respondFromError } from '@/lib/response'
import { getStore } from '@/lib/store.types'

import metaSchema from '@/schemas/meta'
import recordTextSchema from '@/schemas/recordText'
import sourceSchema from '@/schemas/source'

export const bodySchema = schema.object({
  text: recordTextSchema.required(),

  source: sourceSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /dataset/{datasetId}/record/create:
 *   post:
 *     operationId: createDatasetRecord
 *     summary: Create record
 *     tags:
 *       - Dataset Record
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
 *             type: object
 *             properties:
 *               text:
 *                 description: The text of the record
 *                 type: string
 *               source:
 *                 description: The source of the record
 *                 type: string
 *               meta:
 *                 $ref: '#/components/schemas/Meta'
 *             required:
 *               - text
 *     responses:
 *       200:
 *         description: The record was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created record
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['rate/records', 'database/records'],
    withSchema(bodySchema, async function (req, session, body) {
      const { text, source, meta } = body

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

      debug(`creating record`, { text })

      try {
        const store = await getStore()

        const id = await createRecord({
          datasetId: dataset.id,
          store,
          text,
          source,
          meta,
        })

        return ok({ id })
      } catch (e) {
        await captureError(e)

        return respondFromError(e)
      }
    })
  )
)

/**
 * @manual Dataset Records
 * @description Dataset records are individual entries within a dataset that contain specific pieces of information used to provide context and knowledge to the agent.
 * @category Resources/Datasets
 * @tags dataset, record
 * @index 1
 *
 * Dataset records are the fundamental building blocks of your knowledge base,
 * representing individual pieces of information that agents can retrieve and
 * use to provide accurate, contextual responses. Each record contains text
 * content that can be searched, retrieved, and referenced during conversations,
 * making them essential for building intelligent applications that leverage
 * stored knowledge.
 *
 * Records support various types of content including documentation, FAQs,
 * product information, support articles, or any structured text data. The
 * system automatically processes and indexes each record, enabling efficient
 * semantic search and retrieval when agents need relevant information to
 * answer user queries.
 *
 * ## Creating Dataset Records
 *
 * Creating a dataset is the first step in organizing information, but
 * populating it with records is what makes it truly useful. Each record you
 * create becomes immediately available for retrieval by agents and
 * applications connected to the dataset.
 *
 * To create a record, you need to provide the text content and optionally
 * specify a source reference and metadata. The `text` parameter contains the
 * actual content that will be indexed and retrieved, while `source` helps you
 * track where the information came from (such as a URL, document name, or
 * section identifier). The `meta` field allows you to attach custom metadata
 * for organizational or filtering purposes.
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/record/create
 * Content-Type: application/json
 *
 * {
 *   "text": "Our premium support plan includes 24/7 phone support, dedicated account manager, and guaranteed 2-hour response time.",
 *   "source": "support-documentation/plans.md",
 *   "meta": {
 *     "category": "support-plans",
 *     "lastUpdated": "2024-01-15"
 *   }
 * }
 * ```
 *
 * The API returns the unique record ID, which you can use for subsequent
 * operations such as updating or deleting the record. Records are immediately
 * indexed and available for search after creation.
 *
 * **Important:** Record content is stored in the platform's vector store.
 * Records are automatically truncated to fit within the embedding model's
 * token limit (approximately 8,000 tokens). When records exceed this limit, only the first portion of
 * the content is indexed and available for search-the rest is silently
 * discarded. To ensure all content is indexed and searchable, split large
 * documents into multiple smaller records before creation.
 */

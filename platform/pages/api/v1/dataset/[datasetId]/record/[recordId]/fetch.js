// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { getStore } from '@/lib/store.types'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /dataset/{datasetId}/record/{recordId}/fetch:
 *   get:
 *     operationId: fetchDatasetRecord
 *     summary: Fetch a record from a dataset
 *     tags:
 *       - Dataset Record
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           description: The ID of the dataset
 *           type: string
 *       - in: path
 *         name: recordId
 *         required: true
 *         schema:
 *           description: The ID of the record to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The dataset was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceMetaProps'
 *                 - type: object
 *                   properties:
 *                     text:
 *                       description: The text of the dataset record
 *                       type: string
 *                     source:
 *                       description: The source of the dataset record
 *                       type: string
 *                   required:
 *                     - text
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const datasetId = requiredUrlParam(req, 'datasetId')
    const recordId = requiredUrlParam(req, 'recordId')

    const dataset = await prisma.dataset.findUniqueByIdentifier(
      session.user,
      datasetId
    )

    if (!dataset) {
      return notFound()
    }

    if (dataset.userId !== session.user.id) {
      return notAuthorized()
    }

    const store = await getStore()

    let record

    try {
      record = await store.accessRecord({ datasetId: dataset.id, recordId })
    } catch {
      return notFound()
    }

    return ok(
      makeJsonSafe({
        id: record.id,
        text: record.text,
        source: record.source,
        meta: record.meta,
      })
    )
  })
)

/**
 * @manual Dataset Records
 *
 * ## Fetching a Specific Dataset Record
 *
 * Retrieving detailed information about an individual record allows you to
 * access its complete content, source information, metadata, and indexing
 * details. This operation is essential for verifying record content, debugging
 * search behavior, auditing data accuracy, or displaying record information in
 * administrative interfaces.
 *
 * When you fetch a record, you receive the full record object including the
 * original text content, any source attribution, custom metadata fields, and
 * system-generated information like creation and update timestamps. This
 * comprehensive view helps you understand exactly what information is stored
 * and how it's being used in search operations.
 *
 * To retrieve a specific record by its ID, send a GET request:
 *
 * ```http
 * GET /api/v1/dataset/{datasetId}/record/{recordId}/fetch
 * ```
 *
 * Replace `{datasetId}` with your dataset identifier (e.g., `dts_abc123xyz`)
 * and `{recordId}` with the specific record identifier (e.g., `rec_def456ghi`).
 *
 * ### Response Structure
 *
 * The response includes the complete record data:
 *
 * ```json
 * {
 *   "id": "rec_def456ghi",
 *   "text": "Our standard shipping takes 5-7 business days and costs $9.99. Express shipping is available for $24.99 with 2-3 day delivery.",
 *   "source": "shipping-policy.pdf, page 3",
 *   "meta": {
 *     "category": "shipping",
 *     "lastReviewed": "2024-01-15",
 *     "verified": true
 *   },
 *   "createdAt": "2024-01-10T14:30:00.000Z",
 *   "updatedAt": "2024-01-15T10:45:00.000Z"
 * }
 * ```
 *
 * ### Field Explanations
 *
 * - **id**: Unique identifier for this record
 * - **text**: The actual content that will be searched and retrieved
 * - **source**: Optional attribution indicating where this information came from
 * - **meta**: Custom metadata fields for organization and filtering
 * - **createdAt**: Timestamp when the record was initially created
 * - **updatedAt**: Timestamp of the most recent modification
 *
 * ### Common Use Cases
 *
 * **Content Verification**: Review the actual text content to ensure accuracy
 * and completeness of information stored in your knowledge base.
 *
 * **Search Debugging**: When search results seem incorrect, fetch the actual
 * records being returned to understand what information the AI is working with.
 *
 * **Data Auditing**: Verify source attribution and metadata to ensure proper
 * documentation of information provenance.
 *
 * **UI Display**: Show detailed record information in administrative dashboards
 * or content management interfaces.
 *
 * **Quality Assurance**: Review records systematically to maintain high-quality
 * knowledge base content.
 *
 * ### Authorization
 *
 * You can only fetch records from datasets that belong to your account.
 * Attempting to access records from other users' datasets will result in an
 * authorization error.
 *
 * ### Performance Note
 *
 * Fetching individual records is a lightweight operation suitable for frequent
 * access. For bulk operations or comprehensive dataset reviews, consider using
 * the list endpoint with appropriate filters instead.
 */

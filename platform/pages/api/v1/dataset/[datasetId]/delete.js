// @ts-check
import prisma from '@/prisma/client'

import { deleteDataset } from '@/lib/dataset.delete'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /dataset/{datasetId}/delete:
 *   post:
 *     operationId: deleteDataset
 *     summary: Delete a dataset
 *     tags:
 *       - Dataset
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           description: The ID of the dataset to delete
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
 *         description: The dataset was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted dataset
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const dataset = await prisma.dataset.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'datasetId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!dataset) {
      return notFound()
    }

    if (dataset.userId !== session.user.id) {
      return notAuthorized()
    }

    await deleteDataset(dataset)

    return ok({ id: dataset.id })
  })
)

/**
 * @manual Datasets
 * @index 40
 *
 * ## Deleting a Dataset
 *
 * Deleting a dataset permanently removes it from your account along with all
 * its records and associated data. This operation is irreversible and cannot
 * be undone, so it should be used carefully, especially for datasets that
 * contain important information or are actively being used by bots or other
 * applications.
 *
 * When you delete a dataset, the entire dataset entity is removed, including
 * its name, description, store configuration, and all records it contains. The
 * operation automatically handles cleanup of related resources, including vector
 * embeddings and indexed data stored in the underlying data store.
 *
 * Before deleting a dataset, consider whether you need to:
 *
 * - **Export your data**: If you might need the data later, export records first
 * - **Update bot configurations**: Remove or update any bots that reference this dataset
 * - **Check dependencies**: Verify that no active applications depend on this dataset
 *
 * To delete a dataset, send a POST request with the dataset ID:
 *
 * ```http
 * POST /api/v1/dataset/{datasetId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The request returns the ID of the deleted dataset upon successful completion:
 *
 * ```json
 * {
 *   "id": "dts_abc123xyz"
 * }
 * ```
 *
 * **Important Considerations:**
 *
 * - **Permanent deletion**: Deleted datasets cannot be recovered
 * - **Record cleanup**: All records within the dataset are also deleted
 * - **Store cleanup**: Vector embeddings and indexed data are removed from the store
 * - **Authorization**: You can only delete datasets that belong to your account
 *
 * If you need to temporarily disable a dataset without deleting it, consider
 * removing it from bot configurations or exporting its data for safekeeping
 * before deletion.
 */

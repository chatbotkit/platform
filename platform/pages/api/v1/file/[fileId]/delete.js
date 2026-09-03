// @ts-check
import prisma from '@/prisma/client'

import { deleteFile } from '@/lib/file.delete'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /file/{fileId}/delete:
 *   post:
 *     operationId: deleteFile
 *     summary: Delete a file
 *     tags:
 *       - File
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           description: The ID of the file to delete
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
 *         description: The file was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted file
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const file = await prisma.file.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'fileId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!file) {
      return notFound()
    }

    if (file.userId !== session.user.id) {
      return notAuthorized()
    }

    await deleteFile(file)

    return ok({ id: file.id })
  })
)

/**
 * @manual Files
 *
 * ## Deleting Files
 *
 * Deleting files permanently removes both the file metadata and the actual file
 * content from storage. This operation is irreversible and should be used with
 * caution, particularly for files that may be referenced by other resources in
 * your application.
 *
 * To delete a file, make a POST request to the delete endpoint:
 *
 * ```http
 * POST /api/v1/file/{fileId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{fileId}` with the ID of the file you want to delete. Even though
 * this endpoint doesn't require any body parameters, you must still send a POST
 * request with an empty JSON object and the appropriate `Content-Type` header.
 *
 * When you delete a file, the following actions occur:
 *
 * 1. **Storage Cleanup**: The actual file content is removed from the storage
 *    service, freeing up storage space in your account
 * 2. **Metadata Removal**: The file record and all associated metadata are
 *    deleted from the database
 * 3. **Reference Breaking**: Any references to this file from other resources
 *    (such as dataset attachments) become invalid
 *
 * The delete operation includes comprehensive security checks to ensure you
 * have permission to delete the file. Only files that belong to your user
 * account can be deleted through this endpoint, preventing accidental or
 * malicious deletion of other users' files.
 *
 * **Important Considerations:**
 *
 * - **Dataset Attachments**: If the file is attached to one or more datasets,
 *   deleting the file will not automatically remove dataset records created
 *   from this file. You should detach the file from datasets first using the
 *   dataset file detachment endpoint if you want to remove associated records.
 *
 * - **Blueprint Dependencies**: If the file is associated with a blueprint,
 *   ensure that removing it won't break any blueprint functionality or
 *   dependent resources.
 *
 * - **No Undo**: File deletion is permanent and cannot be reversed. Make sure
 *   you have backups of important files before deletion, or verify that the
 *   file is no longer needed.
 *
 * **Example Response:**
 *
 * ```json
 * {
 *   "id": "file_abc123"
 * }
 * ```
 *
 * The response confirms successful deletion by returning the ID of the deleted
 * file. If the file doesn't exist or you don't have permission to delete it,
 * the API will return an appropriate error response.
 *
 * **Best Practice**: Before deleting a file, consider using the fetch endpoint
 * to retrieve and verify its details, ensuring you're deleting the correct
 * file and understanding any potential impacts on your application.
 */

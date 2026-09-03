// @ts-check
import prisma from '@/prisma/client'

import { encode } from '@/lib/b64'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { catchAllParam, requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import {
  deleteStorageDirectory,
  deleteStorageFile,
  storageDirectoryExists,
  storageFileExists,
} from '@/lib/space.storage'

export const bodySchema = schema.object({
  recursive: schema.boolean(),
})

/**
 * @swagger
 *
 * /space/{spaceId}/storage/delete/{path}:
 *   post:
 *     operationId: deleteSpaceStoragePath
 *     summary: Delete a file or directory from space storage
 *     description: |
 *       Delete a file or directory from space storage. The path is specified
 *       in the URL after /delete/. If recursive is true and the path is a
 *       directory, all files within it will be deleted.
 *     tags:
 *       - Space Storage
 *     parameters:
 *       - in: path
 *         name: spaceId
 *         required: true
 *         schema:
 *           description: The ID of the space
 *           type: string
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           description: The file or directory path
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recursive:
 *                 description: Whether to delete directory contents recursively
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: The file or directory was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 path:
 *                   description: The deleted file or directory path
 *                   type: string
 *               required:
 *                 - path
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const spaceId = requiredUrlParam(req, 'spaceId')
      const path = catchAllParam(req, 'path').join('/') || null

      if (!path) {
        return notFound()
      }

      const { recursive } = body

      const pathId = encode(path, true)

      const space = await prisma.space.findUniqueByIdentifier(
        session.user,
        spaceId,
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      if (!space) {
        return notFound()
      }

      if (space.userId !== session.user.id) {
        return notAuthorized()
      }

      if (recursive) {
        if (!(await storageDirectoryExists({ spaceId: space.id, pathId }))) {
          return notFound()
        }

        await deleteStorageDirectory({ spaceId: space.id, pathId })
      } else {
        if (!(await storageFileExists({ spaceId: space.id, pathId }))) {
          return notFound()
        }

        await deleteStorageFile({ spaceId: space.id, pathId })
      }

      return ok({
        path: path,
      })
    })
  )
)

/**
 * @manual Space Storage
 * @index 40
 *
 * ## Deleting Files and Directories
 *
 * Space storage supports deleting both individual files and entire directories.
 * The delete operation is permanent and cannot be undone, so use it carefully.
 * The file or directory path is specified directly in the URL after the
 * `/delete/` segment.
 *
 * ### Deleting a Single File
 *
 * To delete a specific file, send a POST request with the file path in the
 * URL:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/storage/delete/documents/report.pdf
 * ```
 *
 * If the file does not exist, the API will return a 404 error. The response
 * includes the `path` of the deleted file for confirmation.
 *
 * ### Deleting a Directory Recursively
 *
 * To delete a directory and all of its contents, include the `recursive`
 * flag in the request body:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/storage/delete/documents/old-reports
 * Content-Type: application/json
 *
 * {
 *   "recursive": true
 * }
 * ```
 *
 * When `recursive` is set to `true`, the system removes every file and
 * subdirectory under the specified path. When `recursive` is `false` or
 * omitted, the operation targets a single file and will fail if the path
 * points to a directory.
 *
 * ### Important Considerations
 *
 * - **Permanent deletion:** Deleted files cannot be recovered. Consider
 *   implementing confirmation prompts in your application before calling
 *   this endpoint.
 *
 * - **Directory existence:** When using recursive mode, the directory must
 *   exist. The API verifies the directory is present before attempting
 *   deletion.
 *
 * - **Partial paths:** Ensure the path is correct and complete. Deleting
 *   a parent directory recursively removes all nested content.
 */

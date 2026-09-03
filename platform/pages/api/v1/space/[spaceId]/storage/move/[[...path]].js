// @ts-check
import prisma from '@/prisma/client'

import { encode } from '@/lib/b64'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { catchAllParam, requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { moveStorageFile, storageFileExists } from '@/lib/space.storage'

export const bodySchema = schema.object({
  destinationPath: schema.string().required(),
})

/**
 * @swagger
 *
 * /space/{spaceId}/storage/move/{path}:
 *   post:
 *     operationId: moveSpaceStoragePath
 *     summary: Move (rename) a file in space storage
 *     description: |
 *       Move a file from one location to another within space storage, or
 *       rename a file by moving it to a new path. The source file path is
 *       specified in the URL after /move/. The destinationPath in the request
 *       body is the target location for the file.
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
 *           description: The source file path
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destinationPath:
 *                 description: The destination file path
 *                 type: string
 *             required:
 *               - destinationPath
 *     responses:
 *       200:
 *         description: The file was moved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 path:
 *                   description: The destination file path
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

      const { destinationPath } = body

      const pathId = encode(path, true)
      const destinationPathId = encode(destinationPath, true)

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

      // @todo support moving directories

      if (!(await storageFileExists({ spaceId: space.id, pathId }))) {
        return notFound()
      }

      await moveStorageFile({
        spaceId: space.id,
        pathId: pathId,
        destinationPathId: destinationPathId,
      })

      return ok({
        path: destinationPath,
      })
    })
  )
)

/**
 * @manual Space Storage
 * @index 51
 *
 * ## Moving and Renaming Files
 *
 * The move operation relocates a file from one path to another within the
 * same space storage. This effectively renames or reorganizes the file. The
 * original file is removed and a new file is created at the destination path.
 *
 * ### Basic Move
 *
 * To move a file, send a POST request with the source path in the URL and
 * the destination path in the request body:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/storage/move/documents/draft.md
 * Content-Type: application/json
 *
 * {
 *   "destinationPath": "documents/final.md"
 * }
 * ```
 *
 * The response confirms the operation by returning the destination `path`.
 *
 * ### Renaming Files
 *
 * Renaming is just a move within the same directory:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/storage/move/photos/IMG_001.jpg
 * Content-Type: application/json
 *
 * {
 *   "destinationPath": "photos/vacation-sunset.jpg"
 * }
 * ```
 *
 * ### Moving to a Different Directory
 *
 * You can also move files between directories:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/storage/move/inbox/report.pdf
 * Content-Type: application/json
 *
 * {
 *   "destinationPath": "archive/2026/report.pdf"
 * }
 * ```
 *
 * ### Important Considerations
 *
 * - **Source must exist:** The source file must exist. The API returns a
 *   404 error if the source path is not found.
 *
 * - **Overwrites allowed:** If a file already exists at the destination
 *   path, it will be overwritten without warning.
 *
 * - **Files only:** Directory moves are not currently supported. To move
 *   a directory, move each file individually.
 *
 * - **Same space:** Both source and destination must be within the same
 *   space's storage. Cross-space moves are not supported.
 */

// @ts-check
import prisma from '@/prisma/client'

import { encode } from '@/lib/b64'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { catchAllParam, requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { copyStorageFile, storageFileExists } from '@/lib/space.storage'

export const bodySchema = schema.object({
  destinationPath: schema.string().required(),
})

/**
 * @swagger
 *
 * /space/{spaceId}/storage/copy/{path}:
 *   post:
 *     operationId: copySpaceStoragePath
 *     summary: Copy a file in space storage
 *     description: |
 *       Copy a file from one location to another within space storage. The
 *       source file path is specified in the URL after /copy/. The
 *       destinationPath in the request body specifies where to copy the file.
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
 *         description: The file was copied successfully
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

      // @todo support copying directories

      if (!(await storageFileExists({ spaceId: space.id, pathId }))) {
        return notFound()
      }

      await copyStorageFile({
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
 * @index 50
 *
 * ## Copying Files
 *
 * The copy operation duplicates a file from one location to another within
 * the same space storage. The original file remains unchanged, and a new
 * copy is created at the destination path. This is useful for creating
 * backups, duplicating templates, or organizing files without losing the
 * original.
 *
 * ### Basic Copy
 *
 * To copy a file, send a POST request with the source path in the URL and
 * the destination path in the request body:
 *
 * ```http
 * POST /api/v1/space/{spaceId}/storage/copy/documents/template.md
 * Content-Type: application/json
 *
 * {
 *   "destinationPath": "documents/draft-2026-04.md"
 * }
 * ```
 *
 * The response confirms the operation by returning the destination `path`.
 *
 * ### Important Considerations
 *
 * - **Source must exist:** The source file must exist. The API returns a
 *   404 error if the source path is not found.
 *
 * - **Overwrites allowed:** If a file already exists at the destination
 *   path, it will be overwritten without warning.
 *
 * - **Files only:** Directory copying is not currently supported. To
 *   duplicate a directory, copy each file individually.
 *
 * - **Same space:** Both source and destination must be within the same
 *   space's storage. Cross-space copies are not supported.
 */

// @ts-check
import prisma from '@/prisma/client'

import { encode } from '@/lib/b64'
import { withGet } from '@/lib/method'
import { catchAllParam, queryParam, requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { listStorage, storageDirectoryExists } from '@/lib/space.storage'

/**
 * @swagger
 *
 * /space/{spaceId}/storage/list/{path}:
 *   get:
 *     operationId: listSpaceStoragePath
 *     summary: List files and directories in space storage
 *     description: |
 *       List files and directories in the space's storage. Supports both flat
 *       and recursive listing. The path is specified in the URL after /list/.
 *       Omit the path to list the root directory.
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
 *         required: false
 *         schema:
 *           description: The directory path (defaults to root)
 *           type: string
 *       - in: query
 *         name: recursive
 *         schema:
 *           description: Whether to list files recursively
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: The list of files was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         description: The ID of the file or directory
 *                         type: string
 *                       path:
 *                         description: The relative path of the file or directory
 *                         type: string
 *                       size:
 *                         description: The size of the file in bytes (0 for directories)
 *                         type: number
 *                       updatedAt:
 *                         description: The timestamp (ms) when the file was last modified
 *                         type: number
 *                       isDirectory:
 *                         description: Whether this is a directory
 *                         type: boolean
 *                 nextToken:
 *                   description: Token to use for next page of results
 *                   type: string
 *               required:
 *                 - items
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const spaceId = requiredUrlParam(req, 'spaceId')
    const path = catchAllParam(req, 'path').join('/') || '.'
    const pathId = encode(path, true)

    const space = await prisma.space.findUniqueByIdentifier(
      session.user,
      spaceId,
      {
        select: {
          // identifiers

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

    const recursive = queryParam(req, 'recursive') === 'true'

    if (
      !(await storageDirectoryExists({
        spaceId: space.id,
        pathId: pathId,
      }))
    ) {
      return notFound()
    }

    const result = await listStorage({
      spaceId: space.id,
      pathId: pathId,
      recursive: recursive,
    })

    const items = result.items

    return ok({
      items,
    })
  })
)

/**
 * @manual Space Storage
 * @index 20
 *
 * ## Listing Files in Space Storage
 *
 * To browse and organize files in your space's storage, you can list all files
 * and directories within a specific path. This operation supports both flat
 * (immediate children only) and recursive (all descendants) listing modes,
 * making it easy to navigate complex directory structures.
 *
 * The listing operation returns detailed information about each file and
 * directory, including file sizes, timestamps, and directory indicators. This
 * makes it possible to build file browsers, backup systems, or content
 * management interfaces.
 *
 * ### Basic Listing
 *
 * To list files in the root directory, send a GET request:
 *
 * ```http
 * GET /api/v1/space/{spaceId}/storage/list
 * ```
 *
 * To list files in a subdirectory, include the path in the URL:
 *
 * ```http
 * GET /api/v1/space/{spaceId}/storage/list/documents/reports
 * ```
 *
 * ### Recursive Listing
 *
 * To list all files recursively within a directory and its subdirectories,
 * add the recursive query parameter:
 *
 * ```http
 * GET /api/v1/space/{spaceId}/storage/list?recursive=true
 * ```
 *
 * Or for a specific subdirectory:
 *
 * ```http
 * GET /api/v1/space/{spaceId}/storage/list/documents?recursive=true
 * ```
 *
 * The response includes an array of items, where each item contains the
 * `path` (human-readable path), `size` in bytes, `updatedAt` timestamp,
 * and an `isDirectory` flag.
 *
 * **Note:** Directory entries will have a size of 0 bytes. Use the
 * `isDirectory` property to distinguish between files and directories when
 * building navigation interfaces.
 */

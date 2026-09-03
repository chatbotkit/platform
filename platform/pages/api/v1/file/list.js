// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getBlueprintIdQueryFilter,
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /file/list:
 *   get:
 *     operationId: listFiles
 *     summary: Retrieve a list of files
 *     tags:
 *       - File
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           description: The cursor to use for pagination
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           description: The order of the paginated items
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *       - in: query
 *         name: take
 *         schema:
 *           description: The number of items to retrieve
 *           type: integer
 *       - in: query
 *         name: meta
 *         schema:
 *           description: Key-value pairs to filter the items by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
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
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceRefProperties'
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - $ref: '#/components/schemas/BlueprintProps'
 *                       - type: object
 *                         properties:
 *                           visibility:
 *                             $ref: '#/components/schemas/FileVisibility'
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *               required:
 *                 - items
 *                 - cursor
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - item
 *                     data:
 *                       $ref: '#/paths/~1file~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const files = await prisma.file.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            ...getBlueprintIdQueryFilter(req),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // ref

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          blueprintId: true,

          // resource specific

          visibility: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(files),
      }
    })
  )
)

/**
 * @manual Files
 * @description Comprehensive guide to managing files in the platform, including uploading, retrieving, updating, and deleting file resources.
 * @category Resources/Files
 * @tags file, upload, storage, management
 * @index 1
 *
 * Files are fundamental resources in the platform that enable you to store,
 * manage, and utilize various types of content including documents, images,
 * and data files. The file management system provides a comprehensive API for
 * creating, uploading, retrieving, updating, and deleting files with robust
 * security controls and flexible storage options.
 *
 * Files can serve multiple purposes within the platform: they can be attached
 * to datasets as data sources, used for bot training materials, or serve as
 * general storage for application content. The platform handles file storage
 * securely with support for both public and private visibility settings,
 * allowing you to control access to your files based on your specific needs.
 *
 * ## Listing Files
 *
 * Retrieving a list of your files is essential for managing your stored
 * content and understanding what resources are available in your account. The
 * list endpoint provides powerful filtering and pagination capabilities to help
 * you efficiently navigate through your file collection.
 *
 * To list files, make a GET request to the files endpoint. The API supports
 * cursor-based pagination, which is ideal for efficiently handling large
 * collections of files without performance degradation:
 *
 * ```http
 * GET /api/v1/file/list
 * ```
 *
 * You can control the pagination behavior using query parameters:
 *
 * ```http
 * GET /api/v1/file/list?take=50&order=desc
 * ```
 *
 * The `take` parameter specifies how many files to retrieve per request
 * (default and maximum may vary based on your account limits), while the
 * `order` parameter controls whether files are returned in ascending (`asc`) or
 * descending (`desc`) order based on creation time.
 *
 * For subsequent pages, use the cursor provided in the previous response:
 *
 * ```http
 * GET /api/v1/file/list?cursor=<cursor_value>&take=50
 * ```
 *
 * You can also filter files by blueprint ID to retrieve only files associated
 * with a specific blueprint:
 *
 * ```http
 * GET /api/v1/file/list?blueprintId=<blueprint_id>
 * ```
 *
 * The response includes comprehensive information about each file including its
 * ID, name, description, visibility settings, blueprint association, metadata,
 * and timestamps. This information enables you to understand file properties
 * and make informed decisions about file management operations.
 *
 * **Note:** The list endpoint only returns files that belong to your user
 * account, ensuring proper data isolation and security. Files are automatically
 * filtered based on your authentication context.
 */

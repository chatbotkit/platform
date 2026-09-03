// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /file/{fileId}/fetch:
 *   get:
 *     operationId: fetchFile
 *     summary: Fetch a file
 *     tags:
 *       - File
 *     parameters:
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           description: The ID of the file to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The file was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     visibility:
 *                       $ref: '#/components/schemas/FileVisibility'
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const file = await prisma.file.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'fileId'),
      {
        select: {
          // identifiers

          id: true,

          // ref

          alias: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

          blueprintId: true,

          // resource specific

          visibility: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!file) {
      return notFound()
    }

    if (file.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (file).userId)

    return ok(makeJsonSafe(file))
  })
)

/**
 * @manual Files
 *
 * ## Retrieving File Details
 *
 * Fetching detailed information about a specific file is essential when you
 * need to inspect file properties, verify metadata, or understand the current
 * state of a file resource before performing operations on it.
 *
 * To retrieve complete details for a specific file, make a GET request to the
 * fetch endpoint with the file ID:
 *
 * ```http
 * GET /api/v1/file/{fileId}/fetch
 * ```
 *
 * Replace `{fileId}` with the actual ID of the file you want to retrieve. The
 * file ID is typically obtained when creating a file or from the list endpoint
 * response.
 *
 * The response includes comprehensive information about the file:
 *
 * - **Basic Information**: File ID, name, and description that identify and
 *   describe the file
 * - **Ownership**: User ID indicating who owns the file
 * - **Blueprint Association**: Blueprint ID if the file is associated with a
 *   blueprint resource
 * - **Visibility Settings**: Whether the file is private or public, controlling
 *   access permissions
 * - **Metadata**: Custom metadata stored in the `meta` field, which may include
 *   content type information and other file-specific properties
 * - **Timestamps**: Creation and last update times for tracking file lifecycle
 *
 * The fetch operation performs security checks to ensure you have permission to
 * access the requested file. Only files that belong to your user account can be
 * retrieved through this endpoint, protecting data privacy and preventing
 * unauthorized access.
 *
 * **Example Response:**
 *
 * ```json
 * {
 *   "id": "file_abc123",
 *   "name": "Product Catalog",
 *   "description": "Complete product listing with images and descriptions",
 *   "blueprintId": "blueprint_xyz789",
 *   "visibility": "private",
 *   "meta": {
 *     "contentType": "application/pdf"
 *   },
 *   "createdAt": "2024-01-15T10:30:00Z",
 *   "updatedAt": "2024-01-15T10:30:00Z"
 * }
 * ```
 */

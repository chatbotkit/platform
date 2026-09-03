// @ts-check
import prisma from '@/prisma/client'

import { assert } from '@/lib/debug'
import { withStreamCursor } from '@/lib/stream'
import { getMetaQueryFilter, getTakeConstraints } from '@/lib/filter'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /dataset/{datasetId}/file/list:
 *   get:
 *     operationId: listDatasetFiles
 *     summary: Retrieve a list of dataset files
 *     tags:
 *       - Dataset File
 *     parameters:
 *       - in: path
 *         name: datasetId
 *         required: true
 *         schema:
 *           description: The ID of the dataset
 *           type: string
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
 *                       - $ref: '#/components/schemas/InstanceListProps'
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
    withStreamCursor(async function (_cursor, req, _stream, session) {
      const dataset = await prisma.dataset.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'datasetId'),
        {
          select: {
            id: true, // @warning: this is super important property
            userId: true,
          },
        }
      )

      if (!dataset) {
        return throwNotFound()
      }

      if (dataset.userId !== session.user.id) {
        return throwNotAuthorized()
      }

      // @note this is a defense in depth situation - without the dataset.id we
      // will return all files from all datasets and this is not what we want,
      // therefore we need to assert that the dataset.id is present

      assert(!!dataset.id, 'dataset.id is not present')

      const files = await prisma.datasetFileAttachment.findMany({
        where: {
          AND: [{ datasetId: dataset.id }, ...getMetaQueryFilter(req)],
        },

        // @note it does not work with cursors
        // @todo find a way to work with cursors
        // ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          file: {
            select: {
              // identifiers

              id: true,

              // basic information

              name: true,
              description: true,

              // resource specific

              visibility: true,

              // meta and others

              meta: true,

              createdAt: true,
              updatedAt: true,
            },
          },
        },
      })

      return {
        items: makeJsonSafe(files.map(({ file }) => file)),
      }
    })
  )
)

/**
 * @manual Dataset Files
 * @description Dataset files represent documents, images, and other content attached to datasets, providing source material that can be indexed and referenced by AI agents during conversations.
 * @category Resources/Datasets
 * @tags dataset, files, documents, attachments
 * @index 12
 *
 * Dataset files are the primary way to add content and knowledge to your
 * datasets, enabling AI agents to access and reference specific documents,
 * images, PDFs, text files, and other file types during conversations. Each
 * file attached to a dataset is automatically processed, indexed, and made
 * searchable, allowing the AI to retrieve relevant information when responding
 * to user queries.
 *
 * ## Listing Dataset Files
 *
 * Retrieving the list of files attached to a dataset allows you to inventory
 * all content within a knowledge base, review file metadata, and manage your
 * dataset's content library. The list endpoint provides comprehensive information
 * about each file including its name, description, visibility settings, and
 * timestamps.
 *
 * To retrieve the files associated with a dataset, send a GET request to the
 * dataset's file list endpoint:
 *
 * ```http
 * GET /api/v1/dataset/{datasetId}/file/list
 * ```
 *
 * ### Pagination
 *
 * The endpoint supports cursor-based pagination for efficiently navigating
 * large file collections:
 *
 * ```http
 * GET /api/v1/dataset/{datasetId}/file/list?cursor=eyJpZCI6ImZpbGVfMTIzIn0&take=50
 * ```
 *
 * - **cursor**: Pagination token from the previous response, enabling you to
 *   fetch the next page of results
 * - **take**: Number of files to retrieve per page (adjust based on your needs)
 * - **order**: Sort order, either `asc` (oldest first) or `desc` (newest first,
 *   default)
 *
 * ### Filtering by Metadata
 *
 * Filter files based on custom metadata fields using deep object notation:
 *
 * ```http
 * GET /api/v1/dataset/{datasetId}/file/list?meta[category]=documentation&meta[language]=en
 * ```
 *
 * Metadata filtering enables flexible organization and retrieval based on your
 * own categorization schemes, making it easy to find specific types of content
 * within large datasets.
 *
 * ### Response Format
 *
 * The endpoint returns an array of file objects:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "file_abc123",
 *       "name": "Product Documentation.pdf",
 *       "description": "Comprehensive product user guide",
 *       "visibility": "private",
 *       "meta": {
 *         "category": "documentation",
 *         "version": "2.1"
 *       },
 *       "createdAt": "2025-01-10T08:30:00.000Z",
 *       "updatedAt": "2025-01-15T14:20:00.000Z"
 *     }
 *   ]
 * }
 * ```
 *
 * ### File Visibility
 *
 * Each file has a visibility setting that controls access:
 *
 * - **private**: Only accessible to the file owner and explicitly authorized
 *   users
 * - **protected**: Accessible to users within the same organization or team
 * - **public**: Publicly accessible (use with caution for sensitive content)
 *
 * ### Streaming Response (JSONL)
 *
 * For real-time processing of large file lists, request JSONL streaming format:
 *
 * ```http
 * GET /api/v1/dataset/{datasetId}/file/list
 * Accept: application/jsonl
 * ```
 *
 * Each line in the response is a separate JSON object:
 *
 * ```jsonl
 * {"type":"item","data":{"id":"file_abc123","name":"Document 1.pdf",...}}
 * {"type":"item","data":{"id":"file_def456","name":"Document 2.pdf",...}}
 * ```
 *
 * This format is ideal for processing large file lists incrementally without
 * waiting for the entire response.
 *
 * **Important Notes:**
 *
 * - Only files attached to datasets you own are returned
 * - File processing status is not included in the list response; check
 *   individual file details for processing state
 * - Deleted files are automatically removed from the list
 * - The list reflects the current state of file attachments through the
 *   DatasetFileAttachment relationship
 * - File metadata is flexible and can store arbitrary key-value pairs for
 *   custom organization
 */

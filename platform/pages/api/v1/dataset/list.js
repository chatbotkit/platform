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
 * /dataset/list:
 *   get:
 *     operationId: listDatasets
 *     summary: Retrieve a list of datasets
 *     tags:
 *       - Dataset
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
 *         description: The list of datasets was retrieved successfully
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
 *                           reranker:
 *                             description: The reranker class for the dataset
 *                             type: string
 *                           recordMaxTokens:
 *                             description: The total number of tokens for each record
 *                             type: number
 *                           searchMinScore:
 *                             description: The minimum score to filter search results by
 *                             type: number
 *                           searchMaxRecords:
 *                             description: The total number of records to return during search
 *                             type: number
 *                           searchMaxTokens:
 *                             description: The total number of tokens to use during search
 *                             type: number
 *                           matchInstruction:
 *                             description: An instruction to include before found records
 *                             type: string
 *                           mismatchInstruction:
 *                             description: An instruction to include if no records where found
 *                             type: string
 *                           separators:
 *                             description: A list of separators to use when tokenizing text
 *                             type: string
 *                           visibility:
 *                             $ref: '#/components/schemas/DatasetVisibility'
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
 *                       $ref: '#/paths/~1dataset~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const datasets = await prisma.dataset.findMany({
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

          reranker: true,

          recordMaxTokens: true,

          searchMinScore: true,
          searchMaxRecords: true,
          searchMaxTokens: true,

          matchInstruction: true,
          mismatchInstruction: true,

          separators: true,

          visibility: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(datasets),
      }
    })
  )
)

/**
 * @manual Datasets
 *
 * ## Listing Datasets
 *
 * Retrieving a comprehensive list of all datasets in your account is essential
 * for managing your knowledge bases, monitoring data organization, and accessing
 * dataset configurations programmatically. The list endpoint provides powerful
 * filtering and pagination capabilities to help you efficiently navigate large
 * collections of datasets.
 *
 * The listing operation returns detailed information about each dataset,
 * including its configuration, storage settings, search parameters, and
 * metadata. This is particularly useful for building administrative interfaces,
 * implementing dataset selection features in applications, or automating dataset
 * management workflows.
 *
 * To retrieve a list of your datasets, send a GET request:
 *
 * ```http
 * GET /api/v1/dataset/list
 * ```
 *
 * The response includes all datasets associated with your account, returned as
 * an array of dataset objects with their complete configuration and metadata.
 *
 * ### Pagination and Ordering
 *
 * For accounts with many datasets, pagination helps manage the response size
 * and improve performance:
 *
 * ```http
 * GET /api/v1/dataset/list?take=20&order=desc
 * ```
 *
 * Available pagination parameters:
 *
 * - **cursor**: Pagination token from previous response to fetch the next page
 * - **take**: Number of datasets to retrieve per request
 * - **order**: Sort order by creation date ("asc" or "desc", defaults to "desc")
 *
 * ### Filtering by Blueprint
 *
 * To retrieve only datasets associated with a specific blueprint or project:
 *
 * ```http
 * GET /api/v1/dataset/list?blueprintId=bp_abc123
 * ```
 *
 * This is useful when working with organized project structures where datasets
 * are grouped by purpose or workflow.
 *
 * ### Filtering by Metadata
 *
 * Datasets with custom metadata can be filtered using meta queries, enabling
 * sophisticated organizational schemes:
 *
 * ```http
 * GET /api/v1/dataset/list?meta[environment]=production&meta[category]=support
 * ```
 *
 * ### Response Structure
 *
 * Each dataset in the response includes:
 *
 * - **Core identifiers**: id, name, description
 * - **Storage configuration**: reranker settings
 * - **Search parameters**: recordMaxTokens, searchMinScore, searchMaxRecords,
 *   searchMaxTokens
 * - **Instructions**: matchInstruction, mismatchInstruction
 * - **Resource relationships**: blueprintId
 * - **Access control**: visibility setting
 * - **Metadata**: Custom meta fields
 * - **Timestamps**: createdAt, updatedAt
 *
 * **Best Practices:**
 *
 * - Use pagination for large dataset collections to improve API performance
 * - Apply filters when searching for specific datasets to reduce response size
 * - Leverage metadata filtering for custom organizational structures
 * - Store pagination cursors for efficient navigation through results
 */

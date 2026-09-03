// @ts-check
import prisma from '@/prisma/client'

import { maskSecretConfig } from '@/lib/credential.mask'
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
 * /secret/list:
 *   get:
 *     operationId: listSecrets
 *     summary: Retrieve a list of secrets
 *     tags:
 *       - Secret
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
 *         description: The list of secrets was retrieved successfully
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
 *                           kind:
 *                             $ref: '#/components/schemas/SecretKind'
 *                           type:
 *                             $ref: '#/components/schemas/SecretType'
 *                           config:
 *                             description: The config of the secret (config.clientSecret is returned as '********' if configured, null otherwise)
 *                             type: object
 *                             additionalProperties: true
 *                           visibility:
 *                             $ref: '#/components/schemas/SecretVisibility'
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
 *                       $ref: '#/paths/~1secret~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const secrets = await prisma.secret.findMany({
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

          kind: true,

          type: true,

          config: true,

          visibility: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        // @note config.clientSecret is returned as '********' when set - see
        // lib/credential.mask.ts
        items: makeJsonSafe(
          secrets.map((secret) => ({
            ...secret,
            config: maskSecretConfig(secret.config),
          }))
        ),
      }
    })
  )
)

/**
 * @manual Secrets
 * @index 10
 *
 * ## Listing Secrets
 *
 * Retrieve a paginated list of all secrets in your workspace. This endpoint allows
 * you to view all configured secrets, making it easy to manage and audit your
 * stored credentials. The list includes metadata about each secret but never exposes
 * the actual credential values for security reasons.
 *
 * You can filter secrets by blueprint association and use pagination parameters to
 * navigate through large sets of secrets. The response includes secret names,
 * descriptions, types, visibility settings, and configuration details.
 *
 * To list all secrets:
 *
 * ```http
 * GET /api/v1/secret/list?order=desc&take=20
 * ```
 *
 * The response includes an array of secret objects with their metadata. You can use
 * the `cursor` parameter for pagination to retrieve additional pages of results.
 *
 * **Query Parameters:**
 * - `cursor` - Pagination cursor from previous response
 * - `order` - Sort order: `asc` or `desc` (default: `desc`)
 * - `take` - Number of items to retrieve per page
 * - `blueprintId` - Filter secrets by blueprint association
 * - `meta` - Filter by metadata fields
 *
 * **Note:** The list endpoint never returns secret values. To verify if a secret is
 * properly configured, use the verify endpoint instead.
 */

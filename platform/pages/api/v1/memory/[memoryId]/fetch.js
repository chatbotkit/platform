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
 * /memory/{memoryId}/fetch:
 *   get:
 *     operationId: fetchMemory
 *     summary: Fetch memory
 *     tags:
 *       - Memory
 *     parameters:
 *       - in: path
 *         name: memoryId
 *         required: true
 *         schema:
 *           description: The ID of the memory to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The memory was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - type: object
 *                   properties:
 *                     contactId:
 *                       type: string
 *                       description: The contact associated with the memory
 *                     botId:
 *                       type: string
 *                       description: The bot associated with the memory
 *                     text:
 *                       type: string
 *                       description: The text of the memory
 *                     expiresAt:
 *                       description: The timestamp (ms) at which the memory expires and is automatically deleted
 *                       type: number
 *                       nullable: true
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const memory = await prisma.memory.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'memoryId'),
      {
        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

          contactId: true,

          botId: true,

          // resource specific

          text: true,

          expiresAt: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!memory) {
      return notFound()
    }

    if (memory.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (memory).userId)

    return ok(makeJsonSafe(memory))
  })
)

/**
 * @manual Memories
 * @index 20
 *
 * ## Fetching a Memory
 *
 * Fetching a specific memory retrieves all details for a single memory by its
 * unique identifier. This operation is useful when you need to access the
 * complete information for a particular memory, whether for display purposes,
 * verification, or as part of a larger workflow.
 *
 * To fetch a memory, you need its unique ID which is returned when the memory
 * is created or can be obtained from listing operations. The fetch operation
 * returns the complete memory object including all fields and metadata.
 *
 * ```http
 * GET /api/v1/memory/{memoryId}/fetch
 * ```
 *
 * For example, to fetch a memory with ID `mem_123abc`:
 *
 * ```http
 * GET /api/v1/memory/mem_123abc/fetch
 * ```
 *
 * The response includes all memory properties:
 *
 * - `id` - Unique memory identifier
 * - `name` - Memory name for organization
 * - `description` - Detailed description
 * - `text` - The actual content stored in the memory
 * - `botId` - Associated bot ID (if any)
 * - `contactId` - Associated contact ID (if any)
 * - `meta` - Additional metadata as JSON
 * - `createdAt` - Creation timestamp
 * - `updatedAt` - Last modification timestamp
 */

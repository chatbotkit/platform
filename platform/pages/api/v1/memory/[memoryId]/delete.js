// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /memory/{memoryId}/delete:
 *   post:
 *     operationId: deleteMemory
 *     summary: Delete memory
 *     tags:
 *       - Memory
 *     parameters:
 *       - in: path
 *         name: memoryId
 *         required: true
 *         schema:
 *           description: The ID of the memory to delete
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The memory was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted memory
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const memory = await prisma.memory.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'memoryId'),
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )

    if (!memory) {
      return notFound()
    }

    if (memory.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.memory.delete({
      where: {
        id: memory.id,
      },
    })

    return ok({ id: memory.id })
  })
)

/**
 * @manual Memories
 * @index 40
 *
 * ## Deleting a Memory
 *
 * Deleting a memory permanently removes it from your account, including all
 * associated content and metadata. This operation is irreversible, so ensure
 * you have appropriate backups or confirmations before proceeding with
 * deletion.
 *
 * To delete a memory, you need its unique identifier. The operation will
 * immediately remove the memory from storage and return the ID of the deleted
 * memory as confirmation.
 *
 * ```http
 * POST /api/v1/memory/{memoryId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * For example, to delete a memory with ID `mem_123abc`:
 *
 * ```http
 * POST /api/v1/memory/mem_123abc/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response will confirm the deletion by returning the ID of the deleted memory:
 *
 * ```json
 * {
 *   "id": "mem_123abc"
 * }
 * ```
 *
 * **Important Considerations:**
 *
 * - Deletion is permanent and cannot be undone
 * - The memory will be immediately unavailable for all operations
 * - Associated bot or contact references will be removed
 * - Any searches or listings will no longer include the deleted memory
 *
 * **Note:** Deleting a memory does not affect the bots or contacts it was
 * associated with. Only the memory itself is removed. If you need to maintain
 * a history of deletions, consider implementing a soft delete pattern using
 * metadata fields instead of permanent deletion.
 */

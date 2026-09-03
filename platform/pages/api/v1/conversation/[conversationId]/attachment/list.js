// @ts-check
import prisma from '@/prisma/client'

import { listConversationAttachments } from '@/lib/conversation.attachment'
import { withStreamCursor } from '@/lib/stream'
import { withGet } from '@/lib/method'
import { queryParam, requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /conversation/{conversationId}/attachment/list:
 *   get:
 *     operationId: listConversationAttachments
 *     summary: List conversation attachments
 *     tags:
 *       - Conversation Attachment
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation to list attachments for
 *           type: string
 *       - in: query
 *         name: cursor
 *         schema:
 *           description: The cursor to use for pagination
 *           type: string
 *       - in: query
 *         name: take
 *         schema:
 *           description: The number of items to retrieve
 *           type: integer
 *     responses:
 *       200:
 *         description: The attachments were listed successfully
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
 *                           name:
 *                             description: The stored attachment file name
 *                             type: string
 *                           type:
 *                             description: The inferred attachment MIME type
 *                             type: string
 *                           size:
 *                             description: The attachment size in bytes
 *                             type: number
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *               required:
 *                 - items
 *                 - cursor
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const conversation = await prisma.conversation.findUnique({
        where: {
          id: requiredUrlParam(req, 'conversationId'),
        },

        select: {
          id: true,
          userId: true,
        },
      })

      if (!conversation) {
        return throwNotFound(`Conversation not found`)
      }

      if (conversation.userId !== session.user.id) {
        return throwNotAuthorized()
      }

      const take = parseInt(queryParam(req, 'take') || '', 10)

      const result = await listConversationAttachments(conversation.id, {
        continuationToken: cursor,
        maxKeys: Number.isFinite(take) ? take : undefined,
      })

      return {
        items: makeJsonSafe(result.items),
        cursor: result.cursor,
      }
    })
  )
)

/**
 * @manual Conversation Attachments
 * @index 70
 *
 * ## Listing Conversation Attachments
 *
 * Conversation attachments can be listed with the attachment list endpoint:
 *
 * ```http
 * GET /api/v1/conversation/{conversationId}/attachment/list
 * ```
 *
 * The response includes attachment names, inferred content types, sizes,
 * timestamps, and a cursor for pagination:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "att_abc123",
 *       "name": "att_abc123.pdf",
 *       "description": "att_abc123.pdf",
 *       "type": "application/pdf",
 *       "size": 12345,
 *       "createdAt": "2025-01-09T10:30:00Z",
 *       "updatedAt": "2025-01-09T10:30:00Z"
 *     }
 *   ],
 *   "cursor": null
 * }
 * ```
 *
 * Use `take` to control page size and `cursor` to fetch the next page:
 *
 * ```http
 * GET /api/v1/conversation/{conversationId}/attachment/list?take=25&cursor=next
 * ```
 *
 * Use the attachment name with the download endpoint to retrieve the file:
 *
 * ```http
 * GET /api/v1/conversation/{conversationId}/attachment/{attachmentName}/download
 * ```
 *
 * Only the conversation owner can list attachments.
 */

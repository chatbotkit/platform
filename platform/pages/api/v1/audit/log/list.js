// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getFieldQueryFilter,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * -@swagger
 *
 * /audit/log/list:
 *   get:
 *     operationId: listAuditLogs
 *     summary: List audit logs
 *     tags:
 *       - Audit
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
 *         description: The list of audit logs was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties: {}
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
 *                       $ref: '#/paths/~1audit~1log~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          AND: [
            { userId: session.user.id },

            ...getMetaQueryFilter(req),

            .../** @type {typeof getFieldQueryFilter<import('@/prisma/types').AuditLog>} */ (
              getFieldQueryFilter
            )(req, [
              'action',
              'conversationId',
              'taskId',
              'contactId',
              'spaceId',
              'blueprintId',
              'botId',
              'datasetId',
              'recordId',
              'skillsetId',
              'abilityId',
              'fileId',
              'secretId',
              'portalId',
              'policyId',
              'webhookId',
              'sessionId',
            ]),
          ],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          conversationId: true,

          taskId: true,

          contactId: true,

          spaceId: true,

          blueprintId: true,

          botId: true,

          datasetId: true,

          recordId: true,

          skillsetId: true,

          abilityId: true,

          fileId: true,

          secretId: true,

          portalId: true,

          policyId: true,

          webhookId: true,

          sessionId: true,

          // resource specific

          action: true,

          oldValues: true,
          newValues: true,

          ipAddress: true,
          userAgent: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(auditLogs),
      }
    })
  )
)

/**
 * @manual Audit Logs
 * @description Audit logs provide comprehensive tracking of all actions and changes made within your ChatBotKit account, enabling security monitoring, compliance auditing, and activity analysis across all resources and operations.
 * @category Observability/Audit
 * @tags audit, logging, security, compliance
 * @index 1
 *
 * Audit logs are essential for maintaining security, compliance, and operational
 * transparency by automatically recording every significant action performed in
 * your ChatBotKit account. Each log entry captures detailed information about
 * what action was performed, who performed it, when it occurred, and what
 * resources were affected.
 *
 * ## Understanding Audit Logs
 *
 * Audit logs capture a wide range of activities including resource creation,
 * updates, deletions, and access operations. Each audit log entry includes:
 *
 * - **Action details**: The type of operation performed (create, update, delete, etc.)
 * - **Resource information**: The specific resources affected by the action
 * - **User context**: Who performed the action and from which IP address
 * - **Temporal data**: Precise timestamps for when the action occurred
 * - **Change tracking**: Old and new values for update operations
 * - **Request metadata**: User agent, session information, and other contextual data
 *
 * This comprehensive logging enables you to track user behavior, investigate
 * security incidents, meet compliance requirements, and understand how your
 * resources are being used and modified over time.
 *
 * ## Listing Audit Logs
 *
 * To retrieve audit logs for your account, you can query the audit log list
 * endpoint with various filtering options to find specific activities or
 * narrow down your search to particular resources or time periods.
 *
 * ```http
 * GET /api/v1/audit/log/list?take=50&order=desc
 * Content-Type: application/json
 * ```
 *
 * You can filter audit logs by specific resources using query parameters:
 *
 * ```http
 * GET /api/v1/audit/log/list?botId={botId}&action=update
 * Content-Type: application/json
 * ```
 *
 * Available filter parameters include:
 *
 * - `action`: Filter by specific action types (create, update, delete, etc.)
 * - `conversationId`, `taskId`, `contactId`: Filter by conversation, task, or contact
 * - `spaceId`: Filter by space
 * - `blueprintId`, `botId`, `datasetId`: Filter by specific resource IDs
 * - `recordId`, `skillsetId`, `abilityId`: Filter by related resource IDs
 * - `fileId`, `secretId`, `portalId`: Filter by integration resources
 * - `policyId`, `webhookId`, `sessionId`: Filter by policy, webhook, and session data
 * - `cursor`, `order`, `take`: Standard pagination parameters
 *
 * The response includes detailed information about each logged action:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "log_abc123",
 *       "name": "Updated Bot Configuration",
 *       "description": "Modified bot backstory and model settings",
 *       "action": "update",
 *       "botId": "bot_xyz789",
 *       "oldValues": { "model": "glm-5.1" },
 *       "newValues": { "model": "glm-5.2" },
 *       "ipAddress": "192.168.1.1",
 *       "userAgent": "Mozilla/5.0...",
 *       "createdAt": "2025-11-22T20:00:00Z",
 *       "updatedAt": "2025-11-22T20:00:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * ## Use Cases for Audit Logs
 *
 * Audit logs serve several critical purposes:
 *
 * - **Security Monitoring**: Track unauthorized access attempts and suspicious activities
 * - **Compliance Auditing**: Meet regulatory requirements for activity logging and data governance
 * - **Troubleshooting**: Investigate issues by reviewing recent changes to configurations
 * - **Usage Analysis**: Understand how resources are being utilized and modified
 * - **Change Management**: Track who made specific changes and when they occurred
 * - **Accountability**: Maintain clear records of all system modifications
 *
 * **Important:** Audit logs are read-only and cannot be modified or deleted.
 * They provide an immutable record of account activity for security and
 * compliance purposes. Logs are retained according to your account's data
 * retention policy.
 */

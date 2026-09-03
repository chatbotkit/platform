// @ts-check
import prisma from '@/prisma/client'

import { withStreamCursor } from '@/lib/stream'
import {
  getCursorConstraints,
  getMetaQueryFilter,
  getTakeConstraints,
} from '@/lib/filter'
import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { throwNotAuthorized, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /contact/{contactId}/secret/list:
 *   get:
 *     operationId: listContactSecrets
 *     summary: List contact secrets
 *     tags:
 *       - Contact Secret
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           description: The ID of the contact to list secrets for
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
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - type: object
 *                         properties:
 *                           type:
 *                             description: The type of the secret
 *                             type: string
 *                         required:
 *                           - type
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
 *                       $ref: '#/paths/~1contact~1{contactId}~1secret~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor, req, _stream, session) {
      const contact = await prisma.contact.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'contactId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

      if (!contact) {
        throwNotFound()
      }

      if (contact.userId !== session.user.id) {
        throwNotAuthorized()
      }

      const values = await prisma.secretValue.findMany({
        where: {
          AND: [{ contactId: contact.id }, ...getMetaQueryFilter(req)],
        },

        ...getCursorConstraints(req, cursor),

        ...getTakeConstraints(req),

        select: {
          // basic information

          name: true,
          description: true,

          // resource specific

          secret: {
            select: {
              // identifiers

              id: true,

              // basic information

              name: true,
              description: true,

              // resource specific

              type: true,
            },
          },

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      })

      return {
        items: makeJsonSafe(
          values.flatMap(({ secret, ...rest }) => {
            if (!secret) {
              return []
            }

            return {
              ...rest,

              id: secret.id,

              name: rest.name || secret.name,
              description: rest.description || secret.description,

              type: secret?.type,
            }
          })
        ),
      }
    })
  )
)

/**
 * @manual Contact Secrets
 *
 * ## Listing Contact Secrets
 *
 * To retrieve all secrets associated with a specific contact, use the list
 * endpoint which returns all authentication tokens, API keys, and OAuth
 * credentials that have been configured for that contact's integrations.
 *
 * ```http
 * GET /api/v1/contact/{contactId}/secret/list
 * Content-Type: application/json
 * ```
 *
 * This endpoint provides visibility into which external services a contact
 * has authenticated with, making it easy to manage and audit their connected
 * integrations. Each secret in the list includes basic information without
 * exposing the actual secret values for security purposes.
 *
 * ## Understanding Secret Types
 *
 * Contact secrets can be of various types depending on the authentication
 * method used by the external service:
 *
 * - **OAuth tokens**: Access and refresh tokens from OAuth 2.0 flows
 * - **API keys**: Direct API key authentication for services that use token-based auth
 * - **Custom credentials**: Service-specific authentication mechanisms
 *
 * The response includes metadata about each secret, including:
 *
 * ```json
 * {
 *   "items": [
 *     {
 *       "id": "secret_abc123",
 *       "name": "Google Calendar Access",
 *       "description": "OAuth token for calendar integration",
 *       "type": "oauth",
 *       "createdAt": "2025-11-20T10:00:00Z",
 *       "updatedAt": "2025-11-22T15:30:00Z"
 *     }
 *   ]
 * }
 * ```
 *
 * ## Pagination and Filtering
 *
 * Like other list endpoints, contact secret listing supports pagination
 * through cursor-based navigation:
 *
 * ```http
 * GET /api/v1/contact/{contactId}/secret/list?take=20&order=desc
 * Content-Type: application/json
 * ```
 *
 * You can also filter secrets by metadata using the `meta` query parameter
 * to find secrets with specific attributes or properties.
 *
 * ## Security Considerations
 *
 * The list endpoint returns secret metadata but never exposes actual secret
 * values, tokens, or credentials. This ensures that:
 *
 * - Listing secrets doesn't compromise security
 * - Audit trails can be maintained without exposing sensitive data
 * - User interfaces can display integration status without secret access
 *
 * To actually use a secret for authentication, you must use the authenticate
 * endpoint with the specific secret ID. To remove access, use the revoke
 * endpoint to invalidate the secret and disconnect the integration.
 *
 * **Important:** Secrets are tied to specific contacts and cannot be shared
 * between contacts. Each contact must authenticate separately with external
 * services to create their own secrets for personalized integrations.
 */

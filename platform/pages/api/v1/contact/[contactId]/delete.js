// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /contact/{contactId}/delete:
 *   post:
 *     operationId: deleteContact
 *     summary: Delete contact
 *     tags:
 *       - Contact
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           description: The ID of the contact to delete
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
 *         description: The contact was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted contact
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
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
      return notFound()
    }

    if (contact.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.contact.delete({
      where: {
        id: contact.id,
      },
    })

    return ok({ id: contact.id })
  })
)

/**
 * @manual Contacts
 *
 * ## Deleting Contacts
 *
 * The delete contact operation permanently removes a contact from your
 * database, including all associated data and relationships. This operation is
 * irreversible and should be used carefully, typically in response to explicit
 * user requests for data deletion or as part of data retention policy
 * enforcement for compliance with privacy regulations.
 *
 * When you delete a contact, the system removes all stored information about
 * that individual including their identifying attributes, preferences,
 * metadata, and interaction history. Any conversations, messages, or other
 * resources linked to this contact may also be affected depending on your
 * database configuration and cascade rules. This ensures complete data removal
 * to comply with data protection regulations like GDPR's "right to be
 * forgotten" or CCPA's deletion requirements.
 *
 * Before deleting a contact, you should consider whether archiving or marking
 * the contact as inactive might be more appropriate for your use case. Deletion
 * is permanent and cannot be undone, so if there's any possibility you might
 * need the contact data in the future for analytics, legal compliance, or
 * business continuity, consider alternative approaches such as soft deletion
 * through metadata flags.
 *
 * ```http
 * POST /api/v1/contact/{contactId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The delete operation requires an empty JSON object in the request body for
 * consistency with other API endpoints, even though no parameters are needed.
 * This design pattern ensures uniform request handling across all POST
 * operations in the API.
 *
 * The response confirms the deletion by returning the ID of the deleted
 * contact. After receiving this response, the contact ID becomes invalid and
 * any subsequent operations using that ID will return a "not found" error.
 * Make sure to update any stored references in your application after
 * successful deletion.
 *
 * **Data Retention Compliance:** When implementing contact deletion for
 * regulatory compliance, ensure you also handle any related data that might
 * exist in external systems, logs, or backups. The API deletion only affects
 * the primary database; you may need additional procedures to ensure complete
 * data removal across your entire infrastructure.
 *
 * **Best Practice:** Before performing a deletion, consider implementing a
 * confirmation workflow in your user interface to prevent accidental data loss.
 * Additionally, you might want to export contact data before deletion to
 * maintain audit trails or comply with record retention requirements in certain
 * jurisdictions.
 *
 * **Rate Limiting:** Bulk deletion operations should be implemented carefully
 * with appropriate rate limiting and error handling. If you need to delete
 * many contacts, implement batching with delays between requests to avoid
 * overwhelming the system or triggering rate limit protections.
 */

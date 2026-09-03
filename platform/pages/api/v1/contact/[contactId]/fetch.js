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
 * /contact/{contactId}/fetch:
 *   get:
 *     operationId: fetchContact
 *     summary: Fetch contact
 *     tags:
 *       - Contact
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           description: The ID of the contact to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The contact was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - type: object
 *                   properties:
 *                     fingerprint:
 *                       description: The fingerprint of the contact
 *                       type: string
 *                     email:
 *                       description: The email address of the contact
 *                       type: string
 *                     phone:
 *                       description: The phone number of the contact
 *                       type: string
 *                     nick:
 *                       description: The nickname of the contact
 *                       type: string
 *                     preferences:
 *                       description: The preferences of the contact
 *                       type: string
 *                     verifiedAt:
 *                       description: The timestamp (ms) when the contact was verified
 *                       type: number
 *                   required:
 *                     - fingerprint
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const contact = await prisma.contact.findUniqueByIdentifier(
      session.user,
      requiredUrlParam(req, 'contactId'),
      {
        select: {
          // identifiers

          id: true,

          // basic information

          name: true,
          description: true,

          // resource linking

          userId: true,

          // resource specific

          fingerprint: true,

          email: true,
          phone: true,

          nick: true,

          preferences: true,

          verifiedAt: true,

          // meta and others

          meta: true,

          createdAt: true,
          updatedAt: true,
        },
      }
    )

    if (!contact) {
      return notFound()
    }

    if (contact.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (contact).userId)

    return ok(makeJsonSafe(contact))
  })
)

/**
 * @manual Contacts
 *
 * ## Fetching Individual Contacts
 *
 * The fetch contact operation retrieves complete information about a specific
 * contact using their unique identifier. This endpoint is essential for
 * displaying contact details in user interfaces, retrieving contact
 * information before starting conversations, or accessing contact data for
 * integration with other systems and workflows.
 *
 * When you fetch a contact, you receive all stored information including
 * identifying attributes (fingerprint, email, phone, nickname), basic
 * information (name and description), custom preferences, verification status,
 * metadata, and timestamps. This comprehensive data enables you to build rich
 * user experiences and make informed decisions in your application logic.
 *
 * The contact ID used in this operation can be obtained from various sources:
 * contact creation responses, list operations, conversation metadata, or your
 * own application database where you might store contact IDs for quick
 * reference. The ID serves as a stable, permanent identifier that remains
 * unchanged throughout the contact's lifecycle.
 *
 * ```http
 * GET /api/v1/contact/{contactId}/fetch
 * ```
 *
 * For example, to fetch a specific contact:
 *
 * ```http
 * GET /api/v1/contact/cont_abc123xyz/fetch
 * ```
 *
 * The response includes all contact fields with their current values. The
 * `verifiedAt` field indicates verification status: if non-null, the contact
 * has been verified with a trusted fingerprint; if null, the contact is
 * unverified and was created through automatic fingerprinting.
 *
 * This endpoint implements robust authorization checks to ensure users can
 * only access contacts within their own account. Attempting to fetch a contact
 * from another user's account will result in a not authorized error, even if
 * you somehow obtained their contact ID. This strict access control maintains
 * data privacy and prevents unauthorized information disclosure.
 *
 * **Use Cases:** Common scenarios for fetching individual contacts include:
 * displaying contact details in a CRM interface, loading contact information
 * before initiating a support conversation, verifying contact existence and
 * status in middleware, populating contact fields in forms for updates, and
 * retrieving contact preferences to personalize conversation experiences.
 *
 * **Performance:** Fetch operations are fast and efficient, typically
 * completing in milliseconds. However, for workflows that need to access
 * multiple contacts, consider using the list endpoint with appropriate filters
 * rather than making many individual fetch requests, as this reduces API calls
 * and improves overall performance.
 */

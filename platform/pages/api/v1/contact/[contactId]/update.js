// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { getMeta } from '@/lib/meta'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import contactFingerprintSchema from '@/schemas/contactFingerprint'
import dbStringSchema from '@/schemas/dbString'
import dbTextSchema from '@/schemas/dbText'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  fingerprint: contactFingerprintSchema,

  email: dbStringSchema.email({ tlds: false }),
  phone: dbStringSchema.phone(),

  nick: dbStringSchema,

  preferences: dbTextSchema,

  verifiedAt: schema.number().allow(null),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /contact/{contactId}/update:
 *   post:
 *     operationId: updateContact
 *     summary: Update contact
 *     tags:
 *       - Contact
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - type: object
 *                 properties:
 *                   fingerprint:
 *                     description: The fingerprint of the contact
 *                     type: string
 *                   email:
 *                     description: The email address of the contact
 *                     type: string
 *                   phone:
 *                     description: The phone number of the contact
 *                     type: string
 *                   nick:
 *                     description: The nickname of the contact
 *                     type: string
 *                   preferences:
 *                     description: The preferences of the contact
 *                     type: string
 *                   verifiedAt:
 *                     description: The timestamp (ms) when the contact was verified
 *                     type: number
 *     responses:
 *       200:
 *         description: The contact was updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the updated contact
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {
        name,
        description,

        fingerprint,

        email,
        phone,

        nick,

        preferences,

        verifiedAt,

        meta,
      } = body

      const contact = await prisma.contact.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'contactId')
      )

      if (!contact) {
        return notFound()
      }

      if (contact.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.contact.update({
        where: {
          id: contact.id,
        },

        data: {
          // basic information

          name,
          description,

          // resource linking

          // resource specific

          fingerprint,

          email,
          phone,

          nick,

          preferences,

          ...(verifiedAt
            ? {
                verifiedAt: new Date(verifiedAt),
              }
            : {
                verifiedAt: verifiedAt === null ? null : undefined,
              }),

          // meta and others

          meta: getMeta(meta, contact.meta),
        },
      })

      return ok({ id: contact.id })
    })
  )
)

/**
 * @manual Contacts
 *
 * ## Updating Contacts
 *
 * The update contact operation enables you to modify existing contact
 * information, allowing you to keep contact records current as users update
 * their details, change preferences, or as you gather additional information
 * through ongoing interactions. This endpoint supports partial updates,
 * meaning you only need to provide the fields you want to change.
 *
 * Contact updates are essential for maintaining accurate customer data over
 * time. As users interact with your system, you might collect additional
 * information, learn new preferences, or need to correct previously entered
 * data. The update operation provides a flexible mechanism for keeping contact
 * records synchronized with the current state of your customer relationships.
 *
 * When updating a contact, you can modify any of the editable fields including
 * name, description, email, phone number, nickname, and preferences. You can
 * also update the fingerprint, though this should be done carefully as it
 * affects contact identification and deduplication. Metadata updates support
 * partial modification, allowing you to add or modify specific metadata fields
 * without affecting other metadata properties.
 *
 * ```http
 * POST /api/v1/contact/{contactId}/update
 * Content-Type: application/json
 *
 * {
 *   "email": "newemail@example.com",
 *   "preferences": "language=es;timezone=America/Mexico_City"
 * }
 * ```
 *
 * To update multiple fields at once:
 *
 * ```http
 * POST /api/v1/contact/{contactId}/update
 * Content-Type: application/json
 *
 * {
 *   "name": "Jane Smith-Johnson",
 *   "email": "jane.smithjohnson@example.com",
 *   "phone": "+1234567890",
 *   "meta": {
 *     "segment": "premium",
 *     "lifetime_value": 15000
 *   }
 * }
 * ```
 *
 * The verification status (`verifiedAt`) can also be updated, which is useful
 * when converting an unverified contact to a verified one after identity
 * confirmation. Pass the current timestamp in milliseconds to mark a contact
 * as verified, or null to mark it as unverified.
 *
 * **Authorization:** Update operations verify ownership before allowing
 * modifications. Only the account that created a contact can update it,
 * ensuring data security and preventing unauthorized modifications. Cross-
 * account contact updates are strictly prohibited.
 *
 * **Metadata Handling:** The metadata update mechanism intelligently merges
 * new metadata with existing metadata rather than replacing it entirely. This
 * means you can update specific metadata fields without losing other metadata
 * properties, making incremental data enrichment workflows efficient and safe.
 *
 * **Best Practice:** When updating contact information based on user input,
 * always validate and sanitize the data before sending it to the API. This
 * prevents malformed data from entering your contact database and ensures data
 * quality remains high throughout your system.
 */

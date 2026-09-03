// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
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
 * /contact/create:
 *   post:
 *     operationId: createContact
 *     summary: Create a new contact
 *     description: |
 *       Create a new contact with the given parameters.
 *     tags:
 *       - Contact
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
 *         description: The contact was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created contact
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, session, body) {
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

      const { id } = await prisma.contact.create({
        data: {
          userId: session.user.id,

          // basic information

          name,
          description,

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

          meta,
        },

        select: {
          id: true,
        },
      })

      return ok({ id })
    })
  )
)

/**
 * @manual Contacts
 * @description Contacts represent end-users or customers who interact with your chatbots, enabling conversation tracking, contact management, and personalized user experiences.
 * @category Objects/Contacts
 * @tags contact, user-management, crm
 * @index 1
 *
 * Contacts are essential for managing the end-users and customers who engage
 * with your AI agents across various channels. Each contact represents a unique
 * individual and stores their identifying information, preferences, and
 * interaction history. The contact system enables you to provide personalized
 * experiences, track conversations over time, and maintain a comprehensive
 * customer relationship management (CRM) capability within your applications.
 *
 * Contacts can be either verified or unverified. Verified contacts are created
 * with a trusted fingerprint and have their identity confirmed, while
 * unverified contacts are automatically generated based on user interactions
 * and may be verified later. This dual approach allows you to capture all user
 * interactions while maintaining security and preventing duplicate entries.
 *
 * ## Creating Contacts
 *
 * Creating a contact is the first step in establishing a relationship with an
 * end-user. You can create contacts explicitly when users sign up, register,
 * or start a conversation, providing their identifying information such as
 * email, phone number, or a custom identifier.
 *
 * When creating a contact, you can specify various attributes including name,
 * description, email, phone, nickname, and custom preferences. You can also
 * provide a unique fingerprint to ensure the contact can be reliably identified
 * across different sessions and channels. The fingerprint serves as a stable
 * identifier that prevents duplicate contact creation.
 *
 * ```http
 * POST /api/v1/contact/create
 * Content-Type: application/json
 *
 * {
 *   "name": "John Doe",
 *   "description": "Premium customer",
 *   "fingerprint": "unique-fingerprint-123",
 *   "email": "john.doe@example.com",
 *   "phone": "+1234567890",
 *   "nick": "johnd",
 *   "preferences": "language=en;timezone=UTC"
 * }
 * ```
 *
 * The API will return the newly created contact ID, which you can use to
 * reference this contact in subsequent operations such as starting
 * conversations, updating preferences, or retrieving interaction history.
 *
 * **Important:** The `fingerprint` parameter is crucial for preventing
 * duplicate contacts. If you create a contact with the same fingerprint
 * multiple times, the system will return the existing contact rather than
 * creating a duplicate. This ensures data consistency and prevents fragmented
 * customer records.
 */

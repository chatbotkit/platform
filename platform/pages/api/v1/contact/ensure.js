// @ts-check
import {
  ensureTrustedContact,
  ensureUntrustedContact,
} from '@/lib/contact.create'
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
 * /contact/ensure:
 *   post:
 *     operationId: ensureContact
 *     summary: Ensure a contact exists or create a new one
 *     description: |
 *       Ensure a contact with the given parameters exists or create a new one.
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
 *                 required:
 *                   - fingerprint
 *     responses:
 *       200:
 *         description: The contact was ensured successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the ensured contact
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

        meta,
      } = body

      let contact

      if (fingerprint) {
        contact = await ensureTrustedContact(
          session.user,
          {
            name,
            description,

            email,
            phone,

            nick,

            preferences,

            meta,
          },
          fingerprint
        )
      } else {
        contact = await ensureUntrustedContact(session.user, {
          name,
          description,

          email,
          phone,

          nick,

          preferences,

          meta,
        })
      }

      return ok({ id: contact.id })
    })
  )
)

/**
 * @manual Contacts
 *
 * ## Ensuring Contact Existence
 *
 * The ensure contact operation provides an idempotent way to create or
 * retrieve contacts, making it ideal for scenarios where you're not sure
 * whether a contact already exists. This is particularly useful in
 * conversational interfaces where users may return for multiple sessions
 * without explicit account creation.
 *
 * When you call the ensure endpoint, the system intelligently handles two
 * distinct scenarios based on whether you provide a trusted fingerprint. If
 * you provide a fingerprint (a verified identifier from a trusted source), the
 * system creates or retrieves a verified contact. If no fingerprint is
 * provided, the system generates a fingerprint based on the contact's
 * attributes and creates or retrieves an unverified contact.
 *
 * This dual-mode operation enables flexible contact management strategies. For
 * authenticated users with verified identities (like those who signed in via
 * OAuth), you can pass a trusted fingerprint to create verified contacts. For
 * anonymous or guest users, you can omit the fingerprint and let the system
 * automatically generate one based on their provided information.
 *
 * ```http
 * POST /api/v1/contact/ensure
 * Content-Type: application/json
 *
 * {
 *   "fingerprint": "verified-user-fingerprint-abc123",
 *   "email": "jane.smith@example.com",
 *   "name": "Jane Smith"
 * }
 * ```
 *
 * For unverified contacts, simply omit the fingerprint parameter:
 *
 * ```http
 * POST /api/v1/contact/ensure
 * Content-Type: application/json
 *
 * {
 *   "email": "guest@example.com",
 *   "name": "Guest User"
 * }
 * ```
 *
 * The endpoint returns the contact ID regardless of whether a new contact was
 * created or an existing one was found. This idempotent behavior ensures your
 * application logic remains simple and doesn't need to handle "contact already
 * exists" errors.
 *
 * **Best Practice:** Use this endpoint in chat initialization flows where you
 * want to ensure a contact exists before starting a conversation, but you're
 * not certain whether this is a new or returning user. This pattern simplifies
 * your code and prevents duplicate contact creation.
 *
 * **Important:** Trusted and untrusted contacts are kept separate. A trusted
 * contact (created with a fingerprint) cannot become untrusted, and vice
 * versa. If you later want to verify an untrusted contact, you'll need to
 * create a new verified contact and migrate the conversation history.
 */

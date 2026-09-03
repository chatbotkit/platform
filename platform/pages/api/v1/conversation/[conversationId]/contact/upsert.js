// @ts-check
// @todo convert to edge
import prisma from '@/prisma/client'
import { MessageType } from '@/prisma/types'

import {
  ensureTrustedContact,
  ensureUntrustedContact,
} from '@/lib/contact.create'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, notModified, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import contactFingerprintSchema from '@/schemas/contactFingerprint'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  fingerprint: contactFingerprintSchema,

  email: schema.string().allow(null, '').email({ tlds: false }),
  phone: schema.string().allow(null, '').phone(),
  nick: schema.string().allow(null, ''),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /conversation/{conversationId}/contact/upsert:
 *   post:
 *     operationId: upsertConversationContact
 *     summary: Upsert contact
 *     tags:
 *       - Conversation Contact
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           description: The ID of the conversation
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
    withSchema(bodySchema, async function (req, session, body) {
      const {
        name,
        description,

        fingerprint,

        email,
        phone,
        nick,

        meta,
      } = body

      const conversation = await prisma.conversation.findUnique({
        where: {
          id: requiredUrlParam(req, 'conversationId'),
        },

        select: {
          id: true,

          userId: true,

          contactId: true,
        },
      })

      if (!conversation) {
        return notFound()
      }

      if (conversation.userId !== session.user.id) {
        return notAuthorized()
      }

      if (conversation.contactId) {
        return notModified()
      }

      let contact

      // @note the contactFingerprintSchema already ensures that the fingerprint
      // is valid for the current session audience

      if (fingerprint) {
        contact = await ensureTrustedContact(
          session.user,
          {
            name,
            description,

            email,
            phone,
            nick,

            meta,
          },
          fingerprint
        )
      } else {
        contact = await ensureUntrustedContact(
          { id: conversation.userId },
          {
            name,
            description,

            email,
            phone,
            nick,

            meta,
          }
        )
      }

      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },

        data: {
          contactId: contact.id,
        },
      })

      // @todo should this be optional

      await prisma.message.create({
        data: {
          conversationId: conversation.id,

          type: MessageType.context, // @todo is this the right message type?

          text: `The user provided their contact information:\n\nname: ${contact.name}`,
        },
      })

      return ok({ id: contact.id })
    })
  )
)

/**
 * @manual Conversation Contacts
 * @description Conversation contacts enable you to track and associate user information with conversations, providing context for interactions and enabling personalized experiences across multiple conversations.
 * @category Objects/Conversations
 * @tags conversation, contact, user-tracking, identification
 * @index 40
 *
 * Conversation contacts provide a powerful way to identify and track users across
 * multiple conversations, enabling you to build personalized experiences, maintain
 * user context, and analyze interaction patterns. By associating contact information
 * with conversations, you can recognize returning users, recall previous interactions,
 * and provide continuity across multiple sessions.
 *
 * Contacts serve as identity anchors that link conversations to specific users,
 * allowing you to build comprehensive user profiles, track engagement over time,
 * and provide contextually relevant responses based on historical interactions.
 * This is essential for creating sophisticated conversational experiences that feel
 * personal and continuous rather than isolated and repetitive.
 *
 * ## Creating or Updating Contacts
 *
 * The upsert operation allows you to create a new contact or update an existing
 * one within the context of a conversation. This operation is idempotent, meaning
 * you can safely call it multiple times with the same fingerprint without creating
 * duplicate contact records.
 *
 * To upsert a contact, send a POST request with the contact information:
 *
 * ```http
 * POST /api/v1/conversation/{conversationId}/contact/upsert
 * Content-Type: application/json
 *
 * {
 *   "name": "John Smith",
 *   "description": "Premium tier customer",
 *   "fingerprint": "user_device_12345",
 *   "email": "john.smith@example.com",
 *   "phone": "+1-555-0123",
 *   "nick": "JohnS"
 * }
 * ```
 *
 * The API will return the contact ID, which links the conversation to the
 * identified user:
 *
 * ```json
 * {
 *   "id": "contact_abc123"
 * }
 * ```
 *
 * ### Contact Fingerprinting
 *
 * The `fingerprint` field is a crucial identifier that enables contact
 * deduplication and user recognition across conversations. A fingerprint should
 * be a stable, unique identifier for the user, such as:
 *
 * - **Device ID**: A unique identifier for the user's device or browser
 * - **Session ID**: A persistent session identifier that survives page refreshes
 * - **User Account ID**: An internal user ID from your authentication system
 * - **Composite Key**: A combination of multiple stable attributes
 *
 * The fingerprint allows the system to recognize when the same user initiates
 * multiple conversations, enabling cross-conversation continuity and personalization.
 * Choose fingerprints carefully to balance user privacy with the need for persistent
 * identity tracking.
 *
 * ### Contact Information Fields
 *
 * Contacts support multiple types of identifying and descriptive information:
 *
 * **name**: A human-readable display name for the contact, used in conversation
 * context and reporting. This can be the user's real name or a pseudonym.
 *
 * **description**: Additional context about the contact, such as account tier,
 * preferences, or any relevant metadata that helps personalize interactions.
 *
 * **email**: The contact's email address, useful for follow-up communications,
 * account linking, and duplicate detection across different fingerprints.
 *
 * **phone**: The contact's phone number, enabling SMS notifications, phone-based
 * authentication, or additional identity verification.
 *
 * **nick**: A short nickname or handle for the contact, useful for casual
 * interactions or when full names are too formal.
 *
 * **meta**: Additional structured metadata in JSON format, allowing you to attach
 * custom attributes, preferences, or tracking data to the contact record.
 *
 * All fields except the fingerprint are optional, allowing you to collect as much
 * or as little information as appropriate for your use case while still benefiting
 * from contact tracking and deduplication.
 *
 * ## Contact Deduplication
 *
 * The upsert operation automatically handles contact deduplication using the
 * fingerprint. When you upsert a contact:
 *
 * - If no contact exists with the given fingerprint, a new contact is created
 * - If a contact with that fingerprint already exists, it is updated with the new
 *   information
 * - The existing contact's ID is returned, maintaining consistency across
 *   conversations
 *
 * This behavior ensures that the same user (identified by fingerprint) always maps
 * to a single contact record, even when they initiate conversations from different
 * devices or sessions, provided the fingerprint remains consistent.
 *
 * ## Context Enrichment
 *
 * When you upsert a contact in a conversation, the system automatically adds a
 * context message to the conversation history. This context message informs the
 * AI about the user's identity and can influence how the AI responds:
 *
 * ```
 * The user provided their contact information:
 *
 * name: John Smith
 * ```
 *
 * This context enrichment helps the AI provide more personalized responses by
 * being aware of the user's identity, even if it wasn't previously known. The AI
 * can use this information to tailor its tone, recall preferences, or reference
 * previous interactions linked to the same contact.
 *
 * ## Use Cases and Best Practices
 *
 * **User Identification**: Collect contact information during conversations to
 * identify users for follow-up, support tickets, or account linking.
 *
 * **Progressive Profiling**: Start with anonymous conversations and gradually
 * collect contact information as trust builds and users become more engaged.
 *
 * **Cross-Conversation Continuity**: Use consistent fingerprints to recognize
 * returning users and maintain context across multiple conversation sessions.
 *
 * **Personalization**: Leverage contact information to provide personalized
 * greetings, recommendations, and responses based on known user attributes.
 *
 * **Analytics and Reporting**: Track individual user engagement patterns,
 * conversation frequency, and interaction quality across time.
 *
 * **GDPR and Privacy Compliance**: Implement proper consent mechanisms before
 * collecting contact information, and provide users with the ability to access,
 * modify, or delete their contact data.
 *
 * **Fingerprint Strategy**: Use stable, privacy-respecting fingerprints that
 * balance user tracking needs with privacy concerns. Consider using salted hashes
 * of user identifiers rather than storing raw identifying information.
 *
 * **Important Notes:**
 *
 * - Contact information is scoped to your account; contacts cannot be shared
 *   across different accounts
 * - Fingerprints should be stable and unique to enable reliable deduplication
 * - Email and phone validation is performed but not verified; consider implementing
 *   verification workflows for critical use cases
 * - Contact information persists independently of conversations; deleting a
 *   conversation does not delete the associated contact
 * - Be mindful of data privacy regulations when collecting and storing user
 *   information
 */

/* eslint-disable import/no-anonymous-default-export */
// @ts-check
import prisma from '@/prisma/client'

import { canUseContact } from '@/lib/contact.access'
import { ensureTrustedContact } from '@/lib/contact.create'
import schema from '@/lib/joi.schema'
import {
  throwNotAuthenticated,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'

import metaSchema from '@/schemas/meta'

/**
 * @param {'use'} accessType
 * @returns {import('joi').Schema}
 */
export default function (accessType) {
  return schema
    .alternatives()
    .try(
      schema.string().allow(null, ''),
      schema.object({
        fingerprint: schema.string().allow(null, ''),
        name: schema.string().allow(null, ''),
        description: schema.string().allow(null, ''),
        email: schema.string().allow(null, ''),
        phone: schema.string().allow(null, ''),
        nick: schema.string().allow(null, ''),
        meta: metaSchema,
      })
    )
    .external(async function (value, helpers) {
      // @todo use types

      const { user, payload } = helpers?.prefs?.context?.session || {}

      if (!user) {
        return throwNotAuthenticated()
      }

      // @note if the contact id is provided in the session payload, use it
      // directly - this is a hard override because it means the session creator
      // has already validated the contact access

      if (payload?.contactId) {
        const contact = await prisma.contact.findUniqueByIdentifier(
          user,
          payload.contactId
        )

        if (!contact) {
          throw throwNotFound(`Contact not found`)
        }

        if (accessType === 'use' && !canUseContact(user.id, contact)) {
          return throwNotAuthorized(
            'You are not authorized to use this contact'
          )
        }

        return contact
      }

      if (typeof value === 'object' && value !== null) {
        const { fingerprint, ...data } = value

        if (!fingerprint) {
          throw new Error('Fingerprint is required when creating a contact')
        }

        const contact = await ensureTrustedContact(user, data, fingerprint)

        if (accessType === 'use' && !canUseContact(user.id, contact)) {
          return throwNotAuthorized(
            'You are not authorized to use this contact'
          )
        }

        return contact
      } else {
        if (value) {
          value = value.trim()
        }

        if (!value) {
          if (value === undefined) {
            return
          } else {
            return null
          }
        }

        const contact = await prisma.contact.findUniqueByIdentifier(user, value)

        if (!contact) {
          throw throwNotFound(`Contact not found`)
        }

        if (accessType === 'use' && !canUseContact(user.id, contact)) {
          return throwNotAuthorized(
            'You are not authorized to use this contact'
          )
        }

        return contact
      }
    }, 'contactId')
}

/**
 * @manual Contact Association
 * @description Learn how to associate conversations and interactions with contacts using either existing contact IDs or automatic contact creation via fingerprints.
 * @category Objects/Contacts
 * @tags contact, contactId, fingerprint, user-tracking
 * @index 15
 *
 * Contact association enables you to track interactions with specific users
 * across multiple conversations, tasks, and API calls. The platform supports
 * two primary patterns for contact association: referencing existing contacts
 * by ID, or automatic contact creation and retrieval using fingerprint-based
 * identification.
 *
 * ## Using Contact IDs
 *
 * When you already have a contact record in the platform, you can reference it
 * directly using its unique identifier. This approach requires the contact to
 * exist before making the API call:
 *
 * ```http
 * POST /api/v1/conversation/complete
 * Content-Type: application/json
 *
 * {
 *   "botId": "bot_abc123",
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "Hello, I need help with my account"
 *     }
 *   ],
 *   "contactId": "cont_xyz789"
 * }
 * ```
 *
 * If the specified contact ID does not exist or you don't have access to it, the
 * API will return an error. This pattern is ideal when you're managing contacts
 * separately and have already created them through the contact management APIs.
 *
 * ## Using Contact Fingerprints (Automatic Creation)
 *
 * The fingerprint-based approach provides a powerful way to ensure contacts
 * exist without requiring separate API calls. Instead of providing a contact ID,
 * you provide a contact object with a unique fingerprint that identifies the
 * user:
 *
 * ```http
 * POST /api/v1/conversation/complete
 * Content-Type: application/json
 *
 * {
 *   "botId": "bot_abc123",
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "Hello, I need help with my account"
 *     }
 *   ],
 *   "contactId": {
 *     "fingerprint": "a3c5f8d9e1b2c4a6f7e8d9c0b1a2c3d4",
 *     "name": "John Doe",
 *     "email": "john.doe@example.com",
 *     "meta": {
 *       "userId": "internal-user-12345"
 *     }
 *   }
 * }
 * ```
 *
 * **How Fingerprint-Based Contact Creation Works:**
 *
 * 1. **Lookup**: The platform searches for an existing contact with the provided
 *    fingerprint in your account.
 *
 * 2. **Return Existing**: If a contact with that fingerprint exists, it's
 *    retrieved and used for the interaction. The contact's existing data is
 *    preserved.
 *
 * 3. **Create New**: If no contact exists with that fingerprint, a new contact
 *    is automatically created with the provided information and associated with
 *    the interaction.
 *
 * This approach eliminates the need for separate "check if contact exists, then
 * create if needed" logic in your application code. You can make a single API
 * call and trust that the contact will be handled appropriately.
 *
 * ## Creating Effective Fingerprints
 *
 * The fingerprint is a unique identifier that represents the user across all
 * interactions. The recommended approach is to use UUID v5 (namespace-based)
 * hashing to create deterministic, collision-resistant fingerprints from user
 * identifiers.
 *
 * **Email-Based Fingerprints (Recommended for Known Users):**
 *
 * ```javascript
 * import { createHash } from 'crypto'
 *
 * function createEmailFingerprint(email) {
 *   // Normalize the email
 *   const normalized = email.toLowerCase().trim()
 *
 *   // Create a deterministic UUID-like fingerprint
 *   const hash = createHash('sha256').update(`email:${normalized}`).digest('hex')
 *
 *   return hash.substring(0, 32)
 * }
 *
 * const fingerprint = createEmailFingerprint('john.doe@example.com')
 * // Example: "a3c5f8d9e1b2c4a6f7e8d9c0b1a2c3d4"
 * ```
 *
 * **Important**: Always normalize email addresses by converting to lowercase and
 * trimming whitespace before hashing to avoid creating duplicate contacts for
 * the same user.
 *
 * **Internal User ID Fingerprints (Recommended for Integrated Systems):**
 *
 * ```javascript
 * import { createHash } from 'crypto'
 *
 * function createUserIdFingerprint(userId) {
 *   const hash = createHash('sha256').update(`user:${userId}`).digest('hex')
 *
 *   return hash.substring(0, 32)
 * }
 *
 * const fingerprint = createUserIdFingerprint('12345')
 * // Example: "b7d8e9f0a1c2d3e4f5a6b7c8d9e0f1a2"
 * ```
 *
 * This approach is ideal when integrating with existing systems that have their
 * own user identification schemes. It ensures consistency between your system
 * and ChatBotKit contacts while keeping the actual user ID private.
 *
 * **Session-Based Fingerprints (for Anonymous Users):**
 *
 * ```javascript
 * import { createHash } from 'crypto'
 *
 * function createSessionFingerprint(sessionId) {
 *   const hash = createHash('sha256').update(`session:${sessionId}`).digest('hex')
 *
 *   return hash.substring(0, 32)
 * }
 *
 * const fingerprint = createSessionFingerprint('abc123xyz789')
 * // Example: "c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3"
 * ```
 *
 * Useful for tracking anonymous users across a session before they're identified.
 * Once the user provides identifying information, you can create a new contact
 * with a more stable fingerprint based on their email or user ID.
 *
 * **Composite Fingerprints (for Multi-Tenant Systems):**
 *
 * ```javascript
 * import { createHash } from 'crypto'
 *
 * function createTenantUserFingerprint(tenantId, userId) {
 *   const hash = createHash('sha256')
 *     .update(`tenant:${tenantId}:user:${userId}`)
 *     .digest('hex')
 *
 *   return hash.substring(0, 32)
 * }
 *
 * const fingerprint = createTenantUserFingerprint('acme', '98765')
 * // Example: "d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4"
 * ```
 *
 * This pattern ensures contacts are unique within tenant boundaries in
 * multi-tenant applications while maintaining deterministic fingerprint
 * generation.
 *
 * **Why UUID-Based Hashing?**
 *
 * Using cryptographic hashing to create fingerprints offers several advantages:
 *
 * - **Deterministic**: The same input always produces the same fingerprint
 * - **Collision-resistant**: Extremely unlikely to generate duplicate fingerprints
 * - **Privacy-friendly**: The original identifier cannot be reverse-engineered
 * - **Consistent length**: All fingerprints have the same length regardless of input
 * - **Error-proof**: No string concatenation issues or special character handling
 *
 * ## Benefits of Fingerprint-Based Contact Management
 *
 * **Eliminates Pre-Flight Requests:**
 *
 * Without fingerprints, you'd need to make separate API calls to check if a
 * contact exists and create it if needed. With fingerprints, this happens
 * automatically in a single request:
 *
 * ```javascript
 * // Without fingerprints (multiple API calls):
 * let contact = await findContact(userEmail)
 * if (!contact) {
 *   contact = await createContact(userEmail, userName)
 * }
 * await completeConversation(botId, messages, contact.id)
 *
 * // With fingerprints (single API call):
 * await completeConversation(botId, messages, {
 *   fingerprint: createEmailFingerprint(userEmail),
 *   name: userName,
 *   email: userEmail
 * })
 * ```
 *
 * **Improves Performance and Reliability:**
 *
 * Reducing API calls means faster response times and fewer opportunities for
 * network failures or race conditions. Your application becomes more resilient
 * and responsive.
 *
 * **Simplifies Integration Code:**
 *
 * You don't need complex contact management logic in your application. The
 * platform handles contact lifecycle management automatically based on
 * fingerprints.
 *
 * **Prevents Duplicate Contacts:**
 *
 * As long as you use consistent, normalized fingerprints, the platform ensures
 * you won't create duplicate contacts for the same user, even if making
 * concurrent requests.
 *
 * ## Common Use Cases
 *
 * **Customer Support Integration:**
 *
 * Track all support interactions for a specific customer by their email:
 *
 * ```http
 * POST /api/v1/conversation/complete
 * Content-Type: application/json
 *
 * {
 *   "botId": "support_bot_123",
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "I haven't received my refund yet"
 *     }
 *   ],
 *   "contactId": {
 *     "fingerprint": "e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9",
 *     "name": "Jane Smith",
 *     "email": "customer@example.com",
 *     "meta": {
 *       "customerId": "CUST-789",
 *       "tier": "gold"
 *     }
 *   }
 * }
 * ```
 *
 * **SaaS Application Integration:**
 *
 * Associate conversations with users from your application:
 *
 * ```http
 * POST /api/v1/conversation/complete
 * Content-Type: application/json
 *
 * {
 *   "botId": "assistant_bot_456",
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "How do I export my data?"
 *     }
 *   ],
 *   "contactId": {
 *     "fingerprint": "f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0",
 *     "name": "Alex Johnson",
 *     "email": "alex@company.com",
 *     "meta": {
 *       "accountId": "acc_xyz",
 *       "role": "admin"
 *     }
 *   }
 * }
 * ```
 *
 * **Task Execution with User Context:**
 *
 * When running background tasks, maintain user context:
 *
 * ```http
 * POST /api/v1/task/complete
 * Content-Type: application/json
 *
 * {
 *   "instruction": "Generate a weekly report summary",
 *   "contactId": {
 *     "fingerprint": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
 *     "name": "Report System",
 *     "meta": {
 *       "reportType": "weekly",
 *       "department": "sales"
 *     }
 *   }
 * }
 * ```
 *
 * ## Contact Data Fields
 *
 * When providing a contact object with a fingerprint, you can include:
 *
 * - **fingerprint** (required): Unique identifier for the contact
 * - **name** (optional): Display name for the contact
 * - **description** (optional): Additional description or notes
 * - **email** (optional): Email address
 * - **phone** (optional): Phone number
 * - **nick** (optional): Nickname or short identifier
 * - **meta** (optional): Custom metadata object for storing additional information
 *
 * All fields except `fingerprint` are optional. On subsequent requests with the
 * same fingerprint, the existing contact data is used, and the provided fields
 * are not updated. If you need to update contact information, use the dedicated
 * contact update API endpoints.
 *
 * ## Important Considerations
 *
 * **Fingerprint Uniqueness:**
 *
 * Fingerprints must be unique within your account. Using the same fingerprint
 * for different users will result in interactions being associated with the same
 * contact record.
 *
 * **Fingerprint Stability:**
 *
 * Choose fingerprints based on stable identifiers. Avoid using session tokens or
 * temporary IDs that change frequently, as this will create many separate
 * contact records instead of consolidating interactions under a single contact.
 *
 * **Normalization:**
 *
 * Always normalize your fingerprint inputs to ensure consistency:
 *
 * ```javascript
 * import { createHash } from 'crypto'
 *
 * // Good: Normalized and hashed email fingerprint
 * const normalized = email.toLowerCase().trim()
 * const fingerprint = createHash('sha256')
 *   .update(`email:${normalized}`)
 *   .digest('hex')
 *   .substring(0, 32)
 *
 * // Bad: Non-normalized email (creates different fingerprints for same user)
 * const fingerprint = createHash('sha256')
 *   .update(`email:${email}`) // May have mixed case or whitespace
 *   .digest('hex')
 *   .substring(0, 32)
 * ```
 *
 * **Privacy Considerations:**
 *
 * Be mindful of including personally identifiable information (PII) in
 * fingerprints and contact data. Ensure compliance with privacy regulations like
 * GDPR and CCPA when storing user information.
 *
 * **Concurrent Requests:**
 *
 * The platform handles concurrent requests with the same fingerprint gracefully.
 * If multiple requests attempt to create a contact with the same fingerprint
 * simultaneously, only one contact will be created, and all requests will use
 * that contact.
 *
 * ## Endpoints Supporting Contact Association
 *
 * The `contactId` parameter (supporting both ID and fingerprint patterns) is
 * available in various API endpoints:
 *
 * - **Conversation APIs**: `/api/v1/conversation/complete`, `/api/v1/conversation/{conversationId}/complete`
 * - **Task APIs**: Task creation and execution endpoints
 * - **Other interaction endpoints**: Any endpoint that supports user context tracking
 *
 * The behavior is consistent across all endpoints: provide either a string ID for
 * existing contacts, or a contact object with fingerprint for automatic
 * creation.
 *
 * ## Best Practices
 *
 * 1. **Use fingerprints for new integrations**: Unless you have a specific need
 *    to manage contacts separately, use the fingerprint pattern for simpler code
 *    and better performance.
 *
 * 2. **Choose stable identifiers**: Base fingerprints on user IDs, email
 *    addresses, or other identifiers that remain constant across sessions.
 *
 * 3. **Normalize all inputs**: Always normalize emails, trim whitespace, and
 *    handle case sensitivity consistently.
 *
 * 4. **Include useful metadata**: Use the `meta` field to store additional
 *    context that helps with analytics and reporting.
 *
 * 5. **Document your fingerprint format**: Establish and document a consistent
 *    fingerprint format across your application to avoid confusion and errors.
 *
 * 6. **Test with real data**: Ensure your fingerprint generation logic works
 *    correctly with real user data, including edge cases like special characters
 *    in emails.
 */

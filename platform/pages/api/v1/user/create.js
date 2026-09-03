// @ts-check
import prisma from '@/prisma/client'
import { UserLimits } from '@/prisma/zod'

import { cuid } from '@/lib/cuid'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { notAuthorized, ok } from '@/lib/response'
import { getChildUserIdentityEmail } from '@/lib/user.identity'
import { revealUserPlan } from '@/lib/user.plan'

import aliasSchema from '@/schemas/alias'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

import { v1 as uuidv1 } from 'uuid'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  image: schema.string().allow(null, ''),

  email: schema
    .string()
    .allow(null, '')
    .email({
      allowFullyQualified: false,
      tlds: false,
    })
    .external((value) => {
      // @note return null when string is empty to avoid having unique constraint on empty string
      {
        if (value === '') {
          return null
        }
      }

      return value
    }, 'email'),

  limits: schema.object().zodSchema(UserLimits).allow(null),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /user/create:
 *   post:
 *     operationId: createUser
 *     summary: Create user
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - type: object
 *                 properties:
 *                   image:
 *                     description: The image of the user
 *                     type: string
 *                   email:
 *                     description: The email of the user
 *                     type: string
 *                   limits:
 *                     $ref: '#/components/schemas/Limits'
 *     responses:
 *       200:
 *         description: The user was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created user
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['database/user'],
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        alias,

        name,
        description,

        image,

        email,

        limits,

        meta,
      } = body

      const { effectiveUser } = await revealUserPlan(session.user)

      if (session.user.id !== effectiveUser.id) {
        return notAuthorized('You are not allowed to create a user.')
      }

      const now = new Date()
      const userId = cuid()

      const { id } = await prisma.user.create({
        data: {
          id: userId,
          parentId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource specific

          // @note this required database identity is deliberately non-routable.
          // The customer's real address is stored separately below.
          email: getChildUserIdentityEmail(userId),

          billingCustomerId: `inherit@${uuidv1()}`, // @note the reason we do this is because billingCustomerId is unique
          billingSubscriptionId: 'inherit',
          billingSubscriptionStatus: `inherit`,
          billingSubscriptionStartedAt: now,
          billingSubscriptionTrialedAt: now,

          image,

          parentContextName: name,
          parentContextEmail: email,

          limits,

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
 * @manual Users
 * @description The User API manages isolated child Users created and managed by a parent User, each with its own configuration, resources, and restrictions.
 * @category User
 * @tags users, accounts, multi-tenant
 * @index 1
 *
 * A User is an isolated platform principal and account. The User API creates
 * child Users managed by a parent User. Each child User has isolated
 * resources, including bots, datasets, conversations, integrations, and
 * settings. This isolation supports multi-tenant products built on top of the
 * ChatBotKit platform.
 *
 * ## Creating Users
 *
 * To create a new child User, you need to send a POST request
 * to the user creation endpoint. This operation can only be performed
 * by the parent User. The created User will be linked to the caller as its
 * parent User, inheriting billing and subscription settings while
 * maintaining operational independence.
 *
 * When creating a user, you can configure various properties including
 * the user's display name, description, profile image, contact email, and
 * resource limits. The contact email is particularly important as it allows
 * you to associate customer contact information with the user for
 * communication and support purposes.
 *
 * ```http
 * POST /api/v1/user/create
 * Content-Type: application/json
 * Authorization: Bearer YOUR_API_TOKEN
 *
 * {
 *   "name": "Acme Corporation",
 *   "description": "Enterprise customer account",
 *   "email": "contact@acme.example.com"
 * }
 * ```
 *
 * The API returns the ID of the newly created user, which you'll use
 * for all subsequent operations related to this user. Store this ID
 * securely as it's required for managing the user's resources and
 * performing operations on their behalf using the `X-RunAs-UserId` header.
 *
 * **Important:** Child Users share billing and subscription limits with their
 * parent User. Ensure the parent User has sufficient capacity for all child
 * Users and their resource usage. Resource limits can be customized per User
 * to control individual usage caps.
 */

/**
 * @manual Resource Limits
 * @description Resource limits control usage quotas and constraints for accounts, defining maximum allocations for various platform resources and operations.
 * @category User
 * @tags limits, quotas, resources, usage
 * @index 10
 *
 * Resource limits provide fine-grained control over account usage by setting
 * maximum values for various platform resources and operations. These limits
 * help manage resource allocation, prevent abuse, and implement tiered service
 * offerings for different customer segments.
 *
 * ## Understanding the Limits Object
 *
 * The limits object is a flexible structure that allows you to control various
 * aspects of account resource usage. All limit values are optional, and when not
 * specified, accounts inherit default limits from their plan or parent user.
 *
 * The limits object has the following structure:
 *
 * ```javascript
 * {
 *   // API token limits
 *   tokens: 100,  // Maximum number of API tokens
 *
 *   // Conversation and messaging limits
 *   conversations: 1000,  // Maximum concurrent conversations
 *   messages: 50000,      // Maximum messages per month
 *
 *   // Database resource limits
 *   database: {
 *     datasets: 50,    // Maximum number of datasets
 *     records: 10000,  // Maximum records across all datasets
 *     skillsets: 20,   // Maximum number of skillsets
 *     abilities: 100,  // Maximum abilities across all skillsets
 *     files: 500       // Maximum files across all datasets
 *   },
 *
 *   // File upload limits
 *   file: {
 *     maxFileSize: 10485760  // Maximum file size in bytes (10MB)
 *   },
 *
 *   // Attachment limits
 *   attachment: {
 *     maxFileSize: 5242880  // Maximum attachment size in bytes (5MB)
 *   }
 * }
 * ```
 *
 * ## Setting Limits for Users
 *
 * When creating or updating users, you can optionally
 * specify a limits object to control their resource usage. If no limits are
 * provided, the user inherits the default limits from the parent user.
 *
 * **Important:** All limit values must be non-negative integers. Set a value to
 * 0 to completely restrict access to that resource type. Omit a field to use
 * default limits.
 *
 * ## Common Use Cases
 *
 * **Tiered Service Plans:** Define different limit profiles for free, basic,
 * and premium tiers, controlling access to resources based on subscription level.
 *
 * **Enterprise Quotas:** Allocate specific resource quotas to enterprise customers
 * based on contractual agreements and usage requirements.
 *
 * **Resource Isolation:** Prevent a single user from consuming excessive
 * resources that could impact other accounts on the platform.
 *
 * **Gradual Access:** Start users with conservative limits and expand
 * their quotas as they demonstrate responsible usage patterns.
 *
 * **Note:** Limits are enforced at the API level. When a limit is reached, API
 * operations that would exceed the limit will return an error. Monitor usage
 * through analytics to proactively manage limits before users encounter restrictions.
 */

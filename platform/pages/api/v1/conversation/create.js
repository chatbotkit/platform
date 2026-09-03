// @ts-check
import { ensureTrustedContact } from '@/lib/contact.create'
import { createConversation } from '@/lib/conversation.create'
import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok, respondFromError } from '@/lib/response'

import botConfigSchema from '@/schemas/botConfig'
import botIdSchema from '@/schemas/botId'
import contactIdSchema from '@/schemas/contactId'
import descriptionSchema from '@/schemas/description'
import expiresAtSchema from '@/schemas/expiresAt'
import messagesSchema from '@/schemas/messages'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import spaceIdSchema from '@/schemas/spaceId'
import taskIdSchema from '@/schemas/taskId'

export const bodySchema = schema
  .object({
    name: nameSchema,
    description: descriptionSchema,

    contactId: contactIdSchema('use'),

    contact: schema.object({
      fingerprint: schema.string().allow(null, ''),
      name: schema.string().allow(null, ''),
      description: schema.string().allow(null, ''),
      email: schema.string().allow(null, ''),
      phone: schema.string().allow(null, ''),
      nick: schema.string().allow(null, ''),
      meta: metaSchema,
    }),

    taskId: taskIdSchema('use'),

    spaceId: spaceIdSchema('use'),

    botId: botIdSchema('use'),

    expiresAt: expiresAtSchema,

    meta: metaSchema,

    messages: messagesSchema,
  })
  .concat(botConfigSchema)

/**
 * @swagger
 *
 * /conversation/create:
 *   post:
 *     operationId: createConversation
 *     summary: Create a new conversation
 *     description: |
 *       Create a new conversation with the given parameters and optional
 *       messages. The conversation will be initialized with the the backstory,
 *       model, dataset, skillset and other configuration options of the bot.
 *       Alternatively the conversation can be initialized directly with the
 *       backstory, model, dataset, skillset and other configuration options.
 *
 *       An array of messages can be included in the request body to add to the
 *       conversation.
 *     tags:
 *       - Conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BotRefOrConfig'
 *               - type: object
 *                 properties:
 *                   contactId:
 *                     description: The contact id assigned to this conversation
 *                     type: string
 *                   taskId:
 *                     description: The task id assigned to this conversation
 *                     type: string
 *                   spaceId:
 *                     description: The space id assigned to this conversation
 *                     type: string
 *                   messages:
 *                     description: An array of messages to be added to the conversation
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         type:
 *                           $ref: '#/components/schemas/MessageType'
 *                         text:
 *                           description: The text of the message
 *                           type: string
 *                       required:
 *                         - type
 *                         - text
 *     responses:
 *       200:
 *         description: The conversation was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the created conversation
 *                   type: string
 *                 messages:
 *                   description: An array of messages included in the conversation
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         $ref: '#/components/schemas/MessageType'
 *                       text:
 *                         description: The text of the message
 *                         type: string
 *                     required:
 *                       - type
 *                       - text
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['rate/conversation', 'conversation', 'rate/message', 'message'],
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        name,
        description,

        contactId: contactInstance,

        contact: contactData,

        taskId: task,

        spaceId: space,

        botId: bot,

        backstory,

        model,

        datasetId: dataset,
        skillsetId: skillset,

        privacy,
        moderation,

        expiresAt,

        meta,

        messages,
      } = body

      // @note null -> no expiry; epoch ms -> Date; undefined -> default (none)
      const normalizedExpiresAt =
        expiresAt === undefined
          ? undefined
          : expiresAt == null
            ? null
            : new Date(expiresAt)

      let contact

      {
        if (contactInstance) {
          contact = contactInstance
        }

        if (contactData) {
          contact = await ensureTrustedContact(
            session.user,
            contactData,
            contactData.fingerprint
          )
        }
      }

      try {
        const { id, messages: msgs } = await createConversation(
          session.user.id,
          {
            // basic information

            name,
            description,

            // resource linking

            contactId: contact?.id,

            taskId: task?.id,

            spaceId: space?.id,

            botId: bot?.id,

            datasetId: dataset?.id || dataset,

            skillsetId: skillset?.id || skillset,

            // resource specific

            backstory,

            model,

            privacy,
            moderation,

            expiresAt: normalizedExpiresAt,

            // meta and others

            meta,

            // messages

            messages,
          }
        )

        debug(`returning to client`, { id })

        return ok({ id, messages: msgs })
      } catch (e) {
        debug(`responding with error`, { e })

        await captureError(e)

        return respondFromError(e)
      }
    })
  )
)

/**
 * @manual Conversations
 * @description Conversations are interactive sessions where messages are exchanged between users and AI bots, enabling rich dialogue experiences with context awareness, memory, and intelligent responses.
 * @category Objects/Conversations
 * @tags conversation, chat, messaging
 * @index 1
 *
 * Conversations are the foundation of interactive AI experiences in ChatBotKit,
 * providing a structured way to manage ongoing dialogues between users and AI
 * bots. Each conversation maintains its own context, history, and state, allowing
 * for natural, context-aware interactions that can span multiple messages and
 * sessions.
 *
 * A conversation serves as a container for messages, maintaining the dialogue
 * history and configuration that determines how the AI responds. Conversations
 * can be associated with bots, contacts, tasks, and spaces, providing flexible
 * organization and management capabilities for different use cases.
 *
 * ## Creating Conversations
 *
 * Creating a conversation initializes a new interactive session with specific
 * configuration options that control the AI's behavior. You can create a
 * conversation by referencing an existing bot (which provides the backstory,
 * model, and other settings) or by providing the configuration directly in the
 * request.
 *
 * To create a conversation, send a POST request to the conversation creation
 * endpoint with your desired configuration:
 *
 * ```http
 * POST /api/v1/conversation/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Session",
 *   "description": "Support conversation for user inquiry",
 *   "botId": "bot_abc123",
 *   "contactId": "contact_xyz789"
 * }
 * ```
 *
 * When creating a conversation, you can specify several key parameters:
 *
 * - **name**: A descriptive name for the conversation (optional)
 * - **description**: Additional context about the conversation's purpose (optional)
 * - **botId**: Reference to an existing bot that provides configuration (optional)
 * - **contactId**: Link to a contact record for tracking user interactions (optional)
 * - **taskId**: Associate the conversation with a specific task (optional)
 * - **spaceId**: Organize the conversation within a space (optional)
 * - **messages**: Include initial messages to start the conversation (optional)
 *
 * ### Configuration Options
 *
 * If you don't reference a bot, you can provide configuration directly:
 *
 * - **backstory**: Instructions that define the AI's personality and behavior
 * - **model**: The language model to use (e.g., "glm-5.2", "claude-4.8-opus")
 * - **datasetId**: Reference to a dataset for knowledge retrieval
 * - **skillsetId**: Reference to a skillset for extended capabilities
 * - **privacy**: Enable privacy mode to prevent data retention
 * - **moderation**: Enable content moderation for safety
 *
 * ### Including Initial Messages
 *
 * You can initialize a conversation with messages by including a messages array:
 *
 * ```http
 * POST /api/v1/conversation/create
 * Content-Type: application/json
 *
 * {
 *   "botId": "bot_abc123",
 *   "messages": [
 *     {
 *       "type": "user",
 *       "text": "Hello, I need help with my order"
 *     }
 *   ]
 * }
 * ```
 *
 * The API will return the created conversation ID and any processed messages,
 * allowing you to immediately continue the interaction.
 *
 * **Important Notes:**
 *
 * - Conversations inherit configuration from their associated bot if a botId is
 *   provided, but you can override specific settings by providing them directly
 * - Each conversation maintains its own message history and context
 * - Conversations can be organized using contacts, tasks, and spaces for
 *   different tracking and filtering needs
 * - Privacy mode prevents message content from being stored, useful for
 *   sensitive conversations
 */

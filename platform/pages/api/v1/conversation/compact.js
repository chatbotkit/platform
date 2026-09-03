// @ts-check
import '@/lib/scope.server'

import { isTrustedSession } from '@/lib/audience.helpers'
import { setContextNamespace } from '@/lib/context.store'
import { getStatelessConversationEngine } from '@/lib/conversation.engine'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { getSafeNamespace } from '@/lib/namespace.safe'
import { ok } from '@/lib/response'

import backstorySchema from '@/schemas/backstory'
import extensionsSchema from '@/schemas/inlineExtensions'
import languageModelSchema from '@/schemas/languageModel'
import messagesSchema from '@/schemas/messages'
import namespaceSchema from '@/schemas/namespace'

export const bodySchema = schema.object({
  botId: schema.string().allow(null, ''), // @note we do not use botId schema because we perform the validation inside the engine

  backstory: backstorySchema,

  model: languageModelSchema,

  datasetId: schema.string().allow(null, ''), // @note we do not use datasetId schema because we perform the validation inside the engine
  skillsetId: schema.string().allow(null, ''), // @note we do not use skillsetId schema because we perform the validation inside the engine

  privacy: schema.boolean(),
  moderation: schema.boolean(),

  // ---

  messages: messagesSchema.min(1).required(),

  // ---

  extensions: extensionsSchema,

  // ----------------
  // unstable options
  // ----------------

  // namespace

  namespace: namespaceSchema,

  // debugging

  debug: schema.boolean().default(false), // @todo add custom schema to only allow debug to be used under certain audiences
})

/**
 * @param {import('@/lib/session.get').Session} session
 * @param {*} body
 * @returns {Promise<{ text: string, usage: { token: number } }>}
 * @todo add proper types for the body
 */
export async function compact(session, body) {
  const {
    botId,

    backstory,

    model,

    datasetId,
    skillsetId,

    privacy,
    moderation,

    // ---

    messages,

    // ---

    extensions,

    // ----------------
    // unstable options
    // ----------------

    // namespace

    namespace: _namespace,

    // debugging

    debug: debugFlag,
  } = body

  if (_namespace) {
    const namespace = getSafeNamespace(session.user, _namespace)

    if (namespace) {
      setContextNamespace(namespace)
    }
  }

  const isTrusted = isTrustedSession(session)

  const engine = await getStatelessConversationEngine({
    backstory,
    model,

    privacy,
    moderation,

    botId,
    datasetId,
    skillsetId,

    messages,

    options: {
      sessionId: session.id,
      userId: session.user.id,

      backstoryExtra: isTrusted ? extensions?.backstory : undefined,

      features: [
        ...(session.options?.engine?.features || []),

        ...(isTrusted ? extensions?.features || [] : []),
      ],

      inlineDatasets:
        isTrusted && extensions?.datasets?.length
          ? extensions.datasets
          : undefined,

      inlineSkillsets:
        isTrusted && extensions?.skillsets?.length
          ? extensions.skillsets
          : undefined,

      ...(isTrusted ? { debug: debugFlag } : {}),

      usageMeta: {
        // @note additional meta can be added here
      },
    },
  })

  try {
    const { message, usage } = await engine.definitelyCompact()

    return {
      text: message?.text ?? '',
      usage: { token: usage.token },
    }
  } finally {
    await engine.dispose()
  }
}

/**
 * @swagger
 *
 * /conversation/compact:
 *   post:
 *     operationId: compactConversationStateless
 *     summary: Compact an array of messages into a single summary
 *     tags:
 *       - Conversation
 *     parameters:
 *       - $ref: '#/components/parameters/TimezoneHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/BotRefOrConfig'
 *               - type: object
 *                 properties:
 *                   messages:
 *                     description: An array of messages to be compacted
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Message'
 *                 required:
 *                   - messages
 *               - type: object
 *                 properties:
 *                   extensions:
 *                     $ref: '#/components/schemas/ExtensionsDefinition'
 *     responses:
 *       200:
 *         description: The messages were compacted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 text:
 *                   description: The compacted text of the messages, or an empty string if there was nothing to compact
 *                   type: string
 *                 usage:
 *                   $ref: '#/components/schemas/Usage'
 *               required:
 *                 - text
 *                 - usage
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['rate/message', 'token'],
    withSchema(bodySchema, async function (_req, session, body) {
      const { text, usage } = await compact(session, body)

      return ok({ text, usage })
    })
  )
)

/**
 * @manual Conversation Flow
 * @description Compacting an arbitrary array of messages into a single summary without persisting a conversation.
 * @category Objects/Conversations
 * @tags conversation, compact, stateless, summary
 * @index 81
 *
 * ## Stateless Message Compaction
 *
 * The stateless compact endpoint summarizes an arbitrary array of messages into
 * a single concise summary without creating or referencing a persistent
 * conversation. This is the counterpart to the conversation-scoped compact
 * endpoint and is ideal when you manage conversation state externally and want
 * to reduce a growing message history into a compact checkpoint you can reuse.
 *
 * Unlike `/conversation/{conversationId}/compact`, this endpoint does not read
 * from or write to the platform. You provide the messages directly along with
 * the same bot configuration accepted by the stateless complete endpoint, and
 * the summary is returned to you to store and manage as you see fit.
 *
 * To compact an array of messages:
 *
 * ```http
 * POST /api/v1/conversation/compact
 * Content-Type: application/json
 *
 * {
 *   "messages": [
 *     { "type": "user", "text": "I need help planning a trip to Japan" },
 *     { "type": "bot", "text": "Happy to help! When are you planning to go?" },
 *     { "type": "user", "text": "Sometime in April, for the cherry blossoms" }
 *   ]
 * }
 * ```
 *
 * The `messages` array must contain at least one message. Each message follows
 * the same structure used elsewhere in the API, with a `type` (user, bot,
 * context, activity) and `text` content.
 *
 * ### Bot Configuration
 *
 * The endpoint accepts the same bot configuration options as the stateless
 * complete endpoint, allowing you to associate the compaction with an existing
 * bot or provide an inline configuration:
 *
 * - **botId**: ID of an existing bot to use
 * - **backstory**: Custom instructions for the AI
 * - **model**: Specific AI model to use
 * - **datasetId** / **skillsetId**: Knowledge base and abilities
 * - **privacy** / **moderation**: Privacy and moderation toggles
 * - **extensions**: Inline datasets, skillsets, backstory and features for
 *   trusted sessions
 *
 * These options primarily influence how usage is attributed and how the engine
 * is configured; the resulting summary is produced from the provided messages.
 *
 * ### Response
 *
 * A successful response returns the compacted text along with the token usage
 * incurred. If there was nothing to compact (for example, all messages were
 * empty), the `text` is an empty string:
 *
 * ```json
 * {
 *   "text": "The user is planning a trip to Japan in April to see the cherry blossoms.",
 *   "usage": {
 *     "token": 320
 *   }
 * }
 * ```
 *
 * ### When to Use
 *
 * - **External state management**: You maintain conversation history in your own
 *   system and want to periodically collapse older turns into a summary.
 * - **Token optimization**: Replacing a long message history with a single
 *   summary reduces the tokens processed in subsequent completions.
 * - **One-off summarization**: You need a quick summary of a set of messages
 *   without persisting anything in the platform.
 */

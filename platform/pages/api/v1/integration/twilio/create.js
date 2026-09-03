// @ts-check
import { ONE_MONTH_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import botIdSchema from '@/schemas/botId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import structstrSchema from '@/schemas/structstr'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  accountSid: schema.string().allow(null, ''),

  authToken: schema.string().allow(null, ''),

  voice: structstrSchema,

  contactCollection: schema.boolean(),

  sessionDuration: schema
    .number()
    .min(0)
    .max(ONE_MONTH_IN_MILLISECONDS)
    .allow(null),

  allowFrom: schema.string().allow(null, ''),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/twilio/create:
 *   post:
 *     operationId: createTwilioIntegration
 *     summary: Create Twilio integration
 *     tags:
 *       - Twilio Integration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - $ref: '#/components/schemas/BotRef'
 *               - type: object
 *                 properties:
 *                   accountSid:
 *                     description: The Twilio account SID
 *                     type: string
 *                   authToken:
 *                     description: The Twilio auth token
 *                     type: string
 *                   voice:
 *                     description: The voice configuration structured string
 *                     type: string
 *                   contactCollection:
 *                     description: Weather to collect contacts
 *                     type: boolean
 *                   sessionDuration:
 *                     description: The session duration (in milliseconds)
 *                     type: number
 *                   allowFrom:
 *                     description: Newline-or-comma-separated list of allowed senders. Use E.164 phone numbers with or without the leading `+`. Set to `*` to allow all. Leave empty to deny all.
 *                     type: string
 *     responses:
 *       200:
 *         description: The Twilio integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Twilio Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        botId: bot,

        accountSid,

        authToken,

        voice,

        contactCollection,

        sessionDuration,

        allowFrom,

        meta,
      } = body

      const { id } = await prisma.twilioIntegration.create({
        data: {
          userId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          botId: bot?.id || bot,

          // resource specific

          accountSid,

          authToken,

          voice,

          contactCollection,

          sessionDuration,

          allowFrom,

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
 * @manual Twilio Integration
 * @description Twilio Integration enables your ChatBotKit bots to communicate with users through SMS text messaging via Twilio's powerful telecommunications platform.
 * @category Integrations
 * @tags twilio, sms, messaging, integration, text-messaging
 * @index 70
 *
 * Twilio Integration connects your ChatBotKit bots with Twilio's SMS messaging
 * infrastructure, enabling bidirectional text message conversations with users
 * through standard phone numbers. This integration allows your bots to send and
 * receive SMS messages, creating accessible conversational experiences that work
 * on any mobile device without requiring app installations or internet connectivity.
 *
 * When you create a Twilio integration, you establish a bridge between your
 * ChatBotKit bot and Twilio's messaging services, allowing users to interact
 * with your bot by sending text messages to a Twilio phone number. The integration
 * handles message routing, conversation state management, and ensures seamless
 * communication between SMS users and your AI bot.
 *
 * ## Creating Twilio Integrations
 *
 * Creating a Twilio integration establishes the connection between your ChatBotKit
 * bot and Twilio's SMS messaging infrastructure, enabling your bot to send and
 * receive text messages through a Twilio phone number.
 *
 * To create a Twilio integration, you need to specify which bot will handle the
 * conversations and configure session management options:
 *
 * ```http
 * POST /api/v1/integration/twilio/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support SMS Bot",
 *   "description": "SMS-based customer support accessible via text message",
 *   "botId": "bot_abc123",
 *   "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
 *   "authToken": "your_twilio_auth_token",
 *   "voice": "twilio/language=en-US/voice=Polly.Joanna",
 *   "contactCollection": true,
 *   "sessionDuration": 1800000,
 *   "allowFrom": "*"
 * }
 * ```
 *
 * The API will return the integration ID that you'll use to configure your Twilio
 * phone number webhook:
 *
 * ```json
 * {
 *   "id": "twilio_xyz789"
 * }
 * ```
 *
 * ### Required Parameters
 *
 * **botId**: The ID of the bot that will handle SMS conversations. This bot's
 * personality, instructions, and capabilities determine how it responds to incoming
 * text messages from users.
 *
 * ### Twilio Credentials
 *
 * **accountSid**: Your Twilio Account SID. This is used when ChatBotKit needs to
 * send a reply through the Twilio REST API, such as when a bot response is not
 * ready before Twilio's webhook response timeout.
 *
 * **authToken**: Your Twilio Auth Token for the account. This value is treated as
 * sensitive and is used together with `accountSid` to send delayed SMS replies
 * through Twilio. Keep it private and rotate it in Twilio if it is exposed.
 *
 * Webhook-based replies can be returned directly to Twilio when the bot responds
 * quickly. Supplying credentials lets the integration fall back to an outbound
 * Twilio API message when the bot needs more time to complete a response.
 *
 * ### Voice Configuration
 *
 * **voice**: Optional structured voice configuration used for call responses,
 * such as `twilio/language=en-US/voice=Polly.Joanna`. The provider appears
 * before the first slash, and provider-specific options follow as key/value
 * parts. When omitted or empty, Twilio uses its default speech settings.
 *
 * ### Session Management
 *
 * **sessionDuration**: Controls how long conversation context persists between
 * messages. Specified in milliseconds, with a maximum of one month (2,592,000,000ms).
 * When a user doesn't send a message within this duration, the conversation
 * context resets, and their next message starts a fresh conversation.
 *
 * Setting appropriate session duration is important for SMS conversations because
 * text message exchanges often have natural pauses. A session duration of 30
 * minutes (1,800,000ms) works well for most customer service scenarios, while
 * longer durations may be appropriate for ongoing support relationships.
 *
 * If not specified, the platform uses default session management behavior
 * appropriate for SMS interactions.
 *
 * ### Sender Filtering
 *
 * **allowFrom**: Restricts which phone numbers can send messages or place calls
 * to this integration. Use newline- or comma-separated E.164 phone numbers, with
 * or without the leading `+`. Set `allowFrom` to `*` to allow everyone. Leave it
 * empty to block all inbound senders.
 *
 * ### Contact Collection
 *
 * **contactCollection**: When enabled, the integration automatically creates and
 * maintains contact records for users who interact with your bot via SMS. This
 * allows you to track conversation history, understand user engagement patterns,
 * and maintain context across multiple conversation sessions.
 *
 * Contact collection is particularly valuable for SMS integrations because it
 * associates conversations with phone numbers, enabling you to:
 * - Track conversation history for individual users
 * - Maintain context across session boundaries
 * - Analyze engagement patterns by phone number
 * - Provide personalized experiences for returning users
 *
 * ## After Creating the Integration
 *
 * After creating a Twilio integration, you need to complete setup in your Twilio
 * account to route incoming SMS messages to ChatBotKit. This involves:
 *
 * **Configuring Webhook URL**: In your Twilio console, configure your phone
 * number's messaging webhook to point to the ChatBotKit Twilio integration endpoint.
 * The webhook URL follows this format:
 *
 * ```
 * https://api.chatbotkit.com/v1/integration/twilio/{twilioIntegrationId}/webhook
 * ```
 *
 * Replace `{twilioIntegrationId}` with the integration ID returned when you created
 * the integration. Set this URL as the "A message comes in" webhook for your Twilio
 * phone number and configure the HTTP method to POST. The endpoint receives incoming
 * SMS messages and responds with TwiML (Twilio Markup Language) XML to send replies
 * back to users.
 *
 * **Setting Authentication**: Twilio requires webhook authentication to ensure
 * message security. You'll need to configure the authentication credentials
 * provided by ChatBotKit in your Twilio phone number settings.
 *
 * **Testing Message Flow**: Send a test SMS to your Twilio phone number to verify
 * that messages are properly routed to your bot and that responses are delivered
 * back to users.
 *
 * The setup process ensures that when users send text messages to your Twilio
 * phone number, those messages are forwarded to your ChatBotKit bot, which
 * processes them and sends responses back through Twilio's SMS infrastructure.
 *
 * ## Integration with Blueprints
 *
 * Twilio integrations can be associated with blueprints for organized resource
 * management. When you include a `blueprintId` during creation, the integration
 * becomes part of that blueprint's resource collection, making it easier to
 * manage related bots, integrations, and messaging configurations together.
 *
 * This is particularly useful when managing multiple Twilio integrations for
 * different purposes or phone numbers, as you can organize them under blueprints
 * for simplified management and deployment.
 *
 * ## Use Cases
 *
 * Twilio integrations enable powerful SMS-based conversational experiences:
 *
 * **Customer Support via SMS**: Provide accessible customer support through text
 * messages, allowing customers to get help without apps or internet connectivity.
 *
 * **Appointment Reminders and Scheduling**: Enable users to confirm, reschedule,
 * or cancel appointments through conversational SMS interactions.
 *
 * **Order Status and Notifications**: Allow customers to check order status,
 * track deliveries, or receive proactive notifications via text message.
 *
 * **Lead Qualification**: Engage potential customers through SMS conversations,
 * qualifying leads and gathering information through natural text exchanges.
 *
 * **Service Accessibility**: Reach users who may not have reliable internet access
 * or prefer SMS communication over other channels.
 *
 * **Two-Way Information Services**: Provide information services that users can
 * access by texting keywords or questions to a phone number.
 *
 * ## Important Considerations
 *
 * **Message Costs**: SMS messages incur charges from Twilio based on message volume
 * and destination. Monitor usage to understand costs associated with your bot's
 * SMS interactions.
 *
 * **Message Length Limits**: SMS messages have character limits (typically 160
 * characters). Long bot responses may be split into multiple messages, which can
 * affect user experience and costs.
 *
 * **Conversation Pacing**: SMS conversations typically have slower pacing than
 * chat interfaces. Design your bot's responses to work well with the asynchronous
 * nature of text messaging.
 *
 * **Phone Number Management**: Each Twilio integration requires a dedicated Twilio
 * phone number configured with the appropriate webhook settings.
 *
 * **User Privacy**: SMS conversations are associated with phone numbers, which
 * are personally identifiable information. Ensure appropriate data handling and
 * privacy practices.
 */

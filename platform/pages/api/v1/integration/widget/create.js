// @ts-check
import { WIDGET_SESSION_DURATION_MAX_IN_MILLISECONDS } from '@/config/widget'

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
import themeSchema from '@/schemas/theme'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  botId: botIdSchema('use'),

  theme: themeSchema,

  layout: schema.string().allow(null, ''), // @todo more specific validation required

  title: schema.string().allow(null, ''),

  intro: schema.string().allow(null, ''),

  initial: schema.string().allow(null, ''),

  placeholder: schema.string().allow(null, ''),

  origin: schema.string().allow(null, ''),

  sessionDuration: schema
    .number()
    .min(0)
    .max(WIDGET_SESSION_DURATION_MAX_IN_MILLISECONDS)
    .allow(null),

  language: schema.string().allow(null, ''),

  plugins: schema.string().allow(null, ''), // @todo more specific validation required

  stream: schema.boolean(),

  verbose: schema.boolean(),

  tools: schema.boolean(),

  unfurl: schema.boolean(),

  math: schema.boolean(),

  carousel: schema.boolean(),

  form: schema.boolean(),

  attachments: schema.boolean(),

  autoScroll: schema.boolean(),

  startFirst: schema.boolean(),

  contactCollection: schema.boolean(),

  exportConversation: schema.boolean(),
  restartConversation: schema.boolean(),

  maximize: schema.boolean(),

  messagePeek: schema.boolean(),

  voiceIn: schema.boolean(),
  voiceOut: schema.boolean(),

  poweredBy: schema.boolean(),

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/widget/create:
 *   post:
 *     operationId: createWidgetIntegration
 *     summary: Create Widget integration
 *     tags:
 *       - Widget Integration
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
 *                   theme:
 *                     description: The theme of the Widget integration
 *                     type: string
 *                   layout:
 *                     description: The default layout of the Widget integration
 *                     type: string
 *                   title:
 *                     description: The title of the Widget integration
 *                     type: string
 *                   intro:
 *                     description: The intro of the Widget integration
 *                     type: string
 *                   initial:
 *                     description: The initial message of the Widget integration
 *                     type: string
 *                   placeholder:
 *                     description: The input placeholder of the Widget integration
 *                     type: string
 *                   origin:
 *                     description: The origin URLs of the Widget integration
 *                     type: string
 *                   sessionDuration:
 *                     description: The session duration of the Widget integration
 *                     type: number
 *                   language:
 *                     description: The language of the Widget integration
 *                     type: string
 *                   plugins:
 *                     description: The plugins of the Widget integration
 *                     type: string
 *                   stream:
 *                     description: Whether the Widget integration is streaming
 *                     type: boolean
 *                   verbose:
 *                     description: Whether the Widget integration is verbose
 *                     type: boolean
 *                   tools:
 *                     description: Whether the Widget integration has tools
 *                     type: boolean
 *                   unfurl:
 *                     description: Whether the Widget integration unfurls links
 *                     type: boolean
 *                   math:
 *                     description: Weather the Widget integration supports math
 *                     type: boolean
 *                   carousel:
 *                     description: Weather the Widget integration supports carousels
 *                     type: boolean
 *                   form:
 *                     description: Weather the Widget integration supports forms
 *                     type: boolean
 *                   attachments:
 *                     description: Weather the Widget integration supports attachments
 *                     type: boolean
 *                   autoScroll:
 *                     description: Whether the Widget integration auto scrolls
 *                     type: boolean
 *                   startFirst:
 *                     description: Whether the Widget integration starts first
 *                     type: boolean
 *                   contactCollection:
 *                     description: Whether the Widget integration collects contacts
 *                     type: boolean
 *                   exportConversation:
 *                     description: Controls whether the Widget allows exporting the current conversation
 *                     type: boolean
 *                   restartConversation:
 *                     description: Controls whether the Widget allows restarting the conversation
 *                     type: boolean
 *                   maximize:
 *                     description: Controls whether the Widget allows maximizing the conversation
 *                     type: boolean
 *                   messagePeek:
 *                     description: Controls whether the Widget allows peeking at the initial messages
 *                     type: boolean
 *                   voiceIn:
 *                     description: Controls whether the Widget allows voice input
 *                     type: boolean
 *                   voiceOut:
 *                     description: Controls whether the Widget allows voice output
 *                     type: boolean
 *                   poweredBy:
 *                     description: Whether the Widget integration displays powered by
 *                     type: boolean
 *     responses:
 *       200:
 *         description: The Widget integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Widget Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        botId: bot,

        theme,

        layout,

        title,

        intro,

        initial,

        placeholder,

        origin,

        sessionDuration,

        language,

        plugins,

        stream,

        verbose,

        tools,

        unfurl,

        math,

        carousel,

        form,

        attachments,

        autoScroll,

        startFirst,

        contactCollection,

        exportConversation,
        restartConversation,

        maximize,

        messagePeek,

        voiceIn,
        voiceOut,

        poweredBy,

        meta,
      } = body

      const { id } = await prisma.widgetIntegration.create({
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

          theme,

          layout,

          title,

          intro,

          initial,

          placeholder,

          origin,

          sessionDuration,

          language,

          plugins,

          stream,

          verbose,

          tools,

          unfurl,

          math,

          carousel,

          form,

          attachments,

          autoScroll,

          startFirst,

          contactCollection,

          exportConversation,
          restartConversation,

          maximize,

          messagePeek,

          voiceIn,
          voiceOut,

          poweredBy,

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
 * @manual Widget Integration
 * @description Widget integrations enable you to embed conversational AI directly into websites and web applications through a customizable chat interface that adapts to your brand, supports rich interactions, and provides seamless user experiences across desktop and mobile devices.
 * @category Integrations
 * @tags widget, chat, embed, integration, website
 * @index 1
 *
 * The widget integration is one of the most popular ways to deploy
 * conversational AI, allowing you to add intelligent chat capabilities to any
 * website or web application with minimal technical implementation. Widget
 * integrations provide a fully-featured chat interface that handles message
 * exchange, file attachments, voice interactions, and rich content display,
 * all while maintaining your brand identity through extensive customization
 * options.
 *
 * Widget integrations are designed to be embedded directly into web pages,
 * appearing as a chat bubble or inline interface that users can interact with
 * naturally. The widget handles all aspects of the conversation flow,
 * including connection management, message streaming, error recovery, and
 * responsive layout adjustments, providing a production-ready chat experience
 * without requiring extensive frontend development.
 *
 * ## Creating Widget Integrations
 *
 * Creating a widget integration establishes a configured chat interface that
 * can be embedded into your website. When you create a widget, you define its
 * appearance, behavior, and capabilities through a comprehensive set of
 * configuration options that control everything from visual theme to advanced
 * features like voice input, file attachments, and contact collection.
 *
 * The widget creation process begins by connecting the widget to a bot or
 * blueprint that defines the conversational AI behavior. You then customize
 * the widget's appearance and functionality to match your use case, brand
 * guidelines, and user experience requirements. The system generates embed
 * code that you can add to your website to activate the widget.
 *
 * ```http
 * POST /api/v1/integration/widget/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Widget",
 *   "description": "Interactive support chat for our main website",
 *   "botId": "bot_abc123",
 *   "theme": {
 *     "primaryColor": "#0066cc",
 *     "secondaryColor": "#f5f5f5",
 *     "fontFamily": "Inter, sans-serif"
 *   },
 *   "title": "How can we help you?",
 *   "placeholder": "Type your message here...",
 *   "contactCollection": true,
 *   "attachments": true,
 *   "voiceIn": true
 * }
 * ```
 *
 * ## Configuration Options
 *
 * Widget integrations support extensive configuration to tailor the chat
 * experience to your specific needs:
 *
 * **Visual Customization:**
 *
 * - **theme**: Color scheme, fonts, and visual styling that match your brand
 *   identity. Supports custom CSS for advanced styling needs.
 * - **layout**: Widget layout mode (bubble, inline, fullscreen) that
 *   determines how the chat interface appears on your website.
 * - **title**: Welcome message or header text displayed at the top of the
 *   chat interface.
 * - **intro**: Introductory message shown when users first open the widget.
 *
 * **Interaction Settings:**
 *
 * - **placeholder**: Placeholder text shown in the message input field to
 *   guide users on what to type.
 * - **initial**: Initial message automatically sent when conversation starts,
 *   useful for greeting users or providing context.
 * - **autoScroll**: Automatically scroll to show the latest message as the
 *   conversation progresses.
 * - **startFirst**: Automatically send the initial message without requiring
 *   user action.
 *
 * **Advanced Features:**
 *
 * - **attachments**: Enable file upload capabilities, allowing users to share
 *   documents, images, and other files during conversations.
 * - **voiceIn**: Enable voice input, allowing users to speak their messages
 *   instead of typing.
 * - **voiceOut**: Enable voice output, allowing the bot to speak responses
 *   aloud using text-to-speech.
 * - **contactCollection**: Collect user contact information (name, email)
 *   before or during conversations for lead capture and support routing.
 * - **tools**: Enable function calling and tool use for advanced bot
 *   capabilities like API calls or data lookups.
 * - **unfurl**: Automatically preview links shared in conversations,
 *   displaying rich content previews.
 * - **math**: Enable mathematical expression rendering for technical support
 *   or educational use cases.
 * - **carousel**: Support carousel-style content display for product
 *   showcases or option selection.
 * - **form**: Enable structured form interactions within conversations.
 *
 * **Session and Privacy:**
 *
 * - **sessionDuration**: Maximum session duration in milliseconds (up to 1
 *   hour). Controls how long conversation context is maintained.
 * - **origin**: Restrict widget usage to specific domains for security.
 *   Prevents unauthorized embedding.
 * - **exportConversation**: Allow users to export conversation transcripts
 *   for their records.
 * - **restartConversation**: Provide option to restart conversations,
 *   clearing history and starting fresh.
 *
 * **Technical Options:**
 *
 * - **stream**: Enable message streaming for real-time response delivery as
 *   the bot generates text.
 * - **verbose**: Include additional debugging information in widget console
 *   logs for troubleshooting.
 * - **language**: Set the default language for the widget interface and
 *   initial messages.
 * - **plugins**: Enable additional widget plugins for extended functionality.
 *
 * **Important Considerations:**
 *
 * - You must connect the widget to either a bot ID or blueprint ID to define
 *   the conversational behavior. Without this connection, the widget cannot
 *   process user messages.
 *
 * - Theme customization should maintain sufficient contrast ratios for
 *   accessibility. Test your color scheme with accessibility tools before
 *   deploying to production.
 *
 * - Enabling advanced features like voice input, file attachments, and
 *   contact collection may affect performance and require additional user
 *   permissions. Consider your target audience and use case when enabling
 *   these features.
 *
 * - Session duration settings affect both user experience and resource
 *   consumption. Longer sessions maintain context better but consume more
 *   memory and may increase costs.
 *
 * - The widget is responsive and mobile-optimized by default, automatically
 *   adapting its layout to different screen sizes and orientations.
 */

// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({})

/**
 * @swagger
 *
 * /integration/widget/{widgetIntegrationId}/clone:
 *   post:
 *     operationId: cloneWidgetIntegration
 *     summary: Clone Widget integration
 *     tags:
 *       - Widget Integration
 *     parameters:
 *       - in: path
 *         name: widgetIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Widget integration
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The Widget integration was cloned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the cloned Widget integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const {} = body

      const widgetIntegration =
        await prisma.widgetIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'widgetIntegrationId'),
          {
            include: {
              files: true,
            },
          }
        )

      if (!widgetIntegration) {
        return notFound()
      }

      if (widgetIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      const { id } = await prisma.widgetIntegration.create({
        data: {
          userId: session.user.id,

          // everything else is copied from the original widget integration

          name: widgetIntegration.name,
          description: widgetIntegration.description,

          blueprintId: widgetIntegration.blueprintId,

          botId: widgetIntegration.botId,

          theme: widgetIntegration.theme,

          layout: widgetIntegration.layout,

          title: widgetIntegration.title,

          intro: widgetIntegration.intro,

          initial: widgetIntegration.initial,

          placeholder: widgetIntegration.placeholder,

          origin: widgetIntegration.origin,

          sessionDuration: widgetIntegration.sessionDuration,

          language: widgetIntegration.language,

          plugins: widgetIntegration.plugins,

          stream: widgetIntegration.stream,

          verbose: widgetIntegration.verbose,

          tools: widgetIntegration.tools,

          unfurl: widgetIntegration.unfurl,

          math: widgetIntegration.math,

          carousel: widgetIntegration.carousel,

          form: widgetIntegration.form,

          attachments: widgetIntegration.attachments,

          autoScroll: widgetIntegration.autoScroll,

          startFirst: widgetIntegration.startFirst,

          contactCollection: widgetIntegration.contactCollection,

          exportConversation: widgetIntegration.exportConversation,
          restartConversation: widgetIntegration.restartConversation,

          maximize: widgetIntegration.maximize,

          messagePeek: widgetIntegration.messagePeek,

          voiceIn: widgetIntegration.voiceIn,
          voiceOut: widgetIntegration.voiceOut,

          poweredBy: widgetIntegration.poweredBy,

          meta: widgetIntegration.meta,
        },
      })

      await prisma.widgetIntegrationFileAttachment.createMany({
        data: widgetIntegration.files.map((file) => ({
          widgetIntegrationId: id,
          fileId: file.fileId,
          type: file.type,
        })),
      })

      return ok({ id })
    })
  )
)

/**
 * @manual Widget Integration
 *
 * ## Cloning Widget Integrations
 *
 * The widget cloning functionality enables you to duplicate existing widget
 * integrations with all their configurations, creating new instances that
 * inherit the complete setup of the original widget. This is particularly
 * useful when you need to deploy similar chat widgets across multiple
 * websites, create variations for A/B testing, or establish development and
 * production versions of the same widget with minimal manual configuration.
 *
 * When you clone a widget integration, the system creates a complete copy
 * that includes all visual customization settings (theme, layout, title,
 * intro, placeholder text), interaction configurations (session duration,
 * language, streaming behavior, plugins), feature enablements (attachments,
 * voice, tools, forms, contact collection), blueprint association, and
 * associated file attachments. The cloned widget receives a new unique
 * identifier but maintains all the functional characteristics of the source
 * widget, allowing you to deploy it independently while preserving tested
 * configurations.
 *
 * ```http
 * POST /api/v1/integration/widget/{widgetIntegrationId}/clone
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The cloning operation is particularly valuable in several scenarios. When
 * managing multiple websites or applications that require similar chat
 * experiences, you can establish a well-configured template widget and clone
 * it for each deployment, ensuring consistency while allowing for minor
 * per-instance customizations after cloning. For testing and development
 * workflows, you can clone production widgets to create safe testing
 * environments where changes can be validated before affecting live systems.
 *
 * The cloned widget maintains references to the same bot, datasets, and
 * skillsets as the original, but operates as an independent integration with
 * its own usage tracking, session management, and configuration lifecycle.
 * This means you can modify the clone's settings, embed code, or associated
 * resources without affecting the source widget, providing flexibility for
 * experimentation and specialized deployments.
 *
 * After cloning, you'll receive the new widget's unique identifier, which you
 * can use to retrieve embed code, update configurations, or manage the
 * cloned instance through the standard widget integration endpoints. The
 * cloned widget is immediately ready for deployment and will function
 * identically to the source widget until you make configuration changes.
 *
 * **Important Considerations:**
 *
 * - File attachments associated with the original widget are referenced in
 *   the clone, not duplicated, so modifications to shared files affect both
 *   widgets
 * - The clone inherits the original's bot association, so both widgets will
 *   use the same AI model and training unless you update the clone's bot
 *   reference
 * - If the source widget is linked to a blueprint, the clone inherits the
 *   same `blueprintId` reference and will receive configuration updates
 *   pushed from that blueprint unless you detach it after cloning
 * - Plugin configurations (`plugins`) are copied from the source widget,
 *   enabling the same custom integrations and extensions in the cloned widget
 * - Usage metrics, conversation history, and analytics for the cloned widget
 *   are tracked separately from the original
 * - Theme customizations and visual settings are copied but can be modified
 *   independently after cloning
 * - The cloned widget requires separate embed code generated specifically for
 *   its unique identifier
 */

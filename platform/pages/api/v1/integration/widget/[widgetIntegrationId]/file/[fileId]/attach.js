// @ts-check
import prisma from '@/prisma/client'
import { WidgetIntegrationFileAttachmentType } from '@/prisma/types'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/widget/{widgetIntegrationId}/file/{fileId}/attach:
 *   post:
 *     operationId: attachWidgetIntegrationFile
 *     summary: Attach a file to a widget integration
 *     tags:
 *       - Widget Integration
 *     parameters:
 *       - in: path
 *         name: widgetIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the widget integration
 *           type: string
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema:
 *           description: The ID of the file to attach
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 description: The attachment slot type for the file
 *                 type: string
 *                 enum:
 *                   - bar
 *                   - user
 *                   - bot
 *                   - button
 *             required:
 *               - type
 *     responses:
 *       200:
 *         description: The file was attached to the widget integration successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the attached file
 *                   type: string
 *                 type:
 *                   description: The attachment slot type
 *                   type: string
 *                 widgetIntegrationId:
 *                   description: The ID of the widget integration
 *                   type: string
 *               required:
 *                 - id
 *                 - type
 *                 - widgetIntegrationId
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
const bodySchema = schema.object({
  type: schema
    .string()
    .valid(...Object.keys(WidgetIntegrationFileAttachmentType))
    .required(),
})

export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { type } = body

      const widgetIntegration =
        await prisma.widgetIntegration.findUniqueByIdentifier(
          session.user,
          requiredUrlParam(req, 'widgetIntegrationId')
        )

      if (!widgetIntegration) {
        return notFound()
      }

      if (widgetIntegration.userId !== session.user.id) {
        return notAuthorized()
      }

      const file = await prisma.file.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'fileId')
      )

      if (!file) {
        return notFound()
      }

      if (file.userId !== session.user.id) {
        return notAuthorized()
      }

      const attachment =
        await prisma.widgetIntegrationFileAttachment.findUnique({
          where: {
            widgetIntegrationId_type: {
              widgetIntegrationId: widgetIntegration.id,

              type: type,
            },
          },
        })

      if (attachment) {
        await prisma.widgetIntegrationFileAttachment.delete({
          where: {
            widgetIntegrationId_type: {
              widgetIntegrationId: widgetIntegration.id,

              type: type,
            },
          },
        })
      }

      await prisma.widgetIntegrationFileAttachment.create({
        data: {
          widgetIntegrationId: widgetIntegration.id,

          type: type,

          fileId: file.id,
        },
      })

      return ok({
        id: file.id,
        type,
        widgetIntegrationId: widgetIntegration.id,
      })
    })
  )
)

/**
 * @manual Widget Integration
 * @index 60
 *
 * ## Attaching Files to Widget Integrations
 *
 * The attach file endpoint allows you to associate uploaded files with specific
 * visual slots in your widget integration. This enables you to customize the
 * widget's appearance by assigning custom images and assets to different parts
 * of the widget interface, such as the header bar, the user avatar, the bot
 * avatar, and button icons.
 *
 * Widget file attachments let you brand your widget to match your product's
 * visual identity. Rather than using default platform images, you can upload
 * your own assets and attach them to the appropriate widget slots. This is
 * especially useful when embedding widgets in branded customer-facing products
 * where visual consistency matters.
 *
 * Each attachment slot (`type`) corresponds to a specific visual element of the
 * widget interface. The available types are:
 *
 * - **bar**: The header or toolbar area of the widget
 * - **user**: The avatar displayed for user messages
 * - **bot**: The avatar displayed for bot messages
 * - **button**: The icon used for the widget launcher button
 *
 * Only one file can be attached to each slot at a time. If a file is already
 * attached to the specified slot, it will be replaced by the new file. This
 * allows you to update widget visuals without manually detaching the previous
 * file first.
 *
 * ```http
 * POST /api/v1/integration/widget/{widgetIntegrationId}/file/{fileId}/attach
 * Content-Type: application/json
 *
 * {
 *   "type": "bot"
 * }
 * ```
 *
 * Before calling this endpoint, upload the file using the file upload API to
 * obtain a valid `fileId`. Both the widget integration and the file must belong
 * to the same account. After attaching, the widget will automatically use the
 * assigned file for the specified slot when rendering.
 *
 * **Authorization:** Both the widget integration and the file must be owned by
 * the authenticated user. Attempts to attach files belonging to another account
 * will be rejected with a not authorized error.
 */

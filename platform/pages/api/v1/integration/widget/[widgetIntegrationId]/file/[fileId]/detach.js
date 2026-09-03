// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/widget/{widgetIntegrationId}/file/{fileId}/detach:
 *   post:
 *     operationId: detachWidgetIntegrationFile
 *     summary: Detach a file from a widget integration
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
 *           description: The ID of the file to detach
 *           type: string
 *     responses:
 *       200:
 *         description: The file was detached from the widget integration successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the detached file
 *                   type: string
 *                 type:
 *                   description: The attachment slot type that was cleared
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
export default withPost(
  withSession(async function (req, session) {
    const attachment = await prisma.widgetIntegrationFileAttachment.findFirst({
      where: {
        widgetIntegrationId: requiredUrlParam(req, 'widgetIntegrationId'),

        fileId: requiredUrlParam(req, 'fileId'),
      },

      include: {
        widgetIntegration: true,

        file: true,
      },
    })

    if (!attachment) {
      return notFound()
    }

    if (attachment.widgetIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    if (!attachment.file) {
      return notFound()
    }

    if (attachment.file.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.widgetIntegrationFileAttachment.delete({
      where: {
        widgetIntegrationId_type: {
          widgetIntegrationId: attachment.widgetIntegrationId,
          type: attachment.type,
        },
      },
    })

    return ok({
      id: attachment.fileId,
      type: attachment.type,
      widgetIntegrationId: attachment.widgetIntegrationId,
    })
  })
)

/**
 * @manual Widget Integration
 * @index 65
 *
 * ## Detaching Files from Widget Integrations
 *
 * The detach file endpoint removes an existing file attachment from a widget
 * integration slot. This is used when you want to revert a widget slot back to
 * its default appearance, replace an attachment in a two-step process, or clean
 * up file associations when reorganizing your widget's visual assets.
 *
 * Detaching a file does not delete the file itself from the platform. The file
 * remains in your file library and can be reattached to any widget integration
 * or used in other contexts. Only the association between the widget slot and
 * the file is removed.
 *
 * To detach a file, provide both the widget integration ID and the file ID in
 * the URL path. The system will locate the attachment record for that specific
 * file and remove it, clearing the corresponding visual slot on the widget.
 *
 * ```http
 * POST /api/v1/integration/widget/{widgetIntegrationId}/file/{fileId}/detach
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The response confirms the detachment by returning the file ID, the slot type
 * that was cleared, and the widget integration ID. After detachment, the widget
 * will fall back to its default appearance for the affected slot.
 *
 * **Common Workflow:** To replace a widget file attachment, you can either use
 * the attach endpoint directly (which replaces any existing attachment for that
 * slot automatically), or explicitly detach the old file first using this
 * endpoint and then attach the new file. The direct replacement approach via the
 * attach endpoint is generally simpler.
 *
 * **Authorization:** Both the widget integration and the attached file must be
 * owned by the authenticated user. Requests referencing attachments from other
 * accounts will be rejected with a not authorized error.
 */

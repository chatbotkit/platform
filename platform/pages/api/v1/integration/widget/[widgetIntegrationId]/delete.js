// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @swagger
 *
 * /integration/widget/{widgetIntegrationId}/delete:
 *   post:
 *     operationId: deleteWidgetIntegration
 *     summary: Delete Widget integration
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
 *         description: The Widget integration was deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the deleted Widget integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const widgetIntegration =
      await prisma.widgetIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'widgetIntegrationId'),
        {
          select: {
            id: true,
            userId: true,
          },
        }
      )

    if (!widgetIntegration) {
      return notFound()
    }

    if (widgetIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await prisma.widgetIntegration.delete({
      where: {
        id: widgetIntegration.id,
      },
    })

    return ok({ id: widgetIntegration.id })
  })
)

/**
 * @manual Widget Integration
 *
 * ## Deleting Widget Integrations
 *
 * Deleting a widget integration permanently removes the widget configuration
 * and all associated settings from your account. This operation is irreversible
 * and should be used carefully, particularly for widgets that are actively
 * embedded on websites or applications.
 *
 * When you delete a widget integration, the widget will immediately stop
 * functioning on any websites where it's embedded. Users attempting to
 * interact with the widget will no longer be able to start conversations
 * or receive responses. This makes deletion particularly important to handle
 * carefully for production deployments.
 *
 * ```http
 * POST /api/v1/integration/widget/{widgetIntegrationId}/delete
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * ### Before Deleting
 *
 * Before deleting a widget integration, consider these important factors to
 * avoid service disruption and data loss:
 *
 * **Check Active Usage**: Verify whether the widget is currently embedded on
 * any websites or applications. Removing an actively-used widget will
 * immediately break functionality for end users visiting those pages.
 *
 * **Review Conversation History**: Ensure you've exported any important
 * conversation data or analytics from the widget's usage history. Once
 * deleted, the widget configuration is removed, though associated conversation
 * data may be preserved separately depending on your settings.
 *
 * **Consider Disabling First**: For widgets in active use, consider updating
 * the widget configuration to disable it or modify its behavior rather than
 * immediately deleting it. This provides a safer rollback path if needed.
 *
 * **Update Embeddings**: Remove the widget embed code from all websites and
 * applications before deletion, or ensure you have a replacement widget ready
 * to deploy to avoid service interruption.
 *
 * ### What Gets Deleted
 *
 * The deletion operation removes the widget integration entity and all its
 * configuration settings including appearance customization, feature flags,
 * behavioral settings, and security configurations.
 *
 * The connected bot, datasets, and other resources are NOT deleted - only
 * the widget integration itself is removed. This means you can create a new
 * widget integration using the same bot and resources if needed.
 *
 * ### After Deletion
 *
 * After deleting a widget integration:
 *
 * **Embedded Widgets Stop Working**: Any embedded instances of the widget
 * will no longer function and may display errors or simply fail to load.
 *
 * **ID Becomes Invalid**: The widget integration ID can no longer be used
 * for API operations and will return "not found" errors if referenced.
 *
 * **Configuration Is Lost**: All widget settings and customizations are
 * permanently removed and cannot be recovered. You'll need to reconfigure
 * from scratch if creating a replacement widget.
 *
 * **Warning**: This operation is permanent and cannot be undone. Ensure you
 * have backups of any important configuration or that you're prepared to
 * reconfigure the widget if needed later.
 */

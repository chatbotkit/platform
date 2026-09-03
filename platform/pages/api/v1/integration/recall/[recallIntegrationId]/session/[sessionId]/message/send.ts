import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { sendRecallChatMessage } from '@/lib/recall.bot'
import { getRecallSessionControlContext } from '@/lib/recall.screenshare'
import { badGateway, ok } from '@/lib/response'

export const bodySchema = schema.object({
  message: schema.string().trim().min(1).max(4096).required(),
  to: schema.string().trim().min(1).default('everyone'),
})

export default withPost(
  withSchema(bodySchema, async function (req, body) {
    const context = await getRecallSessionControlContext(req)

    if (!context.ok) {
      return context.response
    }

    const { recallIntegration, recallSession } = context

    const { message, to } = body

    try {
      const data = await sendRecallChatMessage({
        apiKey: recallIntegration.apiKey,
        message,
        recallBotId: recallSession.recallBotId,
        region: recallIntegration.region,
        to,
      })

      return ok({
        data,
      })
    } catch (error) {
      return badGateway(
        error instanceof Error ? error.message : 'Failed to send chat message'
      )
    }
  })
)

// @note not a public route

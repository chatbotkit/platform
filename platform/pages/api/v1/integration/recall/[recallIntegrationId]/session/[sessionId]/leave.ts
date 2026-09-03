import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { leaveRecallMeeting } from '@/lib/recall.bot'
import { getRecallSessionControlContext } from '@/lib/recall.screenshare'
import { badGateway, ok } from '@/lib/response'

export const bodySchema = schema.object({})

export default withPost(
  withSchema(bodySchema, async function (req) {
    const context = await getRecallSessionControlContext(req)

    if (!context.ok) {
      return context.response
    }

    const { recallIntegration, recallSession } = context

    try {
      const data = await leaveRecallMeeting({
        apiKey: recallIntegration.apiKey,
        recallBotId: recallSession.recallBotId,
        region: recallIntegration.region,
      })

      return ok({
        data,
      })
    } catch (error) {
      return badGateway(
        error instanceof Error ? error.message : 'Failed to leave meeting'
      )
    }
  })
)

// @note not a public route

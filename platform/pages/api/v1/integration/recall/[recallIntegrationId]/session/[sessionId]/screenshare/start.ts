import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { startRecallScreenshare } from '@/lib/recall.bot'
import { getRecallScreenshareSessionContext } from '@/lib/recall.screenshare'
import { badGateway, ok } from '@/lib/response'

import externalUrlSchema from '@/schemas/externalUrl'

export const bodySchema = schema.object({
  url: externalUrlSchema.required(),
})

export default withPost(
  withSchema(bodySchema, async function (req, body) {
    const context = await getRecallScreenshareSessionContext(req)

    if (!context.ok) {
      return context.response
    }

    const { recallIntegration, recallSession } = context

    const { url } = body

    try {
      const { data, url: screenshareUrl } = await startRecallScreenshare({
        apiKey: recallIntegration.apiKey,

        recallIntegrationId: recallIntegration.id,
        recallBotId: recallSession.recallBotId,
        region: recallIntegration.region,

        url,
      })

      return ok({
        data,
        url: screenshareUrl,
      })
    } catch (error) {
      return badGateway(
        error instanceof Error ? error.message : 'Failed to start screenshare'
      )
    }
  })
)

// @note not a public route

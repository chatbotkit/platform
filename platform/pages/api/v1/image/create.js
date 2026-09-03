// @ts-check
import { withStream } from '@/lib/stream'
import { createImage } from '@/lib/image'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { Usage } from '@/lib/usage.model'
import { recordImageUsage } from '@/lib/usage.record'

import imageModelSchema from '@/schemas/imageModel'

export const bodySchema = schema.object({
  model: imageModelSchema,

  prompt: schema.string().required(),

  // @todo add more options here like size, etc
})

export default withPost(
  withSessionLimits(
    ['token', 'image'],
    withSchema(
      bodySchema,
      withStream(async function (_req, stream, session, body) {
        const { model, prompt } = body

        const { urls, usage } = await createImage(prompt, {
          model,
          user: session.user.id,
          signal: stream.abortSignal,
        })

        const usageRecorder = new Usage()

        usageRecorder.addImageTokens(usage.inputTokens, usage.model, 'input')
        usageRecorder.addImageTokens(usage.outputTokens, usage.model, 'output')

        await usageRecorder.recordBaseTokens({
          user: session.user,
          meta: {
            reason: 'image/create',
          },
        })

        await recordImageUsage({
          user: session.user,
          count: urls.length,
          model: usage.model,
          meta: {
            reason: 'image/create',
          },
        })

        await stream.result({
          urls,
          usage,
        })
      })
    )
  )
)

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
}

// @note this API route is not public - no documentation available

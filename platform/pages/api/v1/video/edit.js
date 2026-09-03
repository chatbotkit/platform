// @ts-check
import { withStream } from '@/lib/stream'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { Usage } from '@/lib/usage.model'
import { recordVideoUsage } from '@/lib/usage.record'
import { editVideo } from '@/lib/video'

import videoModelSchema from '@/schemas/videoModel'

export const bodySchema = schema.object({
  model: videoModelSchema,

  prompt: schema.string().required(),

  videos: schema.array().items(schema.string()).max(1).optional(),
  frames: schema.array().items(schema.string()).max(2).optional(),
  audios: schema.array().items(schema.string()).max(1).optional(),

  n: schema.number().optional(),
  aspectRatio: schema.string().optional(),
  resolution: schema.string().optional(),
  duration: schema.number().optional(),
  fps: schema.number().optional(),
  seed: schema.number().optional(),
})

export default withPost(
  withSessionLimits(
    ['token', 'video'],
    withSchema(
      bodySchema,
      withStream(async function (_req, stream, session, body) {
        const {
          model,
          prompt,
          videos,
          frames,
          audios,
          n,
          aspectRatio,
          resolution,
          duration,
          fps,
          seed,
        } = body

        const { urls, usage } = await editVideo(prompt, videos || [], {
          model,
          frames,
          audios,
          n,
          aspectRatio,
          resolution,
          duration,
          fps,
          seed,
          user: session.user.id,
          signal: stream.abortSignal,
        })

        const usageRecorder = new Usage()

        usageRecorder.addVideoTokens(usage.inputTokens, usage.model, 'input')
        usageRecorder.addVideoTokens(usage.outputTokens, usage.model, 'output')

        await usageRecorder.recordBaseTokens({
          user: session.user,
          meta: {
            reason: 'video/edit',
          },
        })

        await recordVideoUsage({
          user: session.user,
          count: urls.length,
          model: usage.model,
          meta: {
            reason: 'video/edit',
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

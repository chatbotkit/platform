// @ts-check
import { withStream } from '@/lib/stream'
import fetch from '@/lib/egress.fetch'
import { editImage } from '@/lib/image'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { Usage } from '@/lib/usage.model'
import { recordImageUsage } from '@/lib/usage.record'

import imageModelSchema from '@/schemas/imageModel'

export const bodySchema = schema.object({
  model: imageModelSchema,

  prompt: schema.string().required(),

  images: schema.array().items(schema.string()).max(3).required(),

  mask: schema.string().optional(),

  // @todo add more parameters here (size, etc)
})

export default withPost(
  withSessionLimits(
    ['token', 'image'],
    withSchema(
      bodySchema,
      withStream(async function (_req, stream, session, body) {
        const { model, prompt, images, mask } = body

        const imageBlobs = /** @type Blob[] */ (
          (
            await Promise.all(
              images.map(async (url) => {
                if (!url) {
                  return
                }

                const response = await fetch(url)

                if (!response.ok) {
                  throw new Error(`Failed to fetch image from ${url}`)
                }

                const blob = await response.blob()

                return blob
              })
            )
          ).filter(Boolean)
        )

        const maskBlob = mask
          ? await fetch(mask).then((response) => {
              if (!response.ok) {
                throw new Error(`Failed to fetch image from ${mask}`)
              }

              return response.blob()
            })
          : undefined

        const { urls, usage } = await editImage(prompt, imageBlobs, {
          mask: maskBlob,
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
            reason: 'image/edit',
          },
        })

        await recordImageUsage({
          user: session.user,
          count: urls.length,
          model: usage.model,
          meta: {
            reason: 'image/edit',
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

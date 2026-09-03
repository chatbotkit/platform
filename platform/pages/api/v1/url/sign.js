// @ts-check
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { sign } from '@/lib/signature.url'

export const bodySchema = schema.object({
  url: schema
    .string()
    .uri({
      scheme: ['https'],
    })
    .required(),
})

export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, session, body) {
      const { url } = body

      return ok({
        url: await sign(url, session),
      })
    })
  )
)

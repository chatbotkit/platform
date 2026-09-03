// @ts-check
import { withStream } from '@/lib/stream'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'

import { sendEvent } from '@/pages/api/v1/conversation/[conversationId]/queue'

export const bodySchema = schema.object({})

export default withPost(
  withSessionLimits(
    ['rate/message', 'message', 'token'],
    withSchema(
      bodySchema,
      withStream(async function (req, stream, session, body) {
        const {} = body

        const conversationId = requiredUrlParam(req, 'conversationId')

        // @note the reason we send this to a queue is because we don't know how
        // long the caller will wait for the result

        await sendEvent(conversationId, {
          type: 'callback',
          payload: {
            body,
          },
        })

        await stream.result({
          id: conversationId,
        })
      })
    )
  )
)

// @note This is an internal endpoint exposed to abilities through the signed
// conversation callback substitution. It records callback payloads into the
// conversation asynchronously, but there are no active first-party callers at
// the moment.

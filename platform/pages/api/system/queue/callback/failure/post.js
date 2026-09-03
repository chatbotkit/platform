// @ts-check
import debug from '@/lib/debug'
import queueProvider from '@chatbotkit-dev/queue'
import { withQueue } from '@/lib/queue'
import { parseRequestJson } from '@/lib/request'
import { ok } from '@/lib/response'

// @note the body this parses is the installed queue's own failure report, not
// a shape the platform defines - `dlqId` in particular is whatever handle that
// queue uses for a delivery it gave up on.
//
// @todo have the queue interpret its own callback body and hand back a neutral
// shape, the way it already does for authentication. Until then this route
// knows one backend's format, and a second one would need it to know two.

export default withQueue(async function (req) {
  const { status, header, body: _body, dlqId } = await parseRequestJson(req)

  const body = _body ? Buffer.from(_body, 'base64').toString() : ''

  debug('received failure callback', {
    status: status,
    header: header,
    body: body,
    dlqId: dlqId,
  })

  // @todo consider if we should capture all 4xx errors

  switch (status) {
    case 401:
    case 402:
    case 403: {
      await queueProvider.discardFailedDeliveries([dlqId])

      break
    }

    case 404: {
      await queueProvider.discardFailedDeliveries([dlqId])

      break
    }

    case 409: {
      await queueProvider.discardFailedDeliveries([dlqId])

      break
    }

    case 429: {
      await queueProvider.discardFailedDeliveries([dlqId])

      break
    }

    // @note for 5xx errors, let the queue system handle retries
    default: {
      if (status >= 500) {
        debug('5xx error, allowing queue retry', { status, dlqId }).log() // @note always log

        // @note don't delete from DLQ - allow retries
      }

      break
    }
  }

  return ok()
})

export const config = {
  api: {
    bodyParser: false,
  },
}

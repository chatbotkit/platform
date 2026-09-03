// @ts-check
import debug from '@/lib/debug'
import { withQueue } from '@/lib/queue'
import { parseRequestJson } from '@/lib/request'
import { ok } from '@/lib/response'

export default withQueue(async function (req) {
  const { status, header, body, dlqId } = await parseRequestJson(req)

  debug('received callback', {
    status: status,
    header: header,
    body: body ? Buffer.from(body, 'base64').toString() : '',
    dlqId: dlqId,
  })

  // @todo use the header or the body to detect if we should be logging the callback

  return ok()
})

export const config = {
  api: {
    bodyParser: false,
  },
}

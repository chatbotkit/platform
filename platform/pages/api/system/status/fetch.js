// @ts-check
import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export default withGet(
  withSession(async function () {
    // @todo implement actual system status fetching logic to obtain real status
    // information form system logs

    return ok({ status: 'ok' })
  })
)

// @ts-check
import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'

export default withGet(async function (_req) {
  return ok({ status: 'ok' })
})

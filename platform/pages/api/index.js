// @ts-check
import { withAny } from '@/lib/method'
import { notFound } from '@/lib/response'

export default withAny(async function (_req) {
  return notFound()
})

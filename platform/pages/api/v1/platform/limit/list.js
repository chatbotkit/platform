// @ts-check
import limits from '@/config/limits'

import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'

// @todo needs more work and standardization

export default withGet(async function (_req) {
  return ok(limits)
})

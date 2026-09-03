import { withAny } from '@/lib/method'

// @note deliberately unauthenticated for now: an error-reporting smoke probe
// for the observability module. Expected to gain a session gate later.

export default withAny(async function () {
  throw new Error('This is a debug error from /api/debug/throw')
})

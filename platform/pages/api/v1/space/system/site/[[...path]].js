// @ts-check
import { withAny } from '@/lib/method'
import { methodNotAllowed } from '@/lib/response'
import { handleSpaceSiteRequest } from '@/lib/space.site.serve'

// @note public serving route for SpaceSite static websites. A
// `<slug>.<space apex>` host is rewritten here by spaces.config.js. The
// request carries no spaceId, so the SpaceSite slug is extracted from the
// request host and the backing space's storage is served. This optional
// catch-all owns the root and every sub-path, so the directory index is served
// at `/` with `<base href="/">`.
//
// `system` is a literal segment under `/space`, so it takes precedence over the
// `[spaceId]` management routes (which only ever see real space ids).
export default withAny(async function (req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return methodNotAllowed()
  }

  return handleSpaceSiteRequest(req, req.method === 'HEAD')
})

// @note static assets can exceed the default 4MB API response limit
export const config = {
  api: {
    responseLimit: false,
  },
}

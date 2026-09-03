// @ts-check
import { getExternalHostURL } from '@/lib/host'
import { withAny } from '@/lib/method'
import { redirect } from '@/lib/response'

// @note This is a redirect shim for external OAuth providers. The URL
// /api/oauth/secret/callback is registered as the redirect URI with third-party
// providers when users connect secrets/integrations. It forwards the incoming
// request (preserving query params) to the actual frontend callback page
// at /secrets/oauth/callback.

export default withAny(async function (req) {
  const url = getExternalHostURL(
    '/secrets/oauth/callback' + new URL(req.url, 'http://localhost').search
  )

  return redirect(new URL(url))
})

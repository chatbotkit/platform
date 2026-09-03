import {
  getContextFrontendHost,
  getContextRequestHost,
  getContextRequestProtocol,
} from '@/lib/context.store'
import {
  getExternalAPIHostURL,
  getExternalFrontendHostURL,
  getExternalHostURL,
} from '@/lib/host'
import { withAny } from '@/lib/method'
import { ok } from '@/lib/response'

// @note deliberately unauthenticated for now: it only reports how this
// deployment resolves its own hosts, which is the information a self-hoster
// needs when debugging proxy and host configuration. Expected to gain a
// session gate later.

export default withAny(async function (_req) {
  return ok({
    host: getContextRequestHost(),
    protocol: getContextRequestProtocol(),
    frontendHost: getContextFrontendHost(),

    // ---

    getExternalHostURL: getExternalHostURL('/api/v1/debug/header'),
    externalAPIHostURL: getExternalAPIHostURL('/v1/debug/header'),
    externalFrontendHostURL: getExternalFrontendHostURL('/api/v1/debug/header'),
  })
})

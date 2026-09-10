// @ts-check
import {
  getContextAPIHost,
  getContextFrontendHost,
  getContextRequestHost,
  getContextRequestProtocol,
} from '@/lib/context.store'
import {
  getExternalAPIHost,
  getExternalAPIHostURL,
  getExternalFrontendHostURL,
} from '@/lib/host'
import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'

import fs from 'fs'
import path from 'path'

export default withGet(async function (req) {
  // @todo move the spec from the public folder

  const specPath = path.join(process.cwd(), 'public', 'api', 'v1', 'spec.json')

  const specContent = fs.readFileSync(specPath, 'utf-8')

  const spec = JSON.parse(specContent)

  const mappedAPIHost = getContextAPIHost()

  const host =
    mappedAPIHost ||
    getContextFrontendHost() || getContextRequestHost() || getExternalAPIHost()

  // @note without a request scheme the host decides: loopback and the site
  // host follow the deployment, anything else is https
  const protocol =
    getContextRequestProtocol() ||
    new URL(getExternalFrontendHostURL('/', host)).protocol.slice(0, -1)

  const requestUrl = new URL(req.url)

  const basePath = requestUrl.pathname.replace(/\/spec$/, '')

  // @note a mapping may serve its API separately from its frontend, with a
  // different route prefix from the origin on which the spec was requested
  const serverUrl = mappedAPIHost
    ? getExternalAPIHostURL(
        basePath.replace(/^\/api(?=\/|$)/, ''),
        mappedAPIHost
      )
    : new URL(basePath, `${protocol}://${host}`).toString()

  spec.servers = [
    {
      url: serverUrl,
    },
  ]

  return ok(spec)
})

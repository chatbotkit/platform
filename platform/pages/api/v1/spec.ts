// @ts-check
import {
  getContextFrontendHost,
  getContextRequestHost,
  getContextRequestProtocol,
} from '@/lib/context.store'
import { getExternalAPIHost } from '@/lib/host'
import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'

import fs from 'fs'
import path from 'path'

export default withGet(async function (req) {
  // @todo move the spec from the public folder

  const specPath = path.join(process.cwd(), 'public', 'api', 'v1', 'spec.json')

  const specContent = fs.readFileSync(specPath, 'utf-8')

  const spec = JSON.parse(specContent)

  const host =
    getContextFrontendHost() || getContextRequestHost() || getExternalAPIHost()

  const protocol = getContextRequestProtocol() || 'https'

  const requestUrl = new URL(req.url)

  const basePath = requestUrl.pathname.replace(/\/spec$/, '')

  const serverUrl = new URL(basePath, `${protocol}://${host}`)

  spec.servers = [
    {
      url: serverUrl.toString(),
    },
  ]

  return ok(spec)
})

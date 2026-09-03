// @ts-check
import { html2text } from '@chatbotkit-dev/file-html/parse'

import { CACHE_PRESETS, getCacheHeaders } from '@/lib/cdn'
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import { withTimeout } from '@/lib/fetch'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { normalizeText } from '@/lib/string'

export const FETCH_TIMEOUT = 10000

const fetchWithTimeout = withTimeout(fetch, { timeout: FETCH_TIMEOUT })

export async function fetchPage(url) {
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
      Accept: '*/*',
    },
  })

  if (!response.ok) {
    return ''
  }

  const html = await response.text()

  return html2text(html, { url })
}

export const bodySchema = schema.object({
  url: schema
    .string()
    .uri({
      scheme: ['http', 'https'],
    })
    .required(),
})

export default withPost(
  withSessionLimits(
    ['fetch'],
    withSchema(bodySchema, async function (_req, _session, body) {
      const { url } = body

      const headers = getCacheHeaders(CACHE_PRESETS.URL)

      debug(`importing url`, { url })

      const page = await fetchPage(url.trim())

      debug(`received page`, { page })

      const text = normalizeText(page)

      debug(`normalized text`, { text })

      return ok({ text }, headers)
    })
  )
)

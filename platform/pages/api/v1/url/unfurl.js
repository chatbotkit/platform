// @ts-check
import { CACHE_PRESETS, getCacheHeaders } from '@/lib/cdn'
import debug from '@/lib/debug'
import commonFetch from '@/lib/egress.fetch'
import { withNextCache, withTimeout } from '@/lib/fetch'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import unfurl from '@/lib/unfurl.fetch'

export const FETCH_TIMEOUT = 10000

const fetch = withNextCache(
  withTimeout(commonFetch, { timeout: FETCH_TIMEOUT }),
  { tags: ['unfurl'] }
)

export async function unfurlPage(url) {
  const response = await fetch(url, {
    headers: {
      // @todo use the latest browser user agent

      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
      Accept: '*/*',
    },
  })

  if (!response.ok) {
    return {
      data: {},
    }
  }

  const html = await response.text()

  return {
    html: html,
    data: await unfurl({ url, html }),
  }
}

export const bodySchema = schema.object({
  url: schema
    .string()
    .uri({
      scheme: ['http', 'https'],
      domain: {
        tlds: {
          allow: true,
        },
      },
    })
    .required(),
})

export default withPost(
  withSessionLimits(
    ['fetch'],
    withSchema(bodySchema, async function (_req, _session, body) {
      const { url } = body

      const headers = getCacheHeaders(CACHE_PRESETS.URL)

      try {
        debug(`importing url`, { url })

        const { data } = await unfurlPage(url.trim())

        debug(`received page`, { data })

        return ok({ data }, headers)
      } catch {
        return ok({ data: {} }, headers)
      }
    })
  )
)

// @note disabled because we are getting errors in jsdom

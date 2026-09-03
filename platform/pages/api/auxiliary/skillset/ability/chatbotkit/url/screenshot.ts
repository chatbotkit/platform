/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- operator screenshot service */
import screenshot from '@chatbotkit-dev/screenshot'

import { authenticatedHandler } from '@/lib/auxiliary.handler'
import debug from '@/lib/debug'
import fetch, { getFetchError } from '@/lib/fetch'

import { z } from 'zod'

// @note the capture can take a while on a heavy page; we give it some headroom
// and rely on the default (non-retrying) fetch so a slow capture is never
// re-triggered
const SCREENSHOT_TIMEOUT_MS = 60_000

const schema = z.object({
  url: z.string().url(),
  fullPage: z.boolean().optional(),
  format: z.enum(['png', 'jpeg', 'webp']).optional(),
  viewportWidth: z.number().int().optional(),
  viewportHeight: z.number().int().optional(),
  selector: z.string().optional(),
  darkMode: z.boolean().optional(),
  delay: z.number().int().optional(),
})

export type Schema = z.infer<typeof schema>

export default authenticatedHandler(
  schema,
  async function (_session, parameters, headers) {
    debug(`chatbotkit/url/screenshot`, { parameters, headers }).log(
      'auxiliary.skillset.ability.chatbotkit.url.screenshot'
    )

    const {
      url,
      fullPage,
      format,
      viewportWidth,
      viewportHeight,
      selector,
      darkMode,
      delay,
    } = parameters

    // @note the query string this used to build by hand has moved behind
    // `@chatbotkit-dev/screenshot`, along with the credential. The two had already
    // drifted: this endpoint supported six of the options `lib/webshot.ts` did and
    // never signed its URLs, so a deployment whose backend required signatures had
    // a screenshot ability that could not take one.

    const capture = screenshot.request(url, {
      fullPage,
      format,
      viewportWidth,
      viewportHeight,
      selector,
      darkMode,
      delay,
    })

    debug(`capturing`, { url: capture.url }).log(
      'auxiliary.skillset.ability.chatbotkit.url.screenshot'
    )

    const response = await fetch(capture.url, {
      headers: capture.headers,
      signal: AbortSignal.timeout(SCREENSHOT_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw await getFetchError(response, { url })
    }

    // @note the worker has already rendered and edge-cached the screenshot by the
    // time it responds, so we discard the image bytes and hand back the canonical
    // (renderable, cacheable) url instead of inlining a large base64 payload
    await response.body?.cancel()

    const result = {
      url: capture.url,
      format: format ?? 'png',
      fullPage: Boolean(fullPage),
      contentType: response.headers.get('content-type'),
      // @todo the last backend detail left in the platform - move this
      // behind the contract if a second capture backend ever appears
      cache: response.headers.get('x-cf-webshot-cache'),
    }

    debug(`captured`, { result }).log(
      'auxiliary.skillset.ability.chatbotkit.url.screenshot'
    )

    return result
  }
)

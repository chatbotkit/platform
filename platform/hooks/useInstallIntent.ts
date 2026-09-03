import { useEffect, useState } from 'react'

import { INTEGRATION_INSTALL_INTENT_PARAM } from '@/lib/integration.verification'

/**
 * Whether the current location asks for the install instructions to be opened
 * on arrival.
 *
 * The setup checklist on the overview links an unconfigured integration to its
 * page through `getIntegrationVerification`, which puts the install flag on the
 * url. Pressing "Install" there is the user saying what they want; making them
 * find and press the very same button again on the page they land on asks them
 * to say it twice.
 *
 * The flag is read during render and cleared in an effect, which is what lets a
 * page carry more than one install button - Slack has three - without the first
 * one to mount stealing the flag from the rest. Every instance of a single
 * commit sees the same answer; a later remount, which is what a back navigation
 * is, finds the flag gone and reports nothing. That is the point of clearing
 * it: a popup the user has already dismissed should not come back on refresh.
 *
 * Reading the location rather than the router is deliberate. The router merges
 * the route params into its query, and navigating to drop the flag would remount
 * the very form the instructions are rendered over.
 */
export default function useInstallIntent(
  param: string = INTEGRATION_INSTALL_INTENT_PARAM
): boolean {
  const [intent] = useState(() => {
    // @note the server has no location to read, and renders no popup either -
    // the instructions open from the effect below, so the markup agrees
    if (typeof window === 'undefined') {
      return false
    }

    return new URLSearchParams(window.location.search).has(param)
  })

  useEffect(() => {
    if (!intent) {
      return
    }

    const url = new URL(window.location.href)

    // @note another instance of the same commit may have cleared it already
    if (!url.searchParams.has(param)) {
      return
    }

    url.searchParams.delete(param)

    window.history.replaceState(
      null,
      '',
      `${url.pathname}${url.search}${url.hash}`
    )
  }, [intent, param])

  return intent
}

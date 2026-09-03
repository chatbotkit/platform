import { useState } from 'react'

import useHydrationSafeLayoutEffect from '@/hooks/useHydrationSafeLayoutEffect'

/**
 * Read partner branding from the `data-partner-*` attributes that
 * `_document.jsx` stamps on `<html>` based on the request host. Populated
 * for SSR pages (e.g. `/overview`) where the host header is known at
 * render time.
 */
export function getPartnerFromDocument() {
  if (typeof document === 'undefined') {
    return null
  }

  const root = document.documentElement

  if (!root || root.dataset.partner !== '1') {
    return null
  }

  return {
    name: root.dataset.partnerName,
    logo: root.dataset.partnerLogo,
    icon: root.dataset.partnerIcon,
    whitelabel: root.dataset.partnerWhitelabel === '1',
    experience: root.dataset.partnerExperience,
  }
}

/**
 * Fallback used when the server-rendered HTML does not carry partner data
 * attributes (e.g. statically generated pages served from a partner domain
 * - the host header is not known at build time). Branding is emitted
 * per-host as a `Server-Timing: partner;desc="<base64 json>"` response
 * header by the CDN rules in `next.config.d/partner.config.js`.
 */
function getPartnerFromServerTiming() {
  if (typeof performance === 'undefined') {
    return null
  }

  const [navigation] = performance.getEntriesByType('navigation')

  const entry = navigation?.serverTiming?.find(({ name }) => name === 'partner')

  if (!entry?.description) {
    return null
  }

  try {
    const branding = JSON.parse(atob(entry.description))

    return {
      name: branding.name,
      logo: branding.logo,
      icon: branding.icon,
      whitelabel: !!branding.whitelabel,
      experience: branding.experience,
    }
  } catch {
    return null
  }
}

/**
 * Custom hook to read partner branding information based on the request host.
 */
export default function usePartner() {
  const [documentPartner, setDocumentPartner] = useState(null)

  // @note keep the initial render null so hydration matches the server HTML,
  // then resolve partner data in a layout effect on the client so the update
  // lands before paint and avoids a visible post-hydration flash.
  useHydrationSafeLayoutEffect(() => {
    setDocumentPartner(getPartnerFromDocument() ?? getPartnerFromServerTiming())
  }, [])

  return documentPartner
}

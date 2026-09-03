'use client'

import {
  GoogleAnalytics,
  GoogleTagManager,
  sendGTMEvent,
} from '@next/third-parties/google'

export const GTAG_ID = process.env.NEXT_PUBLIC_GTAG_ID

export function hasDataLayer() {
  try {
    return (
      typeof window !== 'undefined' &&
      window.dataLayer &&
      Array.isArray(window.dataLayer)
    )
  } catch {
    return false
  }
}

/**
 * @param {object} options
 * @param {string} options.event
 * @param {string} options.action
 * @param {string} options.category
 * @param {string} options.label
 * @param {number} options.value
 * @returns {void}
 */
export function event({ event, action, category, label, value }) {
  if (!hasDataLayer()) {
    return
  }

  sendGTMEvent({ event, action, category, label, value })
}

/**
 *
 * @param {string} event
 * @param {Record<string,any>} parameters
 * @returns {void}
 */
export function customEvent(event, parameters) {
  if (!hasDataLayer()) {
    return
  }

  sendGTMEvent({ ...parameters, event })
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @returns {import('react').JSX.Element|React.ReactNode}
 */
export default function GTag({ gtag = GTAG_ID, disabled, children, ...props }) {
  if (gtag && !disabled) {
    if (gtag.startsWith('GTM-')) {
      return <GoogleTagManager {...props} gtmId={gtag} />
    } else {
      return <GoogleAnalytics {...props} gaId={gtag} />
    }
  } else {
    return children
  }
}

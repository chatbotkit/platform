'use client'

import { useCallback, useEffect, useState } from 'react'

import { GTAG_ID } from '@/components/GTag'
import Link from '@/components/Link'

const CONSENT_STORAGE_KEY = 'chatbotkit-consent'
const CONSENT_VERSION = 1

const DEFAULT_CONSENT = {
  analytics: false,
  marketing: false,
}

function getStoredConsent() {
  try {
    const raw = window.localStorage?.getItem?.(CONSENT_STORAGE_KEY)

    if (!raw) {
      return null
    }

    const value = JSON.parse(raw)

    if (value?.version !== CONSENT_VERSION) {
      return null
    }

    return {
      analytics: Boolean(value.analytics),
      marketing: Boolean(value.marketing),
      version: CONSENT_VERSION,
      updatedAt: value.updatedAt || null,
    }
  } catch {
    return null
  }
}

function setStoredConsent(consent) {
  try {
    window.localStorage?.setItem?.(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        ...consent,
        version: CONSENT_VERSION,
        updatedAt: new Date().toISOString(),
      })
    )
  } catch {
    // @note consent still applies for the current page even if storage fails
  }
}

function pushDataLayer() {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(arguments)
}

function updateGoogleConsent(consent, command = 'update') {
  try {
    const consentState = {
      analytics_storage: consent.analytics ? 'granted' : 'denied',
      ad_storage: consent.marketing ? 'granted' : 'denied',
      ad_user_data: consent.marketing ? 'granted' : 'denied',
      ad_personalization: consent.marketing ? 'granted' : 'denied',
    }

    if (command === 'default') {
      consentState.wait_for_update = 500
    }

    pushDataLayer('consent', command, {
      ...consentState,
    })
  } catch {
    // pass
  }
}

function announceConsent(consent) {
  const detail = {
    analytics: Boolean(consent.analytics),
    marketing: Boolean(consent.marketing),
  }

  try {
    window.dispatchEvent(
      new CustomEvent('chatbotkit:consent', {
        detail,
      })
    )
  } catch {
    // pass
  }

  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'chatbotkit_consent_update',
      chatbotkit_consent_analytics: detail.analytics,
      chatbotkit_consent_marketing: detail.marketing,
    })
  } catch {
    // pass
  }
}

/**
 * Manages optional tracking consent for public landing and knowledge pages.
 *
 * @returns {import('react').JSX.Element|null}
 */
export default function Consent() {
  const [consent, setConsent] = useState()

  useEffect(() => {
    updateGoogleConsent(DEFAULT_CONSENT, 'default')

    const storedConsent = getStoredConsent()

    if (storedConsent) {
      updateGoogleConsent(storedConsent)
      announceConsent(storedConsent)
    }

    setConsent(storedConsent)
  }, [])

  const saveConsent = useCallback((nextConsent) => {
    setStoredConsent(nextConsent)
    updateGoogleConsent(nextConsent)
    announceConsent(nextConsent)
    setConsent(nextConsent)

    return {
      status: 'saved',
      consent: nextConsent,
    }
  }, [])

  const acceptAnalytics = useCallback(() => {
    return saveConsent({
      analytics: true,
      marketing: false,
    })
  }, [saveConsent])

  const acceptAll = useCallback(() => {
    return saveConsent({
      analytics: true,
      marketing: true,
    })
  }, [saveConsent])

  const decline = useCallback(() => {
    return saveConsent({
      analytics: false,
      marketing: false,
    })
  }, [saveConsent])

  // @note without a tag there is no tracking to consent to (community edition)
  if (!GTAG_ID || consent === undefined || consent !== null) {
    return null
  }

  return (
    <div className="fixed bottom-5 left-5 right-5 z-[2147483646] max-w-md sm:right-auto">
      <div
        className="bg-gradient-dynamic from-indigo-400 via-cyan-400 to-violet-500 p-[2px] animate-deg-rotate"
        style={{
          animationDuration: '9s',
        }}
      >
        <div className="auto-bg-gray-100 p-5 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-normal auto-text-gray-950">
                We value your privacy
              </h2>
              <p className="mt-2 text-sm leading-6 auto-text-gray-600">
                We use optional analytics to improve ChatBotKit and our
                marketing efforts, including LinkedIn ad performance. By
                clicking <strong>Accept All</strong> you consent to our use of
                cookies.
              </p>
              <p className="mt-2 text-sm">
                <Link className="default-link" href="/legal/privacy">
                  Learn more in our Privacy Policy
                </Link>
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                className="default-button small"
                type="button"
                onClick={decline}
              >
                Decline
              </button>
              <button
                className="default-button small"
                type="button"
                onClick={acceptAnalytics}
              >
                Analytics Only
              </button>
              <button
                className="primary-button small"
                type="button"
                onClick={acceptAll}
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

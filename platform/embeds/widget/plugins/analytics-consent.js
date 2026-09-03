async function main(instance) {
  window.dataLayer = window.dataLayer || []

  function gtag() {
    window.dataLayer?.push?.(arguments)
  }

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  })

  const localStorageKey = 'chatbotkit-analytics-consent'

  function grant() {
    localStorage?.setItem?.(localStorageKey, 'granted')

    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted',
    })
  }

  function deny() {
    localStorage?.setItem?.(localStorageKey, 'denied')

    gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    })
  }

  const status = localStorage?.getItem?.(localStorageKey) || 'unknown'

  if (status === 'granted') {
    grant()
  }

  if (status === 'denied') {
    deny()
  }

  if (status === 'unknown') {
    instance.registerFunctions({
      grantAnalyticsConsent: {
        description: 'Grant analytics consent',
        parameters: {},
        handler: () => {
          grant()

          return { status: 'granted' }
        },
      },
      denyAnalyticsConsent: {
        description: 'Deny analytics consent',
        parameters: {},
        handler: () => {
          deny()

          return { status: 'denied' }
        },
      },
    })

    instance.initiateMessage({
      text: [
        'Inform the user that use analytics technologies to better understand how you use our site and to enhance your experience.',
        'Offer them to accept or decline analytics usage using button like this:',
        '[Accept Analytics Usage]() [Decline Analytics]()',
      ].join('\n\n'),
    })
  }
}

main(window.chatbotkitWidgetPlugin.instance)

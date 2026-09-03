import { useEffect, useMemo, useState } from 'react'

import Script from 'next/script'

import { responseToDataUrl } from '@/lib/dataurl.response'
import fetch from '@/lib/fetch'
import { makeJsonSafe } from '@/lib/struct'
import { makeScreenshotRequest } from '@/lib/webshot'

import Component from '@/components/Component'
import PagePlaceholder, {
  DashboardPlaceholder,
} from '@/components/PagePlaceholder'
import Toggle from '@/components/Toggle'

export default function Test({
  widgetIntegrationId,

  targetUrl,
  targetUrlImage,

  placeholder,

  widgetsCount,

  withFunctions,
}) {
  const [isDark, setIsDark] = useState(false)

  const functions = useMemo(() => {
    if (!withFunctions) {
      return
    }

    return {
      toggleDarkMode: {
        description: 'Toggle dark mode',
        parameters: {},
        handler: () => {
          setIsDark((isDark) => !isDark)
        },
      },
      isDarkModeEnabled: {
        description: 'Checks if dark mode is enabled',
        parameters: {},
        result: {
          data: { isDark },
        },
      },
    }
  }, [withFunctions, isDark])

  useEffect(() => {
    if (!window.chatbotkitWidget?.instance) {
      return
    }

    if (functions) {
      window.chatbotkitWidget.instance.functions = functions
    }
  }, [functions])

  return (
    <>
      {Array.from({ length: widgetsCount }).map((_, index) => (
        <Script
          key={index}
          strategy="afterInteractive"
          id={`chatbotkit-widget-${index}`}
          src="/integrations/widget/v2.js"
          data-widget={widgetIntegrationId}
          data-cache="false"
          onLoad={() => {
            if (functions) {
              window.chatbotkitWidget.instance.functions = functions
            }
          }}
        />
      ))}
      <style jsx global>{`
        html,
        body {
          background-color: ${isDark ? '#000000' : '#ffffff'} !important;
        }
      `}</style>
      {targetUrl ? (
        <iframe
          className="w-screen h-screen absolute top-0 bottom-0 left-0 right-0"
          src={targetUrl}
          allow=""
          sandbox=""
        />
      ) : targetUrlImage ? (
        <img
          className="w-screen absolute top-0 bottom-0 left-0 right-0"
          src={targetUrlImage}
          alt="screenshot"
        />
      ) : (
        <>
          <div className="p-5 min-h-screen">
            <div className="fixed left-5 bottom-5">
              <Toggle
                checked={isDark}
                setChecked={(checked) => setIsDark(checked)}
              />
            </div>
            <Component
              className="max-w-6xl mx-auto pt-6 p-4 space-y-4 h-full"
              as={
                {
                  page: PagePlaceholder,
                  dashboard: DashboardPlaceholder,
                }[placeholder] || PagePlaceholder
              }
              isDark={isDark}
            />
          </div>
        </>
      )}
    </>
  )
}

Test.theme = 'light'

export async function getServerSideProps({ params, query }) {
  const widgetIntegrationId = params.widgetIntegrationId

  if (!widgetIntegrationId) {
    return {
      notFound: true,
    }
  }

  let targetUrl = query.targetUrl?.trim()

  if (targetUrl) {
    if (!targetUrl.startsWith('http')) {
      targetUrl = `https://${targetUrl}`
    }
  } else {
    targetUrl = null
  }

  let targetUrlImage = query.targetUrlImage?.trim()

  if (targetUrlImage) {
    if (!targetUrlImage.startsWith('http')) {
      targetUrlImage = `https://${targetUrlImage}`
    }

    const { url: screenshotUrl, headers: screenshotHeaders } =
      makeScreenshotRequest(targetUrlImage, {
        format: 'jpeg',
        fullPage: true,
        imageQuality: 80,
        cacheTtl: 14400,
        timeout: 60_000,
        block: true,
      })

    const response = await fetch(screenshotUrl, { headers: screenshotHeaders })

    if (!response.ok) {
      throw new Error('Failed to fetch image')
    }

    targetUrlImage = await responseToDataUrl(response)
  } else {
    targetUrlImage = null
  }

  const placeholder = query.placeholder

  return {
    props: makeJsonSafe({
      widgetIntegrationId,

      targetUrl,
      targetUrlImage,

      placeholder,

      widgetsCount: Math.abs(parseInt(query.count) || 1),

      withFunctions: query.withFunctions === 'true',
    }),
  }
}

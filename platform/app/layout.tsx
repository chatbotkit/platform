/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- stamps the runtime hosts onto <html> per request; the constants are the build-time fallback */
import type { Metadata } from 'next'
import { headers } from 'next/headers'

import observability from '@chatbotkit-dev/observability'

import { appApex, partnersApex, portalApex, spaceApex } from '@/config/apexes'
import { appLabsHost, appMainHost } from '@/config/origins'
import { siteHostname } from '@/config/site'

import { setupHeadersContext } from '@/lib/context.setup'
import {
  executeInContext,
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'
import {
  getExternalAPIHost,
  getExternalFrontendHost,
  getExternalStaticHost,
  getExternalWidgetHost,
} from '@/lib/host'

import ChunkErrorListener from '@/components/ChunkErrorListener'
import GlobalRoot from '@/components/GlobalRoot'

export function generateMetadata(): Metadata {
  return {
    title: 'ChatBotKit',
    description: 'Revolutionize User Interaction With Smart AI Solutions',

    other: {
      ...observability.getTracePropagationData(),
    },
  }
}

export default async function RootLayout({ children }) {
  const thisHeaders = await headers()

  return executeInContext(async () => {
    setupHeadersContext(thisHeaders)

    const host =
      getContextFrontendHost() || getContextRequestHost() || siteHostname

    return (
      <html
        data-audience={host}
        data-site-host={getExternalFrontendHost()}
        data-static-host={getExternalStaticHost()}
        data-widget-host={getExternalWidgetHost()}
        data-api-host={getExternalAPIHost()}
        data-app-apex={appApex}
        data-portal-apex={portalApex}
        data-space-apex={spaceApex}
        data-partners-apex={partnersApex}
        data-app-main-host={appMainHost}
        data-app-labs-host={appLabsHost}
        // Suppress hydration warnings caused by browser extensions injecting
        // class/style attributes
        suppressHydrationWarning
      >
        <head />
        <body
          // Suppress hydration warnings caused by browser extensions injecting
          // DOM nodes into body
          suppressHydrationWarning
        >
          <ChunkErrorListener />
          <GlobalRoot
          // @note global-root must be a direct body sibling to #__next so it is
          // never inside the element that headlessUI Dialog marks as `inert` when
          // a modal opens. PopButton/MenuButton portals here; if this div were
          // inside #__next it would become inert and menus would be unclickable
          // inside any headlessUI Dialog.
          />
          {children}
        </body>
      </html>
    )
  })
}

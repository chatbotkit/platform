import { redirect } from 'next/navigation'

import {
  getPublicAppConfig,
  getUserAppConfig,
} from '@/lib/app.router.app.config'
import { getAppManifestPath } from '@/lib/app.router.app.manifest'
import { withAppRouterContext } from '@/lib/app.router.context'

import App from '@/layouts/App'

import {
  LEGACY_APP_NAME as LEGACY_STATIC_APP_NAME,
  APP_NAME as STATIC_APP_NAME,
} from '@/app/apps/static/const'

async function generateMetadataImpl() {
  const config = await getPublicAppConfig()

  const {
    name = 'ChatBotKit',
    description = 'Discover a range of cutting-edge conversational AI apps, each uniquely designed and powered by the advanced capabilities of the ChatBotKit platform. Our collection offers diverse AI tools to enhance user interaction and engagement in various domains.',
  } = config || {}

  return {
    title: name,
    description: description,
    keywords:
      'ChatBotKit AI applications, conversational AI solutions, innovative AI tools, advanced chatbot apps, ChatBotKit platform tools, interactive AI solutions, AI-powered tools, user engagement AI apps, conversational AI innovations, ChatBotKit app collection, online AI interaction tools',
    manifest: getAppManifestPath(),
  }
}

async function Layout({ children }) {
  // @note if the portal has the Static app configured, redirect the root to
  // it. This is read from the public (unauthenticated) config and runs before
  // `getUserAppConfig` so the static site is reachable without portal sign-in
  // (the app route handler is itself public).
  {
    const publicConfig = await getPublicAppConfig()
    const publicApps = publicConfig?.apps

    if (
      publicApps &&
      (STATIC_APP_NAME in publicApps || LEGACY_STATIC_APP_NAME in publicApps)
    ) {
      redirect(`/${STATIC_APP_NAME}`)
    }
  }

  const config = await getUserAppConfig(':index')

  if (config) {
    const { apps } = config || []

    const entries = Object.entries(apps || {}).filter(([, app]) => !app?.hidden)

    // @todo document this logic in the portal docs

    // if there is only one app, skip the home page and redirect to that app
    {
      if (entries.length === 1) {
        return redirect(`/${entries[0][0]}`) // @note the assumption here is that this is access from sub-domain hence we don't use /app/ prefix
      }
    }

    // if there is a default app, skip the home page and redirect to that app
    {
      const defaultApp = entries.find(([, app]) => app?.default)?.[0]

      if (defaultApp) {
        return redirect(`/${defaultApp}`) // @note the assumption here is that this is access from sub-domain hence we don't use /app/ prefix
      }
    }

    // if the home page is disabled, redirect to the first app
    {
      if (config?.home === false) {
        return redirect(`/${entries[0][0]}`) // @note the assumption here is that this is access from sub-domain hence we don't use /app/ prefix
      }
    }
  }

  return (
    <App goBackTo=":prev" config={config}>
      {children}
    </App>
  )
}

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

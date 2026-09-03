import { getPublicAppConfig } from '@/lib/app.router.app.config'
import { getAppManifestPath } from '@/lib/app.router.app.manifest'
import { withAppRouterContext } from '@/lib/app.router.context'

import Confirm from '@/components/Confirm'

import manifest from './app.manifest'
import { APP_NAME } from './const'

async function generateMetadataImpl() {
  const config = await getPublicAppConfig()

  const { name = manifest.name, description = manifest.description } =
    config || {}

  return {
    title: name,
    description: description,
    keywords: 'chatbotkit, media, image, graph, generation, ai, canvas',
    manifest: getAppManifestPath(APP_NAME),
  }
}

// @note this root layout intentionally stays minimal - the actual app chrome is
// applied per route group: `(home)` renders the standard header layout while
// `[projectId]` renders a focused, fullscreen editor with no chrome
async function Layout({ children }) {
  return <Confirm>{children}</Confirm>
}

export const maxDuration = 800

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

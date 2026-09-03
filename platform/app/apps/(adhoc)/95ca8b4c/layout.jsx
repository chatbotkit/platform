import {
  getPublicAppConfig,
  getUserAppConfig,
} from '@/lib/app.router.app.config'
import { getAppManifestPath } from '@/lib/app.router.app.manifest'
import { withAppRouterContext } from '@/lib/app.router.context'

import App from '@/layouts/App'
import { Error } from '@/layouts/Errata'

import manifest from './app.manifest'
import { Main } from './components'
import { APP_NAME } from './const'
import { listNoteStreams } from './server'

async function generateMetadataImpl() {
  const config = await getPublicAppConfig()

  const { name = manifest.name, description = manifest.description } =
    config || {}

  return {
    title: name,
    description: description,
    keywords: '',
    manifest: getAppManifestPath(APP_NAME),
  }
}

async function Layout({ children }) {
  const [config, result] = await Promise.all([
    getUserAppConfig(APP_NAME),
    listNoteStreams({}),
  ])

  if (!result) {
    return (
      <div className="main-page main-page-3xl">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in result) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={result.error.code}
          error_description={result.error.message}
        />
      </div>
    )
  }

  return (
    <App
      slug={APP_NAME}
      goBackTo=":prev"
      config={config}
      showHeader={false}
      showFooter={false}
    >
      <Main noteStreams={result}>{children}</Main>
    </App>
  )
}

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

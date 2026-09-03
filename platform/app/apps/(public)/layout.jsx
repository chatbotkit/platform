import { getPublicAppConfig } from '@/lib/app.router.app.config'
import { withAppRouterContext } from '@/lib/app.router.context'

import { AppProvider } from '@/layouts/App'

async function generateMetadataImpl() {
  const config = await getPublicAppConfig()

  const { name = '', description = '' } = config || {}

  return {
    title: name,
    description: description,
    keywords: '',
  }
}

async function Layout({ children }) {
  // @note the reason we use public config here is because this layout is used
  // for public access only

  const config = await getPublicAppConfig()

  return <AppProvider config={config}>{children}</AppProvider>
}

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

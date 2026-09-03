import { getUserAppConfig } from '@/lib/app.router.app.config'
import { withAppRouterContext } from '@/lib/app.router.context'

import App from '@/layouts/App'

import { APP_NAME } from '../const'

async function HomeLayout({ children }) {
  const config = await getUserAppConfig(APP_NAME)

  return (
    <App slug={APP_NAME} goBackTo=":prev" config={config}>
      {children}
    </App>
  )
}

export const maxDuration = 800

export default withAppRouterContext(HomeLayout)

import { getUserAppConfig } from '@/lib/app.router.app.config'
import { withAppRouterContext } from '@/lib/app.router.context'

import App from '@/layouts/App'

import { APP_NAME } from '../../const'

// @note the editor is a focused, fullscreen canvas: no header, footer or
// sidebar. We keep the floating nav so the profile dropdown stays available;
// the editor injects its own buttons next to it via AppNavExtra and renders a
// matching back button on the top left.
async function ProjectLayout({ children }) {
  const config = await getUserAppConfig(APP_NAME)

  return (
    <App
      slug={APP_NAME}
      goBackTo=":prev"
      config={config}
      showHeader={false}
      showFooter={false}
      showSidebar={false}
    >
      {children}
    </App>
  )
}

export const maxDuration = 800

export default withAppRouterContext(ProjectLayout)

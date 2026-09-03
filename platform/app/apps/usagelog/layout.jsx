import {
  getPublicAppConfig,
  getUserAppConfig,
} from '@/lib/app.router.app.config'
import { getAppManifestPath } from '@/lib/app.router.app.manifest'
import { withAppRouterContext } from '@/lib/app.router.context'

import App from '@/layouts/App'

import manifest from './app.manifest'
import { APP_NAME } from './const'

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
  const config = await getUserAppConfig(APP_NAME)

  return (
    <App
      slug={APP_NAME}
      goBackTo=":prev"
      config={config}
      showNav={false}
      showHeader={false}
      showFooter={false}
    >
      {children}
    </App>
  )
}

/**
 * @doc Apps
 * @index 74
 *
 * ## [Usage Logs](https://chatbotkit.com/apps/usagelog)
 *
 * Usage Logs provides detailed usage record analysis and viewing capabilities,
 * offering granular visibility into resource consumption, token usage, and
 * operational activity across your ChatBotKit account. This developer-focused
 * application enables technical teams to understand precisely how platform
 * resources are being utilized and identify optimization opportunities.
 *
 * ### Core Features of Usage Logs
 *
 * - **Granular Usage Records**: Usage Logs captures detailed records of every
 *   resource consumption event, providing a complete picture of how tokens,
 *   API calls, and platform features are being used across all your
 *   deployments.
 * - **Resource Attribution**: Track usage back to specific bots, conversations,
 *   and integrations, enabling accurate attribution of resource consumption and
 *   supporting cost allocation across different projects or teams.
 * - **Historical Analysis**: Access historical usage records to identify trends,
 *   seasonal patterns, and growth trajectories that inform capacity planning
 *   and budget forecasting for your AI operations.
 * - **Anomaly Detection**: Monitor usage patterns to identify unusual
 *   consumption spikes or unexpected resource usage that may indicate
 *   configuration issues or unauthorized activity.
 *
 * ### Optimize Resource Utilization with Usage Logs
 *
 * Usage Logs transforms granular platform activity data into actionable
 * insights that help technical teams optimize resource efficiency and control
 * costs. By providing detailed visibility into exactly how platform resources
 * are consumed, Usage Logs enables informed decisions about bot configuration,
 * conversation design, and infrastructure allocation.
 *
 * Whether you are investigating unexpected token consumption, verifying that
 * usage patterns align with expected behavior, or building reports for
 * stakeholders, Usage Logs provides the detailed usage history necessary to
 * manage your ChatBotKit resources effectively.
 */

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

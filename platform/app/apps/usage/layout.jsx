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
    <App slug={APP_NAME} goBackTo=":prev" config={config}>
      {children}
    </App>
  )
}

/**
 * @doc Apps
 * @index 40
 *
 * ## [Usage](https://chatbotkit.com/apps/usage)
 *
 * Usage provides comprehensive account usage analytics and general statistics, offering detailed insights into platform utilization, performance metrics, and resource consumption across all ChatBotKit services. This essential application enables organizations to monitor their AI deployment effectiveness, track usage patterns, and optimize their ChatBotKit investment through data-driven insights.
 *
 * ### Core Features of Usage
 *
 * - **Comprehensive Analytics**: Track detailed usage metrics across all ChatBotKit services, including conversation volumes, API calls, token consumption, and feature utilization patterns that provide complete visibility into your AI operations.
 * - **Performance Monitoring**: Monitor response times, error rates, and system performance metrics to ensure optimal AI service delivery and identify areas for improvement.
 * - **Cost Analysis**: Understand resource consumption patterns and associated costs, enabling informed decisions about scaling, optimization, and budget planning for your AI initiatives.
 * - **Historical Reporting**: Access detailed historical data and trends that reveal usage patterns over time, supporting strategic planning and capacity management decisions.
 *
 * ### Optimize Your AI Investment with Usage
 *
 * Usage transforms raw platform data into actionable business intelligence, enabling organizations to maximize the value of their ChatBotKit investment. By providing detailed insights into how AI services are being utilized, Usage empowers teams to identify optimization opportunities, plan for scaling, and ensure efficient resource allocation across their AI operations.
 *
 * Whether you're managing multiple chatbots, tracking API usage across different applications, or analyzing the effectiveness of various AI implementations, Usage provides the comprehensive analytics necessary to make informed decisions about your conversational AI strategy.
 */

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

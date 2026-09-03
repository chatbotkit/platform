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
 * @index 60
 *
 * ## [Trace](https://chatbotkit.com/apps/trace)
 *
 * Trace serves as an advanced traceability and debugging tool for ChatBotKit, providing detailed insights into AI decision-making processes, conversation flows, and system performance. Unlike other ChatBotKit apps, Trace is uniquely designed as a universal debugging tool that's always available throughout the platform and doesn't require installation in portals.
 *
 * ### Core Features of Trace
 *
 * - **Conversation Flow Analysis**: Trace provides comprehensive visibility into how conversations flow through the ChatBotKit system, showing each step of the AI decision-making process and enabling detailed analysis of conversation patterns and behaviors.
 * - **Performance Debugging**: The application offers sophisticated debugging capabilities that help technical teams identify performance bottlenecks, optimize AI responses, and troubleshoot issues across the entire conversational AI stack.
 * - **Real-time Monitoring**: Trace operates in real-time, allowing developers and technical teams to observe AI operations as they happen, providing immediate insights into system behavior and performance characteristics.
 * - **Universal Accessibility**: As a platform-wide debugging tool, Trace is accessible from anywhere within the ChatBotKit ecosystem, including within portal environments, making it an essential tool for maintaining and optimizing AI operations.
 *
 * ### Universal Debugging Tool
 *
 * Trace stands apart from other ChatBotKit apps because it serves as a universal debugging and analysis tool that's integrated throughout the entire platform. Whether you're working within the main ChatBotKit interface, operating within custom portals, or debugging specific conversation flows, Trace is always accessible to provide insights and debugging capabilities.
 */

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

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
 * @index 70
 *
 * ## [Event Logs](https://chatbotkit.com/apps/eventlog)
 *
 * Event Logs provides advanced event log analysis and viewing capabilities,
 * offering detailed insights into system events, conversation triggers, and
 * platform activities across your ChatBotKit ecosystem. This developer-focused
 * application enables technical teams to monitor, analyze, and troubleshoot
 * AI operations through comprehensive event stream visibility.
 *
 * ### Core Features of Event Logs
 *
 * - **Real-time Event Streaming**: Event Logs captures and displays platform
 *   events as they occur, providing immediate visibility into conversation
 *   flows, API calls, and system interactions that drive your AI-powered
 *   applications.
 * - **Advanced Log Analysis**: The application offers sophisticated filtering
 *   and search capabilities that allow developers to quickly isolate specific
 *   event types, identify patterns, and diagnose issues across large volumes
 *   of event data.
 * - **Conversation Event Tracking**: Track detailed conversation-level events
 *   including message processing, intent recognition, and AI decision points,
 *   enabling deep analysis of how your conversational AI performs in
 *   production.
 * - **Integration Debugging**: Event Logs provides visibility into integration
 *   events and webhook triggers, making it easier to verify that external
 *   service connections are functioning correctly.
 *
 * ### Gain Deep Operational Visibility with Event Logs
 *
 * Event Logs transforms raw platform activity into structured, searchable
 * event streams that development and operations teams can use to understand
 * system behavior and resolve issues quickly. By providing comprehensive
 * event visibility in a developer-friendly interface, Event Logs accelerates
 * debugging cycles and supports proactive monitoring of your AI deployments.
 *
 * Whether you are troubleshooting unexpected conversation behaviors,
 * verifying integration triggers, or analyzing the performance
 * characteristics of your AI workflows, Event Logs provides the event-level
 * detail necessary to maintain reliable, high-quality conversational AI
 * applications.
 */

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

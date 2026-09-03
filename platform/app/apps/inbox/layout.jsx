import {
  getPublicAppConfig,
  getUserAppConfig,
} from '@/lib/app.router.app.config'
import { getAppManifestPath } from '@/lib/app.router.app.manifest'
import { withAppRouterContext } from '@/lib/app.router.context'

import App from '@/layouts/App'

import manifest from './app.manifest'
import { Main } from './components'
import ConfigSchema from './config'
import { APP_NAME } from './const'

/**
 * @todo add types once getPublicAppConfig is typed well
 */
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
  const config = await getUserAppConfig(APP_NAME, ConfigSchema)

  return (
    <App
      slug={APP_NAME}
      goBackTo=":prev"
      config={config}
      showHeader={false}
      showFooter={false}
      sidebarItems={[
        {
          title: 'Conversations',
          items: [{ title: 'Latest', href: '?tab=latest' }],
          expanded: true,
          collapsible: false,
        },
        ...(!!config.filters?.integration
          ? [
              {
                title: 'Integrations',
                items: [
                  { title: 'Widget', href: '?tab=widget' },
                  { title: 'Slack', href: '?tab=slack' },
                  { title: 'Discord', href: '?tab=discord' },
                  { title: 'Messenger', href: '?tab=messenger' },
                  { title: 'WhatsApp', href: '?tab=whatsapp' },
                  { title: 'Telegram', href: '?tab=telegram' },
                  { title: 'Email', href: '?tab=email' },
                  { title: 'Trigger', href: '?tab=trigger' },
                ],
                expanded: true,
                collapsible: false,
              },
            ]
          : []),
        ...(config.filters?.safety
          ? [
              {
                title: 'Safety',
                items: [{ title: 'Moderation', href: '?tab=moderation' }],
                expanded: true,
                collapsible: false,
              },
            ]
          : []),
        ...(config.filters?.console
          ? [
              {
                title: 'Other',
                items: [{ title: 'Console', href: '?tab=console' }],
                expanded: true,
                collapsible: false,
              },
            ]
          : []),
      ]}
    >
      <Main>{children}</Main>
    </App>
  )
}

/**
 * @doc Apps
 * @index 30
 *
 * ## [Inbox](https://chatbotkit.com/apps/inbox)
 *
 * Inbox represents a comprehensive solution for conversation management, designed to centralize and streamline the oversight of conversational AI interactions across your entire ChatBotKit ecosystem. This essential application addresses the growing need for effective conversation management as organizations scale their AI implementations and require sophisticated tools for monitoring, analyzing, and optimizing their conversational AI performance.
 *
 * ### Core Features of Inbox
 *
 * - **Centralized Message Management**: Inbox consolidates conversations from all connected channels and chatbots into a single, unified interface, providing complete visibility into your conversational AI ecosystem without the complexity of managing multiple separate dashboards.
 * - **Advanced Filtering and Search**: The application offers powerful filtering capabilities that allow teams to quickly locate specific conversations, analyze patterns, and identify trends across large volumes of conversational data with precision and efficiency.
 * - **Team Collaboration Tools**: Inbox facilitates seamless collaboration among team members, enabling shared access to conversations, collaborative analysis, and coordinated response strategies that enhance overall conversation quality and effectiveness.
 * - **Performance Analytics**: Built-in analytics provide insights into conversation performance, user satisfaction, and system effectiveness, enabling data-driven decisions that continuously improve AI performance and user experience.
 *
 * ### Streamline Conversation Oversight with Inbox
 *
 * Inbox transforms conversation management from a reactive, fragmented process into a proactive, centralized operation that scales with your organization's needs. By providing comprehensive oversight tools, advanced analytics, and collaborative features, Inbox empowers teams to maintain high-quality conversational AI experiences while efficiently managing large volumes of interactions.
 *
 * Whether you're managing customer support conversations, monitoring sales interactions, or overseeing internal AI assistance, Inbox provides the tools necessary to ensure consistent quality, identify improvement opportunities, and maintain operational excellence across your entire conversational AI ecosystem.
 */

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

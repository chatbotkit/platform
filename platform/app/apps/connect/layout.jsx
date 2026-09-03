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
 * @index 20
 *
 * ## [Connect](https://chatbotkit.com/apps/connect)
 *
 * Connect serves as the essential bridge between ChatBotKit and the broader ecosystem of digital services, transforming how conversational AI integrates with your existing tools and workflows. This powerful application addresses the critical need for seamless connectivity between AI capabilities and the diverse array of services that modern businesses rely on daily.
 *
 * ### Core Features of Connect
 *
 * - **Service Integration Hub**: Connect provides a centralized platform for managing connections to third-party services and APIs, eliminating the complexity of maintaining multiple separate integrations while ensuring robust connectivity across your entire service ecosystem.
 * - **Authentication Management**: The app handles complex authentication protocols across different services, providing secure and reliable connections that maintain proper access controls while simplifying the user experience.
 * - **Workflow Automation**: Connect enables sophisticated automated workflows that bridge ChatBotKit capabilities with external systems, allowing for seamless data flow and process automation that enhances operational efficiency.
 * - **Real-time Synchronization**: The platform ensures that data and actions flow smoothly between ChatBotKit and connected services, maintaining consistency and enabling real-time collaboration across your entire tech stack.
 *
 * ### Transform Your Service Ecosystem with Connect
 *
 * Connect is not merely an integration platform; it's a strategic enabler that transforms isolated services into a cohesive, AI-enhanced ecosystem. By facilitating seamless connections between ChatBotKit and your existing tools, Connect empowers organizations to leverage AI capabilities across their entire operational infrastructure.
 *
 * Imagine scenarios where your conversational AI can automatically update customer records in your CRM, trigger support tickets in your helpdesk system, or coordinate with your marketing automation platform based on conversation insights. Connect makes these sophisticated integrations possible while maintaining the simplicity and reliability that businesses require.
 */

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

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
 * @index 50
 *
 * ## [Task](https://chatbotkit.com/apps/task)
 *
 * Task represents a powerful advancement in AI-driven task management and workflow automation, designed to seamlessly integrate sophisticated task orchestration capabilities with the conversational AI ecosystem. This innovative application enables organizations to automate complex workflows using conversational AI that integrates naturally with existing operational processes.
 *
 * ### Core Features of Task
 *
 * - **Workflow Automation**: Task enables sophisticated automation of complex workflows through conversational AI interfaces, allowing organizations to streamline operations and reduce manual intervention in routine processes.
 * - **Task Orchestration**: The application coordinates multiple tasks across different systems and services, managing dependencies and ensuring proper execution sequencing for complex multi-step workflows.
 * - **Conversational Task Management**: Task provides intuitive conversational interfaces for creating, monitoring, and managing automated workflows, making sophisticated automation accessible without requiring technical expertise.
 * - **Integration Capabilities**: Seamlessly integrates with existing business systems and tools, enabling AI-driven task automation that works within your current operational infrastructure.
 *
 * ### Transform Your Workflows with Task
 *
 * Task empowers organizations to leverage conversational AI for automating complex operational workflows, reducing manual effort while increasing efficiency and reliability. By combining intuitive conversational interfaces with powerful automation capabilities, Task makes sophisticated workflow orchestration accessible to teams across your organization.
 *
 * Whether you're automating customer onboarding processes, coordinating multi-step approval workflows, or managing complex data processing tasks, Task provides the conversational AI-driven automation capabilities necessary to streamline operations and enhance productivity across your organization.
 */

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

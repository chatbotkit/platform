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
 * @index 72
 *
 * ## [Audit Logs](https://chatbotkit.com/apps/auditlog)
 *
 * Audit Logs provides comprehensive audit trail visibility and analysis for
 * your ChatBotKit account, enabling security teams and administrators to
 * monitor account activity, track configuration changes, and maintain
 * compliance records. This essential governance tool creates a complete
 * record of all significant actions performed within your ChatBotKit
 * environment.
 *
 * ### Core Features of Audit Logs
 *
 * - **Complete Activity Tracking**: Audit Logs records all significant account
 *   actions including resource creation, updates, and deletions, providing a
 *   comprehensive audit trail that supports security reviews and compliance
 *   reporting.
 * - **Change History**: Track configuration changes to bots, datasets,
 *   skillsets, and other resources over time, making it easy to understand
 *   what changed and when across your entire ChatBotKit deployment.
 * - **Access Monitoring**: Monitor authentication events, API access patterns,
 *   and administrative actions to detect unauthorized activity and ensure your
 *   account security posture remains strong.
 * - **Compliance Support**: The detailed audit trail provided by Audit Logs
 *   supports regulatory compliance requirements by maintaining records of data
 *   access, modifications, and administrative activities.
 *
 * ### Maintain Governance and Compliance with Audit Logs
 *
 * Audit Logs empowers security-conscious organizations to maintain full
 * visibility into account activity, supporting internal governance policies
 * and external compliance requirements. By providing a structured, searchable
 * audit trail, the application enables teams to quickly investigate security
 * incidents, verify compliance status, and demonstrate accountability for all
 * significant platform actions.
 *
 * Whether you are conducting security reviews, preparing compliance reports,
 * or investigating unusual account activity, Audit Logs provides the
 * comprehensive activity history necessary to support robust governance of
 * your conversational AI infrastructure.
 */

export const generateMetadata = withAppRouterContext(generateMetadataImpl)

export default withAppRouterContext(Layout)

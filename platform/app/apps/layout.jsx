/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- server component - the values resolve from the runtime environment */
import { Suspense } from 'react'

import { staticUrl } from '@/config/site'

import Wrapper from '@/components/Wrapper'

export const metadata = {
  icons: {
    icon: [
      {
        url: new URL('/favicon-light.ico', staticUrl).toString(),
        media: '(prefers-color-scheme: light)',
      },
      {
        url: new URL('/favicon-dark.ico', staticUrl).toString(),
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: [
      {
        url: new URL('/apple-touch-icon.png', staticUrl).toString(),
        sizes: '180x180',
      },
    ],
  },
}

// @note CLIENT-ONLY APP EMBEDS - read before touching app SSR behaviour.
//
// Apps under /apps/* (chat, inspector, the *log tools, the adhoc dashboards,
// etc.) are authenticated, interactive dashboard embeds - they are NOT SEO or
// SSR pages. Server-rendering their client-heavy trees inside the <Suspense>
// below aborts the boundary ("The server could not finish this Suspense
// boundary … Switched to client rendering"), which repeatedly surfaced in
// production across the app pages. Two things trigger it:
//   1. `next/dynamic(() => …, { ssr: false })` anywhere in the tree (it aborts
//      the boundary during SSR - see components/NoSsr.jsx for the safe pattern).
//   2. some client component resolving to `undefined` only in the streaming
//      SSR pass (could not be reproduced outside the real RSC pipeline).
//
// Fix/convention: the SuperTools-exposed app pages render their <Main> inside
// <NoSsr> so nothing of the interactive UI hits the server pass (data fetching
// in the server layout/page still runs). When you add a new app embed here,
// wrap its <Main> in <NoSsr> too, and do NOT reintroduce ssr:false dynamics.
// The list of wrapped apps is in components/SuperTools.jsx.

export default async function Layout({ children }) {
  return (
    // @note if we don't add Suspense we wont be able to build we end up with
    // errors such as: useSearchParams() should be wrapped in a suspense...
    <Suspense>
      <Wrapper>{children}</Wrapper>
    </Suspense>
  )
}

/**
 * @doc Apps
 * @description Discover the ChatBotKit Apps ecosystem featuring Chat, Connect, Inbox, Usage, Task, and Trace applications designed to enhance conversational AI capabilities.
 * @category Other
 * @tags apps, pre-built, chatbot, free ai chat bot, conversational ai chat bot, free ai chatbot app
 * @icon heroicons/square-3-stack-3d
 * @index 502
 * @date Mon, Apr 06, 2026, 10:00 AM
 *
 * In the rapidly evolving landscape of artificial intelligence and conversational AI technologies, platforms strive to meet a broad spectrum of customer needs, which can often be as diverse as the customers themselves. ChatBotKit, a leading platform in this domain, understands the importance of catering to this wide array of requirements while also maintaining the flexibility and specificity that individual users and businesses demand. This is where ChatBotKit Apps come into play, marking a significant evolution in how users interact with and leverage the ChatBotKit platform for their unique needs.
 *
 * ChatBotKit Apps are specialized applications developed to enhance the core functionalities of the ChatBotKit platform, offering a tailored experience that goes beyond the one-size-fits-all approach. These apps are designed to meet specific customer requirements, providing bespoke solutions that integrate seamlessly with ChatBotKit's existing resources and capabilities. By focusing on purpose-built applications, we aim to bridge the gap between the platform's broad potential and the specialized demands of its diverse user base.
 *
 * As part of our commitment to innovation and customer-centric development, we are continuously expanding our portfolio of ChatBotKit Apps. Each app is built upon the robust infrastructure of the ChatBotKit platform, ensuring reliability, scalability, and security while offering a more personalized and custom experience. This approach not only empowers users to achieve more with ChatBotKit but also opens up new possibilities for customization and integration that were previously unattainable.
 *
 * In this documentation section, we will explore the current range of ChatBotKit Apps available, providing insights into their functionalities, use cases, and how they can transform your interaction with the ChatBotKit platform.
 *
 * ## Portal Integration and White-Labeling
 *
 * One of the most powerful aspects of ChatBotKit Apps is their integration with **ChatBotKit Portals** - a revolutionary feature that enables organizations to deploy apps as fully white-labeled solutions with dedicated URLs and complete branding control. This capability transforms how businesses can present and deploy AI solutions to their users.
 *
 * ### Portal Capabilities
 *
 * **Custom Domain Deployment**: Each portal can be deployed on its own custom domain (such as support.yourcompany.com or ai.yourbrand.com), providing a seamless branded experience that aligns perfectly with your organization's digital presence.
 *
 * **Complete White-Labeling**: Portals support comprehensive branding customization, including custom logos, titles, color schemes, and styling that ensures the AI experience feels native to your brand and organizational identity.
 *
 * **Granular Access Control**: Advanced user management capabilities allow organizations to define precisely which users can access which apps and features, creating tailored experiences for different user groups while maintaining appropriate security boundaries.
 *
 * **Flexible App Configuration**: Portals can be configured to expose individual apps (such as a dedicated Chat portal for customer service) or combine multiple apps into comprehensive AI workspaces that serve diverse organizational needs.
 *
 * ### Portal Use Cases
 *
 * **Dedicated Customer Support Portals**: Deploy an Inbox-focused portal for your support team with custom branding and restricted access, enabling efficient conversation management while maintaining your organization's professional appearance.
 *
 * **Specialized Team Workspaces**: Create Chat-based portals that assemble multiple AI agents for specific departments like sales or marketing, providing domain-specific AI assistance with appropriate access controls and branding.
 *
 * **Comprehensive Business AI Hubs**: Combine Chat, Connect, and Inbox into unified portals that serve as complete AI workspaces for your organization, featuring integrated authentication and consistent branding across all applications.
 *
 * **Client-Specific Deployments**: Develop customized portal experiences for different clients or partners, each with unique branding, user access controls, and app configurations tailored to specific business relationships.
 *
 * ### Portal Management
 *
 * Portals are configured through intuitive interfaces that define app exposure, user permissions, branding elements, authentication requirements, and app-specific settings. This flexibility enables organizations to create precisely targeted AI experiences that align with their operational needs while leveraging the full power of the ChatBotKit platform infrastructure.
 *
 * The portal system ensures that businesses can deploy professional, branded AI solutions that integrate seamlessly with their existing digital infrastructure while maintaining the robust functionality and reliability that ChatBotKit provides.
 */

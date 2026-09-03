import { isDevelopment, isStaging } from '@/lib/env'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import IntegrationList from '@/components/IntegrationList'

import faq from '@/content/faqs/platform-integrations.yaml'

export default function Index({ authenticated, showPrivateIntegrations }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <IntegrationList
          authenticated={authenticated}
          showPrivateIntegrations={showPrivateIntegrations}
          scopeAware={true}
        />
      </div>
    </section>
  )
}

Index.getLayout = function (children, { authenticated }) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Maximize Chatbot Efficiency with Powerful Integrations - ChatBotKit"
      description="Elevate your chatbot's capabilities with ChatBotKit's wide range of integrations. Seamlessly connect your chatbot to various systems and platforms, enhancing its functionality and efficiency. Perfect for businesses looking to automate communication, streamline processes, and achieve greater success with advanced chatbot solutions."
      keywords="chatbot integrations, ChatBotKit platform, system integration for chatbots, chatbot functionality enhancement, automation solutions, communication automation, chatbot system connectivity, advanced chatbot solutions, business process streamlining, chatbot efficiency improvement, integrating chatbots with platforms, enhancing chatbot systems, automated chatbot responses, chatbot technology advancements"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="integrations">
            Learn More
          </DocsLink>
        </PageHero>
      )}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export function PageHero(props) {
  return (
    <Hero
      {...props}
      title={['Empower your bots', 'with integrations']}
      description="Connect your AI bots to other systems and watch them shine with success."
      compact={true}
    />
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      props: makeJsonSafe({
        authenticated: false,
      }),
    }
  }

  // the list itself loads client-side through the GraphQL integration
  // connections; the server only decides authentication and which
  // integration types are visible in this environment
  return {
    props: makeJsonSafe({
      authenticated: true,

      showPrivateIntegrations: isDevelopment || isStaging,
    }),
  }
}

import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotList from '@/components/BotList'
import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'

import faq from '@/content/faqs/platform-bots.yaml'

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <BotList
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link className="primary-button" href="/bots/new">
                Create Bot
              </Link>
            ) : null
          }
        />
      </div>
    </section>
  )
}

Index.getLayout = function (children, { authenticated }) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Create Custom Chatbots with ChatBotKit - The Conversational AI Bot Creation Platform"
      description="Step into the world of conversational AI with ChatBotKit. Design and deploy custom chatbots tailored to your specific needs. Our user-friendly platform guides you through the process of creating sophisticated bots for business, customer support, or personal projects."
      keywords="chatbot creation platform, custom chatbot design, conversational AI design, build your own chatbot, ChatBotKit bot builder, easy chatbot development, business chatbots, customer support bots, personal project chatbots, AI bot customization, chatbot development tools, user-friendly chatbot software"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="bots">
            Learn More
          </DocsLink>
          {/* <Link
            className="primary-button"
            href={{ pathname: '/signin', query: { callbackUrl: '/bots' } }}
          >
            Sign in
          </Link> */}
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
      title={['Create conversational', 'AI bots']}
      description="Design your own bots tailored to your needs using a wide-range of AI models."
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

  return {
    props: makeJsonSafe({
      authenticated: true,
    }),
  }
}

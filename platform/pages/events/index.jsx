import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import EventLog from '@/components/EventLog'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'

import faq from '@/content/faqs/platform-events.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        {authenticated ? (
          <EventLog
            autoLoad={true}
            loadMore="auto"
            eventTypes={VISIBLE_EVENT_TYPES}
          />
        ) : null}
      </div>
    </section>
  )
}

Index.getLayout = function (children, { authenticated }) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Events"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="events">
            Learn More
          </DocsLink>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/webhooks',
            },
          }}
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
      title={['Monitor real-time events', 'across your platform']}
      description="Track system events, user interactions, and bot activities as they happen. Stay informed with real-time visibility into your AI operations."
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

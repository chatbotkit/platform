import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import PolicyList from '@/components/PolicyList'

import faq from '@/content/faqs/platform-policies.yaml'

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <PolicyList
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link className="primary-button" href="/policies/new">
                Create Policy
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
      title="Manage Policies - ChatBotKit"
      description="Create and manage policies to automatically handle data retention and other automated governance tasks for your conversational AI platform."
      keywords="chatbot policies, conversation retention, data governance, automatic expiry, policy management, conversation lifecycle, data retention policies, ChatBotKit automation"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="policies">
            Learn More
          </DocsLink>
          {/* <Link
            className="primary-button"
            href={{ pathname: '/signin', query: { callbackUrl: '/policies' } }}
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
      title={['Manage conversation', 'policies']}
      description="Create and manage policies to automatically handle data retention and governance tasks for your conversations."
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

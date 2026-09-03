import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DatasetList from '@/components/DatasetList'
import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'

import faq from '@/content/faqs/platform-datasets.yaml'

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <DatasetList
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link className="primary-button" href="/datasets/new">
                Create Dataset
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
      title="Enhance Your Chatbot with Custom Datasets - ChatBotKit"
      description="Elevate your chatbot's performance with tailored datasets on ChatBotKit. Teach your bot with unique, specialized data to ensure it understands and responds accurately to user requests. Ideal for refining conversational AI capabilities and customizing user interactions."
      keywords="chatbot datasets, custom chatbot training, conversational AI data, chatbot data enhancement, personalized chatbot learning, dataset customization for chatbots, AI training datasets, improve chatbot accuracy, user-specific chatbot data, ChatBotKit dataset integration, advanced chatbot learning"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="datasets">
            Learn More
          </DocsLink>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/datasets',
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
      title={['Teach your AI bots', 'your unique data']}
      description="Unlock the full potential of your AI bots by teaching them your data."
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

import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BlueprintList from '@/components/BlueprintList'
import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'

import faq from '@/content/faqs/platform-blueprints.yaml'

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <BlueprintList
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link className="primary-button" href="/blueprints/new">
                Create Blueprint
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
      title="Blueprints"
      description="Create reusable AI Blueprints"
      keywords="blueprints, ai, artificial intelligence, machine learning, ml, deep learning, dl, neural networks, nn, natural language processing, nlp, computer vision, cv, speech recognition, sr, chatbot, chatbots, chatbotkit, chatbot kit"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="blueprints">
            Learn More
          </DocsLink>
          {/* <Link
            className="primary-button"
            href={{
              pathname: '/signin',
              query: {
                callbackUrl: '/blueprints',
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
      title={['Create reusable', 'AI blueprints']}
      description="A blueprint is a reusable AI solution that you can use to create multiple AI resources to solve a specific problem."
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

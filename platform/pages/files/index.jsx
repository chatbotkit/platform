import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import FileList from '@/components/FileList'
import Hero from '@/components/Hero'
import Link from '@/components/Link'

import faq from '@/content/faqs/platform-files.yaml'

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <FileList
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <Link className="primary-button" href="/files/new">
                Create File
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
      title="Files"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="files">
            Learn More
          </DocsLink>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/files',
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
      title={['Store and share files', 'with your AI solutions']}
      description="Upload files to your account and use them in your bots, datasets and skillsets."
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

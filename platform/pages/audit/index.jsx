import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import AuditLog from '@/components/AuditLog'
import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'

import faq from '@/content/faqs/platform-audit.yaml'

export const VISIBLE_AUDIT_ACTIONS = [
  // @todo add actions here
]

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        {authenticated ? (
          <AuditLog
            autoLoad={true}
            loadMore="auto"
            auditActions={VISIBLE_AUDIT_ACTIONS}
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
      title="Audit Logs"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="audit">
            Learn More
          </DocsLink>
          {/* <Link
            className="primary-button"
            href={{
              pathname: '/signin',
              query: {
                callbackUrl: '/audit',
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
      title={['Monitor system changes', 'with comprehensive audit logs']}
      description="Track all user actions and system changes across your platform. Maintain complete audit trails for security, compliance, and troubleshooting."
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

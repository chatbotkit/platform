import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import DocsLink from '@/components/DocsLink'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import { TeamSwitchButton } from '@/components/SessionContext'
import TeamList from '@/components/TeamList'

import faq from '@/content/faqs/platform-teams.yaml'

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <TeamList
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <>
                <Link className="primary-button" href="/teams/new">
                  Create Team
                </Link>
                <TeamSwitchButton.Maybe className="default-button">
                  Switch Team
                </TeamSwitchButton.Maybe>
              </>
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
      title="Team Management Dashboard - ChatBotKit"
      description="Manage your teams with ChatBotKit's Team Management Dashboard. Create and organize teams, manage memberships, and collaborate effectively with team-based access control and permissions."
      keywords="team management, team collaboration, team dashboard, ChatBotKit teams, team access control, team permissions, collaborative workspace"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="teams">
            Learn More
          </DocsLink>
          {/* <Link
            className="primary-button"
            href={{ pathname: '/signin', query: { callbackUrl: '/teams' } }}
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
      title={['Manage Teams', 'and Collaboration']}
      description="Create and manage teams, control access permissions, and collaborate efficiently with your team members on AI projects."
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

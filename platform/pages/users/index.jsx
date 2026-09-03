import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import ManualLink from '@/components/ManualLink'
import { UserSwitchButton } from '@/components/SessionContext'
import UserList from '@/components/UserList'

import faq from '@/content/faqs/platform-users.yaml'

export default function Index({ authenticated }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <UserList
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <>
                <Link className="primary-button" href="/users/new">
                  Create User
                </Link>
                <UserSwitchButton.Maybe className="default-button">
                  Switch User
                </UserSwitchButton.Maybe>
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
      breadcrumbs={['Users', 'ChatBotKit']}
      title="Users"
      description="Create and manage isolated users on the ChatBotKit platform. Control access, monitor usage, and configure resource limits for each user."
      keywords="ChatBotKit users, user management, manage users, user access control, user resource limits"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <ManualLink className="default-button" slug="users">
            Learn More
          </ManualLink>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/users',
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
      title={['Create and manage', 'users']}
      description="Create and manage isolated users. Control access, monitor usage, and configure resource limits for each account."
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

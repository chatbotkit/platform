import { useState } from 'react'

import { ONE_WEEK_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import admins from '@/config/admins'
import { overrides as overridesConfig } from '@/config/limits'

import prisma from '@/prisma/client'

import { isAdmin } from '@/lib/admin'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Admin from '@/layouts/Admin'

import { copyTextToClipboard } from '@/components/CopyButton'
import DynamicIcon from '@/components/DynamicIcon'
import List, { ListItem } from '@/components/List'
import SimpleTabs from '@/components/SimpleTabs'

import useRouter from '@/hooks/useRouter'

function UserList({ users, ...props }) {
  return (
    <List {...props}>
      {users.map(
        ({
          id,

          name,
          description,

          email,

          role,
          organization,

          goal,

          createdAt,
        }) => {
          return (
            <ListItem
              key={id}
              icon={
                <DynamicIcon
                  className="w-12 h-12 rounded-full"
                  icon={`@gravatar/${email}`}
                />
              }
              link={`/admin/users/${id}`}
              title={name || email}
              body={
                <div className="space-y-2">
                  <p className="font-semibold">{email}</p>
                  {description ? <p>{description}</p> : null}
                  {goal ? <p className="italic">{goal}</p> : null}
                </div>
              }
              timestamp={createdAt}
              actions={{
                'Copy ID': () => {
                  copyTextToClipboard(id, 'User ID copied to clipboard')
                },

                'Copy Email': () => {
                  copyTextToClipboard(email, 'User email copied to clipboard')
                },
              }}
            >
              {role ? <div className="tag">{role}</div> : null}
              {organization ? <div className="tag">{organization}</div> : null}
            </ListItem>
          )
        }
      )}
    </List>
  )
}

export default function Index({
  users: { grantedUsers, newUsers, adminUsers },
}) {
  const router = useRouter()

  const [email, setEmail] = useState('')

  return (
    <div className="main-page">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()

          const thisEmail = email.trim()

          if (!thisEmail) {
            return
          }

          router.push(`/admin/users/${email}`)
        }}
        disabled={!email}
      >
        <input
          className="default-input w-full"
          type="text"
          placeholder="Find user by identifier"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </form>
      <SimpleTabs
        tabs={{
          [`Granted (${grantedUsers.length})`]: (
            <UserList users={grantedUsers} />
          ),

          [`New (${newUsers.length})`]: <UserList users={newUsers} />,

          [`Admins (${adminUsers.length})`]: <UserList users={adminUsers} />,
        }}
      />
    </div>
  )
}

Index.getLayout = function (children) {
  return <Admin title="Users">{children}</Admin>
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  if (!isAdmin(session.user)) {
    return {
      notFound: true,
    }
  }

  const users = await prisma.$queryMap({
    grantedUsers: prisma.user.findMany({
      where: {
        email: {
          // @note any plan grant marks a comped account - tier grants
          // (e.g. ultimate) and the structural unlimited grant alike
          in: Object.keys(overridesConfig).filter(
            (key) => overridesConfig[key]?.plan && !admins.includes(key)
          ),
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    }),

    newUsers: prisma.user.findMany({
      where: {
        AND: [
          {
            createdAt: {
              gte: new Date(Date.now() - ONE_WEEK_IN_MILLISECONDS),
            },
          },
          { parentId: null },
        ],
      },

      orderBy: {
        createdAt: 'desc',
      },
    }),

    adminUsers: prisma.user.findMany({
      where: {
        email: {
          in: admins,
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    }),
  })

  return {
    props: makeJsonSafe({
      users,
    }),
  }
}

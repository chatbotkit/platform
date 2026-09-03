import { getShortDateTime } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { isAdmin } from '@/lib/admin'
import { userToPlan } from '@/lib/billing.core'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import { getUsage } from '@/lib/usage.get'
import { findUser } from '@/lib/user.find'

import Admin from '@/layouts/Admin'

import Link from '@/components/Link'
import NavHeader from '@/components/NavHeader'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

export default function Index({ user, parent, plan, metrics, usage }) {
  const router = useRouter()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleAdjustTokenUsage() {
    if (
      !confirm('Are you sure you want to adjust the token usage of this user?')
    ) {
      return
    }

    const token = prompt('Enter the token to adjust the usage of this user.')

    if (!token) {
      return
    }

    await fetch(`/api/admin/user/${user.id}/usage/adjust`, {
      method: 'POST',
      data: {
        token: parseInt(token, 10),
      },
      successMessage: 'Usage adjusted successfully.',
    })
  }

  async function handleDelete() {
    if (
      !confirm(
        'This will permanently delete this user. Continue to typed confirmation?'
      )
    ) {
      return
    }

    const expectedConfirmation = user.email || user.id

    const confirmation = prompt(
      `Type ${expectedConfirmation} to confirm deleting this user.`
    )

    if (confirmation !== expectedConfirmation) {
      return
    }

    const { error } = await fetch(`/api/admin/user/${user.id}/delete`, {
      method: 'POST',
      data: {
        sendDeletionEmail: true,
      },
    })

    if (!error) {
      router.push('/admin/users')
    }
  }

  async function handleSwitch() {
    if (!confirm('Are you sure you want to switch this user?')) {
      return
    }

    const { error } = await fetch(`/api/admin/user/${user.id}/switch`, {
      method: 'POST',
      data: {},
    })

    if (!error) {
      router.push('/overview')
    }
  }

  return (
    <>
      <div className="main-page">
        <NavHeader
          link="/admin/users"
          caption="users"
          title={user.name || user.email}
        />
        <div className="prose dark:prose-invert">
          <table>
            <thead>
              <tr>
                <td>type</td>
                <td>value</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>id</td>
                <td>{user.id}</td>
              </tr>
              <tr>
                <td>email</td>
                <td>{user.email}</td>
              </tr>
              <tr>
                <td>name</td>
                <td>{user.name}</td>
              </tr>
              <tr>
                <td>parent</td>
                <td>
                  {user.parentId ? (
                    <Link href={`/admin/users/${user.parentId}`}>
                      {parent?.name || parent?.email || user.parentId}
                    </Link>
                  ) : null}
                </td>
              </tr>
              <tr>
                <td>description</td>
                <td>{user.description}</td>
              </tr>
              <tr>
                <td>role</td>
                <td>{user.role}</td>
              </tr>
              <tr>
                <td>organization</td>
                <td>{user.organization}</td>
              </tr>
              <tr>
                <td>industry</td>
                <td>{user.industry}</td>
              </tr>
              <tr>
                <td>goal</td>
                <td>{user.goal}</td>
              </tr>
              <tr>
                <td>channel</td>
                <td>{user.channel}</td>
              </tr>
              <tr>
                <td>plan</td>
                <td>{plan}</td>
              </tr>
              <tr>
                <td>created at</td>
                <td suppressHydrationWarning>
                  {getShortDateTime(user.createdAt)}
                </td>
              </tr>
              {metrics && (
                <>
                  <tr>
                    <td className="font-bold">bots</td>
                    <td>{metrics.botsCount}</td>
                  </tr>
                  <tr>
                    <td className="font-bold">conversations</td>
                    <td>{metrics.conversationsCount}</td>
                  </tr>
                </>
              )}
              {usage && (
                <>
                  <tr>
                    <td className="font-bold">token usage</td>
                    <td>{usage.tokens.value.toLocaleString('en-US')}</td>
                  </tr>
                  <tr>
                    <td className="font-bold">conversation usage</td>
                    <td>{usage.conversations.value.toLocaleString('en-US')}</td>
                  </tr>
                  <tr>
                    <td className="font-bold">message usage</td>
                    <td>{usage.messages.value.toLocaleString('en-US')}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-row gap-2">
          <button
            className="default-button"
            type="button"
            onClick={handleAdjustTokenUsage}
          >
            Adjust Token Usage
          </button>
          <button
            className="danger-button"
            type="button"
            onClick={() => handleDelete()}
          >
            Delete
          </button>
          <button
            className="default-button"
            type="button"
            onClick={handleSwitch}
          >
            Switch
          </button>
        </div>
      </div>
    </>
  )
}

Index.getLayout = function (children, { user }) {
  return (
    <Admin breadcrumbs={['Users']} title={user.email || user.id}>
      {children}
    </Admin>
  )
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

  const user = await findUser(context.params.userId)

  if (!user) {
    return {
      notFound: true,
    }
  }

  const parent = user.parentId
    ? await prisma.user.findUnique({
        where: {
          id: user.parentId,
        },
      })
    : null

  const plan = userToPlan(user)

  const usage = await getUsage(user.id)

  // Fetch user metrics
  const metrics = await prisma.$queryMap({
    botsCount: prisma.bot.count({
      where: {
        userId: user.id,
      },
    }),
    conversationsCount: prisma.conversation.count({
      where: {
        userId: user.id,
      },
    }),
  })

  return {
    props: makeJsonSafe({
      user,

      parent,

      plan,

      metrics,

      usage,
    }),
  }
}

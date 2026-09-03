import { useState } from 'react'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import List from '@/components/List'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'

import faq from '@/content/faqs/platform-team-instance.yaml'

export function AddMemberPopup() {
  return (
    <div className="space-y-6">
      {/* email */}
      <div>
        <label className="default-label" htmlFor="email">
          Email Address
        </label>
        <div className="mt-1">
          <input
            className="default-input w-full"
            name="email"
            type="email"
            placeholder="Enter email address"
            autoFocus
            required
          />
        </div>
        <p className="input-description">
          Enter the email address of the person you want to invite to this team.
          They will receive an invitation to join.
        </p>
      </div>
    </div>
  )
}

export function Members({ team }) {
  const [memberships, setMemberships] = useState(team?.memberships || [])

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const { popup, openPopup, closePopup, setDisabled } = usePopup()

  async function handleAddMember(data) {
    const email = data.email?.trim()

    if (!email) {
      return
    }

    setDisabled(true)

    const { data: responseData, error } = await fetch(
      `/api/v1/team/${team.id}/membership/create`,
      {
        data: {
          email,
        },

        successMessage: 'Member added successfully.',
      }
    )

    setDisabled(false)

    if (!error && responseData) {
      setMemberships([...memberships, { ...responseData, email }])

      closePopup()
    }
  }

  async function handleRemoveMember(membershipId) {
    const { error } = await fetch(
      `/api/v1/team/${team.id}/membership/${membershipId}/delete`,
      {
        data: {},

        successMessage: 'Member removed successfully.',
      }
    )

    if (!error) {
      setMemberships(memberships.filter((m) => m.id !== membershipId))
    }
  }

  async function handleResendInvite(membershipId) {
    await fetch(
      `/api/v1/team/${team.id}/membership/${membershipId}/invite/resend`,
      {
        data: {},

        successMessage: 'Invitation resent successfully.',
      }
    )
  }

  function openAddMemberPopup() {
    openPopup(<AddMemberPopup />, {
      title: 'Add Team Member',
      closePopupOnClickOutside: true,
      actions: {
        'Add Member': {
          default: true,
          fn: handleAddMember,
        },
      },
    })
  }

  return (
    <div className="space-y-6">
      {popup}
      <List
        actions={
          <button
            className="default-link"
            type="button"
            onClick={openAddMemberPopup}
          >
            Add Member
          </button>
        }
        emptyMessage="No members added yet. Click 'Add Member' to invite someone to this team."
      >
        {memberships.map((membership) => (
          <List.Item
            key={membership.id}
            title={membership.email}
            description={membership.name || 'No name provided'}
            actions={{
              'Resend Invite': async () => {
                await handleResendInvite(membership.id)
              },
              Delete: async () => {
                await handleRemoveMember(membership.id)
              },
            }}
          />
        ))}
      </List>
    </div>
  )
}

export function Form({ team }) {
  const confirmDelete = useConfirmDelete()

  const router = useRouter()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (team.id) {
      const { error } = await fetch(`/api/v1/team/${team.id}/update`, {
        data,

        successMessage: 'Team updated.',
      })

      if (!error) {
        Object.assign(team, data)
      }
    } else {
      const {
        data: { id: teamId },
      } = await fetch(`/api/v1/team/create`, {
        data,

        successMessage: 'Team created.',
      })

      if (teamId) {
        router.push(`/teams/${teamId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this team?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/team/${team.id}/delete`, {
      data: {},

      successMessage: 'Team deleted.',
    })

    if (!error) {
      router.push(`/teams`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* team configuration */}
          <div>
            <Headline title="Team Configuration">
              This information is used to configure the team.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              <GeneralBasicOptions instance={team} />
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Show Advanced Options"
              >
                <div className="mt-6 space-y-6">
                  {/* meta */}
                  <div>
                    <label className="default-label" htmlFor="meta">
                      Meta
                    </label>
                    <div className="mt-1">
                      <MetaInput name="meta" defaultMeta={team.meta} />
                    </div>
                    <p className="input-description">
                      Custom metadata for this team.
                    </p>
                  </div>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/teams">
              Back To Teams
            </BackLink> */}
            {team.id ? (
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {team.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ team }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/teams" caption="teams" title="Team">
          <p>
            A team allows you to collaborate with others and share resources.
            Team members can access shared bots, datasets, and other resources.
            For more information, see the team{' '}
            <DocsLink slug="teams">documentation</DocsLink>.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form team={team} />
          </div>
        </section>
        {team.id ? (
          <section data-page-section-title="Members">
            <div className="main-page">
              <Headline title="Team Members">
                Manage team members and their access to this team.
              </Headline>
              <Members key={team.id} team={team} />
            </div>
          </section>
        ) : null}
        {/* {team.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this team.
              </Headline>
              <MetaArea instance={team} />
            </div>
          </section>
        ) : null} */}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { team }) {
  return (
    <Dashboard
      breadcrumbs={['Teams', 'ChatBotKit']}
      title={team.name || team.id || 'New'}
      authenticated={true}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      redirect: {
        destination: '/signin?callbackUrl=/teams',
        permanent: false,
      },
    }
  }

  if (context.query.teamId === 'new') {
    return {
      props: makeJsonSafe({
        team: {
          name: context.query.name || null,
          description: context.query.description || null,
        },
      }),
    }
  }

  const team = await prisma.team.findUnique({
    where: {
      id: context.query.teamId,
    },

    include: {
      memberships: true,
    },
  })

  if (!team) {
    return {
      notFound: true,
    }
  }

  if (team.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      team,
    }),
  }
}

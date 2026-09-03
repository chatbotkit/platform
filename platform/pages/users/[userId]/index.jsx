import { useState } from 'react'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getUserLimits } from '@/lib/limit.core'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import {
  getUsage,
  getUsageSeries,
  getUsageSeriesFromDate,
} from '@/lib/usage.get'
import { getUsagePeriodFromUsage } from '@/lib/usage.period'

import Dashboard from '@/layouts/Dashboard'

import CodeAction from '@/components/CodeAction'
import { useConfirm, useConfirmDelete } from '@/components/Confirm'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import LimitsCheatsheet from '@/components/LimitsCheatsheet'
import LimitsConfigInput from '@/components/LimitsConfigInput'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import ThisSolution from '@/components/ThisSolution'
import UsageView from '@/components/UsageView'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

import faq from '@/content/faqs/platform-user-instance.yaml'

export function Form({ user }) {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

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

    if (user.id) {
      const { error } = await fetch(`/api/v1/user/${user.id}/update`, {
        data,

        successMessage: 'User updated.',
      })

      if (!error) {
        Object.assign(user, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: userId },
      } = await fetch(`/api/v1/user/create`, {
        data,

        successMessage: 'User created.',
      })

      if (userId) {
        router.push(`/users/${userId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this user?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/user/${user.id}/delete`, {
      data: {},
    })

    if (!error) {
      router.push(`/users`)
    }
  }

  async function handleSwitch(event) {
    event.preventDefault()

    if (!(await confirm('Do you really want to switch to this user?'))) {
      return
    }

    const { error } = await fetch(`/api/me/user/${user.id}/switch`, {
      data: {},
    })

    if (!error) {
      router.push('/overview')
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="user"
        instance={user}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* user configuration */}
          <div>
            <Headline title="User Configuration">
              This information is used to configure the user.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              <GeneralBasicOptions instance={user} />
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Advanced Options"
              >
                {/* alias */}
                <div>
                  <label className="default-label" htmlFor="alias">
                    Alias
                  </label>
                  <div className="mt-1">
                    <input
                      className="default-input w-full max-w-xs"
                      name="alias"
                      type="text"
                      defaultValue={user.alias}
                      pattern="[a-z0-9_-]*"
                      maxLength={128}
                    />
                  </div>
                  <p className="input-description">
                    Optional unique alias for this user. Use lowercase letters,
                    numbers, hyphens, and underscores only. Can be used to
                    reference this user via @alias.
                  </p>
                </div>
                {/* email */}
                <div>
                  <label className="default-label" htmlFor="email">
                    Email
                  </label>
                  <div className="mt-1">
                    <input
                      className="default-input w-full max-w-xs"
                      name="email"
                      type="text"
                      defaultValue={user.email}
                    />
                  </div>
                  <p className="input-description">
                    The email address identifies the child User to its parent
                    User. Use a unique address for each child User.
                  </p>
                </div>
                {/* limits */}
                <div>
                  <label className="default-label" htmlFor="limits">
                    Limits
                  </label>
                  <div className="mt-1">
                    <LimitsConfigInput
                      name="limits"
                      defaultLimits={user.limits}
                    />
                  </div>
                  <p className="input-description">
                    The limits control the user&apos;s access to the platform
                    and are defined as a JSON object.
                  </p>
                  <LimitsCheatsheet className="mt-2" />
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={user.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this user.
                  </p>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {user.id ? (
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {user.id ? (
              <button
                type="button"
                className="default-button"
                onClick={handleSwitch}
              >
                Switch
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {user.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({
  user,
  usage,
  usagePeriod,
  usageSeries,
  usageSeriesThisPeriod,
  limits,
}) {
  return (
    <>
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form user={user} />
          </div>
        </section>
        {user.id ? (
          <section data-page-section-title="Usage">
            <div className="main-page">
              <UsageView
                usage={usage}
                usageSeries={usageSeries}
                usageSeriesThisPeriod={usageSeriesThisPeriod}
                usagePeriod={usagePeriod}
                limits={limits}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { user }) {
  return (
    <Dashboard
      breadcrumbs={['Users', 'ChatBotKit']}
      title={user.name || user.id || 'New User'}
      description="Create and manage an isolated user, including its profile, resource limits, metadata, and usage."
      keywords="ChatBotKit user, user configuration, user limits, user usage"
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
        destination: `/signin?callbackUrl=${context.resolvedUrl}`,
        permanent: false,
      },
    }
  }

  if (context.query.userId === 'new') {
    return {
      props: makeJsonSafe({
        user: {},
      }),
    }
  }

  const user = await prisma.user.findUnique({
    where: {
      id: context.query.userId,
    },

    select: {
      id: true,

      alias: true,

      name: true,
      description: true,

      email: true, // @note important for the limits

      limits: true,

      meta: true,

      parentId: true,
      parentContextEmail: true,
    },
  })

  if (!user) {
    return {
      notFound: true,
    }
  }

  if (user.parentId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  const [usage, usageSeries, limits] = await Promise.all([
    getUsage(user.id),

    getUsageSeries(user.id),

    getUserLimits(user),
  ])

  // @note when no counter exists there is no active period and the "this
  // period" slice would misleadingly show usage from the trailing 31 days
  const usagePeriod = getUsagePeriodFromUsage(usage)

  const usageSeriesThisPeriod = usagePeriod
    ? getUsageSeriesFromDate(usageSeries, usagePeriod.start)
    : null

  user.email = user.parentContextEmail

  delete user.parentId
  delete user.parentContextEmail

  return {
    props: makeJsonSafe({
      user,

      usage,

      usagePeriod,

      usageSeries,
      usageSeriesThisPeriod,

      limits,
    }),
  }
}

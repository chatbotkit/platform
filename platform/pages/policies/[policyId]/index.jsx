import { useState } from 'react'

import prisma from '@/prisma/client'
import { PolicyType, ResourceState } from '@/prisma/types'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import PolicyBlockStatus from '@/components/PolicyBlockStatus'
import PolicyConfigInput from '@/components/PolicyConfigInput'
import ThisSolution from '@/components/ThisSolution'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-policy-instance.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function Form({ policy }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  // controlled so the config editor can switch to match the selected type
  const [type, setType] = useState(policy.type || PolicyType.retention)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

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

    delete data.portal

    if (policy.id) {
      const { error } = await fetch(`/api/v1/policy/${policy.id}/update`, {
        data,

        successMessage: 'Policy updated.',
      })

      if (!error) {
        Object.assign(policy, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: policyId },
      } = await fetch(`/api/v1/policy/create`, {
        data: scopeCreateData(data),

        successMessage: 'Policy created.',
      })

      if (policyId) {
        router.push(`/policies/${policyId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this policy?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/policy/${policy.id}/delete`, {
      data: {},

      successMessage: 'Policy deleted...',
    })

    if (!error) {
      router.push(`/policies`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="policy"
        instance={policy}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* policy configuration */}
          <div>
            <Headline title="Policy Configuration">
              This information is used to configure the policy basic options.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              <GeneralBasicOptions instance={policy} />
              {/* type */}
              <div className="sm:col-span-3">
                <label className="default-label" htmlFor="type">
                  Type
                </label>
                <div className="mt-1">
                  <select
                    name="type"
                    className="default-input w-full"
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    required
                  >
                    {Object.entries(PolicyType).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="input-description">
                  The type of policy to create.
                </p>
              </div>
              {/* state */}
              <div className="sm:col-span-3">
                <label className="default-label" htmlFor="state">
                  State
                </label>
                <div className="mt-1">
                  <select
                    name="state"
                    className="default-input w-full"
                    defaultValue={policy.state}
                  >
                    {Object.entries(ResourceState).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="input-description">
                  Disabled policies are kept and configured, but are not enforced
                  at runtime. Use this to toggle the policy off without deleting
                  it.
                </p>
              </div>
              {/* bot */}
              <div className="sm:col-span-3">
                <label className="default-label" htmlFor="botId">
                  Bot
                </label>
                <div className="mt-1">
                  <BotSelect
                    name="botId"
                    defaultValue={policy.botId || ''}
                    className="default-input w-full"
                  />
                </div>
                <p className="input-description">
                  The bot this policy applies to. Leave empty to apply the
                  policy to every bot.
                </p>
              </div>
              {/* config */}
              <div>
                <label className="default-label" htmlFor="config">
                  Config
                </label>
                <div className="mt-1">
                  <PolicyConfigInput
                    type={type}
                    name="config"
                    defaultConfig={policy.config}
                  />
                </div>
                <p className="input-description">
                  {type === PolicyType.usage
                    ? 'Define the usage threshold, window and the action(s) to take when it is crossed.'
                    : 'Type the configuration to customize the policy. This information is used to configure the policy.'}
                </p>
              </div>
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Show Advanced Options"
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
                      defaultValue={policy.alias}
                      pattern="[a-z0-9_-]*"
                      maxLength={128}
                    />
                  </div>
                  <p className="input-description">
                    Optional unique alias for this policy. Use lowercase
                    letters, numbers, hyphens, and underscores only. Can be used
                    to reference this policy via @alias.
                  </p>
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={policy.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this policy.
                  </p>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/policies">
              Back To Policies
            </BackLink> */}
            {policy.id ? (
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {policy.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ policy }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/policies" caption="policies" title="Policy">
          <p>
            A policy is an automated rule that manages the lifecycle of your
            conversations by setting expiration dates based on configurable
            parameters. For more information, see the policy{' '}
            <DocsLink slug="policies">documentation</DocsLink>.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form policy={policy} />
          </div>
        </section>
        {policy.id && policy.type === PolicyType.usage ? (
          <section data-page-section-title="Block">
            <div className="main-page">
              <Headline title="Block">
                Lift the block this policy is currently holding. Clearing also
                resets the policy&apos;s usage window so the bot is not
                immediately re-blocked.
              </Headline>
              <div className="mt-6">
                <PolicyBlockStatus policyId={policy.id} />
              </div>
            </div>
          </section>
        ) : null}
        {policy.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Events">
                Keep tabs on the progress of your bot events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ policyId: policy.id }}
                filter={false}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { policy }) {
  return (
    <Dashboard
      breadcrumbs={['Policies', 'ChatBotKit']}
      title={policy.name || policy.id || 'New'}
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

  if (context.query.policyId === 'new') {
    return {
      props: makeJsonSafe({
        policy: {
          name: '',
          description: '',

          type: PolicyType.retention,

          state: ResourceState.enabled,

          config: {
            expiresInDays: 30,
          },
        },
      }),
    }
  }

  const policy = await prisma.policy.findUnique({
    where: {
      id: context.query.policyId,
    },
  })

  if (!policy) {
    return {
      notFound: true,
    }
  }

  if (policy.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      policy: policy,
    }),
  }
}

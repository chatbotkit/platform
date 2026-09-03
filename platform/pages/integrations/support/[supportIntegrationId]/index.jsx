import { useState } from 'react'

import prisma from '@/prisma/client'
import { Trigger } from '@/prisma/types'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import { useConfirm, useConfirmDelete } from '@/components/Confirm'
import DescriptionInput from '@/components/DescriptionInput'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import ThisSolution from '@/components/ThisSolution'
import TriggerSelect from '@/components/TriggerSelect'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-integrations-support.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function Form({ integration }) {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)
  const [isTriggering, setIsTriggering] = useState(false)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
    successMessage: 'Support integration settings updated.',
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/support/${integration.id}/update`,
        {
          data: {
            ...data,
          },
        }
      )

      if (!error) {
        Object.assign(integration, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: supportIntegrationId },
      } = await fetch(`/api/v1/integration/support/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (supportIntegrationId) {
        router.push(`/integrations/support/${supportIntegrationId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (
      !(await confirmDelete('Do you really want to delete this integration?'))
    ) {
      return
    }

    const { error } = await fetch(
      `/api/v1/integration/support/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Support integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleTriggerSupport(event) {
    event.preventDefault()

    if (
      !(await confirm(
        'This will trigger support processing on the last 100 conversations. Do you want to continue?'
      ))
    ) {
      return
    }

    setIsTriggering(true)

    try {
      await fetch(`/api/v1/integration/support/${integration.id}/trigger`, {
        data: {
          sample: 100,
        },

        successMessage: `Support triggered on the last 100 conversations.`,
      })
    } finally {
      setIsTriggering(false)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/support"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="Support Integration Configuration">
              This information is used to configure some general options around
              the integration.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* name */}
              <div>
                <label className="default-label" htmlFor="name">
                  Name
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full"
                    name="name"
                    type="text"
                    defaultValue={integration.name}
                  />
                </div>
                <p className="input-description">
                  Type any name to recognize the integration from others.
                </p>
              </div>
              {/* description */}
              <div>
                <label className="default-label" htmlFor="description">
                  Description
                </label>
                <div className="mt-1">
                  <DescriptionInput
                    className="default-input w-full"
                    name="description"
                    defaultValue={integration.description}
                  />
                </div>
                <p className="input-description">
                  Provide optional description for this integration.
                </p>
              </div>
              {/* botId */}
              <div>
                <label className="default-label" htmlFor="botId">
                  Bot
                </label>
                <div className="mt-1">
                  <BotSelect
                    className="default-input w-full max-w-xs sm:text-sm"
                    name="botId"
                    defaultValue={integration.botId}
                  />
                </div>
                <p className="input-description">
                  The bot that will be monitored for new conversations. If not
                  specified, all bots will be monitored.
                </p>
              </div>
            </div>
          </div>
          {/* application configuration */}
          <div>
            <Headline title="Support Application Configuration">
              This information is used to configure the support integration.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* email */}
              <div>
                <label className="default-label" htmlFor="email">
                  Email
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full max-w-xs sm:text-sm"
                    name="email"
                    type="email"
                    defaultValue={integration.email}
                  />
                </div>
                <p className="input-description">
                  The support email to use for transcribed conversations.
                </p>
              </div>
            </div>
          </div>
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
                  defaultValue={integration.alias}
                  pattern="[a-z0-9_-]*"
                  maxLength={128}
                />
              </div>
              <p className="input-description">
                Optional unique alias for this integration. Use lowercase
                letters, numbers, hyphens, and underscores only. Can be used to
                reference this integration via @alias.
              </p>
            </div>
            {/* trigger */}
            <div>
              <label className="default-label" htmlFor="trigger">
                Trigger
              </label>
              <div className="mt-1">
                <TriggerSelect
                  className="default-input w-full max-w-xs sm:text-sm"
                  name="trigger"
                  defaultValue={integration.trigger}
                />
              </div>
              <p className="input-description">
                The trigger that will be used to start the integration.
              </p>
            </div>
            {/* meta */}
            <div>
              <label className="default-label" htmlFor="meta">
                Meta
              </label>
              <div className="mt-1">
                <MetaInput name="meta" defaultMeta={integration.meta} />
              </div>
              <p className="input-description">
                Custom metadata for this integration.
              </p>
            </div>
          </Expando>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackButton
              type="button"
              className="default-button"
              href="/integrations"
            >
              Back To Integrations
            </BackButton> */}
            {integration.id ? (
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {integration.id ? (
              <button
                className="default-button"
                type="button"
                onClick={handleTriggerSupport}
                disabled={isTriggering}
              >
                Trigger
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {integration.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ integration }) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader
          link="/integrations"
          caption="integrations"
          title="Support"
          beta={true}
        >
          <p>
            With this integration, you can dynamically forward idle
            conversations to your email support system. Detailed instructions on
            how to set up this integration can be found at{' '}
            <DocsLink className="default-link" slug="support">
              ChatBotKit Support Integration
            </DocsLink>{' '}
            docs.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form integration={integration} />
          </div>
        </section>
        {integration.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Support Integration Events">
                Keep tabs on the progress of your Support integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ supportIntegrationId: integration.id }}
                filter={false}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { integration }) {
  return (
    <Dashboard
      breadcrumbs={['Support', 'Integrations', 'ChatBotKit']}
      title={integration.name || integration.id || 'New'}
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

  if (context.query.supportIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          botId: context.query.botId,

          // default values

          trigger: Trigger.automatic,
        },
      }),
    }
  }

  const integration = await prisma.supportIntegration.findUnique({
    where: {
      id: context.query.supportIntegrationId,
    },

    include: {
      bot: {
        select: {
          id: true,

          name: true,
          description: true,

          datasetId: true,
          skillsetId: true,
        },
      },

      ...Object.fromEntries(
        // @todo dynamically find all integrations
        [].map((key) => {
          return [
            `${key}Integrations`,
            {
              select: {
                id: true,

                name: true,
                description: true,
              },
            },
          ]
        })
      ),
    },
  })

  if (!integration) {
    return {
      notFound: true,
    }
  }

  if (integration.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      integration,
    }),
  }
}

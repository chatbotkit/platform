import { useState } from 'react'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { withNotionIntegrationResources } from '@/lib/solution'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import DatasetImportJobFinishURLs from '@/components/DatasetImportJobFinishURLs'
import DatasetSelect from '@/components/DatasetSelect'
import DaysSelect from '@/components/DaysSelect'
import DescriptionInput from '@/components/DescriptionInput'
import DocsLink from '@/components/DocsLink'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import RevealToken from '@/components/RevealToken'
import ScheduleSelect from '@/components/ScheduleSelect'
import ThisSolution from '@/components/ThisSolution'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-integrations-notion.yaml'

export const VISIBLE_EVENT_TYPES = [
  'dataset.import.job.start',
  'dataset.import.job.finish',
]

export function Form({ integration }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
    successMessage: 'Notion integration settings updated.',
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/notion/${integration.id}/update`,
        {
          data,

          successMessage: 'Notion integration updated.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const { error, data: createData } = await fetch(
        `/api/v1/integration/notion/create`,
        {
          data: scopeCreateData(data),

          successMessage: 'Notion integration created.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        const { id: notionIntegrationId } = createData

        if (notionIntegrationId) {
          router.push(`/integrations/notion/${notionIntegrationId}`)
        }
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
      `/api/v1/integration/notion/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Notion integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleSync(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/notion/${integration.id}/sync`, {
      successMessage: 'Notion is syncing with your dataset.',

      data: {},
    })
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/notion"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="Notion Integration Configuration">
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
              {/* datasetId */}
              <div>
                <label className="default-label" htmlFor="datasetId">
                  Dataset
                </label>
                <div className="mt-1">
                  <DatasetSelect
                    className="default-input w-full max-w-xs sm:text-sm"
                    name="datasetId"
                    defaultValue={integration.datasetId}
                    required={true}
                  />
                </div>
                <p className="input-description">
                  Dataset to import information into.
                </p>
              </div>
            </div>
          </div>
          {/* application configuration */}
          <div>
            <Headline title="Notion Application Configuration">
              This information is used to configure the notion integration.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* url */}
              <div>
                <label className="default-label" htmlFor="token">
                  Token
                </label>
                <div className="mt-1">
                  <RevealToken
                    className="default-input w-full sm:text-sm"
                    name="token"
                    defaultToken={integration.token}
                    required={true}
                  />
                </div>
                <p className="input-description">
                  The Token of the Notion integration.
                </p>
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
                    letters, numbers, hyphens, and underscores only. Can be used
                    to reference this integration via @alias.
                  </p>
                </div>
                {/* syncSchedule */}
                <div>
                  <label className="default-label" htmlFor="syncSchedule">
                    Sync Schedule
                    <sup className="ml-2 bg-gray-800 text-white p-0.5 rounded">
                      PRO
                    </sup>
                  </label>
                  <div className="mt-1">
                    <ScheduleSelect
                      className="default-input w-full max-w-xs sm:text-sm"
                      name="syncSchedule"
                      defaultValue={integration.syncSchedule}
                      fair={true}
                    />
                  </div>
                  <p className="input-description">
                    The sync scheduled defines how often to sync your Notion
                    pages with the selected dataset. This option is only
                    available to customers on ChatBotKit Pro and Team plans.
                  </p>
                </div>
                {/* expiresIn */}
                <div>
                  <label className="default-label" htmlFor="expiresIn">
                    Expires In
                  </label>
                  <div className="mt-1">
                    <DaysSelect
                      className="default-input w-full max-w-xs sm:text-sm"
                      name="expiresIn"
                      defaultValue={integration.expiresIn}
                    />
                  </div>
                  <p className="input-description">
                    The dataset record will be automatically removed after this
                    period. When set to <strong>automatic</strong> dataset
                    records will be removed upon synchronization.
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
          </div>
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
                onClick={handleSync}
              >
                Sync
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
        <NavHeader link="/integrations" caption="integrations" title="Notion">
          <p>
            With this integration, you can dynamically import Notion content
            into a dataset so that your chatbot always have the most up-to-date
            information. Detailed instructions on how to set up this integration
            can be found at{' '}
            <DocsLink className="default-link" slug="integrations">
              ChatBotKit Integrations
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
          <section data-page-section-title="URLs">
            <div className="main-page">
              <Headline title="Notion Sync URLs">
                Understand what Notion pages are included in this integration.{' '}
                <strong>
                  If a page does not appear in the list below, ensure that it
                  has been{' '}
                  <DocsLink slug="notion">
                    shared with your integration
                  </DocsLink>
                  .
                </strong>
              </Headline>
              <DatasetImportJobFinishURLs
                contextFilters={{ notionIntegrationId: integration.id }}
              />
            </div>
          </section>
        ) : null}
        {integration.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Notion Integration Events">
                Keep tabs on the progress of your Notion integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ notionIntegrationId: integration.id }}
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
      breadcrumbs={['Notion', 'Integrations', 'ChatBotKit']}
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

  if (context.query.notionIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          datasetId: context.query.datasetId,

          // default values

          expiresIn: 0,
        },
      }),
    }
  }

  const integration = await prisma.notionIntegration.findUnique({
    where: {
      id: context.query.notionIntegrationId,
    },

    include: {
      ...withNotionIntegrationResources(session.user.id),
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

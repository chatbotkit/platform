import { useMemo, useState } from 'react'

import prisma from '@/prisma/client'
import { Trigger } from '@/prisma/types'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import { useConfirm, useConfirmDelete } from '@/components/Confirm'
import DailyChart from '@/components/DailyChart'
import DescriptionInput from '@/components/DescriptionInput'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import ExtractIntegrationItemList from '@/components/ExtractIntegrationItemList'
import ExtractSchemaCheatsheet from '@/components/ExtractSchemaCheatsheet'
import ExtractSchemaInput from '@/components/ExtractSchemaInput'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import LanguageModelSelect from '@/components/LanguageModelSelect'
import Link from '@/components/Link'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import ThisSolution from '@/components/ThisSolution'
import TriggerSelect from '@/components/TriggerSelect'

import useExtractIntegrationSeries from '@/hooks/useExtractIntegrationSeries'
import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import { propertiesJsonSchema } from '@/schemas/jsonSchema'

import faq from '@/content/faqs/platform-integrations-extract.yaml'

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
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/extract/${integration.id}/update`,
        {
          data: {
            ...data,
          },

          successMessage: 'Extract integration settings updated.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: extractIntegrationId },
      } = await fetch(`/api/v1/integration/extract/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (extractIntegrationId) {
        router.push(`/integrations/extract/${extractIntegrationId}`)
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
      `/api/v1/integration/extract/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Extract integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleTriggerExtraction(event) {
    event.preventDefault()

    if (
      !(await confirm(
        'This will trigger extraction on the last 100 conversations. Do you want to continue?'
      ))
    ) {
      return
    }

    setIsTriggering(true)

    try {
      await fetch(`/api/v1/integration/extract/${integration.id}/trigger`, {
        data: {
          sample: 100,
        },

        successMessage: `Extraction triggered on the last 100 conversations.`,
      })
    } finally {
      setIsTriggering(false)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/extract"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="Extract Integration Configuration">
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
            <Headline title="Extract Application Configuration">
              This information is used to configure the extract integration.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* schema */}
              <div>
                <label className="default-label" htmlFor="schema">
                  Schema
                </label>
                <div className="mt-1">
                  <ExtractSchemaInput
                    className="default-input w-full max-w-full sm:text-sm font-mono"
                    name="schema"
                    defaultSchema={integration.schema}
                    joiSchema={propertiesJsonSchema}
                    required={true}
                    spellCheck={false}
                  />
                </div>
                <p className="input-description">
                  The object schema that will be used to extract data from the
                  conversation. This must be in JSON schema object format. For
                  more information on how to write JSON schema, please refer to{' '}
                  <Link
                    className="default-link"
                    href="https://json-schema.org/understanding-json-schema/reference/object#properties"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Understanding JSON Schema
                  </Link>{' '}
                  docs.
                </p>
                <ExtractSchemaCheatsheet className="mt-2" />
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
                {/* model */}
                <div>
                  <label className="default-label" htmlFor="model">
                    Model
                  </label>
                  <div className="mt-1">
                    <LanguageModelSelect
                      className="default-input w-full max-w-xs sm:text-sm"
                      name="model"
                      defaultValue={integration.model}
                    />
                  </div>
                  <p className="input-description">
                    The language model to use for data extraction. If not
                    specified, the default model will be used.
                  </p>
                </div>
                {/* request */}
                <div>
                  <label className="default-label" htmlFor="request">
                    Request
                  </label>
                  <div className="mt-1">
                    <AutoTextarea
                      className="default-input w-full"
                      name="request"
                      defaultValue={integration.request}
                      placeholder="https://..."
                    />
                  </div>
                  <p className="input-description">
                    Optional web request definition to use to send the extracted
                    data to. You can type in a full http request or just the URL
                    of the endpoint.
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
              // @todo use a confirm button to confirm the action before doing anything else
              <button
                className="default-button"
                type="button"
                onClick={handleTriggerExtraction}
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

function Chart({ integration }) {
  const { data, formats } = useExtractIntegrationSeries(
    integration.id,
    integration.schema
  )

  return <DailyChart data={data} formats={formats} />
}

export default function Index({ integration }) {
  const hasCollectionItems = useMemo(() => {
    return Object.values(integration.schema).some(
      (def) => 'collect' in def && !!def.collect
    )
  }, [integration.schema])

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader
          link="/integrations"
          caption="integrations"
          title="Extract"
          beta={true}
        >
          <p>
            With this integration, you can dynamically extract data from
            conversations. Detailed instructions on how to set up this
            integration can be found at{' '}
            <DocsLink className="default-link" slug="extract">
              ChatBotKit Extract Integration
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
        {integration.id && hasCollectionItems ? (
          <section data-page-section-title="Metrics">
            <div className="main-page">
              <Headline title="Measured Values">
                This chart displays the daily metrics collected by this
                integration.
              </Headline>
              <div className="mt-6 grid grid-cols-1 gap-4">
                <Chart integration={integration} />
              </div>
            </div>
          </section>
        ) : null}
        {integration.id ? (
          <section data-page-section-title="Items">
            <div className="main-page">
              <Headline title="Extracted Items">
                Review the items extracted by this integration. You can export
                the data as CSV for further analysis.
              </Headline>
              <div className="mt-6">
                <ExtractIntegrationItemList
                  integrationId={integration.id}
                  autoLoad={true}
                />
              </div>
            </div>
          </section>
        ) : null}
        {integration.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Extract Integration Events">
                Keep tabs on the progress of your Extract integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ extractIntegrationId: integration.id }}
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
      breadcrumbs={['Extract', 'Integrations', 'ChatBotKit']}
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

  if (context.query.extractIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          botId: context.query.botId,

          // default values

          schema: {
            property01: {
              description: 'Detailed description of the property',
              type: 'string',
            },
            property02: {
              description: 'Detailed description of the property',
              type: 'number',
            },
            property03: {
              description: 'Detailed description of the property',
              type: 'boolean',
              required: true,
            },
          },

          trigger: Trigger.automatic,
        },
      }),
    }
  }

  const integration = await prisma.extractIntegration.findUnique({
    where: {
      id: context.query.extractIntegrationId,
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

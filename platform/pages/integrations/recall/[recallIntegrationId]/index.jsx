import { useState } from 'react'

import { getExternalAPIHostURL } from '@/lib/host'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import {
  DEFAULT_RECALL_REGION,
  RECALL_REGIONS,
  RECALL_REGION_LABELS,
} from '@/lib/recall.constants'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotSelect from '@/components/BotSelect'
import { useConfirmDelete } from '@/components/Confirm'
import Expando from '@/components/Expando'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import IntegrationInstallButton from '@/components/IntegrationInstallButton'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import RevealToken from '@/components/RevealToken'
import ThisSolution from '@/components/ThisSolution'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

export function getInstallDetails({ integration }) {
  return {
    endpoints: [
      {
        label: 'Bot Status Webhook',
        url: getExternalAPIHostURL(
          `/v1/integration/recall/${integration.id}/webhook`
        ),
        description:
          'Use this URL as the Bot Status Change webhook in your Recall workspace dashboard. ChatBotKit listens for the bot.call_ended event and finalises the meeting conversation.',
        required: true,
        copyMessage: 'Recall webhook URL copied to clipboard',
      },
    ],

    instructions: [
      'Log into the Recall.ai dashboard',
      'Navigate to Webhooks (Settings > Webhooks)',
      'Create a new Bot Status Change webhook',
      'Set the delivery method to HTTP POST',
      'Paste the Bot Status Webhook URL above',
      'Save the configuration',
    ],
  }
}

export function getInstallPopupDetails(options) {
  return getInstallDetails(options)
}

export function Form({ integration, installDetails }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
    successMessage: 'Recall integration settings updated.',
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/recall/${integration.id}/update`,
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
        data: { id: recallIntegrationId },
      } = await fetch(`/api/v1/integration/recall/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (recallIntegrationId) {
        router.push(`/integrations/recall/${recallIntegrationId}`)
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
      `/api/v1/integration/recall/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Recall integration deleted.',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  return (
    <>
      <ThisSolution
        type="integrations/recall"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          <div>
            <Headline title="Recall Integration Configuration">
              This information is used to configure the private Recall
              integration.
            </Headline>
            <div className="mt-6 space-y-6">
              <GeneralBasicOptions instance={integration} />
              <div>
                <label className="default-label" htmlFor="botId">
                  Bot
                </label>
                <div className="mt-1">
                  <BotSelect
                    className="default-input w-full max-w-xs"
                    name="botId"
                    defaultValue={integration.botId}
                  />
                </div>
                <p className="input-description">Select an existing bot.</p>
              </div>
            </div>
          </div>
          {integration.id ? (
            <div>
              <Headline title="Recall Application Configuration">
                This information is used to configure the Recall integration.
              </Headline>
              <div className="mt-6 space-y-6">
                <div>
                  <label className="default-label" htmlFor="apiKey">
                    API Key
                  </label>
                  <div className="mt-1">
                    <RevealToken
                      className="default-input w-full sm:text-sm"
                      name="apiKey"
                      defaultToken={integration.apiKey}
                    />
                  </div>
                  <p className="input-description">
                    The API key used to authenticate with Recall.
                  </p>
                </div>
                <div>
                  <label className="default-label" htmlFor="webhookSecret">
                    Webhook Secret
                  </label>
                  <div className="mt-1">
                    <RevealToken
                      className="default-input w-full sm:text-sm"
                      name="webhookSecret"
                      defaultToken={integration.webhookSecret}
                    />
                  </div>
                  <p className="input-description">
                    The signing secret of the webhook endpoint you created in
                    the Recall dashboard (it starts with <q>whsec_</q>).
                    Optional but recommended: when set, bot status callbacks
                    are verified against their signature. Existing integrations
                    keep working without it.
                  </p>
                </div>
                <div>
                  <label className="default-label" htmlFor="region">
                    Region
                  </label>
                  <div className="mt-1">
                    <select
                      id="region"
                      className="default-input w-full max-w-xs"
                      name="region"
                      defaultValue={integration.region || ''}
                    >
                      <option value="">
                        {`${RECALL_REGION_LABELS[DEFAULT_RECALL_REGION]} (${DEFAULT_RECALL_REGION}, default)`}
                      </option>
                      {RECALL_REGIONS.filter(
                        (region) => region !== DEFAULT_RECALL_REGION
                      ).map((region) => (
                        <option key={region} value={region}>
                          {RECALL_REGION_LABELS[region]} ({region})
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="input-description">
                    Select the Recall region that owns this API key.
                  </p>
                </div>
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
                        defaultValue={integration.alias}
                        pattern="[a-z0-9_-]*"
                        maxLength={128}
                      />
                    </div>
                    <p className="input-description">
                      Optional unique alias for this integration. Use lowercase
                      letters, numbers, hyphens, and underscores only. Can be
                      used to reference this integration via @alias.
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
          ) : null}
        </div>
        <div>
          <div className="action-area">
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
              <IntegrationInstallButton
                title="Recall Install Instructions"
                details={installDetails}
              />
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

export function Initiate({ integration }) {
  const { loading, fetch } = useFetch({
    loadingMessage: 'Initiating Recall bot...',
    failureMessage: true,
    successMessage: 'Recall bot initiated.',
  })

  async function handleInitiate(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    await fetch(`/api/v1/integration/recall/${integration.id}/initiate`, {
      data,
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleInitiate}>
      <div>
        <label className="default-label" htmlFor="meetingUrl">
          Meeting URL
        </label>
        <div className="mt-1">
          <input
            id="meetingUrl"
            className="default-input w-full sm:text-sm"
            name="meetingUrl"
            type="url"
            placeholder="https://zoom.us/j/123?pwd=456"
            autoComplete="off"
            required
          />
        </div>
        <p className="input-description">
          The meeting URL the Recall bot should join.
        </p>
      </div>
      <div>
        <label className="default-label" htmlFor="text">
          Initiation Text
        </label>
        <div className="mt-1">
          <textarea
            id="text"
            className="default-input w-full sm:text-sm"
            name="text"
            rows={4}
            placeholder="Ask the bot what to do when it joins the meeting..."
            required
          />
        </div>
        <p className="input-description">
          The bot uses this as an instruction when it starts the meeting
          session.
        </p>
      </div>
      <div>
        <label className="default-label" htmlFor="botName">
          Bot Name
        </label>
        <div className="mt-1">
          <input
            id="botName"
            className="default-input w-full sm:text-sm"
            name="botName"
            placeholder="ChatBotKit"
            autoComplete="off"
          />
        </div>
        <p className="input-description">
          Optional display name for the Recall meeting bot.
        </p>
      </div>
      <div className="action-area">
        <span className="action-area-space" />
        <button type="submit" className="primary-button" disabled={loading}>
          Start Bot
        </button>
      </div>
    </form>
  )
}

export default function Index({ integration }) {
  const installDetails = getInstallDetails({ integration })
  const installPopupDetails = getInstallPopupDetails({ integration })

  return (
    <PageSections className="pt-12">
      <section data-page-section-title="Configuration">
        <div className="main-page">
          <Form
            key={integration.id || 'new'}
            integration={integration}
            installDetails={installPopupDetails}
          />
        </div>
      </section>
      {integration.id ? (
        <section data-page-section-title="Webhook">
          <div className="main-page">
            <Headline title="Recall Webhook Configuration">
              Configure the bot status webhook in your Recall workspace
              dashboard to finalise meetings when they end.
            </Headline>
            <Expando
              titleClassName="default-link text-sm"
              title="Show Instructions"
            >
              <WebhookSetupSection {...installDetails} />
            </Expando>
          </div>
        </section>
      ) : null}
      {integration.id ? (
        <section data-page-section-title="Initiate">
          <div className="main-page">
            <Headline title="Recall Initiate">
              Start a Recall meeting bot from this integration.
            </Headline>
            <Expando
              titleClassName="default-link text-sm"
              title="Show Initiate"
            >
              <Initiate integration={integration} />
            </Expando>
          </div>
        </section>
      ) : null}
    </PageSections>
  )
}

Index.getLayout = function (children, { integration }) {
  return (
    <Dashboard
      breadcrumbs={['Recall', 'Integrations', 'ChatBotKit']}
      title={integration.name || integration.id || 'New'}
      authenticated={true}
    >
      {children}
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

  if (context.query.recallIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          botId: context.query.botId,
        },
      }),
    }
  }

  const integration = await prisma.recallIntegration.findUnique({
    where: {
      id: context.query.recallIntegrationId,
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

import { useState } from 'react'

import { ONE_DAY_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getExternalAPIHostURL } from '@/lib/host'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import { useConfirm, useConfirmDelete } from '@/components/Confirm'
import ConversationManager from '@/components/ConversationManager'
import DurationSelect from '@/components/DurationSelect'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import IntegrationInstallButton from '@/components/IntegrationInstallButton'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import ScheduleSelect from '@/components/ScheduleSelect'
import ThisSolution from '@/components/ThisSolution'
import TimezoneSelect from '@/components/TimezoneSelect'
import Toggle from '@/components/Toggle'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-integrations-trigger.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function getInstallDetails({
  integration,
  eventEndpoint,
}) {
  return {
    sections: {
      Setup: {
        title: 'Setup',
        endpoints: [
          {
            label: 'Event Endpoint',
            url: eventEndpoint,
            description:
              'Send POST requests with your payload to this endpoint to invoke the trigger.',
            required: true,
            copyMessage: 'Trigger event endpoint copied to clipboard',
          },
        ],
        secrets: [
          {
            label: 'Secret',
            name: 'secret',
            value: integration.secret,
            type: 'reveal',
            description:
              'Include this secret (e.g. as an Authorization header or custom header) to authenticate your requests.',
            required: true,
            copyMessage: 'Trigger secret copied to clipboard',
          },
        ],
        instructions: [
          'Construct the JSON payload representing the event you want to send.',
          'Send a POST request to the Event Endpoint above including the secret for authentication.',
          'Monitor the Trigger Integration Events section to verify processing.',
          'Optionally schedule executions via Trigger Schedule if supported in your plan.',
        ],
      },
      Code: {
        title: 'Code',
        code: {
          language: 'bash',
          content: `curl -X POST ${eventEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${integration.secret}" \\
  -d '{
    "event": "your_event_name",
    "data": {
      "key": "value"
    }
  }'`,
        },
        instructions: [
          'Replace "your_event_name" with the actual event type you want to trigger.',
          'Customize the data payload with your specific event data.',
          'The secret can be sent as an Authorization Bearer token or in a custom header.',
          'The endpoint expects a JSON payload with your event information.',
        ],
      },
    },
  }
}

export function getInstallPopupDetails({ integration, eventEndpoint }) {
  const details = getInstallDetails({ integration, eventEndpoint })

  return {
    ...details,
    sections: {
      ...details.sections,
      Setup: {
        ...details.sections.Setup,
        instructions: [
          'Construct the JSON payload representing the event you want to send.',
          'Send a POST request to the Event Endpoint above including the secret for authentication.',
          'After sending a test request, close these instructions and review the Trigger Integration Events section.',
          'Configure Trigger Schedule in the integration form if scheduled executions are supported in your plan.',
        ],
      },
    },
  }
}

export function Form({
  integration,
  installDetails,
  updateCounter = 0,
  onIntegrationUpdate,
}) {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
    successMessage: true,
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (data.handle) {
      data.handle = data.handle.replace(/^\/+/g, '').trim().toLowerCase()
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/trigger/${integration.id}/update`,
        {
          data: {
            ...data,
          },

          successMessage: 'Trigger integration settings updated.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        onIntegrationUpdate?.()
      }
    } else {
      const {
        data: { id: triggerIntegrationId },
      } = await fetch(`/api/v1/integration/trigger/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (triggerIntegrationId) {
        router.push(`/integrations/trigger/${triggerIntegrationId}`)
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
      `/api/v1/integration/trigger/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Trigger integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleSetup(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/trigger/${integration.id}/setup`, {
      data: {},

      successMessage: 'Trigger setup completed.',
    })
  }

  async function handleInvoke(event) {
    event.preventDefault()

    if (
      !(await confirm('Are you sure you want to invoke this trigger?', {
        title: 'Confirm Trigger Invocation',
        actions: {
          Invoke: { result: true, default: true },
        },
      }))
    ) {
      return
    }

    await fetch(`/api/v1/integration/trigger/${integration.id}/invoke`, {
      data: {},

      successMessage: 'Trigger invoked...',
    })

    onIntegrationUpdate?.()
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/trigger"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="Trigger Integration Configuration">
              This information is used to configure some general options around
              the integration.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              <GeneralBasicOptions
                instance={integration}
                additionalNameInstructions="This value have an effect on the conversation when the trigger is invoked."
                additionalDescriptionInstructions="This value have an effect on the conversation when the trigger is invoked."
              />
              {/* botId */}
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
            <>
              {/* application configuration */}
              <div>
                <Headline title="Trigger Application Configuration">
                  This information is used to configure the trigger integration.
                </Headline>
                <div className="mt-6 space-y-6">
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
                        Optional unique alias for this integration. Use
                        lowercase letters, numbers, hyphens, and underscores
                        only. Can be used to reference this integration via
                        @alias.
                      </p>
                    </div>
                    {/* authenticate */}
                    <div>
                      <label className="default-label" htmlFor="authenticate">
                        Authenticate
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="authenticate"
                          defaultChecked={integration.authenticate}
                        />
                      </div>
                      <p className="input-description">
                        When enabled, the integration requires authentication.
                      </p>
                    </div>
                    {/* schedule */}
                    <div>
                      <label className="default-label" htmlFor="schedule">
                        Trigger Schedule
                        <sup className="ml-2 bg-gray-800 text-white p-0.5 rounded">
                          PRO
                        </sup>
                      </label>
                      <div className="mt-1">
                        <ScheduleSelect
                          className="default-input w-full max-w-xs sm:text-sm"
                          name="schedule"
                          defaultValue={integration.schedule}
                          allowCustom={true}
                        />
                      </div>
                      <p className="input-description">
                        The trigger scheduled defines how often to trigger is
                        executed without external influence. This option is only
                        available to customers on ChatBotKit Pro and Team plans.
                      </p>
                    </div>
                    {/* timezone */}
                    <div>
                      <label className="default-label" htmlFor="timezone">
                        Timezone
                      </label>
                      <div className="mt-1">
                        <TimezoneSelect
                          className="default-input w-full max-w-xs sm:text-sm"
                          name="timezone"
                          defaultValue={integration.timezone}
                        />
                      </div>
                      <p className="input-description">
                        The timezone used for cron and local-time schedules.
                      </p>
                    </div>
                    {/* sessionDuration */}
                    <div>
                      <label
                        className="default-label"
                        htmlFor="sessionDuration"
                      >
                        Session Duration
                      </label>
                      <div className="mt-1">
                        <DurationSelect
                          className="default-input w-full max-w-xs sm:text-sm"
                          name="sessionDuration"
                          defaultValue={integration.sessionDuration}
                          nullable
                          defaultCaption="1 day (default)"
                        />
                      </div>
                      <p className="input-description">
                        The bot will be able to continue the same conversation
                        for the specified time period.
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
            </>
          ) : null}
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
            {false /* deliberately disabled */ && integration.id ? (
              <button
                type="button"
                className="default-button"
                onClick={handleSetup}
              >
                Setup
              </button>
            ) : null}
            {integration.id ? (
              <IntegrationInstallButton
                title="Trigger Install Instructions"
                details={installDetails}
                docsSlug="trigger"
              />
            ) : null}
            {integration.id ? (
              <button
                className="default-button"
                type="button"
                onClick={handleInvoke}
              >
                Invoke
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

export function Chat({ integration }) {
  return (
    <ConversationManager
      instance={integration}
      autoStart={true}
      autoAddBackstory={false}
      advancedOptions={false}
      stream={true}
      verbose={true}
      conversationLink={true}
      situationLink={true}
    />
  )
}

export default function Index({ integration, eventEndpoint }) {
  const [updateCounter, setUpdateCounter] = useState(0)

  const installDetails = getInstallDetails({ integration, eventEndpoint })
  const installPopupDetails = getInstallPopupDetails({
    integration,
    eventEndpoint,
  })

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader
          link="/integrations"
          caption="integrations"
          title="Trigger"
          beta={true}
        >
          <p>
            With this integration, you can trigger your bot from an external
            source, such as a website, mobile app, or another bot. This is
            useful when you want to trigger a bot from a specific event or
            action. Detailed instructions on how to set up this integration can
            be found at{' '}
            <DocsLink className="default-link" slug="trigger">
              ChatBotKit Trigger Integration
            </DocsLink>{' '}
            docs.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form
              integration={integration}
              installDetails={installPopupDetails}
              updateCounter={updateCounter}
              onIntegrationUpdate={() => setUpdateCounter((value) => value + 1)}
            />
          </div>
        </section>
        {integration.id ? (
          <section data-page-section-title="Webhook">
            <div className="main-page">
              <Headline title="Trigger Webhook Configuration">
                Use the event endpoint and secret below to send events that
                invoke the trigger.
              </Headline>
              <Expando
                titleClassName="default-link text-sm"
                title="Show Instructions"
              >
                <WebhookSetupSection.Multi sections={installDetails.sections} />
              </Expando>
            </div>
          </section>
        ) : null}
        {/* @note disabled because it is confusing */}
        {/* {integration.id ? (
          <section>
            <div className="main-page">
              <Headline title="Conversation Tester">
                Are you ready to test your chatbot skills? Use this section to
                put your creation to the test!
              </Headline>
              <Chat key={integration.id} integration={integration} />
            </div>
          </section>
        ) : null} */}
        {integration.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Trigger Integration Events">
                Keep tabs on the progress of your Trigger integration&apos;s
                events.
              </Headline>
              <EventLog
                key={`trigger-events-${updateCounter}`}
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ triggerIntegrationId: integration.id }}
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
      breadcrumbs={['Trigger', 'Integrations', 'ChatBotKit']}
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

  if (context.query.triggerIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          botId: context.query.botId,

          // default values

          sessionDuration: ONE_DAY_IN_MILLISECONDS,
        },
      }),
    }
  }

  const integration = await prisma.triggerIntegration.findUnique({
    where: {
      id: context.query.triggerIntegrationId,
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

      eventEndpoint: getExternalAPIHostURL(
        `/v1/integration/trigger/${integration.id}/event`
      ),
    }),
  }
}

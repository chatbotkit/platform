import { useState } from 'react'

import { ONE_DAY_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import { getTelegramIntegrationWebhook } from '@/lib/telegram.webhook'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
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
import RevealToken from '@/components/RevealToken'
import ThisSolution from '@/components/ThisSolution'
import Toggle from '@/components/Toggle'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-integrations-telegram.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function getInstallDetails({ webhookEndpoint }) {
  return {
    endpoints: [
      {
        label: 'Webhook',
        url: webhookEndpoint,
        description:
          'This is the webhook URL we set on your Telegram bot during setup.',
        required: true,
        copyMessage: 'Telegram webhook URL copied to clipboard',
      },
    ],

    instructions: [
      'Create a bot with @BotFather if you have not already and obtain the Bot Token.',
      'Enter the Bot Token above and click Save, then click the Setup button.',
      'Setup will register the webhook with Telegram for you automatically.',
      'If you ever need to re-register manually, you can use the URL above with the setWebhook method.',
    ],
  }
}

export function getInstallPopupDetails() {
  return {
    instructions: [
      'Create a bot with @BotFather if you have not already and obtain the Bot Token.',
      'Close these instructions, enter the Bot Token in the integration form, save the integration, then click Setup.',
      'Setup will register the webhook with Telegram for you automatically.',
    ],
  }
}

export function Form({ integration, installDetails }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

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
        `/api/v1/integration/telegram/${integration.id}/update`,
        {
          data: {
            ...data,
          },

          successMessage: 'Telegram integration settings updated.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: telegramIntegrationId },
      } = await fetch(`/api/v1/integration/telegram/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (telegramIntegrationId) {
        router.push(`/integrations/telegram/${telegramIntegrationId}`)
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
      `/api/v1/integration/telegram/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Telegram integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleSetup(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/telegram/${integration.id}/setup`, {
      data: {},

      successMessage: 'Telegram setup completed.',
    })
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/telegram"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="Telegram Integration Configuration">
              This information is used to configure some general options around
              the integration.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              <GeneralBasicOptions instance={integration} />
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
                <Headline title="Telegram Application Configuration">
                  This information is used to configure the telegram
                  integration.
                </Headline>
                <div className="mt-6 space-y-6">
                  {/* bot token */}
                  <div>
                    <label className="default-label" htmlFor="botToken">
                      Bot Token
                    </label>
                    <div className="mt-1">
                      <RevealToken
                        className="default-input w-full sm:text-sm"
                        name="botToken"
                        defaultToken={integration.botToken}
                      />
                    </div>
                    <p className="input-description">
                      The bot token for this Telegram application. You need a{' '}
                      <q>System User</q> to get a permanent bot token.
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
                        Optional unique alias for this integration. Use
                        lowercase letters, numbers, hyphens, and underscores
                        only. Can be used to reference this integration via
                        @alias.
                      </p>
                    </div>
                    {/* contactCollection */}
                    <div>
                      <label
                        className="default-label"
                        htmlFor="contactCollection"
                      >
                        Contact Collection
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="contactCollection"
                          defaultChecked={integration.contactCollection}
                        />
                      </div>
                      <p className="input-description">
                        Weather or not to collect contact information from the
                        user.
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
                        The user will be able to continue the same conversation
                        for the specified time period.
                      </p>
                    </div>
                    {/* attachments */}
                    <div>
                      <label className="default-label" htmlFor="attachments">
                        Attachments
                        <sup className="beta">BETA</sup>
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="attachments"
                          defaultChecked={integration.attachments}
                        />
                      </div>
                      <p className="input-description">
                        If enabled the bot will automatically process
                        attachments.
                      </p>
                    </div>
                    {/* allowFrom */}
                    <div>
                      <label className="default-label" htmlFor="allowFrom">
                        Allowed Senders
                      </label>
                      <div className="mt-1">
                        <textarea
                          className="default-input w-full sm:text-sm"
                          name="allowFrom"
                          rows={4}
                          defaultValue={integration.allowFrom}
                          placeholder={'@username\n@123456789\n#-100123456789'}
                        />
                      </div>
                      <p className="input-description">
                        Limit which Telegram users or chats can send messages to
                        this integration. Enter one pattern per line or separate
                        with commas. Use @username or @numericId for users,
                        #chatId for groups. Use * to allow everyone. Leave empty
                        to block all.
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
            {true /* feature flag */ &&
            integration.id &&
            integration.botToken ? (
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
                title="Telegram Install Instructions"
                details={installDetails}
                docsSlug="telegram"
                links={[
                  {
                    caption: 'Open BotFather',
                    url: 'https://t.me/BotFather',
                    default: true,
                  },
                ]}
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

export function Initiate({ integration }) {
  const { loading, fetch } = useFetch({
    loadingMessage: 'Initiating Telegram conversation...',
    failureMessage: true,
    successMessage: 'Telegram conversation initiated.',
  })

  async function handleInitiate(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    await fetch(`/api/v1/integration/telegram/${integration.id}/initiate`, {
      data,
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleInitiate}>
      <div>
        <label className="default-label" htmlFor="chatId">
          Chat ID
        </label>
        <div className="mt-1">
          <input
            id="chatId"
            className="default-input w-full sm:text-sm"
            name="chatId"
            placeholder="123456789 or @channelusername"
            autoComplete="off"
            required
          />
        </div>
        <p className="input-description">
          Use a Telegram chat ID, user ID, group ID, or supported channel
          username.
        </p>
      </div>
      <div>
        <label className="default-label" htmlFor="text">
          Initiation Text
        </label>
        <div className="mt-1">
          <AutoTextarea
            id="text"
            className="default-input w-full sm:text-sm"
            name="text"
            placeholder="Ask the bot to write the opening Telegram message..."
            required
          />
        </div>
        <p className="input-description">
          The bot uses this as an instruction and sends the generated message
          through Telegram.
        </p>
      </div>
      <div className="action-area">
        <span className="action-area-space" />
        <button type="submit" className="primary-button" disabled={loading}>
          Send Message
        </button>
      </div>
    </form>
  )
}

export default function Index({ integration, webhookEndpoint }) {
  const installDetails = getInstallDetails({ webhookEndpoint })
  const installPopupDetails = getInstallPopupDetails()

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/integrations" caption="integrations" title="Telegram">
          <p>
            With this integration, you can create your own Telegram
            conversational AI chatbot. Detailed instructions on how to set up
            this integration can be found at{' '}
            <DocsLink className="default-link" slug="telegram">
              ChatBotKit Telegram Integration
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
            />
          </div>
        </section>
        {integration.id ? (
          <section data-page-section-title="Webhook">
            <div className="main-page">
              <Headline title="Telegram Webhook Configuration">
                The webhook is automatically configured when you click the Setup
                button, but you can review the values and instructions below.
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
              <Headline title="Telegram Initiate">
                Start a Telegram conversation from this integration.
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
              <Headline title="Telegram Integration Events">
                Keep tabs on the progress of your Telegram integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ telegramIntegrationId: integration.id }}
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
      breadcrumbs={['Telegram', 'Integrations', 'ChatBotKit']}
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

  if (context.query.telegramIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          botId: context.query.botId,

          // default values

          allowFrom: '*',
          attachments: true,
          sessionDuration: ONE_DAY_IN_MILLISECONDS,
        },
      }),
    }
  }

  const integration = await prisma.telegramIntegration.findUnique({
    where: {
      id: context.query.telegramIntegrationId,
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

      webhookEndpoint: getTelegramIntegrationWebhook(integration.id),
    }),
  }
}

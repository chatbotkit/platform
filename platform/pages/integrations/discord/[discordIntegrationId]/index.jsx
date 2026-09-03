import { useState } from 'react'

import { ONE_DAY_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getExternalAPIHostURL } from '@/lib/host'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

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

import faq from '@/content/faqs/platform-integrations-discord.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function getInstallDetails({ interactEndpoint }) {
  return {
    endpoints: [
      {
        label: 'Interaction Endpoint',
        url: interactEndpoint,
        description:
          'Copy the interaction endpoint above and set it up under "General Information" section of your discord application.',
        required: true,
        copyMessage: 'Discord interaction endpoint copied to clipboard',
      },
    ],

    instructions: [
      'Navigate to your Discord application in the Discord Developer Portal',
      'Go to the "General Information" section',
      'Paste the Interaction Endpoint URL above into the "Interactions Endpoint URL" field',
      'Save your application settings',
    ],
  }
}

export function getInstallPopupDetails(options) {
  return getInstallDetails(options)
}

export function getInstallUrl(appId) {
  const url = new URL(
    'https://discord.com/api/oauth2/authorize?permissions=2147485696&scope=bot%20applications.commands'
  )

  url.searchParams.append('client_id', appId)

  return url.toString()
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
        `/api/v1/integration/discord/${integration.id}/update`,
        {
          data: {
            ...data,
          },

          successMessage: 'Discord integration settings updated.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: discordIntegrationId },
      } = await fetch(`/api/v1/integration/discord/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (discordIntegrationId) {
        router.push(`/integrations/discord/${discordIntegrationId}`)
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
      `/api/v1/integration/discord/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Discord integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleSetup(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/discord/${integration.id}/setup`, {
      data: {},

      successMessage: 'Discord setup completed.',
    })
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/discord"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="Discord Integration Configuration">
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
                <Headline title="Discord Application Configuration">
                  This information is used to configure the discord integration.
                </Headline>
                <div className="mt-6 space-y-6">
                  {/* app id */}
                  <div>
                    <label className="default-label" htmlFor="appId">
                      Application Id
                    </label>
                    <div className="mt-1">
                      <input
                        className="default-input w-full sm:text-sm"
                        name="appId"
                        type="text"
                        defaultValue={integration.appId}
                      />
                    </div>
                    <p className="input-description">
                      The application id for this discord application. You can
                      find this information in the <q>General Information</q>{' '}
                      section in your Discord Application.
                    </p>
                  </div>
                  {/* public key */}
                  <div>
                    <label className="default-label" htmlFor="publicKey">
                      Public Key
                    </label>
                    <div className="mt-1">
                      <RevealToken
                        className="default-input w-full sm:text-sm"
                        name="publicKey"
                        defaultToken={integration.publicKey}
                      />
                    </div>
                    <p className="input-description">
                      The public key for this discord application. You can find
                      this information in the <q>General Information</q> section
                      in your Discord Application.
                    </p>
                  </div>
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
                      The bot token for this discord application. You can find
                      this information in the <q>Bot</q> section in your Discord
                      Application. Click on the <q>Add Bot</q> or the
                      <q>Reset Token</q> button to get a new token.
                    </p>
                  </div>
                  {/* handle */}
                  <div>
                    <label className="default-label" htmlFor="handle">
                      Handle
                    </label>
                    <div className="mt-1">
                      <input
                        className="default-input w-full sm:text-sm"
                        name="handle"
                        type="text"
                        defaultValue={integration.handle}
                      />
                    </div>
                    <p className="input-description">
                      The handle for this integration. It is used as a slash
                      command. If no value is provided the command name will be{' '}
                      <strong>/chatbotkit</strong>. Enter the handle without{' '}
                      <strong>/</strong> (<strong>slash</strong>).
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
                    {/* ephemeral */}
                    <div>
                      <label className="default-label" htmlFor="ephemeral">
                        Ephemeral
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="ephemeral"
                          defaultChecked={integration.ephemeral}
                        />
                      </div>
                      <p className="input-description">
                        Indicate if the conversation is only visible to the user
                        who invoked it.
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
                        Collect contact details such as name and phone number.
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
                    {/* @note disabled because not supported */}
                    {/* <div>
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
                    </div> */}
                    {/* allowFrom */}
                    <div>
                      <label className="default-label" htmlFor="allowFrom">
                        Allowed Senders
                      </label>
                      <div className="mt-1">
                        <textarea
                          className="default-input w-full sm:text-sm"
                          name="allowFrom"
                          id="allowFrom"
                          rows={4}
                          defaultValue={integration.allowFrom}
                          placeholder={'123456789012345678\n@username\n*'}
                        />
                      </div>
                      <p className="input-description">
                        Limit which Discord users can interact with this
                        integration. Use Discord user IDs (17-18 digit
                        snowflakes) or @username. Use <code>*</code> to allow
                        all. Leave empty to deny all.
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
            {integration.id && integration.appId && integration.botToken ? (
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
                title="Discord Install Instructions"
                details={installDetails}
                docsSlug="discord"
                links={[
                  {
                    caption: 'Open Developer Portal',
                    url: 'https://discord.com/developers/applications',
                  },

                  ...(integration.appId
                    ? [
                        {
                          caption: 'Install to Server',
                          url: getInstallUrl(integration.appId),
                          default: true,
                        },
                      ]
                    : []),
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
    loadingMessage: 'Initiating Discord conversation...',
    failureMessage: true,
    successMessage: 'Discord conversation initiated.',
  })

  async function handleInitiate(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    await fetch(`/api/v1/integration/discord/${integration.id}/initiate`, {
      data,
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleInitiate}>
      <div>
        <label className="default-label" htmlFor="channelId">
          Channel ID
        </label>
        <div className="mt-1">
          <input
            id="channelId"
            className="default-input w-full sm:text-sm"
            name="channelId"
            placeholder="123456789012345678"
            autoComplete="off"
            required
          />
        </div>
        <p className="input-description">
          Use the Discord channel ID where the bot should send the message.
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
            placeholder="Ask the bot to write the opening Discord message..."
            required
          />
        </div>
        <p className="input-description">
          The bot uses this as an instruction and sends the generated message
          through Discord.
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

export default function Index({ integration, interactEndpoint }) {
  const installDetails = getInstallDetails({ interactEndpoint })
  const installPopupDetails = getInstallPopupDetails({ interactEndpoint })

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/integrations" caption="integrations" title="Discord">
          <p>
            With this integration, you can receive notifications and interact
            with your chatbot directly from your Discord server. Detailed
            instructions on how to set up this integration can be found at{' '}
            <DocsLink className="default-link" slug="discord">
              ChatBotKit Discord Integration
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
              <Headline title="Discord Webhook Configuration">
                Configure the interaction endpoint in your Discord application
                settings.
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
              <Headline title="Discord Initiate">
                Start a Discord conversation from this integration.
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
              <Headline title="Discord Integration Events">
                Keep tabs on the progress of your Discord integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ discordIntegrationId: integration.id }}
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
      breadcrumbs={['Discord', 'Integrations', 'ChatBotKit']}
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

  if (context.query.discordIntegrationId === 'new') {
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

  const integration = await prisma.discordIntegration.findUnique({
    where: {
      id: context.query.discordIntegrationId,
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

  integration.createdAt = integration.createdAt.getTime()
  integration.updatedAt = integration.updatedAt.getTime()

  return {
    props: makeJsonSafe({
      integration,

      interactEndpoint: getExternalAPIHostURL(
        `/v1/integration/discord/${integration.id}/interact`
      ),
    }),
  }
}

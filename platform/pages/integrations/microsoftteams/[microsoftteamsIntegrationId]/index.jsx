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

import faq from '@/content/faqs/platform-integrations-microsoftteams.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export const INSTALL_DOCS_SLUG = 'microsoft-teams'

export function getInstallDetails({ callbackEndpoint }) {
  return {
    endpoints: [
      {
        label: 'Messaging Endpoint',
        url: callbackEndpoint,
        description:
          'Copy this URL and set it as the Messaging Endpoint in your Azure Bot resource under "Configuration".',
        required: true,
        copyMessage: 'Teams messaging endpoint copied to clipboard',
      },
    ],

    instructions: [
      'Go to the Azure portal and navigate to your Azure Bot resource',
      'Open "Configuration" in the left sidebar',
      'Paste the Messaging Endpoint URL above into the "Messaging endpoint" field',
      'Enter your Microsoft App ID and save',
      'Add the Teams channel in "Channels" to make your bot available in Microsoft Teams',
      'Copy the App ID and App Secret into this settings page and click Save, then Setup',
    ],
  }
}

export function getInstallPopupDetails({ callbackEndpoint }) {
  return {
    ...getInstallDetails({ callbackEndpoint }),
    instructions: [
      'Go to the Azure portal and navigate to your Azure Bot resource',
      'Open "Configuration" in the left sidebar',
      'Paste the Messaging Endpoint URL above into the "Messaging endpoint" field',
      'Enter your Microsoft App ID and save',
      'Add the Teams channel in "Channels" to make your bot available in Microsoft Teams',
      'Close these instructions, enter the Application ID and Application Secret in the integration form, save the integration, then click Setup.',
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

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/microsoftteams/${integration.id}/update`,
        {
          data: {
            ...data,
          },

          successMessage: 'Teams integration settings updated.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: microsoftteamsIntegrationId },
      } = await fetch(`/api/v1/integration/microsoftteams/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (microsoftteamsIntegrationId) {
        router.push(
          `/integrations/microsoftteams/${microsoftteamsIntegrationId}`
        )
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
      `/api/v1/integration/microsoftteams/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Teams integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleSetup(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/microsoftteams/${integration.id}/setup`, {
      data: {},

      successMessage: 'Teams setup completed.',
    })
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/microsoftteams"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="Teams Integration Configuration">
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
              {/* microsoft teams application configuration */}
              <div>
                <Headline title="Microsoft Teams Application Configuration">
                  This information is used to configure the Microsoft Teams bot
                  integration. You will be able to complete this information
                  after creating your Azure Bot resource.
                </Headline>
                <div className="mt-6 space-y-6">
                  {/* botFrameworkAppId */}
                  <div>
                    <label
                      className="default-label"
                      htmlFor="botFrameworkAppId"
                    >
                      Application ID
                    </label>
                    <div className="mt-1">
                      <input
                        className="default-input w-full sm:text-sm"
                        name="botFrameworkAppId"
                        type="text"
                        defaultValue={integration.botFrameworkAppId || ''}
                      />
                    </div>
                    <p className="input-description">
                      The Microsoft App ID for your bot. You can find this in
                      the Azure Bot resource under{' '}
                      <q>Configuration &gt; Microsoft App ID</q>.
                    </p>
                  </div>
                  {/* botFrameworkAppSecret */}
                  <div>
                    <label
                      className="default-label"
                      htmlFor="botFrameworkAppSecret"
                    >
                      Application Secret
                    </label>
                    <div className="mt-1">
                      <RevealToken
                        className="default-input w-full sm:text-sm"
                        name="botFrameworkAppSecret"
                        defaultToken={integration.botFrameworkAppSecret}
                      />
                    </div>
                    <p className="input-description">
                      The Microsoft App Password (client secret) for your bot.
                      Create one in the Azure portal under your app
                      registration&apos;s <q>Certificates &amp; secrets</q>{' '}
                      section.
                    </p>
                  </div>
                  {/* tenantId */}
                  <div>
                    <label className="default-label" htmlFor="tenantId">
                      Tenant ID
                    </label>
                    <div className="mt-1">
                      <RevealToken
                        className="default-input w-full sm:text-sm"
                        name="tenantId"
                        defaultToken={integration.tenantId}
                      />
                    </div>
                    <p className="input-description">
                      The Azure Active Directory tenant ID for your
                      organisation. Use <strong>common</strong> to allow
                      sign-ins from any tenant (multi-tenant bots).
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
                        Collect contact details such as name and display name
                        from Teams users.
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
                          placeholder={'29:1AbcDefGhi\n29:1XyzOtherUser\n*'}
                        />
                      </div>
                      <p className="input-description">
                        Limit which Teams users can interact with this
                        integration. Enter one Teams user ID (e.g.{' '}
                        <code>29:1AbcDef...</code>) per line. Use <code>*</code>{' '}
                        to allow all. Leave empty to deny all.
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
            {integration.id &&
            integration.botFrameworkAppId &&
            integration.botFrameworkAppSecret ? (
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
                title="Teams Install Instructions"
                details={installDetails}
                docsSlug={INSTALL_DOCS_SLUG}
                links={[
                  {
                    caption: 'Open Azure Portal',
                    url: 'https://portal.azure.com/',
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

export function Initiate({ integration }) {
  const { loading, fetch } = useFetch({
    loadingMessage: 'Initiating Teams conversation...',
    failureMessage: true,
    successMessage: 'Teams conversation initiated.',
  })

  async function handleInitiate(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    await fetch(
      `/api/v1/integration/microsoftteams/${integration.id}/initiate`,
      {
        data,
      }
    )
  }

  return (
    <form className="space-y-6" onSubmit={handleInitiate}>
      <div>
        <label className="default-label" htmlFor="conversationId">
          Conversation ID
        </label>
        <div className="mt-1">
          <input
            id="conversationId"
            className="default-input w-full sm:text-sm"
            name="conversationId"
            placeholder="19:abc123@thread.tacv2"
            autoComplete="off"
            required
          />
        </div>
        <p className="input-description">
          Use the Bot Framework conversation ID where the Teams bot should send
          the message.
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
            placeholder="Ask the bot to write the opening Teams message..."
            required
          />
        </div>
        <p className="input-description">
          The bot uses this as an instruction and sends the generated message
          through Teams.
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

export default function Index({ integration, callbackEndpoint }) {
  const installDetails = getInstallDetails({ callbackEndpoint })
  const installPopupDetails = getInstallPopupDetails({ callbackEndpoint })

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader
          link="/integrations"
          caption="integrations"
          title="Microsoft Teams"
        >
          <p>
            With this integration, you can deploy an AI bot directly into your
            Microsoft Teams workspace. Detailed instructions on how to set up
            this integration can be found at{' '}
            <DocsLink className="default-link" slug="teams">
              ChatBotKit Teams Integration
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
              <Headline title="Teams Webhook Configuration">
                Configure the messaging endpoint in your Azure Bot resource to
                connect Teams to this integration.
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
              <Headline title="Teams Initiate">
                Start a Teams conversation from this integration.
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
        {integration.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Teams Integration Events">
                Keep tabs on the progress of your Teams integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ microsoftteamsIntegrationId: integration.id }}
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
      breadcrumbs={['Teams', 'Integrations', 'ChatBotKit']}
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

  if (context.query.microsoftteamsIntegrationId === 'new') {
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

  const integration = await prisma.microsoftteamsIntegration.findUnique({
    where: {
      id: context.query.microsoftteamsIntegrationId,
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

  integration.createdAt = integration.createdAt.getTime()
  integration.updatedAt = integration.updatedAt.getTime()

  return {
    props: makeJsonSafe({
      integration,

      callbackEndpoint: getExternalAPIHostURL(
        `/v1/integration/microsoftteams/${integration.id}/callback`
      ),
    }),
  }
}

/**
 * @doc Microsoft Teams
 * @description Connect your ChatBotKit bot to Microsoft Teams channels, group chats, and direct messages via the Azure Bot Framework
 * @category Integrations
 * @tags microsoft teams, teams, integration, messaging, azure, bot framework, enterprise, chat
 * @index 212
 * @date Fri, Sep 12, 2025, 12:00 AM
 *
 * The Microsoft Teams integration lets you bring a ChatBotKit AI bot directly into your Microsoft Teams workspace. Once connected, users can talk to the bot in direct messages, group chats, and channels - right where they already work, without switching tools or learning anything new.
 *
 * ## How It Works
 *
 * The integration connects ChatBotKit to Teams through the Microsoft Bot Framework. You register a bot in the Azure portal, point its messaging endpoint at ChatBotKit, and the two services take care of the rest. Every message a user sends to the bot in Teams gets processed by the ChatBotKit bot you choose, and the reply comes back instantly inside Teams.
 *
 * Each user gets their own conversation context that carries forward for as long as the session is active, so conversations feel coherent and continuous. Sessions can be configured to last anywhere from minutes to days depending on your use case.
 *
 * ## What You Can Do With It
 *
 * The most common use is an internal support or knowledge bot - something that answers questions about company policies, IT procedures, or project documentation without anyone having to search through wikis or wait for a colleague to respond. Because the bot lives inside Teams, adoption is natural: people just message it the same way they message anyone else.
 *
 * Beyond support, teams use it for onboarding assistants that help new hires find their footing, project bots that surface status updates and documentation on demand, and helpdesk bots that handle the first tier of IT requests automatically.
 *
 * You can control exactly who can talk to the bot and how long their conversation context lasts. For organisations with strict tenant boundaries, you can scope the integration to a single Azure AD tenant so only your own users can reach it.
 *
 * ## Setting It Up
 *
 * You'll need a Microsoft Azure account with permission to create Bot resources. The overall flow is: create the integration in ChatBotKit, set up an Azure Bot, connect the two with a webhook URL and credentials, then verify everything with the Setup button.
 *
 * 1. **Create the integration**: Give it a name, pick the bot that will handle conversations, and click Create. ChatBotKit will generate a unique Messaging Endpoint URL for this integration.
 * 2. **Register an Azure Bot**: In the [Azure portal](https://portal.azure.com), search for "Azure Bot" and create a new resource. This is where Microsoft registers your bot and issues the credentials ChatBotKit needs.
 * 3. **Set the Messaging Endpoint**: In your Azure Bot resource, open Configuration and paste the Messaging Endpoint URL from ChatBotKit into the "Messaging endpoint" field. This is how Teams knows where to send messages.
 * 4. **Get your credentials**: From your Azure Bot's Configuration page, copy the Microsoft App ID. Then go to your app registration in Azure AD, open "Certificates & secrets", and create a new client secret.
 * 5. **Enable the Teams channel**: In your Azure Bot resource, go to Channels and add Microsoft Teams. This makes the bot available inside Teams.
 * 6. **Enter credentials in ChatBotKit**: Back on this page, fill in the Application ID, Application Secret, and Tenant ID (use `common` if you want the bot to work across multiple tenants), then click Save.
 * 7. **Run Setup**: Click the **Setup** button to verify that ChatBotKit can authenticate with Azure using the credentials you provided. A success response means the bot is ready to use in Teams.
 */

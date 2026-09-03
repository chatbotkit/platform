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
import { useConfirmDelete } from '@/components/Confirm'
import DocsLink from '@/components/DocsLink'
import DurationSelect from '@/components/DurationSelect'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import IntegrationInstallButton from '@/components/IntegrationInstallButton'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import RevealTextarea from '@/components/RevealTextarea'
import ThisSolution from '@/components/ThisSolution'
import Toggle from '@/components/Toggle'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-integrations-googlechat.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function getInstallDetails({ eventEndpoint }) {
  return {
    endpoints: [
      {
        label: 'HTTP Endpoint URL',
        url: eventEndpoint,
        description:
          'Use this as the HTTP endpoint URL in the Google Chat API Configuration page.',
        required: true,
        copyMessage: 'Google Chat HTTP endpoint URL copied to clipboard',
      },
    ],

    instructions: [
      'Enable the Google Chat API in your Google Cloud project',
      'Open Google Chat API → Configuration and choose HTTP endpoint URL',
      'Paste the endpoint URL above and enable the Chat app functionality you need',
      'Create a service account in the same project, download its JSON key, and paste it into this page',
      'Paste the Project number (App ID) from the Chat API Configuration page',
      'Save this integration, then click Setup to verify the connection',
      'Add the app to each Google Chat space where it should respond',
    ],
  }
}

export function getInstallPopupDetails({ eventEndpoint }) {
  return {
    ...getInstallDetails({ eventEndpoint }),
    instructions: [
      'Enable the Google Chat API in your Google Cloud project',
      'Open Google Chat API → Configuration and choose HTTP endpoint URL',
      'Paste the endpoint URL above and enable the Chat app functionality you need',
      'Create a service account in the same project and download its JSON key',
      'Copy the Project number (App ID) from the Chat API Configuration page',
      'Close these instructions, enter the service account JSON key and Project number in the integration form, and save the integration.',
      'Click Setup to verify the connection, then add the app to each Google Chat space where it should respond',
    ],
  }
}

export function Form({ integration, installDetails }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { fetch } = useFetch({
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
        `/api/v1/integration/googlechat/${integration.id}/update`,
        {
          data: {
            ...data,
          },

          successMessage: 'Google Chat integration settings updated.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: googlechatIntegrationId },
      } = await fetch(`/api/v1/integration/googlechat/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (googlechatIntegrationId) {
        router.push(`/integrations/googlechat/${googlechatIntegrationId}`)
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
      `/api/v1/integration/googlechat/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Google Chat integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleSetup(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/googlechat/${integration.id}/setup`, {
      data: {},

      successMessage: 'Google Chat setup completed.',
    })
  }

  return (
    <>
      <ThisSolution
        type="integrations/googlechat"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="Google Chat Integration Configuration">
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
              {/* google chat application configuration */}
              <div>
                <Headline title="Google Chat Application Configuration">
                  Add the Google Cloud credentials for this Chat app. See the{' '}
                  <DocsLink className="default-link" slug="google-chat">
                    setup docs
                  </DocsLink>{' '}
                  for the full walkthrough.
                </Headline>
                <div className="mt-6 space-y-6">
                  {/* serviceAccountKey */}
                  <div>
                    <label
                      className="default-label"
                      htmlFor="serviceAccountKey"
                    >
                      Service Account Key
                    </label>
                    <div className="mt-1">
                      <RevealTextarea
                        className="default-input w-full max-h-96 !overflow-auto not-focus:max-h-24 [&:not(:focus)]:gradient-mask-b-10"
                        name="serviceAccountKey"
                        defaultToken={integration.serviceAccountKey}
                      />
                    </div>
                    <p className="input-description">
                      Paste the service account JSON key from the same Google
                      Cloud project as your Chat API configuration.
                    </p>
                  </div>
                  {/* projectNumber */}
                  <div>
                    <label className="default-label" htmlFor="projectNumber">
                      Project Number
                    </label>
                    <div className="mt-1">
                      <input
                        className="default-input w-full sm:text-sm"
                        name="projectNumber"
                        type="text"
                        defaultValue={integration.projectNumber || ''}
                        placeholder="123456789012"
                      />
                    </div>
                    <p className="input-description">
                      Paste the numeric Project number (App ID) from the Chat
                      API Configuration page. This enables request verification.
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
                        Collect contact records from direct message
                        conversations. Contacts are not associated from shared
                        spaces or group conversations.
                      </p>
                    </div>
                    {/* attachments */}
                    <div>
                      <label className="default-label" htmlFor="attachments">
                        Attachments
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="attachments"
                          defaultChecked={integration.attachments}
                        />
                      </div>
                      <p className="input-description">
                        Process uploaded files from Google Chat messages and
                        make them available to the bot as conversation
                        attachments. Google Drive file attachments are skipped.
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
                    {/* autoRespond */}
                    <div>
                      <label className="default-label" htmlFor="autoRespond">
                        Auto-Respond Configuration
                      </label>
                      <div className="mt-1">
                        <AutoTextarea
                          className="default-input w-full sm:text-sm max-h-96 !overflow-auto"
                          name="autoRespond"
                          id="autoRespond"
                          placeholder="Google Chat only sends space events when users interact with the app, such as @mentions..."
                          defaultValue={integration.autoRespond || ''}
                        />
                      </div>
                      <p className="input-description">
                        Google Chat sends direct messages and explicit space
                        interactions, such as @mentions, to this integration.
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
                          placeholder={
                            'users/123456789\nusers/987654321\n* (allow all)'
                          }
                        />
                      </div>
                      <p className="input-description">
                        Limit which Google Chat users can interact with this
                        integration. Enter one entry per line - use a Google
                        Chat user resource name (e.g.{' '}
                        <code>users/123456789</code>), a display name, or{' '}
                        <code>*</code> to allow all. Leave empty to deny all.
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
            {integration.id && integration.serviceAccountKey ? (
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
                title="Google Chat Install Instructions"
                details={installDetails}
                docsSlug="google-chat"
                links={[
                  {
                    caption: 'Open Google Cloud Console',
                    url: 'https://console.cloud.google.com/',
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
    loadingMessage: 'Initiating Google Chat conversation...',
    failureMessage: true,
    successMessage: 'Google Chat conversation initiated.',
  })

  async function handleInitiate(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    await fetch(`/api/v1/integration/googlechat/${integration.id}/initiate`, {
      data,
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleInitiate}>
      <div>
        <label className="default-label" htmlFor="space">
          Space or User
        </label>
        <div className="mt-1">
          <input
            id="space"
            className="default-input w-full sm:text-sm"
            name="space"
            placeholder="spaces/AAAA... or person@example.com"
            autoComplete="off"
            required
          />
        </div>
        <p className="input-description">
          Use a Google Chat space resource name or a user identifier for a
          direct message.
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
            placeholder="Ask the bot to write the opening Google Chat message..."
            required
          />
        </div>
        <p className="input-description">
          The bot uses this as an instruction and sends the generated message
          through Google Chat.
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

export default function Index({ integration, eventEndpoint }) {
  const installDetails = getInstallDetails({ eventEndpoint })
  const installPopupDetails = getInstallPopupDetails({ eventEndpoint })

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader
          link="/integrations"
          caption="integrations"
          title="Google Chat"
        >
          <p>
            With this integration, you can deploy an AI bot directly into Google
            Chat spaces and direct messages. Detailed instructions on how to set
            up this integration can be found at{' '}
            <DocsLink className="default-link" slug="google-chat">
              ChatBotKit Google Chat Integration
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
              <Headline title="Google Chat Webhook Configuration">
                Configure the HTTP endpoint in your Google Cloud Console to
                connect Google Chat to this integration. Full setup details are
                in the{' '}
                <DocsLink className="default-link" slug="google-chat">
                  Google Chat docs
                </DocsLink>
                .
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
              <Headline title="Google Chat Initiate">
                Start a Google Chat conversation from this integration.
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
              <Headline title="Google Chat Integration Events">
                Keep tabs on the progress of your Google Chat integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ googlechatIntegrationId: integration.id }}
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
      breadcrumbs={['Google Chat', 'Integrations', 'ChatBotKit']}
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

  if (context.query.googlechatIntegrationId === 'new') {
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

  const integration = await prisma.googlechatIntegration.findUnique({
    where: {
      id: context.query.googlechatIntegrationId,
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
      integration: makeJsonSafe(integration),

      eventEndpoint: getExternalAPIHostURL(
        `/v1/integration/googlechat/${integration.id}/event`
      ),
    }),
  }
}

/**
 * @doc Google Chat
 * @description Connect your ChatBotKit bot to Google Chat spaces and direct messages
 * @category Integrations
 * @tags google chat, gchat, integration, messaging, google workspace, bot, spaces
 * @index 211
 *
 * The Google Chat integration allows you to deploy a ChatBotKit AI bot directly into Google Chat spaces and direct messages. Users in your Google Workspace can @mention the bot in spaces or start a direct message conversation, and the bot will respond using the knowledge and instructions you have configured.
 *
 * Each integration is tied to its own Google Cloud project and Chat app, so multiple users can independently run their own bots - each with their own credentials, configuration, and conversation history.
 *
 * ## What You Can Do
 *
 * With the Google Chat integration, you can:
 *
 * - **Space Conversations**: Deploy the bot into any Google Chat space where it gets added, responding when users explicitly interact with the app, such as by @mentioning it
 * - **Direct Messages**: The bot automatically responds to direct messages from users without needing to be @mentioned
 * - **Thread Awareness**: In spaces, the bot recognises threads and maintains conversation context within a thread so replies stay coherent
 * - **Commands**: Configure slash commands, quick commands, or message actions that send private responses back to the invoking user
 * - **File Attachments**: When enabled, uploaded files sent to the Chat app are made available to the bot as conversation attachments
 * - **Sender Filtering**: Restrict which Google Workspace users can interact with the bot using the Allowed Senders field - useful for internal or team-specific bots
 * - **Multiple Instances**: Create multiple Google Chat integrations pointing at different Google Cloud projects, allowing you to run separate bots for different teams or use cases
 * - **Automated Responses**: Provide 24/7 AI-powered support inside your organisation's existing Google Chat workflow
 *
 * ## How It Works
 *
 * When a user sends a message to your Chat app - either by @mentioning it in a space or by sending a direct message - Google Chat sends it to the HTTP endpoint URL shown on this page. ChatBotKit verifies the request, runs the message through your configured bot, and sends the reply back to Google Chat using the service account credentials you provide.
 *
 * The integration maintains per-user conversation context so each person talking to the bot gets a coherent, session-aware experience. Sessions expire based on the session duration you configure.
 *
 * Users can reset their current conversation by sending `///restart`, `///reset`, or `///new`.
 *
 * ## Getting Started
 *
 * 1. **Create the Integration**: Give it a name and select the bot that will handle conversations
 * 2. **Note the HTTP Endpoint URL**: After saving, this page shows your unique webhook URL - copy it
 * 3. **Set Up a Google Cloud Project**: Go to [Google Cloud Console](https://console.cloud.google.com) and create a project
 * 4. **Enable the Google Chat API**: Open APIs & Services → Library, search for "Google Chat API", and click Enable. The API will not appear under APIs & Services anywhere else until this step is done
 * 5. **Configure the Chat API**: Once enabled, go to APIs & Services → Enabled APIs & services → Google Chat API → Configuration tab, then set the HTTP Endpoint URL to your ChatBotKit endpoint and enable the functionality you need
 * 6. **Create a Service Account**: Under "IAM & Admin → Service Accounts" in the same Google Cloud project, create a service account and download a JSON key. No IAM role assignment is required - Google recognises the service account as part of the same Chat app project
 * 7. **Fill In Credentials**: Paste the JSON key into the Service Account Key field and enter your Google Cloud Project Number. The Project Number is a numeric identifier (typically 12 digits) distinct from the human-readable project ID. The easiest place to copy it is the Chat API Configuration page itself (shown under "Application info" as "Project number (App ID)"); it is also on the Google Cloud Console home dashboard under "Project info" or in the project picker drop-down.
 * 8. **Save and Setup**: Click Save, then click Setup to verify the connection
 * 9. **Add the App in Google Chat**: Start a direct message with the app to test DMs. For spaces or group conversations, open the target space in Google Chat, choose **Manage members** or **Add people & apps**, search for the Chat app by its App name, and add it to that specific space. Enabling "Join spaces and group conversations" only makes the app eligible to be added; it does not automatically install it into any space.
 *
 * > **Admin note**: Workspace or Google Cloud admins can also find the project number with `gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)"`.
 *
 * ## Connect Google Chat to ChatBotKit
 *
 * The HTTP Endpoint URL is how Google Chat delivers interaction events to ChatBotKit. Configure it in the Google Cloud Console:
 *
 * 1. Open [Google Cloud Console](https://console.cloud.google.com) and navigate to your project
 * 2. Enable the Google Chat API: APIs & Services → Library → search "Google Chat API" → **Enable** (required before the API surfaces anywhere else)
 * 3. Go to **APIs & Services → Enabled APIs & services → Google Chat API → Configuration**
 * 4. Under **Application info**, fill in the required fields: **App name** (display name shown to users in Chat), **Avatar URL** (a publicly reachable `https://` image URL - Google Drive sharing links do not work), and **Description**. The configuration cannot be saved while any of these are empty. The **Project number (App ID)** shown here is also the value to paste into the Project Number field on the ChatBotKit integration page
 * 5. Under **Connection settings**, set the endpoint type to **HTTP endpoint URL** (the other option is Apps Script - you want HTTP)
 * 6. Select **Use a common HTTP endpoint URL for all triggers** so that a single URL field appears, then paste your ChatBotKit endpoint into it
 * 7. Under **Functionality**, enable **Join spaces and group conversations** if you want the bot in multi-user spaces
 * 8. Optional: under **Commands**, add slash commands, quick commands, or message actions. Use clear names and descriptions, and add matching instructions to your bot so it knows how to respond to each command
 * 9. Under **Visibility**, either select **Make this Chat app available to specific people and groups in your domain** and enter at least one email address (the configuration cannot be saved while this list is empty), or choose to make it available to everyone in your Workspace domain
 * 10. Save the configuration
 * 11. In Google Chat, add the app to each space where you want it to respond: open the space, choose **Manage members** or **Add people & apps**, search for the app's **App name**, and add it. For direct messages, start a new chat with the app instead.
 *
 * Google Chat only sends space events after the Chat app has been added to that specific space. The **Join spaces and group conversations** setting allows the app to be added to spaces, but it does not add the app for you.
 *
 * > ⚠️ **Gotcha - if you cannot find the bot when searching in Google Chat**
 * >
 * > Google Chat **Visibility is deny-by-default**: if no one is on the allowlist, nobody can discover or add the app. Go to APIs & Services → Enabled APIs & services → Google Chat API → Configuration → **Visibility** and make sure one of these is true:
 * >
 * > - **"Make this Chat app available to specific people and groups in your domain"** is ticked **and** at least your own email is in the list, **or**
 * > - **"Make this Chat app available to everyone in your domain"** is ticked.
 * >
 * > Toggling the specific-people option off without enabling the domain-wide option makes the bot completely undiscoverable - searching by its App name in `+ New chat` or "Add people & apps" will return no results. You must also be signed into Google Chat as a user **in the same Workspace domain** as the project; personal `@gmail.com` accounts cannot see Chat apps hosted in a Workspace project.
 *
 * > ⚠️ **Gotcha - if the "available to everyone in your domain" option is missing**
 * >
 * > If your Workspace admin has enabled the Marketplace allowlisting policy, Google Chat will hide the domain-wide visibility option entirely and show a notice that begins with "Your admin's Google Workspace Marketplace setting requires app allowlisting." In that case:
 * >
 * > - You can still use the **specific people and groups** option, but the list is capped at **5 email addresses** (intended for development/testing).
 * > - To make the app available beyond those 5 users, the app must either be **published to the Google Workspace Marketplace** (see Google's [Publish Google Chat apps](https://developers.google.com/workspace/chat/publish-app) guide), or your Workspace admin must explicitly **allowlist the app** in Workspace Marketplace admin settings.
 * > - Group/domain visibility settings configured here have **no effect** until one of those happens - even if you can tick them, they are ignored by the allowlisting policy.
 * > - Also check **Admin Console → Apps → Google Workspace Marketplace apps → Settings → Manage access to apps**. If **Don't allow users to install and run apps from the Marketplace** is enabled, turn on **Allow exception for internal apps. Users can install and run any internal app.**
 * >
 * > For internal-only bots, the simplest path is usually to ask your Workspace admin to allowlist the app rather than publishing to the public Marketplace. Without the internal-app exception above, the app can still receive mention events, but asynchronous replies can fail with `403 PERMISSION_DENIED`: "This organization's administrator must allow users to install this Chat app."
 *
 * > ⚠️ **Gotcha - spaces must explicitly include the app**
 * >
 * > If direct messages work but the bot does not respond in a space, confirm that the Chat app has been added to that exact space. Open the space in Google Chat, use **Manage members** or **Add people & apps**, search for the app's **App name**, and add it.
 * >
 * > The Google Cloud **Join spaces and group conversations** checkbox is required for space support, but it only controls whether the app can be added. It does not automatically place the app into existing spaces.
 *
 * ## Integration Settings
 *
 * **Name**: A human-readable label used only inside ChatBotKit. It does not change the app's display name in Google Chat.
 *
 * **Description**: An internal note that helps you remember what the integration is for, especially when you manage several Chat apps.
 *
 * **Bot**: The ChatBotKit bot that handles incoming Google Chat messages.
 *
 * **Service Account Key**: The JSON key for a service account in the same Google Cloud project as the Chat API configuration. ChatBotKit uses it to send replies for your Chat app. The key is stored encrypted and is never shown in full after saving.
 *
 * **Project Number**: The numeric Google Cloud project identifier, also shown as **Project number (App ID)** on the Chat API Configuration page. Setting it enables request verification for production traffic.
 *
 * **Contact Collection**: When enabled, ChatBotKit creates contact records from direct message conversations using the Google Chat sender identity. Contacts are not associated from shared spaces or group conversations.
 *
 * **Attachments**: When enabled, uploaded Google Chat files are downloaded and made available to the bot as conversation attachments. Google Drive-backed attachments are skipped because they use a separate Drive file reference.
 *
 * **Session Duration**: Controls how long a user's conversation context is preserved. By default this is one day. Set a longer duration for workspaces where users often return to the same conversation after long pauses.
 *
 * **Auto-Respond Configuration**: Google Chat only sends direct messages and explicit app interactions in spaces. This setting cannot make the bot see every unmentioned message in a space.
 *
 * **Allowed Senders**: Restricts who can interact with the integration. Enter one entry per line, using a Google Chat user identifier, a display name, or `*` to allow all users. Leave the field empty to deny all users.
 *
 * ## Best Practices
 *
 * **Control Who Can Interact**: Use the Allowed Senders field to restrict access for internal bots. This prevents unexpected usage if the Chat app is accidentally added to a public space.
 *
 * **Understand Space Message Delivery**: Google Chat only sends direct messages and explicit app interactions in spaces, such as @mentions. It does not send every message posted in a space. Use the Allowed Senders filter to control who can interact with the bot.
 *
 * **Context Security**: Direct messages are better suited for private account-specific tasks. Multi-user spaces and group conversations are shared contexts, so some private actions may require the user to continue in a direct message.
 *
 * **Contact Collection**: When enabled, contact records are collected from direct message conversations. Shared spaces and group conversations are not associated with contacts.
 *
 * **File Attachments**: Enable Attachments if users need to send files for the bot to inspect. Uploaded Google Chat files are supported; Google Drive-backed attachments are skipped.
 *
 * **Session Duration**: Google Chat conversations can have long gaps between messages. Consider setting a longer session duration (such as 4-8 hours) so users can return to a conversation without losing context.
 *
 * **Multiple Bots**: You can create several Google Chat integrations - each pointing to a different Google Cloud project and Chat app - to run separate bots for different teams, languages, or purposes.
 *
 * ## Practical Use Cases
 *
 * **Internal Knowledge Base**: Deploy a bot in your company's Google Chat that answers questions about internal processes, HR policies, or technical documentation - available to employees directly inside Workspace.
 *
 * **IT Helpdesk**: Let employees ask IT questions in a dedicated helpdesk space. The bot handles common troubleshooting steps and escalates to a human when needed.
 *
 * **Onboarding Assistant**: Add the bot to onboarding spaces to help new employees find information, understand company processes, and get answers to frequently asked questions.
 *
 * **Project Space Bot**: In a project-specific space, use the bot to field questions about project status, documentation, or meeting notes, keeping the team informed without manual effort.
 *
 * **Developer Support**: Deploy a bot in your engineering spaces that answers questions about your codebase, APIs, or runbooks, surfacing information from your dataset directly in the conversation.
 *
 * The Google Chat integration lets you bring conversational AI into the place where your team already communicates, without asking them to change tools or workflows.
 */

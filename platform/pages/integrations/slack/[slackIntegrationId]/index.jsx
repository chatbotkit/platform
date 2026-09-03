import { useState } from 'react'

import { ONE_DAY_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getExternalAPIHostURL } from '@/lib/host'
import { getSoftSession } from '@/lib/session.get'
import {
  buildSlackManifest,
  buildSlackManifestInstallUrl,
} from '@/lib/slack.manifest'
import { makeJsonSafe } from '@/lib/struct'
import toast from '@/lib/toast'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import CodeBlock from '@/components/CodeBlock'
import { useConfirmDelete } from '@/components/Confirm'
import ConversationManager from '@/components/ConversationManager'
import DurationSelect from '@/components/DurationSelect'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import IntegrationInstallButton from '@/components/IntegrationInstallButton'
import Link from '@/components/Link'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import RevealToken from '@/components/RevealToken'
import ThisSolution from '@/components/ThisSolution'
import Toggle from '@/components/Toggle'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-integrations-slack.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

/**
 * The body of the Slack install instructions. Slack has no webhook endpoints to
 * copy - it is handed the whole app manifest instead - so this stands in place
 * of the setup section the other integrations render out of `details`.
 *
 * @note the docs link is not repeated here - `IntegrationInstallButton` renders
 * it below this content from `docsSlug`
 */
export function Install({ manifest }) {
  return (
    <div className="space-y-6">
      <p>
        Click <strong>Install</strong> to add this Slack bot. Alternative you can
        copy the manifest and paste it in the{' '}
        <Link
          className="default-link"
          href="https://api.slack.com/apps?new_app=1"
          target="_blank"
        >
          Slack App Builder
        </Link>
      </p>
      <Expando titleClassName="default-link text-sm" title="Show Manifest">
        <CodeBlock className="max-h-96 text-sm" language="javascript">
          {manifest}
        </CodeBlock>
      </Expando>
    </div>
  )
}

export function Form({ integration, baseUrl }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
    successMessage: 'Slack integration settings updated.',
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/slack/${integration.id}/update`,
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
        data: { id: slackIntegrationId },
      } = await fetch(`/api/v1/integration/slack/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (slackIntegrationId) {
        router.push(`/integrations/slack/${slackIntegrationId}`)
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
      `/api/v1/integration/slack/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Slack integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleSetup(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/slack/${integration.id}/setup`, {
      data: {},

      successMessage: 'Slack setup completed.',
    })
  }

  // @note the manifest describes the integration as the form has it, not as the
  // database has it - a name typed but not yet saved is still the name the
  // Slack app should be created under. That is why these are resolved from the
  // form when the popup opens rather than built here at render
  function getManifest(data) {
    return JSON.stringify(
      buildSlackManifest({ ...data, id: integration.id }, baseUrl),
      null,
      2
    )
  }

  // @note shared by the three buttons which open these instructions: the two
  // links which explain where the credentials below come from, and the one in
  // the action area
  const installButtonProps = {
    title: 'Install Instructions',

    docsSlug: 'slack',

    // @note Slack has no endpoints or secrets to copy out of a setup section -
    // the manifest carries all of it - so the body stands in for `details`
    children: (data) => <Install manifest={getManifest(data)} />,

    links: (data) => [
      {
        caption: 'Install',
        url: buildSlackManifestInstallUrl(
          { ...data, id: integration.id },
          baseUrl
        ),
        default: true,
      },
    ],

    actions: (data) => ({
      Copy: {
        async fn() {
          try {
            await window.navigator?.clipboard?.writeText(getManifest(data))

            toast.success('Manifest copied to your clipboard')
          } catch {
            // @note clipboard API may be blocked by permissions policy

            toast.error('Failed to copy manifest to clipboard')
          }
        },
      },
    }),
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/slack"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="Slack Integration Configuration">
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
                <Headline title="Slack Application Configuration">
                  This information is used to configure the slack bot
                  integration.{' '}
                  <em>
                    You will be able to complete this information after the bot
                    is saved and installed.
                  </em>
                </Headline>
                <div className="mt-6 space-y-6">
                  {/* signing secret */}
                  <div>
                    <label className="default-label" htmlFor="signingSecret">
                      Signing Secret
                    </label>
                    <div className="mt-1">
                      <RevealToken
                        className="default-input w-full sm:text-sm"
                        name="signingSecret"
                        defaultToken={integration.signingSecret}
                      />
                    </div>
                    <p className="input-description">
                      The <q>Signing Secret</q> can be found at the{' '}
                      <q>Basic Information</q> tab. If you have not done so,
                      press the{' '}
                      <IntegrationInstallButton
                        {...installButtonProps}
                        className="default-link"
                        autoOpen={false}
                      />{' '}
                      button to get the signing secret.
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
                      The <q>Bot User OAuth Token</q> can be found at the{' '}
                      <q>OAuth & Permissions</q> tab. If you have not done so,
                      press the{' '}
                      <IntegrationInstallButton
                        {...installButtonProps}
                        className="default-link"
                        autoOpen={false}
                      />{' '}
                      button to get the bot token. If you do not see the bot
                      token, click <q>Install to Workspace</q> button first.
                    </p>
                  </div>
                  {/* user token */}
                  <div>
                    <label className="default-label" htmlFor="userToken">
                      User Token
                    </label>
                    <div className="mt-1">
                      <RevealToken
                        className="default-input w-full sm:text-sm"
                        name="userToken"
                        defaultToken={integration.userToken}
                      />
                    </div>
                    <p className="input-description">
                      The <q>User OAuth Token</q> can be found at the{' '}
                      <q>OAuth & Permissions</q> tab. This token is optional and
                      provides additional user-level permissions for the bot.
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
                    {/* references */}
                    <div>
                      <label className="default-label" htmlFor="references">
                        References
                        <sup className="beta">BETA</sup>
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="references"
                          defaultChecked={integration.references}
                        />
                      </div>
                      <p className="input-description">
                        If enabled, the bot will show interactive reference
                        buttons when responses contain citations or references.
                      </p>
                    </div>
                    {/* ratings */}
                    <div>
                      <label className="default-label" htmlFor="ratings">
                        Ratings
                        <sup className="beta">BETA</sup>
                      </label>
                      <div className="mt-1">
                        <Toggle
                          className="default-input w-full sm:text-sm"
                          name="ratings"
                          defaultChecked={integration.ratings}
                        />
                      </div>
                      <p className="input-description">
                        If enabled, the bot will show thumbs up and thumbs down
                        ratings buttons on responses to collect user ratings.
                      </p>
                    </div>
                    {/* visibleMessages */}
                    <div>
                      <label
                        className="default-label"
                        htmlFor="visibleMessages"
                      >
                        Visible Messages
                      </label>
                      <div className="mt-1">
                        <input
                          type="number"
                          name="visibleMessages"
                          id="visibleMessages"
                          className="default-input w-full max-w-xs sm:text-sm"
                          defaultValue={integration.visibleMessages || 0}
                          min={0}
                          max={10}
                        />
                      </div>
                      <p className="input-description">
                        The number of visible messages outside of the new
                        thread.
                      </p>
                    </div>
                    {/* autoRespond */}
                    <div>
                      <label className="default-label" htmlFor="autoRespond">
                        Auto-Respond Configuration
                        <sup className="beta">BETA</sup>
                      </label>
                      <div className="mt-1">
                        <AutoTextarea
                          className="default-input w-full sm:text-sm max-h-96 !overflow-auto"
                          name="autoRespond"
                          id="autoRespond"
                          placeholder="Leave empty for default behavior, use '@all' to respond to everything, or enter custom instructions..."
                          defaultValue={integration.autoRespond || ''}
                        />
                      </div>
                      <p className="input-description">
                        Control when your bot responds to channel messages.
                        Leave empty for default (DMs and @mentions only), use{' '}
                        <code>@all</code> for all messages,{' '}
                        <code>@agent [instructions]</code> to let your
                        bot&apos;s AI agent decide, or write plain instructions
                        for quick filtering.
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
                          placeholder={'U12345678\n#C12345678\n@username\n*'}
                        />
                      </div>
                      <p className="input-description">
                        Limit which Slack users or channels can interact with
                        this integration. Use Slack user IDs (U…/W…), channel
                        IDs (#C…/C…), @username, or #channel-name. Use{' '}
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
            {integration.id &&
            integration.signingSecret &&
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
              // @note the one which answers the install flag - the two above
              // sit inside the credential descriptions and are held shut, so
              // arriving from the setup checklist opens these instructions once
              <IntegrationInstallButton {...installButtonProps} />
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
    loadingMessage: 'Initiating Slack conversation...',
    failureMessage: true,
    successMessage: 'Slack conversation initiated.',
  })

  async function handleInitiate(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    await fetch(`/api/v1/integration/slack/${integration.id}/initiate`, {
      data,
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleInitiate}>
      <div>
        <label className="default-label" htmlFor="channel">
          Channel or User
        </label>
        <div className="mt-1">
          <input
            id="channel"
            className="default-input w-full sm:text-sm"
            name="channel"
            placeholder="C12345678 or U12345678"
            autoComplete="off"
            required
          />
        </div>
        <p className="input-description">
          Use a Slack channel ID, DM channel ID, or user ID.
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
            placeholder="Ask the bot to write the opening Slack message..."
            required
          />
        </div>
        <p className="input-description">
          The bot uses this as an instruction and sends the generated message
          through Slack.
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

export default function Index({
  integration,

  baseUrl,

  eventEndpoint,
  interactionEndpoint,
  commandEndpoint,
}) {
  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/integrations" caption="integrations" title="Slack">
          <p>
            With this integration, you can receive notifications and interact
            with your chatbot directly from your Slack workspace. Detailed
            instructions on how to set up this integration can be found at{' '}
            <DocsLink className="default-link" slug="slack">
              ChatBotKit Slack Integration
            </DocsLink>{' '}
            docs.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form integration={integration} baseUrl={baseUrl} />
          </div>
        </section>
        {integration.id ? (
          <section data-page-section-title="Webhook">
            <div className="main-page">
              <Headline title="Slack Webhook Configuration">
                Configure these webhook URLs in your Slack application to enable
                full integration functionality.
              </Headline>
              <Expando
                titleClassName="default-link text-sm"
                title="Show Instructions"
              >
                <WebhookSetupSection
                  endpoints={[
                    {
                      label: 'Event Subscriptions Request URL',
                      url: eventEndpoint,
                      description:
                        'Set this URL in the "Event Subscriptions" section of your Slack app configuration.',
                      required: true,
                      copyMessage:
                        'Slack event subscription URL copied to clipboard',
                    },
                    {
                      label: 'Interactivity Request URL',
                      url: interactionEndpoint,
                      description:
                        'Set this URL in the "Interactivity & Shortcuts" section for interactive components.',
                      required: true,
                      copyMessage:
                        'Slack interactivity URL copied to clipboard',
                    },
                    {
                      label: 'Slash Command URL',
                      url: commandEndpoint,
                      description: `Set this URL for your /${
                        integration.handle || 'chatbotkit'
                      } slash command.`,
                      required: false,
                      copyMessage:
                        'Slack slash command URL copied to clipboard',
                    },
                  ]}
                  instructions={[
                    'Navigate to your Slack app configuration at api.slack.com',
                    'Go to "Event Subscriptions" and enable events, then paste the Event Subscriptions Request URL',
                    'Subscribe to the required bot events: app_mention, message.channels, message.groups, message.im, message.mpim',
                    'Go to "Interactivity & Shortcuts" and enable interactivity, then paste the Interactivity Request URL',
                    'Go to "Slash Commands" and create a new command, then paste the Slash Command URL',
                    'Save all your changes and reinstall your app to the workspace',
                  ]}
                />
              </Expando>
            </div>
          </section>
        ) : null}
        {integration.id ? (
          <section data-page-section-title="Initiate">
            <div className="main-page">
              <Headline title="Slack Initiate">
                Start a Slack conversation from this integration.
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
              <Headline title="Slack Integration Events">
                Keep tabs on the progress of your Slack integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ slackIntegrationId: integration.id }}
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
      breadcrumbs={['Slack', 'Integrations', 'ChatBotKit']}
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

  if (context.query.slackIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          botId: context.query.botId,

          // default values

          visibleMessages: 0,
          allowFrom: '*',
          attachments: true,
          sessionDuration: ONE_DAY_IN_MILLISECONDS,
        },
      }),
    }
  }

  const integration = await prisma.slackIntegration.findUnique({
    where: {
      id: context.query.slackIntegrationId,
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
      integration: makeJsonSafe(integration),

      baseUrl: getExternalAPIHostURL(),

      eventEndpoint: getExternalAPIHostURL(
        `/v1/integration/slack/${integration.id}/event`
      ),

      interactionEndpoint: getExternalAPIHostURL(
        `/v1/integration/slack/${integration.id}/interaction`
      ),

      commandEndpoint: getExternalAPIHostURL(
        `/v1/integration/slack/${integration.id}/command`
      ),
    }),
  }
}

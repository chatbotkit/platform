import { useState } from 'react'

import { ONE_DAY_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { GITHUB_DEFAULT_ALLOW_FROM } from '@/lib/github.validation'
import { getExternalAPIHostURL } from '@/lib/host'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import DurationSelect from '@/components/DurationSelect'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import IntegrationInstallButton from '@/components/IntegrationInstallButton'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import RevealTextarea from '@/components/RevealTextarea'
import RevealToken from '@/components/RevealToken'
import ThisSolution from '@/components/ThisSolution'
import Toggle from '@/components/Toggle'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function getInstallDetails({ eventEndpoint }) {
  return {
    endpoints: [
      {
        label: 'Webhook Payload URL',
        url: eventEndpoint,
        description:
          'Set this as the Webhook URL in your GitHub App settings (Content type: application/json) and use the same Webhook Secret configured above.',
        required: true,
        copyMessage: 'GitHub webhook URL copied to clipboard',
      },
    ],

    instructions: [
      'Create a GitHub App (or a repository/org webhook) at github.com/settings/apps',
      'Set the Webhook URL to the Payload URL above and the Webhook Secret to match the value configured here',
      'Subscribe to events: Issue comment, Pull request review comment',
      'Grant repository permissions: Issues and Pull requests (read & write) so the bot can read threads and post comments',
      'Install the App on your org(s) and pick the repositories it may access - the bot answers wherever it is installed and @mentioned',
    ],
  }
}

export function getInstallPopupDetails({ integration, eventEndpoint }) {
  return {
    ...getInstallDetails({ eventEndpoint }),
    endpoints: [
      {
        label: 'Webhook Payload URL',
        url: eventEndpoint,
        description:
          'Set this as the Webhook URL in your GitHub App settings (Content type: application/json) and use the Webhook Secret provided in these instructions.',
        required: true,
        copyMessage: 'GitHub webhook URL copied to clipboard',
      },
    ],
    secrets: [
      {
        label: 'Webhook Secret',
        name: 'webhookSecret',
        value: integration.webhookSecret,
        type: 'reveal',
        description:
          'Use this value as the Webhook Secret in your GitHub App settings.',
        required: true,
        copyMessage: 'GitHub webhook secret copied to clipboard',
      },
    ],
    instructions: [
      'Create a GitHub App (or a repository/org webhook) at github.com/settings/apps',
      'Set the Webhook URL to the Payload URL and use the Webhook Secret provided in these instructions',
      'Subscribe to events: Issue comment, Pull request review comment',
      'Grant repository permissions: Issues and Pull requests (read & write) so the bot can read threads and post comments',
      'Install the App on your org(s) and pick the repositories it may access - the bot answers wherever it is installed and @mentioned',
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
    successMessage: 'GitHub integration settings updated.',
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/github/${integration.id}/update`,
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
        data: { id: githubIntegrationId },
      } = await fetch(`/api/v1/integration/github/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (githubIntegrationId) {
        router.push(`/integrations/github/${githubIntegrationId}`)
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
      `/api/v1/integration/github/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'GitHub integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleSetup(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/github/${integration.id}/setup`, {
      data: {},

      loadingMessage: 'Checking the GitHub App credentials...',
      successMessage: 'GitHub App credentials are valid.',
    })
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/github"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="GitHub Integration Configuration">
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
                <Headline title="GitHub Application Configuration">
                  This information is used to authenticate webhook deliveries
                  and to act back on GitHub.{' '}
                  <em>
                    You will be able to complete this information after the
                    integration is saved.
                  </em>
                </Headline>
                <div className="mt-6 space-y-6">
                  {/* appId */}
                  <div>
                    <label className="default-label" htmlFor="appId">
                      App ID
                    </label>
                    <div className="mt-1">
                      <input
                        className="default-input w-full max-w-xs sm:text-sm"
                        name="appId"
                        type="text"
                        defaultValue={integration.appId || ''}
                        placeholder="123456"
                      />
                    </div>
                    <p className="input-description">
                      This integration&apos;s GitHub App id (App settings →{' '}
                      <q>About</q>). Signs the App JWT used to mint tokens.
                    </p>
                  </div>
                  {/* privateKey */}
                  <div>
                    <label className="default-label" htmlFor="privateKey">
                      Private Key
                    </label>
                    <div className="mt-1">
                      <RevealTextarea
                        className="default-input w-full max-h-96 !overflow-auto not-focus:max-h-24 [&:not(:focus)]:gradient-mask-b-10"
                        name="privateKey"
                        defaultToken={integration.privateKey}
                        placeholder={
                          '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
                        }
                      />
                    </div>
                    <p className="input-description">
                      The GitHub App private key (PEM), generated in the App
                      settings.
                    </p>
                  </div>
                  {/* webhookSecret */}
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
                      The webhook secret configured on your GitHub App. Used to
                      validate the <code>x-hub-signature-256</code> header on
                      inbound deliveries. The installation id is captured
                      automatically from each event - there is nothing else to
                      enter here.
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
                        only.
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
                        Collect contact details from the GitHub sender.
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
                        The conversation in an issue/PR thread continues for the
                        specified time period.
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
                          placeholder={
                            '@collaborators\n@octocat\nmy-org/my-repo'
                          }
                        />
                      </div>
                      <p className="input-description">
                        Limit who can summon the bot by @mentioning it. Enter
                        one pattern per line or separate with commas. Use{' '}
                        <code>@collaborators</code> for anyone with access to
                        the repository, <code>@login</code> for a specific user,{' '}
                        <code>owner/repo</code> or <code>owner/*</code> for a
                        repository. Use * to allow everyone &mdash; on a public
                        repository that means any GitHub user can start a
                        conversation on your account. Leave empty to block all.
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
            {integration.id ? (
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {integration.id && integration.appId && integration.privateKey ? (
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
                title="GitHub Install Instructions"
                details={installDetails}
                docsSlug="github"
                links={[
                  {
                    caption: 'Open GitHub Apps',
                    url: 'https://github.com/settings/apps',
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

export default function Index({ integration, eventEndpoint }) {
  const installDetails = getInstallDetails({ eventEndpoint })
  const installPopupDetails = getInstallPopupDetails({
    integration,
    eventEndpoint,
  })

  return (
    <>
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
              <Headline title="GitHub Webhook Configuration">
                Configure this webhook URL in your GitHub App (or repository/org
                webhook) to enable the integration.
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
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="GitHub Integration Events">
                Keep tabs on the progress of your GitHub integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ githubIntegrationId: integration.id }}
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
      breadcrumbs={['GitHub', 'Integrations', 'ChatBotKit']}
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

  if (context.query.githubIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          botId: context.query.botId,

          // default values

          sessionDuration: ONE_DAY_IN_MILLISECONDS,

          allowFrom: GITHUB_DEFAULT_ALLOW_FROM,
        },
      }),
    }
  }

  const integration = await prisma.githubIntegration.findUnique({
    where: {
      id: context.query.githubIntegrationId,
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
        `/v1/integration/github/${integration.id}/event`
      ),
    }),
  }
}

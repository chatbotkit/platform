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
import RevealToken from '@/components/RevealToken'
import ThisSolution from '@/components/ThisSolution'
import Toggle from '@/components/Toggle'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-integrations-whatsapp.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function getInstallDetails({ integration, callbackEndpoint }) {
  return {
    endpoints: [
      {
        label: 'Callback Endpoint',
        url: callbackEndpoint,
        description:
          'Copy the callback endpoint above and set it as the Webhook Callback URL in your WhatsApp configuration.',
        required: true,
        copyMessage: 'WhatsApp callback endpoint copied to clipboard',
      },
    ],

    secrets: [
      {
        label: 'Verify Token',
        name: 'verifyToken',
        value: integration.verifyToken,
        type: 'reveal',
        description:
          'Copy the verify token above and set it as the Webhook Verify Token.',
        required: true,
        copyMessage: 'WhatsApp verify token copied to clipboard',
      },
    ],

    instructions: [
      'Go to Meta for Developers and open your app',
      'Copy the App Secret from App settings > Basic into the App Secret field in ChatBotKit and save the integration',
      'Navigate to WhatsApp > Configuration',
      'Click "Edit" or "Add" webhook callback URL',
      'Paste the Callback Endpoint URL and the Verify Token above',
      'Subscribe to message and status events as needed',
      'Save the configuration',
    ],
  }
}

export function getInstallPopupDetails(options) {
  return getInstallDetails(options)
}

export function Form({ integration, installDetails }) {
  const confirm = useConfirm()
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
        `/api/v1/integration/whatsapp/${integration.id}/update`,
        {
          data: {
            ...data,
          },

          successMessage: 'WhatsApp integration settings updated.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: whatsappIntegrationId },
      } = await fetch(`/api/v1/integration/whatsapp/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (whatsappIntegrationId) {
        router.push(`/integrations/whatsapp/${whatsappIntegrationId}`)
      }
    }
  }

  async function handleIntegrationHelp(event) {
    event.preventDefault()

    if (
      !(await confirm(
        'Please contact support if you need help with your WhatsApp Business integration.'
      ))
    ) {
      return
    }

    window.open('/contact')
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (
      !(await confirmDelete('Do you really want to delete this integration?'))
    ) {
      return
    }

    const { error } = await fetch(
      `/api/v1/integration/whatsapp/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'WhatsApp integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleSetup(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/whatsapp/${integration.id}/setup`, {
      data: {},

      successMessage: 'WhatsApp setup completed.',
    })
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/whatsapp"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="WhatsApp Integration Configuration">
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
                <Headline title="WhatsApp Application Configuration">
                  This information is used to configure the whatsapp
                  integration.
                </Headline>
                <div className="mt-6 space-y-6">
                  {/* phoneNumberId */}
                  <div>
                    <label className="default-label" htmlFor="phoneNumberId">
                      Phone Number ID
                    </label>
                    <div className="mt-1">
                      <input
                        className="default-input w-full sm:text-sm"
                        name="phoneNumberId"
                        type="text"
                        defaultValue={integration.phoneNumberId}
                      />
                    </div>
                    <p className="input-description">
                      The phone number id for WhatsApp application. This
                      information is available in the <q>Getting Started</q>{' '}
                      section in your WhatsApp application.
                    </p>
                  </div>
                  {/* access token */}
                  <div>
                    <label className="default-label" htmlFor="accessToken">
                      Access Token
                    </label>
                    <div className="mt-1">
                      <RevealToken
                        className="default-input w-full sm:text-sm"
                        name="accessToken"
                        defaultToken={integration.accessToken}
                      />
                    </div>
                    <p className="input-description">
                      The access token for this WhatsApp application. You need a{' '}
                      <q>System User</q> to get a permanent access token.
                    </p>
                  </div>
                  {/* app secret */}
                  <div>
                    <label className="default-label" htmlFor="appSecret">
                      App Secret
                    </label>
                    <div className="mt-1">
                      <RevealToken
                        className="default-input w-full sm:text-sm"
                        name="appSecret"
                        defaultToken={integration.appSecret}
                      />
                    </div>
                    <p className="input-description">
                      The app secret from Meta for Developers. Optional but
                      recommended: when set, incoming webhook notifications are
                      verified against their <q>X-Hub-Signature-256</q>
                      signature. Existing integrations keep working without it.
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
                          placeholder={'+12025551234\n+447911123456'}
                        />
                      </div>
                      <p className="input-description">
                        Limit which phone numbers can send messages to this
                        integration. Enter one phone number per line or separate
                        with commas. Use E.164 format (digits only, e.g.
                        12025551234). Use * to allow everyone. Leave empty to
                        block all.
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
            {false /* deliberately disabled */ &&
            integration.id &&
            integration.phoneNumberId &&
            integration.accessToken &&
            integration.appSecret ? (
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
                title="WhatsApp Install Instructions"
                details={installDetails}
                docsSlug="whatsapp"
                links={[
                  {
                    caption: 'Open Meta for Developers',
                    url: 'https://developers.facebook.com/apps',
                    default: true,
                  },
                ]}
              />
            ) : null}
            {integration.id ? (
              <button
                type="button"
                className="default-button"
                onClick={handleIntegrationHelp}
              >
                Integration Help
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

export function Initiate({ integration }) {
  const { loading, fetch } = useFetch({
    loadingMessage: 'Initiating WhatsApp conversation...',
    failureMessage: true,
    successMessage: 'WhatsApp conversation initiated.',
  })

  async function handleInitiate(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    await fetch(`/api/v1/integration/whatsapp/${integration.id}/initiate`, {
      data,
    })
  }

  return (
    <form className="space-y-6" onSubmit={handleInitiate}>
      <div>
        <label className="default-label" htmlFor="to">
          Recipient Phone
        </label>
        <div className="mt-1">
          <input
            id="to"
            className="default-input w-full sm:text-sm"
            name="to"
            placeholder="14155238886"
            autoComplete="tel"
            required
          />
        </div>
        <p className="input-description">
          Use the recipient phone number in E.164 format. A leading + is
          accepted.
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
            placeholder="Write the free-form WhatsApp message..."
            required
          />
        </div>
        <p className="input-description">
          This sends a free-form WhatsApp message while Meta allows messaging
          this recipient.
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
  const installDetails = getInstallDetails({ integration, callbackEndpoint })
  const installPopupDetails = getInstallPopupDetails({
    integration,
    callbackEndpoint,
  })

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/integrations" caption="integrations" title="WhatsApp">
          <p>
            With this integration, you can create your own WhatsApp
            conversational AI chatbot. Detailed instructions on how to set up
            this integration can be found at{' '}
            <DocsLink className="default-link" slug="whatsapp">
              ChatBotKit WhatsApp Integration
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
              <Headline title="WhatsApp Webhook Configuration">
                Configure the webhook callback and verify token in your Meta App
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
              <Headline title="WhatsApp Initiate">
                Start a WhatsApp conversation from this integration.
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
              <Headline title="WhatsApp Integration Events">
                Keep tabs on the progress of your WhatsApp integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ whatsappIntegrationId: integration.id }}
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
      breadcrumbs={['WhatsApp', 'Integrations', 'ChatBotKit']}
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

  if (context.query.whatsappIntegrationId === 'new') {
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

  const integration = await prisma.whatsappIntegration.findUnique({
    where: {
      id: context.query.whatsappIntegrationId,
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

  if (integration.appSecret) {
    integration.appSecret = '********'
  }

  return {
    props: makeJsonSafe({
      integration,

      callbackEndpoint: getExternalAPIHostURL(
        `/v1/integration/whatsapp/${integration.id}/callback`
      ),
    }),
  }
}

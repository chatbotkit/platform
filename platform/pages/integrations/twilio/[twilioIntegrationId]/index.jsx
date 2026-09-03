import { useEffect, useState } from 'react'

import { getExternalAPIHost } from '@/lib/host'

import { ONE_DAY_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import fetch from '@/lib/fetch'
import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import { getTwilioIntegrationWebhook } from '@/lib/twilio.webhook'

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
import SimpleTabs from '@/components/SimpleTabs'
import ThisSolution from '@/components/ThisSolution'
import Toggle from '@/components/Toggle'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useBroadcastChannelState from '@/hooks/useBroadcastChannelState'
import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-integrations-twilio.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function getInstallDetails({ integration }) {
  return {
    sections: {
      Messaging: {
        title: 'Messaging',
        endpoints: [
          {
            label: 'Messaging Webhook',
            url: getTwilioIntegrationWebhook(
              integration.id,
              getExternalAPIHost()
            ),
            description:
              'Use this URL as the webhook for incoming messages in the Messaging configuration of your Twilio phone number.',
            required: true,
            copyMessage: 'Twilio messaging webhook URL copied to clipboard',
          },
        ],
        instructions: [
          'Log into the Twilio Console',
          'Navigate to Phone Numbers > Active Numbers and select your number',
          'Scroll to the Messaging section',
          'Set the Incoming Messages webhook to HTTP POST',
          'Paste the Messaging Webhook URL above',
          'Save the configuration',
        ],
      },
      Calls: {
        title: 'Calls',
        endpoints: [
          {
            label: 'Call Webhook',
            url: getTwilioIntegrationWebhook(
              integration.id,
              getExternalAPIHost()
            ),
            description:
              'Use this URL as the webhook for incoming calls in the Voice configuration of your Twilio phone number.',
            required: true,
            copyMessage: 'Twilio call webhook URL copied to clipboard',
          },
        ],
        instructions: [
          'Log into the Twilio Console',
          'Navigate to Phone Numbers > Active Numbers and select your number',
          'Scroll to the Voice Configuration section',
          'Set the A Call Comes In webhook to HTTP POST',
          'Paste the Call Webhook URL above',
          'Save the configuration',
        ],
      },
    },
  }
}

export function getInstallPopupDetails(options) {
  return getInstallDetails(options)
}

function useTwilioNumbers(integration, deps = []) {
  const [numbers, setNumbers] = useBroadcastChannelState(
    'twilio-integration:numbers',
    []
  )

  useEffect(() => {
    if (!integration) {
      return
    }

    if (!integration.accountSid || !integration.authToken) {
      setNumbers([])

      return
    }

    let canceled = false

    async function fetchNumbers() {
      try {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${integration.accountSid}/IncomingPhoneNumbers.json?PageSize=100`,
          {
            headers: {
              Authorization: `Basic ${btoa(
                `${integration.accountSid}:${integration.authToken}`
              )}`,
            },
          }
        )

        if (!response.ok) {
          throw new Error('Failed to load Twilio numbers')
        }

        const data = await response.json()

        if (!canceled) {
          setNumbers(
            Array.isArray(data?.incoming_phone_numbers)
              ? data.incoming_phone_numbers
              : []
          )
        }
      } catch {
        if (!canceled) {
          setNumbers([])
        }
      }
    }

    fetchNumbers()

    return () => {
      canceled = true
    }
  }, [integration?.accountSid, integration?.authToken, setNumbers, ...deps])

  return numbers
}

export function Form({ integration, installDetails }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  useTwilioNumbers(integration, [updateCounter])

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
        `/api/v1/integration/twilio/${integration.id}/update`,
        {
          data: {
            ...data,
          },

          successMessage: 'Twilio integration settings updated.',
        }
      )

      if (!error) {
        Object.assign(integration, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: twilioIntegrationId },
      } = await fetch(`/api/v1/integration/twilio/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (twilioIntegrationId) {
        router.push(`/integrations/twilio/${twilioIntegrationId}`)
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
      `/api/v1/integration/twilio/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Twilio integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  async function handleSetup(event) {
    event.preventDefault()

    await handleOnSubmit(event)

    await fetch(`/api/v1/integration/twilio/${integration.id}/setup`, {
      data: {},

      successMessage: 'Twilio setup completed.',
    })
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/twilio"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="Twilio Integration Configuration">
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
                <Headline title="Twilio Application Configuration">
                  This information is used to configure the twilio integration.
                </Headline>
                <div className="mt-6 space-y-6">
                  {/* accountSid */}
                  <div>
                    <label className="default-label" htmlFor="accountSid">
                      Account SID
                    </label>
                    <div className="mt-1">
                      <input
                        className="default-input w-full sm:text-sm"
                        name="accountSid"
                        defaultValue={integration.accountSid}
                        autoComplete="off"
                      />
                    </div>
                    <p className="input-description">
                      The Account SID for this Twilio project.
                    </p>
                  </div>
                  {/* authToken */}
                  <div>
                    <label className="default-label" htmlFor="authToken">
                      Auth Token
                    </label>
                    <div className="mt-1">
                      <RevealToken
                        className="default-input w-full sm:text-sm"
                        name="authToken"
                        defaultToken={integration.authToken}
                      />
                    </div>
                    <p className="input-description">
                      The auth token used to send messages with this Twilio
                      project.
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
                    {/* voice */}
                    <div>
                      <label className="default-label" htmlFor="voice">
                        Voice
                      </label>
                      <div className="mt-1">
                        <input
                          className="default-input w-full sm:text-sm"
                          name="voice"
                          defaultValue={integration.voice}
                          placeholder="elevenlabs/language=en-US/voice=UgBBYS2sOqTuMpoF3BR0"
                          autoComplete="off"
                        />
                      </div>
                      <p className="input-description">
                        Optional structured voice configuration for voice calls.
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
                        Weather or not to collect contact information.
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
                          rows={4}
                          defaultValue={integration.allowFrom}
                          placeholder={'+12025551234\n+447911123456'}
                        />
                      </div>
                      <p className="input-description">
                        Limit which phone numbers can send messages or calls to
                        this integration. Enter one phone number per line or
                        separate with commas. Use E.164 format. Use * to allow
                        everyone. Leave empty to block all.
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
                title="Twilio Install Instructions"
                details={installDetails}
                docsSlug="twilio"
                links={[
                  {
                    caption: 'Open Twilio Console',
                    url: 'https://console.twilio.com/',
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
  const twilioNumbers = useTwilioNumbers()

  const { loading, fetch } = useFetch({
    loadingMessage: 'Initiating Twilio conversation...',
    failureMessage: true,
    successMessage: 'Twilio conversation initiated.',
  })

  async function handleInitiate(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    await fetch(`/api/v1/integration/twilio/${integration.id}/initiate`, {
      data,
    })
  }

  return (
    <SimpleTabs
      tabs={{
        SMS: (
          <form className="space-y-6" onSubmit={handleInitiate}>
            <input type="hidden" name="channel" value="sms" />
            <datalist id="twilio-sms-from-options">
              {twilioNumbers
                .filter(
                  (number) => number.phone_number && number.capabilities?.sms
                )
                .map((number) => (
                  <option
                    key={number.phone_number}
                    value={number.phone_number}
                    label={
                      number.friendly_name
                        ? `${number.friendly_name} (${number.phone_number})`
                        : number.phone_number
                    }
                  />
                ))}
            </datalist>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="default-label" htmlFor="from">
                  From
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full sm:text-sm"
                    name="from"
                    list="twilio-sms-from-options"
                    placeholder="+16513956925"
                    autoComplete="off"
                    required
                  />
                </div>
                <p className="input-description">
                  Use a Twilio phone number in international format.
                </p>
              </div>
              <div>
                <label className="default-label" htmlFor="to">
                  To
                </label>
                <div className="mt-1">
                  <input
                    id="to"
                    className="default-input w-full sm:text-sm"
                    name="to"
                    placeholder="+447911123456"
                    autoComplete="tel"
                    required
                  />
                </div>
                <p className="input-description">
                  Use international format, for example +447911123456.
                </p>
              </div>
            </div>
            <div>
              <label className="default-label" htmlFor="text">
                Initiation Text
              </label>
              <div className="mt-1">
                <AutoTextarea
                  className="default-input w-full sm:text-sm"
                  name="text"
                  placeholder="Ask the bot to write the opening SMS..."
                  required
                />
              </div>
              <p className="input-description">
                The bot uses this as an instruction and sends the generated SMS
                through Twilio.
              </p>
            </div>
            <div className="action-area">
              <span className="action-area-space" />
              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                Send SMS
              </button>
            </div>
          </form>
        ),
        Call: (
          <form className="space-y-6" onSubmit={handleInitiate}>
            <input type="hidden" name="channel" value="call" />
            <datalist id="twilio-call-from-options">
              {twilioNumbers
                .filter(
                  (number) => number.phone_number && number.capabilities?.voice
                )
                .map((number) => (
                  <option
                    key={number.phone_number}
                    value={number.phone_number}
                    label={
                      number.friendly_name
                        ? `${number.friendly_name} (${number.phone_number})`
                        : number.phone_number
                    }
                  />
                ))}
            </datalist>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="default-label" htmlFor="voice-from">
                  From
                </label>
                <div className="mt-1">
                  <input
                    id="voice-from"
                    className="default-input w-full sm:text-sm"
                    name="from"
                    list="twilio-call-from-options"
                    placeholder="+15005550006"
                    autoComplete="off"
                    required
                  />
                </div>
                <p className="input-description">
                  Use a Twilio phone number in international format.
                </p>
              </div>
              <div>
                <label className="default-label" htmlFor="voice-to">
                  To
                </label>
                <div className="mt-1">
                  <input
                    id="voice-to"
                    className="default-input w-full sm:text-sm"
                    name="to"
                    placeholder="+447911123456"
                    autoComplete="tel"
                    required
                  />
                </div>
                <p className="input-description">
                  Use international format, for example +447911123456.
                </p>
              </div>
            </div>
            <div>
              <label className="default-label" htmlFor="voice-text">
                Initiation Text
              </label>
              <div className="mt-1">
                <AutoTextarea
                  id="voice-text"
                  className="default-input w-full sm:text-sm"
                  name="text"
                  placeholder="Ask the bot to write the opening voice message..."
                  required
                />
              </div>
              <p className="input-description">
                The bot uses this as an instruction and opens the call with the
                generated message.
              </p>
            </div>
            <div className="action-area">
              <span className="action-area-space" />
              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                Start Call
              </button>
            </div>
          </form>
        ),
      }}
    />
  )
}

export default function Index({ integration }) {
  const installDetails = getInstallDetails({ integration })
  const installPopupDetails = getInstallPopupDetails({ integration })

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader
          link="/integrations"
          caption="integrations"
          title="Twilio"
          beta={true}
        >
          <p>
            With this integration, you can create a dedicated twilio inbox for
            your AI chatbot. Detailed instructions on how to set up this
            integration can be found at{' '}
            <DocsLink className="default-link" slug="twilio">
              ChatBotKit Twilio Integration
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
              <Headline title="Twilio Webhook Configuration">
                Configure the webhook for inbound messages in your Twilio
                Console.
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
        {integration.id ? (
          <section data-page-section-title="Initiate">
            <div className="main-page">
              <Headline title="Twilio Initiate">
                Start a Twilio conversation from this integration.
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
              <Headline title="Twilio Integration Events">
                Keep tabs on the progress of your Twilio integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ twilioIntegrationId: integration.id }}
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
      breadcrumbs={['Twilio', 'Integrations', 'ChatBotKit']}
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

  if (context.query.twilioIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          botId: context.query.botId,

          // default values

          allowFrom: '*',
          sessionDuration: ONE_DAY_IN_MILLISECONDS,
        },
      }),
    }
  }

  const integration = await prisma.twilioIntegration.findUnique({
    where: {
      id: context.query.twilioIntegrationId,
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

/**
 * @doc Twilio
 * @description Connect your ChatBotKit bot to Twilio for SMS messaging and phone-call voice agents
 * @category Integrations
 * @tags twilio, integration, sms, messaging, phone, voice, calls, whatsapp
 * @index 210
 * @date Wed, Dec 24, 2025, 12:00 AM
 *
 * The Twilio integration allows you to connect your ChatBotKit AI bot to Twilio's communication platform, enabling your bot to communicate via SMS, phone calls, WhatsApp, and other supported messaging channels. This means your AI assistant can respond to text messages, handle inbound calls, start outbound conversations, and provide automated support through mobile channels.
 *
 * ## What You Can Do
 *
 * With the Twilio integration, you can:
 *
 * - **SMS Conversations**: Let customers text your phone number and get AI-powered responses
 * - **Voice Calls**: Let customers call your phone number and speak with a voice-enabled AI agent
 * - **WhatsApp Business**: Connect your bot to WhatsApp Business API for rich messaging experiences
 * - **Multi-Channel Support**: Handle conversations across SMS, WhatsApp, and other Twilio-supported channels
 * - **Phone Number Management**: Use your existing Twilio phone numbers or acquire new ones for your bot
 * - **Automated Responses**: Provide 24/7 support through text and phone conversations without manual intervention
 * - **Two-Way Communication**: Your bot can both receive and send messages, creating natural conversations
 *
 * ## How It Works
 *
 * When someone sends a message or calls your Twilio phone number, Twilio forwards that interaction to ChatBotKit through a webhook. Your AI bot processes the message or transcribed speech, generates an appropriate response using its knowledge and configuration, and sends the reply back through Twilio as either text or spoken TwiML.
 *
 * The integration maintains conversation context, so your bot remembers previous messages within a session. This allows for natural, coherent conversations where the bot can reference earlier parts of the discussion, just like it would in a web chat.
 *
 * You can restrict inbound access with the allowed senders setting. Add one or
 * more E.164 phone numbers, separated by commas or new lines, to accept only
 * those SMS messages and calls. Use `*` to allow everyone, or leave the field
 * empty to block all inbound senders.
 *
 * ## Getting Started
 *
 * To set up your Twilio integration:
 *
 * 1. **Create the Integration**: Click "Create Integration" and give it a descriptive name (like "Customer Support SMS")
 * 2. **Select Your Bot**: Choose which AI bot will handle the conversations on this channel
 * 3. **Configure Twilio Credentials**: Enter the Account SID and Auth Token for the Twilio account that owns your messaging number
 * 4. **Configure Basic Settings**: Add a description and adjust settings like session duration
 * 5. **Get Your Webhook URL**: After creating the integration, you'll see a webhook URL in the setup section
 * 6. **Configure Twilio**: In your Twilio Console, add the webhook URL to your phone number's messaging configuration
 * 7. **Test It Out**: Send a test message or place a test call to your phone number and watch your bot respond!
 *
 * The Account SID and Auth Token let ChatBotKit send delayed SMS replies and initiate outbound SMS or phone-call conversations through Twilio.
 *
 * ## Setting Up the Twilio Webhook
 *
 * The webhook is how Twilio communicates with ChatBotKit. Here's what you need to do in your Twilio Console:
 *
 * 1. Log into the [Twilio Console](https://console.twilio.com)
 * 2. Navigate to **Phone Numbers > Active Numbers** and select your number
 * 3. Scroll to the **Messaging** or **Voice** section
 * 4. Set the incoming message or call webhook to **HTTP POST**
 * 5. Paste your ChatBotKit webhook URL (shown in the integration page)
 * 6. Save your configuration
 *
 * For WhatsApp, the process is similar but you'll configure the webhook in your WhatsApp Business API settings instead.
 *
 * ## Best Practices
 *
 * **Start Simple**: Begin with a straightforward bot configuration and test thoroughly before adding complexity. Send test messages to ensure responses are appropriate and helpful.
 *
 * **Set Clear Expectations**: In your bot's backstory or instructions, include guidelines for SMS and voice conversations. Text messages are typically shorter and more informal than web chats, while spoken replies should be concise and easy to understand.
 *
 * **Monitor Costs**: Both Twilio and ChatBotKit have usage-based pricing. Keep an eye on message volumes and conversation lengths to manage costs effectively.
 *
 * **Handle Session Duration**: SMS conversations often have longer pauses than web chats. Consider setting a longer session duration (like 1-2 hours) so users can return to the conversation without losing context.
 *
 * **Test Different Scenarios**: Try various message and call types - questions, commands, typos, pauses, and interruptions - to ensure your bot handles them gracefully.
 *
 * **Compliance Matters**: If you're texting customers, make sure you're following regulations like TCPA (in the US) and GDPR (in Europe). Get proper consent before sending marketing messages.
 *
 * ## Practical Use Cases
 *
 * **Customer Support**: Let customers text a support number to get instant help with common questions, troubleshooting, or account inquiries. Your bot can handle the routine questions while escalating complex issues.
 *
 * **Appointment Reminders**: Use your bot with Twilio to send automated appointment reminders and allow customers to confirm, reschedule, or cancel via text.
 *
 * **Order Status Updates**: Customers can text your number to check on order status, tracking information, or delivery estimates without calling or visiting a website.
 *
 * **Restaurant Reservations**: Accept table reservations via SMS, with your bot asking for party size, date, time, and special requests.
 *
 * **Lead Qualification**: Capture leads through SMS campaigns, with your bot asking qualifying questions and gathering contact information for your sales team.
 *
 * The Twilio integration brings the power of conversational AI to mobile messaging and phone calls, meeting your customers where they already spend much of their time.
 */

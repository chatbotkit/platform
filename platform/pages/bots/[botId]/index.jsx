import { useMemo, useState } from 'react'

import { getExternalAPIHostURL } from '@/lib/host'

import botsConfig from '@/config/bots'

import prisma from '@/prisma/client'
import { BotVisibility } from '@/prisma/enums'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { withBotResources } from '@/lib/solution'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BackstoryInput from '@/components/BackstoryInput'
import BotBlockStatus from '@/components/BotBlockStatus'
import BotInsights from '@/components/BotInsights'
import CodeAction from '@/components/CodeAction'
import { useConfirm, useConfirmDelete } from '@/components/Confirm'
import ConversationManager from '@/components/ConversationManager'
import DatasetSelect from '@/components/DatasetSelect'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import HubOptions from '@/components/HubOptions'
import IntegrationList from '@/components/IntegrationList'
import LanguageModelSelect from '@/components/LanguageModelSelect'
import Link from '@/components/Link'
import MemoryList from '@/components/MemoryList'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import PlatformExperienceOnly from '@/components/PlatformExperienceOnly'
import SkillsetSelect from '@/components/SkillsetSelect'
import ThisSolution from '@/components/ThisSolution'
import Toggle from '@/components/Toggle'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useExternalAPIURL from '@/hooks/useExternalAPIURL'
import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-bot-instance.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function Form({ bot, variant = 'full' }) {
  const confirm = useConfirm()
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const title =
    variant === 'behaviour' ? 'Behaviour Configuration' : 'Bot Configuration'

  const showConfiguration = variant !== 'behaviour'

  const showBehaviour = variant !== 'configuration'

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (bot.id) {
      const { error } = await fetch(`/api/v1/bot/${bot.id}/update`, {
        data,

        successMessage: 'Bot updated.',
      })

      if (!error) {
        Object.assign(bot, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: botId },
      } = await fetch(`/api/v1/bot/create`, {
        data: scopeCreateData(data),

        successMessage: 'Bot created.',
      })

      if (botId) {
        router.push(`/bots/${botId}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this bot?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/bot/${bot.id}/delete`, {
      data: {},

      successMessage: 'Bot deleted...',
    })

    if (!error) {
      router.push(`/bots`)
    }
  }

  async function handleClone(event) {
    event.preventDefault()

    if (
      !(await confirm('Do you really want to clone this bot?', {
        actions: {
          Clone: { result: true },
        },
      }))
    ) {
      return
    }

    const { error, data } = await fetch(`/api/v1/bot/${bot.id}/clone`, {
      data: {},

      successMessage: 'Bot cloned...',
    })

    if (error) {
      return
    }

    router.push(`/bots/${data.id}`)
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="bot"
        instance={bot}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* bot configuration */}
          <div>
            <Headline title={title}>
              {variant === 'behaviour'
                ? 'This information defines how the bot behaves and which model it uses.'
                : 'This information is used to configure the bot.'}
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              {showConfiguration ? (
                <GeneralBasicOptions instance={bot} />
              ) : null}
              {/* backstory */}
              {showBehaviour ? (
                <div>
                  <label className="default-label" htmlFor="backstory">
                    Backstory
                  </label>
                  <div className="mt-1">
                    <BackstoryInput
                      className="default-input w-full"
                      name="backstory"
                      defaultValue={bot.backstory}
                    />
                  </div>
                  <p className="input-description">
                    Write the chat bot backstory to define its behavior.
                  </p>
                </div>
              ) : null}
              {/* model */}
              {showBehaviour ? (
                <div>
                  <label className="default-label" htmlFor="model">
                    Model
                  </label>
                  <div className="mt-1">
                    <LanguageModelSelect
                      className="default-input w-full max-w-xs"
                      name="model"
                      defaultValue={bot.model}
                    />
                  </div>
                  <p className="input-description">
                    The model to use for this bot.
                  </p>
                </div>
              ) : null}
              {/* datasetId */}
              {showBehaviour ? (
                <div>
                  <label className="default-label" htmlFor="datasetId">
                    Dataset
                  </label>
                  <div className="mt-1">
                    <DatasetSelect
                      className="default-input w-full max-w-xs"
                      name="datasetId"
                      defaultValue={bot.datasetId}
                    />
                  </div>
                  <p className="input-description">
                    The dataset to use for this bot.
                  </p>
                </div>
              ) : null}
              {/* skillsetId */}
              {showBehaviour ? (
                <div>
                  <label className="default-label" htmlFor="skillsetId">
                    Skillset
                  </label>
                  <div className="mt-1">
                    <SkillsetSelect
                      className="default-input w-full max-w-xs"
                      name="skillsetId"
                      defaultValue={bot.skillsetId}
                    />
                  </div>
                  <p className="input-description">
                    The skillset to use for this bot.
                  </p>
                </div>
              ) : null}
              {/* advanced options */}
              {showConfiguration ? (
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
                        defaultValue={bot.alias}
                        pattern="[a-z0-9_-]*"
                        maxLength={128}
                      />
                    </div>
                    <p className="input-description">
                      Optional unique alias for this bot. Use lowercase letters,
                      numbers, hyphens, and underscores only. Can be used to
                      reference this bot via @alias.
                    </p>
                  </div>
                  {/* privacy */}
                  <div>
                    <label className="default-label" htmlFor="privacy">
                      Privacy
                    </label>
                    <div className="mt-1">
                      <Toggle
                        className="default-input w-full"
                        name="privacy"
                        defaultChecked={bot.privacy}
                      />
                    </div>
                    <p className="input-description">
                      If enabled all messages are stripped from any personal
                      data.
                    </p>
                  </div>
                  {/* moderation */}
                  <div>
                    <label className="default-label" htmlFor="moderation">
                      Moderation
                    </label>
                    <div className="mt-1">
                      <Toggle
                        className="default-input w-full"
                        name="moderation"
                        defaultChecked={bot.moderation}
                      />
                    </div>
                    <p className="input-description">
                      If enabled all messages are checked for abusive content
                      and harmful messages.
                    </p>
                  </div>
                  {/* visibility */}
                  <div>
                    <label className="default-label" htmlFor="visibility">
                      Visibility
                    </label>
                    <div className="mt-1">
                      <select
                        name="visibility"
                        className="default-input w-full max-w-xs"
                        defaultValue={bot.visibility}
                      >
                        {Object.entries(BotVisibility).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="input-description">
                      Private bots are only accessible by the owner. Protected
                      bots are accessible by the owner and all child Users.
                      Public bots are accessible by all users of the platform.
                    </p>
                  </div>
                  {/* meta */}
                  <div>
                    <label className="default-label" htmlFor="meta">
                      Meta
                    </label>
                    <div className="mt-1">
                      <MetaInput name="meta" defaultMeta={bot.meta} />
                    </div>
                    <p className="input-description">
                      Custom metadata for this bot.
                    </p>
                  </div>
                </Expando>
              ) : null}
              {/* hub options */}
              {showConfiguration && bot?.id ? (
                <HubOptions type="bot" instance={bot} />
              ) : null}
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/bots">
              Back To Bots
            </BackLink> */}
            {bot.id && variant !== 'behaviour' ? (
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            {bot.id && variant !== 'behaviour' ? (
              <button
                className="default-button"
                type="button"
                onClick={handleClone}
              >
                Clone
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {bot.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export function Integrations({ bot }) {
  const integrations = useMemo(() => {
    return Object.keys(bot)
      .filter((k) => k.endsWith('Integrations'))
      .filter((k) => bot[k].length > 0)
      .flatMap((key) => {
        const type = key.replace(/Integrations$/, '')

        return bot[key].map((integration) => {
          return {
            ...integration,

            type,
          }
        })
      })

    // @note we want to run this only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resource = useMemo(() => ({ type: 'bot', id: bot.id }), [bot.id])

  return (
    <>
      <IntegrationList integrations={integrations} resource={resource} />
    </>
  )
}

export function Chat({ bot }) {
  const instance = useMemo(() => {
    // Only expose the botId as the rest of the parameters will be picked
    // dynamically.

    return {
      botId: bot.id,
    }
  }, [bot.id])

  return (
    <div className="space-y-6">
      <ConversationManager
        instance={instance}
        autoStart={true}
        autoAddBackstory={false}
        advancedOptions={false}
        stream={true}
        verbose={true}
        conversationLink={true}
        situationLink={true}
      />
    </div>
  )
}

function getBotExecutionSections(
  botId,
  apiBase = getExternalAPIHostURL('/v1')
) {
  return {
    sdk: {
      title: 'Node SDK',
      instructions: [
        'Use completion stream for real-time token/result events.',
        'Use dispatch when you want background execution with channel-based updates.',
        'Subscribe to the dispatch channel to receive progress and final result events.',
      ],
      code: {
        language: 'javascript',
        content: `import { ChatBotKit } from '@chatbotkit/sdk'

const client = new ChatBotKit({
  secret: process.env.CHATBOTKIT_API_SECRET,
})

const botId = '${botId}'

// 1) Completion stream (foreground)
for await (const { type, data } of client.conversation
  .complete(null, {
    botId,
    messages: [{ type: 'user', text: 'Summarize the latest incidents.' }],
  })
  .stream()) {
  if (type === 'token') {
    process.stdout.write(data.token || '')
  }

  if (type === 'result') {
    console.log('\nfinal:', data)
  }
}

// 2) Background dispatch + channel subscribe
const { channelId } = await client.conversation.dispatch(null, {
  botId,
  messages: [{ type: 'user', text: 'Generate a weekly ops report.' }],
})

for await (const event of client.channel.subscribe(channelId).stream()) {
  if (event.type !== 'message') {
    continue
  }

  const payload = event.data

  if (payload.type === 'result') {
    console.log('background result:', payload)
    break
  }
}`,
      },
    },
    go: {
      title: 'Go SDK',
      instructions: [
        'Use CompleteStream for foreground token/result streaming.',
        'Dispatch in the background via HTTPClient POST to the dispatch endpoint.',
        'Subscribe to the channel via HTTPClient PostStream to consume events.',
      ],
      code: {
        language: 'go',
        content: `package main

import (
  "context"
  "fmt"
  "os"

  "github.com/chatbotkit/go-sdk/sdk"
  "github.com/chatbotkit/go-sdk/types"
)

func main() {
  ctx := context.Background()

  client := sdk.New(sdk.Options{
    Secret: os.Getenv("CHATBOTKIT_API_SECRET"),
  })

  botID := "${botId}"

  // 1) Completion stream (foreground)
  streamReq := types.ConversationCompleteRequest{
    BotID: botID,
    Messages: []types.Message{{Type: "user", Text: "Summarize the latest incidents."}},
  }

  events, errs := client.Conversation.CompleteStream(ctx, streamReq)

  for event := range events {
    switch e := event.(type) {
    case *sdk.TokenEvent:
      fmt.Print(e.Token)
    case *sdk.ResultEvent:
      fmt.Printf("\\nfinal: %#v\\n", e.Data)
    }
  }

  if err := <-errs; err != nil {
    panic(err)
  }

  // 2) Background dispatch + subscribe
  dispatchPath := "/api/v1/conversation/dispatch"

  dispatchReq := map[string]interface{}{
    "botId": botID,
    "messages": []map[string]string{
      {"type": "user", "text": "Generate a weekly ops report."},
    },
  }

  dispatchResp := map[string]interface{}{}

  if err := client.HTTPClient().Post(ctx, dispatchPath, dispatchReq, &dispatchResp); err != nil {
    panic(err)
  }

  channelID, _ := dispatchResp["channelId"].(string)
  subscribePath := fmt.Sprintf("/api/v1/channel/%s/subscribe", channelID)
  channelEvents, channelErrs := client.HTTPClient().PostStream(ctx, subscribePath, map[string]interface{}{})

  for event := range channelEvents {
    fmt.Printf("channel event: %s\\n", event.Type)
  }

  if err := <-channelErrs; err != nil {
    panic(err)
  }
}`,
      },
    },
    api: {
      title: 'REST API',
      instructions: [
        'Use /conversation/complete with streaming for foreground completions.',
        'Use /conversation/dispatch to run completion in the background.',
        'Subscribe to /channel/{channelId}/subscribe to receive background events.',
      ],
      code: {
        language: 'bash',
        content: `# Required env vars:
# export CHATBOTKIT_API_SECRET="..."
# export BOT_ID="${botId}"

API_BASE="${apiBase}"
AUTH_HEADER="Authorization: Bearer $CHATBOTKIT_API_SECRET"
JSON_HEADER="Content-Type: application/json"

# 1) Completion stream (foreground)
curl -N -X POST "$API_BASE/conversation/complete" \\
  -H "$AUTH_HEADER" \\
  -H "$JSON_HEADER" \\
  -d '{
    "botId": "'"$BOT_ID"'",
    "messages": [
      { "type": "user", "text": "Summarize the latest incidents." }
    ]
  }'

# 2) Background dispatch
DISPATCH_RESPONSE=$(curl -sS -X POST "$API_BASE/conversation/dispatch" \\
  -H "$AUTH_HEADER" \\
  -H "$JSON_HEADER" \\
  -d '{
    "botId": "'"$BOT_ID"'",
    "messages": [
      { "type": "user", "text": "Generate a weekly ops report." }
    ]
  }')

CHANNEL_ID=$(echo "$DISPATCH_RESPONSE" | jq -r '.channelId')

# 3) Subscribe to background events
curl -N -X POST "$API_BASE/channel/$CHANNEL_ID/subscribe" \\
  -H "$AUTH_HEADER" \\
  -H "$JSON_HEADER" \\
  -d '{}'`,
      },
    },
  }
}

export default function Index({ bot }) {
  const getAPIURL = useExternalAPIURL()

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/bots" caption="bots" title="Bot">
          <p>
            A bot is an automated conversational AI system designed to interact
            with users through various messaging platforms and communication
            channels. For more information, refer to the{' '}
            <DocsLink slug="bots">bot documentation</DocsLink>.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section
          data-page-section-title="Configuration"
          data-page-section-index="200"
        >
          <div className="main-page">
            <Form bot={bot} variant={bot.id ? 'configuration' : 'full'} />
          </div>
        </section>
        {bot.id ? (
          <section
            data-page-section-title="Behaviour"
            data-page-section-index="100"
            data-page-section-default
          >
            <div className="main-page">
              <Form bot={bot} variant="behaviour" />
            </div>
          </section>
        ) : null}
        {bot.id ? (
          <section data-page-section-title="Integrations">
            <div className="main-page">
              <Headline title="Bot Integrations">
                Extend your bot&apos;s capabilities by connecting it to external
                apps and services.
              </Headline>
              <Integrations bot={bot} />
            </div>
          </section>
        ) : null}
        {bot.id ? (
          <section
            data-page-section-title="Availability"
            data-page-section-more
          >
            <div className="main-page">
              <Headline title="Availability">
                Whether this bot is currently allowed to run. A bot can be
                temporarily blocked by a usage policy; clear the block to
                re-enable it before it expires.
              </Headline>
              <div className="mt-6">
                <BotBlockStatus botId={bot.id} />
              </div>
            </div>
          </section>
        ) : null}
        {bot.id ? (
          <section data-page-section-title="Insights" data-page-section-more>
            <div className="main-page">
              <Headline title="Insights">
                Performance metrics, conversation quality and alerts for this
                bot.
              </Headline>
              <BotInsights botId={bot.id} />
            </div>
          </section>
        ) : null}
        {bot.id ? (
          <section data-page-section-title="Chat">
            <div className="main-page">
              <Headline title="Chat With This Bot">
                Test and explore your bot directly here. For an enhanced
                experience, try it in the{' '}
                <Link
                  className="default-link"
                  href="/apps/chat"
                >
                  Chat
                </Link>{' '}
                app.
              </Headline>
              <Chat key={bot.id} bot={bot} />
            </div>
          </section>
        ) : null}
        {bot.id ? (
          <section data-page-section-title="Memories" data-page-section-more>
            <div className="main-page">
              <Headline title="Memories">
                The memories associated with this bot.
              </Headline>
              <MemoryList
                filter={false}
                exportRoute={null}
                botId={bot.id}
                autoLoad={true}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {bot.id ? (
          <PlatformExperienceOnly>
            <section data-page-section-title="SDK" data-page-section-more>
              <div className="main-page">
                <Headline title="Use This Bot with SDK or API">
                  Use completion stream for interactive responses or dispatch
                  for background execution with channel-based updates.
                </Headline>
                <Expando
                  titleClassName="default-link text-sm"
                  title="Show Examples"
                >
                  <WebhookSetupSection.Multi
                    sections={getBotExecutionSections(bot.id, getAPIURL('/v1'))}
                  />
                </Expando>
              </div>
            </section>
          </PlatformExperienceOnly>
        ) : null}
        {bot.id ? (
          <section data-page-section-title="Events" data-page-section-more>
            <div className="main-page">
              <Headline title="Events">
                Monitor and track your bot&apos;s event activity.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ botId: bot.id }}
                filter={false}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { bot }) {
  return (
    <Dashboard
      breadcrumbs={['Bots', 'ChatBotKit']}
      title={bot.name || bot.id || 'New'}
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

  if (context.query.botId === 'new') {
    return {
      props: makeJsonSafe({
        bot: {
          name: context.query.name || null,
          description: context.query.description || null,

          backstory: context.query.backstory || botsConfig.defaultBackstory,

          model: context.query.model || null,

          datasetId: context.query.datasetId || null,
          skillsetId: context.query.skillsetId || null,
        },
      }),
    }
  }

  const bot = await prisma.bot.findUnique({
    where: {
      id: context.query.botId,
    },

    include: {
      ...withBotResources(session.user.id),
    },
  })

  if (!bot) {
    return {
      notFound: true,
    }
  }

  if (bot.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      bot: bot,
    }),
  }
}

import { useMemo, useState } from 'react'

import { getExternalAPIHostURL } from '@/lib/host'

import { maxAbilitiesTake } from '@/config/abilities'
import skillsetsConfig from '@/config/skillsets'

import prisma from '@/prisma/client'
import { ResourceState, SkillsetVisibility } from '@/prisma/enums'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { withSkillsetResources } from '@/lib/solution'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotList from '@/components/BotList'
import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import { useConfirm, useConfirmDelete } from '@/components/Confirm'
import ConversationManager from '@/components/ConversationManager'
import DescriptionInput from '@/components/DescriptionInput'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import HubOptions from '@/components/HubOptions'
import IntegrationList from '@/components/IntegrationList'
import Link from '@/components/Link'
import MetaInput from '@/components/MetaInput'
import ObjectView from '@/components/ObjectView'
import PageSections from '@/components/PageSections'
import PlatformExperienceOnly from '@/components/PlatformExperienceOnly'
import SkillsetAbilityList from '@/components/SkillsetAbilityList'
import SkillsetConnectionList from '@/components/SkillsetConnectionList'
import ThisSolution from '@/components/ThisSolution'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useExternalAPIURL from '@/hooks/useExternalAPIURL'
import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'
import useSecretAuthenticate from '@/hooks/useSecretAuthenticate'
import useSkillsetSecrets from '@/hooks/useSkillsetSecrets'

import faq from '@/content/faqs/platform-skillset-instance.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function Form({ skillset }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (skillset.id) {
      const { error } = await fetch(`/api/v1/skillset/${skillset.id}/update`, {
        data,

        successMessage: 'Skillset updated.',
      })

      if (!error) {
        Object.assign(skillset, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: skillsetId },
      } = await fetch(`/api/v1/skillset/create`, {
        data: scopeCreateData(data),

        successMessage: 'Skillset created.',
      })

      if (skillsetId) {
        router.push(`/skillsets/${skillsetId}`)
      }
    }

    if (router.query.botId) {
      await fetch(`/api/v1/bot/${router.query.botId}/update`, {
        data: {
          skillsetId: skillset.id,
        },

        successMessage: 'Bot assigned to skillset.',
      })
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this skillset?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/skillset/${skillset.id}/delete`, {
      data: {},

      successMessage: 'Skillset deleted...',
    })

    if (!error) {
      router.push(`/skillsets`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="skillset"
        instance={skillset}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* skillset configuration */}
          <div>
            <Headline title="Skillset Configuration">
              This information is used to configure the skillset.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* name */}
              <div>
                <label className="default-label" htmlFor="name">
                  Name
                </label>
                <div className="mt-1">
                  <input
                    className="default-input w-full"
                    name="name"
                    type="text"
                    defaultValue={skillset.name}
                  />
                </div>
                <p className="input-description">
                  Type any name to recognize the skillset from others.{' '}
                  <strong>
                    The name does have influence on the skillset functionality.
                    This field can be used to add additional information how to
                    use the skillset abilities.
                  </strong>
                </p>
              </div>
              {/* description */}
              <div>
                <label className="default-label" htmlFor="description">
                  Description
                </label>
                <div className="mt-1">
                  <DescriptionInput
                    className="default-input w-full"
                    name="description"
                    defaultValue={skillset.description}
                  />
                </div>
                <p className="input-description">
                  Type description to inform what this skillset is about.{' '}
                  <strong>
                    The description does have any influence on the skillset
                    functionality so make sure it is unique and descriptive.
                  </strong>
                </p>
              </div>
              {/* state */}
              <div>
                <label className="default-label" htmlFor="state">
                  State
                </label>
                <div className="mt-1">
                  <select
                    name="state"
                    className="default-input w-full max-w-xs"
                    defaultValue={skillset.state}
                  >
                    {Object.entries(ResourceState).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="input-description">
                  Disabled skillsets are kept and configured, but are not
                  exposed to bots or integrations at runtime. Use this to toggle
                  the whole skillset off without deleting it.
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
                      defaultValue={skillset.alias}
                      pattern="[a-z0-9_-]*"
                      maxLength={128}
                    />
                  </div>
                  <p className="input-description">
                    Optional unique alias for this skillset. Use lowercase
                    letters, numbers, hyphens, and underscores only. Can be used
                    to reference this skillset via @alias.
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
                      defaultValue={skillset.visibility}
                    >
                      {Object.entries(SkillsetVisibility).map(
                        ([key, value]) => (
                          <option key={key} value={key}>
                            {value}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <p className="input-description">
                    Private skillsets are only accessible by the owner.
                    Protected skillsets are accessible by the owner and all
                    child Users. Public skillsets are accessible by all users
                    of the platform.
                  </p>
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={skillset.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this skillset.
                  </p>
                </div>
              </Expando>
              {/* hub options */}
              {skillset?.id ? (
                <HubOptions type="skillset" instance={skillset} />
              ) : null}
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/skillsets">
              Back To Skillsets
            </BackLink> */}
            {skillset.id ? (
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {skillset.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export function Bots({ skillset }) {
  const [bots, setBots] = useState(skillset.bots || [])

  const confirm = useConfirm()

  const { popup, openPopup, closePopup, setDisabled } = usePopup()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleLink({ botId }) {
    if (!botId) {
      return
    }

    setDisabled(true)

    try {
      const { error } = await fetch(`/api/v1/bot/${botId}/update`, {
        data: {
          skillsetId: skillset.id,
        },

        successMessage: 'Bot linked to skillset.',
      })

      if (error) {
        return
      }

      // @note refetch the bot so we can display it in the list below

      const { data: bot } = await fetch(`/api/v1/bot/${botId}/fetch`)

      setBots((bots) => [
        bot || { id: botId },
        ...bots.filter(({ id }) => id !== botId),
      ])

      closePopup()
    } finally {
      setDisabled(false)
    }
  }

  function handleLinkClick() {
    openPopup(
      <div className="space-y-4">
        <p className="text-sm">
          Select the bot you want to link to this skillset.
        </p>
        <BotSelect
          className="default-input w-full"
          name="botId"
          refLink={false}
        />
      </div>,
      {
        closePopupOnClickOutside: true,
        title: 'Link Bot',
        actions: {
          Link: {
            default: true,

            fn: handleLink,
          },
        },
      }
    )
  }

  const single = bots.length === 1

  async function handleUnlinkClick() {
    const confirmed = await confirm(
      single
        ? 'Do you really want to unlink this bot from the skillset?'
        : 'Do you really want to unlink these bots from the skillset?',
      {
        title: single ? 'Unlink Bot' : 'Unlink Bots',

        actions: {
          Unlink: { result: true, danger: true },
        },
      }
    )

    if (!confirmed) {
      return
    }

    const results = await Promise.all(
      bots.map(({ id }) => {
        return fetch(`/api/v1/bot/${id}/update`, {
          data: {
            skillsetId: null,
          },

          successMessage: 'Bot unlinked from skillset.',
        })
      })
    )

    // @note keep the bots we failed to unlink

    const failed = bots.filter((bot, index) => results[index].error)

    setBots(failed)
  }

  return (
    <>
      {popup}
      <BotList
        items={bots}
        setItems={setBots}
        exportRoute={null}
        deleteRoute={null}
        filter={false}
        quickAccess={true}
        trailingActions={
          bots.length ? (
            <button
              className="text-sm default-link"
              type="button"
              onClick={handleUnlinkClick}
            >
              {single ? 'Unlink bot' : 'Unlink bots'}
            </button>
          ) : (
            <button
              className="text-sm default-link"
              type="button"
              onClick={handleLinkClick}
            >
              Link bot
            </button>
          )
        }
      />
    </>
  )
}

export function Integrations({ skillset }) {
  const integrations = useMemo(() => {
    return Object.keys(skillset)
      .filter((k) => k.endsWith('Integrations'))
      .filter((k) => skillset[k].length > 0)
      .flatMap((key) => {
        const type = key.replace(/Integrations$/, '')

        return skillset[key].map((integration) => {
          return {
            ...integration,

            type,
          }
        })
      })

    // @note we want to run this only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resource = useMemo(
    () => ({ type: 'skillset', id: skillset.id }),
    [skillset.id]
  )

  return (
    <>
      <IntegrationList integrations={integrations} resource={resource} />
    </>
  )
}

export function Chat({ skillset, disabled }) {
  const instance = useMemo(() => {
    return {
      backstory: `${skillsetsConfig.defaultTestBackstory}\n\nSkillset Name: ${skillset.name}\nSkillset Description: ${skillset.description}`,

      model: skillsetsConfig.defaultTestModel,

      skillsetId: skillset.id,
    }
  }, [skillset.id, skillset.name, skillset.description])

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
        disabled={disabled}
      />
      <Expando titleClassName="default-link text-sm" title="Chat Configuration">
        <p className="mb-2 text-sm text-gray-500">
          This chat instance is using the following configuration:
        </p>
        <ObjectView className="text-xs" object={instance} />
      </Expando>
    </div>
  )
}

function getSkillsetExecutionSections(
  skillset,
  apiBase = getExternalAPIHostURL('/v1')
) {
  const firstAbilityId = skillset?.abilities?.[0]?.id || 'ABILITY_ID'

  return {
    sdk: {
      title: 'Node SDK',
      instructions: [
        'Initialize the SDK with your API secret.',
        'Pick an ability from this skillset (for example, the first ability ID).',
        'Execute the ability with an input payload and read the result.',
      ],
      code: {
        language: 'javascript',
        content: `import { ChatBotKit } from '@chatbotkit/sdk'

const client = new ChatBotKit({
  secret: process.env.CHATBOTKIT_API_SECRET,
})

const skillsetId = '${skillset.id}'
const abilityId = '${firstAbilityId}' // replace if needed

const response = await client.skillset.ability.execute(skillsetId, abilityId, {
  input: 'Summarize the latest open incidents in 3 bullet points.',
})

console.log(response.result)
console.log(response.messages)
console.log(response.usage)`,
      },
    },
    go: {
      title: 'Go SDK',
      instructions: [
        'Initialize the Go SDK client with your API secret.',
        'Pick an ability ID from this skillset and execute it directly.',
        'Use the SDK HTTP client helper for the execute endpoint.',
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

  skillsetID := "${skillset.id}"
  abilityID := "${firstAbilityId}" // replace if needed

  path := fmt.Sprintf("/api/v1/skillset/%s/ability/%s/execute", skillsetID, abilityID)

  req := types.SkillsetAbilityExecuteRequest{
    Input: "Summarize the latest open incidents in 3 bullet points.",
  }

  var resp types.SkillsetAbilityExecuteResponse

  if err := client.HTTPClient().Post(ctx, path, req, &resp); err != nil {
    panic(err)
  }

  fmt.Printf("result: %#v\\n", resp.Result)
  fmt.Printf("messages: %d\\n", len(resp.Messages))
}`,
      },
    },
    api: {
      title: 'REST API',
      instructions: [
        'Use your API secret as a Bearer token in the Authorization header.',
        'Call the ability execute endpoint with an input payload.',
        'Read result, messages, and usage from the response body.',
      ],
      code: {
        language: 'bash',
        content: `# Required env vars:
# export CHATBOTKIT_API_SECRET="..."
# export SKILLSET_ID="${skillset.id}"
# export ABILITY_ID="${firstAbilityId}"

API_BASE="${apiBase}"
AUTH_HEADER="Authorization: Bearer $CHATBOTKIT_API_SECRET"
JSON_HEADER="Content-Type: application/json"

curl -X POST "$API_BASE/skillset/$SKILLSET_ID/ability/$ABILITY_ID/execute" \\
  -H "$AUTH_HEADER" \\
  -H "$JSON_HEADER" \\
  -d '{
    "input": "Summarize the latest open incidents in 3 bullet points."
  }'`,
      },
    },
  }
}

export default function Index({ skillset }) {
  const getAPIURL = useExternalAPIURL()

  // @note adding abilities can create the secrets behind them, so the
  // connections section refetches once the dialog is done

  const {
    secrets,
    loading: secretsLoading,
    refresh: refreshSecrets,
  } = useSkillsetSecrets(skillset.id)

  // @note both lists below can send the owner off to authenticate a secret, but
  // the flow reports its result back to the page which opened it - so it is
  // owned here, once, rather than listened for twice

  const authenticateSecret = useSecretAuthenticate(refreshSecrets)

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/skillsets" caption="skillsets" title="Skillset">
          <p>
            A skillset is a collection of pre-built functionality and logic
            modules that enable your chatbot to perform specific tasks and
            operations. Learn more in the{' '}
            <DocsLink slug="skillsets">Skillsets documentation</DocsLink>.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page">
            <Form skillset={skillset} />
          </div>
        </section>
        {skillset.id ? (
          <section data-page-section-title="Bot">
            <div className="main-page">
              <Headline title="Skillset Bot">
                The bot which uses this skillset as its toolset.
              </Headline>
              <Bots skillset={skillset} />
            </div>
          </section>
        ) : null}
        {skillset.id ? (
          <section data-page-section-title="Abilities">
            <div className="main-page">
              <Headline title="Skillset Abilities">
                Extend your skillset&apos;s functionality by adding abilities.
              </Headline>
              <SkillsetAbilityList
                skillsetId={skillset.id}
                blueprintId={skillset.blueprintId}
                secrets={secrets}
                authenticate={authenticateSecret}
                onCreate={refreshSecrets}
                defaultItems={skillset.abilities}
                defaultTotalCount={skillset._count.abilities}
                quickAccess={true}
              />
            </div>
          </section>
        ) : null}
        {skillset.id ? (
          <section data-page-section-title="Connections">
            <div className="main-page">
              <Headline title="Skillset Connections">
                The secrets this skillset&apos;s abilities rely on, and what is
                left to do before they will run.
              </Headline>
              <SkillsetConnectionList
                secrets={secrets}
                loading={secretsLoading}
                authenticate={authenticateSecret}
                onChange={refreshSecrets}
              />
            </div>
          </section>
        ) : null}
        {skillset.id ? (
          <section data-page-section-title="Integrations">
            <div className="main-page">
              <Headline title="Skillset Integrations">
                Connect your skillset to external apps and services to maximize
                its capabilities.
              </Headline>
              <Integrations skillset={skillset} />
            </div>
          </section>
        ) : null}
        {skillset.id ? (
          <section data-page-section-title="Chat">
            <div className="main-page">
              <Headline title="Chat With This Skillset">
                Test your skillset here. For optimal results, create a custom
                chatbot or integration with a tailored backstory. You can also
                interact with this skillset in the{' '}
                <Link
                  className="default-link"
                  href="/apps/chat"
                >
                  Chat
                </Link>{' '}
                app.
              </Headline>
              <Chat key={skillset.id} skillset={skillset} />
            </div>
          </section>
        ) : null}
        {/* {skillset.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this skillset.
              </Headline>
              <MetaArea instance={skillset} />
            </div>
          </section>
        ) : null} */}
        {skillset.id ? (
          <PlatformExperienceOnly>
            <section data-page-section-title="SDK">
              <div className="main-page">
                <Headline title="Execute Skillset Abilities via SDK or API">
                  Run abilities directly from your integrations and backend
                  services. This section focuses on ability execution only.
                </Headline>
                <Expando
                  titleClassName="default-link text-sm"
                  title="Show Examples"
                >
                  <WebhookSetupSection.Multi
                    sections={getSkillsetExecutionSections(
                      skillset,
                      getAPIURL('/v1')
                    )}
                  />
                </Expando>
              </div>
            </section>
          </PlatformExperienceOnly>
        ) : null}
        {skillset.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Events">
                Monitor your skillset activity and events.
              </Headline>
              <EventLog
                eventType={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ skillsetId: skillset.id }}
              />
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { skillset }) {
  return (
    <Dashboard
      breadcrumbs={['Skillsets', 'ChatBotkit']}
      title={skillset.name || skillset.id || 'New'}
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

  if (context.query.skillsetId === 'new') {
    return {
      props: makeJsonSafe({
        skillset: {},
      }),
    }
  }

  const skillset = await prisma.skillset.findUnique({
    where: {
      id: context.query.skillsetId,
    },

    include: {
      abilities: {
        select: {
          id: true,

          name: true,
          description: true,

          instruction: true,

          linkedSecretId: true,
          linkedFileId: true,
        },

        take: maxAbilitiesTake,
      },

      ...withSkillsetResources(session.user.id),

      _count: {
        select: { abilities: true },
      },
    },
  })

  if (!skillset) {
    return {
      notFound: true,
    }
  }

  if (skillset.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  return {
    props: makeJsonSafe({
      skillset,
    }),
  }
}

/**
 * @doc Skillsets
 * @index 20
 *
 * ## Configuring Your Skillset
 *
 * When you're setting up or editing a skillset, you have several important configuration options that control how your bot understands and uses the abilities you've defined.
 *
 * ### Name and Description Matter
 *
 * The most important thing to understand about skillsets is that the **name** and **description** fields aren't just for your reference - the AI actually reads and uses them to understand what the skillset does and when to use its abilities. This is a powerful feature that helps your bot work more intelligently.
 *
 * When you write your skillset name, be descriptive and specific. Instead of just "Tools," use something like "Customer Support and Knowledge Base Tools." This immediately tells the AI (and your team) what this skillset is designed for.
 *
 * The description field is even more important. Use it to explain:
 * - What types of tasks this skillset helps with
 * - When the bot should consider using these abilities
 * - Any important context about how the abilities work together
 *
 * For example: "This skillset provides customer support capabilities including searching our product documentation, creating support tickets, and sending follow-up emails. Use these abilities when customers need help with product questions or technical issues."
 *
 * ### Adding Abilities
 *
 * The heart of any skillset is its abilities - the individual actions your bot can perform. After creating a skillset, you'll need to add at least one ability before your bot can do anything with it.
 *
 * Click **"Create Ability"** to add a new capability. You can either:
 * - **Build a custom ability** by writing your own instructions and configuration
 * - **Use a template** to quickly set up common integrations with popular services
 *
 * Each ability you add appears in the Skillset Abilities list, where you can edit, test, or remove them as needed.
 *
 * ### Testing Your Skillset
 *
 * One of the most valuable features is the built-in chat interface available on every skillset's page. This lets you test your abilities in real conversations before deploying them to your production bots.
 *
 * The test chat creates a temporary bot that uses only this skillset, so you can see exactly how the AI interprets your abilities and when it chooses to use them. Try different conversation styles and requests to ensure your abilities trigger appropriately.
 *
 * When testing, pay attention to:
 * - **Does the AI understand when to use each ability?** If not, refine your skillset description and ability instructions
 * - **Do the abilities return the right information?** Check that the data or actions match what you expect
 * - **Does the conversation flow naturally?** The AI should incorporate ability results smoothly into its responses
 *
 * ### Visibility Settings
 *
 * Under Advanced Options, you can control who has access to your skillset:
 * - **Private**: Only you can see and use this skillset
 * - **Protected**: You and your child Users can access it
 * - **Public**: Available to all platform users - useful if you're sharing a useful integration with the community
 *
 * Most users keep skillsets private unless they're specifically designed for sharing.
 *
 * ### Connecting to Bots
 *
 * Once your skillset is configured and has abilities, you can connect it to any of your bots. Go to the bot's settings page and select your skillset from the available options. You can connect multiple skillsets to a single bot, giving it access to all the combined abilities.
 *
 * Remember that the bot sees all abilities from all connected skillsets, so organize your skillsets thoughtfully to avoid overwhelming the AI with too many unrelated options.
 */

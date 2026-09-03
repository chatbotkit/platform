import { useState } from 'react'

import { descriptionMaxLength as defaultAbilityDescriptionMaxLength } from '@/config/abilities'

import prisma from '@/prisma/client'
import { ResourceState } from '@/prisma/enums'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { withSkillsetResources } from '@/lib/solution'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BackButton from '@/components/BackButton'
import BotSelect from '@/components/BotSelect'
import CodeAction from '@/components/CodeAction'
import { useConfirm } from '@/components/Confirm'
import DescriptionInput from '@/components/DescriptionInput'
import DocsLink from '@/components/DocsLink'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import FileSelect from '@/components/FileSelect'
import ForwardButton from '@/components/ForwardButton'
import Headline from '@/components/Headline'
import InstructionCheatsheet from '@/components/InstructionCheatsheet'
import InstructionInput from '@/components/InstructionInput'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import SecretSelect from '@/components/SecretSelect'
import SkillsetAbilityTester from '@/components/SkillsetAbilityTester'
import SpaceSelect from '@/components/SpaceSelect'
import ThisSolution from '@/components/ThisSolution'

import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-skillset-ability-instance.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function Form({ skillset }) {
  const confirm = useConfirm()

  const [updateCounter, setUpdateCounter] = useState(0)

  const [name, setName] = useState(skillset.ability.name)
  const [description, setDescription] = useState(skillset.ability.description)

  const abilityMaxTokens = defaultAbilityDescriptionMaxLength

  const router = useRouter()

  // @note the skillset page sends us here with a template to apply, or `none`
  // when the user asked for a blank ability. Absent means they came here
  // directly, so we still offer the template dialog on arrival.

  const template = router.query.template

  const templateId = template && template !== 'none' ? template : undefined

  const scopeCreateData = useScopedCreateData()

  const { code, loading, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (skillset.ability.id) {
      const { error } = await fetch(
        `/api/v1/skillset/${skillset.id}/ability/${skillset.ability.id}/update`,
        {
          data,

          successMessage: 'Skillset ability updated.',
        }
      )

      if (!error) {
        Object.assign(skillset.ability, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const {
        data: { id: abilityId },
      } = await fetch(`/api/v1/skillset/${skillset.id}/ability/create`, {
        // @note the ability belongs to the skillset, so it belongs to the
        // skillset's blueprint - not to whichever project is selected.
        // scopeCreateData leaves an existing blueprintId alone, so it only
        // fills in the fallback when the skillset has no blueprint of its own.
        data: scopeCreateData(
          skillset.blueprintId
            ? { ...data, blueprintId: skillset.blueprintId }
            : data
        ),

        successMessage: 'Skillset ability created.',
      })

      if (abilityId) {
        router.push(`/skillsets/${skillset.id}/abilities/${abilityId}`)
      }
    }
  }

  function backToSkillset(event) {
    event.preventDefault()

    router.push(`/skillsets/${skillset.id}`)
  }

  async function deleteAbility(event) {
    event.preventDefault()

    if (
      !(await confirm(
        'You are about to delete this ability. Do you want to continue?'
      ))
    ) {
      return
    }

    const { error } = await fetch(
      `/api/v1/skillset/${skillset.id}/ability/${skillset.ability.id}/delete`,
      {
        data: {},
      }
    )

    if (!error) {
      router.push(`/skillsets/${skillset.id}`)
    }
  }

  function gotoCreateNewAbility(event) {
    event.preventDefault()

    router.push(`/skillsets/${skillset.id}/abilities/new`)
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
          {/* skillset ability configuration */}
          <div>
            <Headline title="Skillset Ability Configuration">
              This information is used to configure the ability.
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
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={loading}
                    required={true}
                  />
                </div>
                <p className="input-description">
                  Type any name to recognize the ability from others.{' '}
                  <strong>
                    The chosen name directly influences the model&apos;s ability
                    to utilize these skills in conversation.
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
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxTokens={abilityMaxTokens}
                    disabled={loading}
                    required={true}
                    countTokens={true}
                  />
                </div>
                <p className="input-description">
                  Enter a description to explain this ability to ChatBotKit.{' '}
                  <strong>
                    This information is important and will be utilized during
                    conversations.
                  </strong>
                </p>
              </div>
              {/* instruction */}
              <div>
                <label className="default-label" htmlFor="instruction">
                  Instruction
                </label>
                <div className="mt-1">
                  <InstructionInput
                    className="default-input w-full"
                    name="instruction"
                    defaultValue={skillset.ability.instruction}
                    maxTokens={abilityMaxTokens}
                    disabled={loading}
                    required={true}
                    templateId={skillset.ability.id ? undefined : templateId}
                    autoOpenTemplate={!skillset.ability.id && !template}
                    onTemplateSelect={(template) => {
                      setName(template.name)
                      setDescription(template.description)
                    }}
                  />
                </div>
                <p className="input-description">
                  This field defines the instruction for the ability. It can be
                  any arbitrary text that will provide context for the bot
                  during a conversation. For more information see the{' '}
                  <DocsLink className="default-link" slug="skillsets">
                    documentation
                  </DocsLink>
                  .
                </p>
                <InstructionCheatsheet className="mt-2" />
              </div>
              {/* linkedSecretId */}
              <div>
                <label className="default-label" htmlFor="store">
                  Referenced Secret
                </label>
                <div className="mt-1">
                  <SecretSelect
                    className="default-input w-full max-w-xs"
                    name="linkedSecretId"
                    defaultValue={skillset.ability.linkedSecretId}
                  />
                </div>
                <p className="input-description">
                  Select a secret to associate with this ability. Secrets are
                  used to store sensitive information like API keys and
                  credentials, which are then made available to the ability.
                </p>
              </div>
              {/* linkedFileId */}
              <div>
                <label className="default-label" htmlFor="file">
                  Referenced File
                </label>
                <div className="mt-1">
                  <FileSelect
                    className="default-input w-full max-w-xs"
                    name="linkedFileId"
                    defaultValue={skillset.ability.linkedFileId}
                  />
                </div>
                <p className="input-description">
                  Select a file to associate with this ability. Files can be
                  used to provide additional context or information that the
                  ability might need to fulfill requests.
                </p>
              </div>
              {/* linkedBotId */}
              <div>
                <label className="default-label" htmlFor="bot">
                  Referenced Bot
                </label>
                <div className="mt-1">
                  <BotSelect
                    className="default-input w-full max-w-xs"
                    name="linkedBotId"
                    defaultValue={skillset.ability.linkedBotId}
                  />
                </div>
                <p className="input-description">
                  Select a bot to associate with this ability. Some abilities
                  use this configuration in a multi-agent environment to fulfill
                  requests.
                </p>
              </div>
              {/* linkedSpaceId */}
              <div>
                <label className="default-label" htmlFor="space">
                  Referenced Space
                </label>
                <div className="mt-1">
                  <SpaceSelect
                    className="default-input w-full max-w-xs"
                    name="linkedSpaceId"
                    defaultValue={skillset.ability.linkedSpaceId}
                  />
                </div>
                <p className="input-description">
                  Select a space to associate with this ability. Some abilities
                  use this configuration to scope their actions to a specific
                  space.
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
                    defaultValue={skillset.ability.state}
                    disabled={loading}
                  >
                    {Object.entries(ResourceState).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="input-description">
                  Disabled abilities are kept and configured, but are not
                  exposed during conversations at runtime. Use this to toggle
                  the ability off without deleting it.
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
                      defaultValue={skillset.ability.alias}
                      pattern="[a-z0-9_-]*"
                      maxLength={128}
                    />
                  </div>
                  <p className="input-description">
                    Optional unique alias for this ability. Use lowercase
                    letters, numbers, hyphens, and underscores only. Can be used
                    to reference this ability via @alias.
                  </p>
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput
                      name="meta"
                      defaultMeta={skillset.ability.meta}
                    />
                  </div>
                  <p className="input-description">
                    Custom metadata for this ability.
                  </p>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            <BackButton
              className="default-button"
              type="button"
              onClick={backToSkillset}
              disabled={loading}
            >
              Back To Skillset
            </BackButton>
            {skillset.ability.id ? (
              <ForwardButton
                className="default-button"
                type="button"
                onClick={gotoCreateNewAbility}
                disabled={loading}
              >
                Create New Ability
              </ForwardButton>
            ) : null}
            {skillset.ability.id ? (
              <button
                type="button"
                className="danger-button"
                onClick={deleteAbility}
                disabled={loading}
              >
                Delete
              </button>
            ) : null}
            <span className="action-area-space" />
            <button className="primary-button" type="submit" disabled={loading}>
              {skillset.ability.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ skillset }) {
  // const abilityMaxTokens = defaultAbilityDescriptionMaxLength * 4

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader
          link={`/skillsets/${skillset.id}`}
          caption="skillset"
          title="Ability"
        >
          <p>
            An ability is a single instruction that is part of a larger
            skillset. It contains around {abilityMaxTokens} tokens, which can be
            words, phrases, or symbols, and allows the agent to fulfill a
            request.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section
          data-page-section-title="Configuration"
          className="section-white"
        >
          <div className="main-page">
            <Form skillset={skillset} />
          </div>
        </section>
        {skillset.ability.id ? (
          <section data-page-section-title="Tester">
            <div className="main-page">
              <Headline title="Tester" beta="debug">
                Test and improve this specific skillset ability.
              </Headline>
              <SkillsetAbilityTester skillset={skillset} />
            </div>
          </section>
        ) : null}
        {/* {skillset.ability.id ? (
          <section>
            <div className="main-page">
              <Headline title="Meta">
                Meta fields assigned to this ability.
              </Headline>
              <MetaArea instance={skillset.ability} />
            </div>
          </section>
        ) : null} */}
        {skillset.ability.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="Skillset Ability Events">
                Keep tabs on your skillset ability events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{
                  skillsetId: skillset.id,
                  abilityId: skillset.ability.id,
                }}
                filter={false}
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
      breadcrumbs={[skillset.name || skillset.id, 'Skillsets', 'ChatBotKit']}
      title={skillset.ability.name || skillset.ability.id || 'New'}
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

  const skillset = await prisma.skillset.findUnique({
    where: {
      id: context.query.skillsetId,
    },

    select: {
      id: true,

      userId: true,

      name: true,

      blueprintId: true,

      abilities: {
        where: {
          id: context.query.abilityId,
        },

        take: 1,
      },

      ...withSkillsetResources(session.user.id),
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

  skillset.ability = skillset.abilities[0]

  delete skillset.abilities

  if (context.query.abilityId === 'new') {
    skillset.ability = {
      instruction: '',
    }

    return {
      props: makeJsonSafe({
        skillset,
      }),
    }
  }

  if (!skillset.ability) {
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
 * @index 30
 *
 * ## Understanding Abilities
 *
 * Skillsets are made of abilities. Each ability has a number of fields which define the name, the purpose of the ability as well as how the ability will be used during the conversation:
 *
 * - **name** - a short but descriptive name for the ability
 * - **description** - a short description for the ability
 * - **instruction** - specific instructions how to apply the ability
 *
 * Both the **name** and **description** fields are used during the intent detection stage of the conversation, i.e. when your bot is trying to figure out what it needs to do to serve the end user. The **instruction** field is only used once this specific ability is selected. The instruction is applied with the conversation in mind to fulfil the end user request.
 *
 * It is essential to keep the **name** and **description** fields descriptive but not too long as they will be used during every stage of the conversation, thus consuming tokens. The instruction field can be much longer. It will be used only once per user request but still contributes to the total token usage.
 *
 * ## Using Actions in Abilities
 *
 * The instruction field is where you specify what your ability should do. You can include actions that your AI agent will execute, along with text instructions that guide when and how those actions should be used. Be as descriptive as possible to ensure your ability works consistently.
 */

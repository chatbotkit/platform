import { useEffect, useMemo, useState } from 'react'

import prisma from '@/prisma/client'
import { Visibility } from '@/prisma/enums'

import fetch from '@/lib/fetch'
import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import BotSelect from '@/components/BotSelect'
import { useConfirmDelete } from '@/components/Confirm'
import Expando from '@/components/Expando'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import RevealToken from '@/components/RevealToken'
import ThisSolution from '@/components/ThisSolution'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

function useAnamPersonas(integration, updateCounter) {
  const [personas, setPersonas] = useState([])

  useEffect(() => {
    if (!integration?.apiKey) {
      setPersonas([])

      return
    }

    let canceled = false

    async function fetchPersonas() {
      try {
        const response = await fetch(
          'https://api.anam.ai/v1/personas?perPage=100',
          {
            headers: {
              Authorization: `Bearer ${integration.apiKey}`,
            },
          }
        )

        if (!response.ok) {
          throw new Error('Failed to load Anam personas')
        }

        const data = await response.json()

        if (!canceled) {
          setPersonas(Array.isArray(data?.data) ? data.data : [])
        }
      } catch {
        if (!canceled) {
          setPersonas([])
        }
      }
    }

    fetchPersonas()

    return () => {
      canceled = true
    }
  }, [integration?.apiKey, updateCounter])

  return personas
}

function AnamPersonaPreview({ persona }) {
  const avatar = persona?.avatar

  const previewUrl = avatar?.videoUrl || avatar?.imageUrl

  if (!persona || !avatar || !previewUrl) {
    return null
  }

  const personaUrl = `https://lab.anam.ai/build/${persona.id}`

  return (
    <a
      className="relative mt-3 block aspect-video max-w-xs overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 shadow-sm transition hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:focus:ring-offset-zinc-950"
      href={personaUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${persona.name || persona.id} in Anam Lab`}
    >
      {avatar.videoUrl ? (
        <video
          className="h-full w-full object-cover object-top bg-black"
          src={avatar.videoUrl}
          poster={avatar.imageUrl}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <img
          className="h-full w-full object-cover object-top"
          src={avatar.imageUrl}
          alt={avatar.displayName || persona.name || 'Anam avatar'}
        />
      )}
      <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)]">
        <span className="tag darker max-w-full text-xs">
          {persona.name || persona.id}
        </span>
      </div>
    </a>
  )
}

export function Form({ integration }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const personas = useAnamPersonas(integration, updateCounter)

  const selectedPersona = useMemo(() => {
    return personas.find((persona) => persona.id === integration.personaId)
  }, [integration.personaId, personas])

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { popup, openPopup } = usePopup()

  const { fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
    successMessage: 'Anam integration settings updated.',
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/anam/${integration.id}/update`,
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
        data: { id: anamIntegrationId },
      } = await fetch(`/api/v1/integration/anam/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (anamIntegrationId) {
        router.push(`/integrations/anam/${anamIntegrationId}`)
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
      `/api/v1/integration/anam/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'Anam integration deleted.',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  function handleTest(event) {
    event.preventDefault()

    const a = document.createElement('a')

    a.href = `/integrations/anam/${integration.id}/test`
    a.target = '_blank'

    a.click()
  }

  return (
    <>
      {popup}
      <ThisSolution
        type="integrations/anam"
        instance={integration}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          <div>
            <Headline title="Anam Integration Configuration">
              This information is used to configure the private Anam
              integration.
            </Headline>
            <div className="mt-6 space-y-6">
              <GeneralBasicOptions instance={integration} />
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
            <div>
              <Headline title="Anam Application Configuration">
                This information is used to configure the Anam integration.
              </Headline>
              <div className="mt-6 space-y-6">
                <div>
                  <label className="default-label" htmlFor="apiKey">
                    API Key
                  </label>
                  <div className="mt-1">
                    <RevealToken
                      className="default-input w-full sm:text-sm"
                      name="apiKey"
                      defaultToken={integration.apiKey}
                    />
                  </div>
                  <p className="input-description">
                    The API key used to authenticate with Anam.
                  </p>
                </div>
                <div>
                  <label className="default-label" htmlFor="personaId">
                    Persona
                  </label>
                  <div className="mt-1">
                    <input
                      className="default-input w-full sm:text-sm"
                      name="personaId"
                      type="text"
                      list="anam-persona-options"
                      defaultValue={integration.personaId}
                      autoComplete="off"
                    />
                    <datalist id="anam-persona-options">
                      {personas.map((persona) => (
                        <option
                          key={persona.id}
                          value={persona.id}
                          label={persona.name || persona.id}
                        />
                      ))}
                    </datalist>
                  </div>
                  <p className="input-description">
                    Select an Anam persona, or paste a persona ID directly.
                  </p>
                  <AnamPersonaPreview persona={selectedPersona} />
                </div>
                <Expando
                  titleClassName="default-link text-sm"
                  title="Show Advanced Options"
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
                      Optional unique alias for this integration. Use lowercase
                      letters, numbers, hyphens, and underscores only. Can be
                      used to reference this integration via @alias.
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
                        defaultValue={integration.visibility}
                      >
                        {Object.entries(Visibility).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="input-description">
                      Private integrations are only accessible by the owner.
                      Protected integrations are accessible by the owner and all
                      child Users. Public integrations are accessible by anyone
                      with the embed URL.
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
          ) : null}
        </div>
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
            {integration.id ? (
              <button
                className="default-button"
                type="button"
                onClick={handleTest}
              >
                Test
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

export default function Index({ integration }) {
  return (
    <PageSections className="pt-12">
      <section data-page-section-title="Configuration">
        <div className="main-page">
          <Form key={integration.id || 'new'} integration={integration} />
        </div>
      </section>
    </PageSections>
  )
}

Index.getLayout = function (children, { integration }) {
  return (
    <Dashboard
      breadcrumbs={['Anam', 'Integrations', 'ChatBotKit']}
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

  if (context.query.anamIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          botId: context.query.botId,
        },
      }),
    }
  }

  const integration = await prisma.anamIntegration.findUnique({
    where: {
      id: context.query.anamIntegrationId,
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
      integration,
    }),
  }
}

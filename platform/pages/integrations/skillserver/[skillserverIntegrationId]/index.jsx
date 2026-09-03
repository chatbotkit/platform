import { useState } from 'react'

import { getExternalAPIHostURL } from '@/lib/host'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import CodeAction from '@/components/CodeAction'
import { useConfirmDelete } from '@/components/Confirm'
import EventLog from '@/components/EventLog'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import GeneralBasicOptions from '@/components/GeneralBasicOptions'
import Headline from '@/components/Headline'
import IntegrationInstallButton from '@/components/IntegrationInstallButton'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import SkillsetSelect from '@/components/SkillsetSelect'
import ThisSolution from '@/components/ThisSolution'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useExternalAPIURL from '@/hooks/useExternalAPIURL'
import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-integrations-skillserver.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function getInstallDetails({
  integration,
  type = 'general',
  getAPIURL = (path) => getExternalAPIHostURL(path),
}) {
  const endpointUrl = getAPIURL(
    `/v1/integration/skillserver/${integration.id}/invoke`
  )

  switch (type) {
    case 'general': {
      return {
        title: 'General',
        code: {
          language: 'bash',
          content: [
            '# Read the manual: GET lists the available abilities and how to call them',
            `curl -H "Authorization: Bearer ${integration.accessToken}" \\`,
            `  ${endpointUrl}`,
            '',
            '# Invoke an ability: POST to the same URL (plain text; add ?format=json for JSON)',
            'curl -X POST \\',
            `  -H "Authorization: Bearer ${integration.accessToken}" \\`,
            '  -H "Content-Type: application/json" \\',
            `  -d '{"ability":"<name>","input":{}}' \\`,
            `  ${endpointUrl}`,
          ].join('\n'),
        },
        instructions: [
          'GET the endpoint first to discover the available abilities and their input fields.',
          'Invoke an ability by POSTing its name and input to the same URL.',
          'Every request must include the access token as a bearer token.',
          "For enhanced security, store your access token in a secure vault such as 1Password or Bitwarden, and use the vault's CLI to inject it as an environment variable.",
        ],
      }
    }

    case 'endpoints': {
      return {
        title: 'Endpoints',
        endpoints: [
          {
            label: 'Skill Server URL (GET = manual, POST = invoke)',
            url: endpointUrl,
          },
        ],
        instructions: [
          'The endpoint is authenticated with the static access token as a bearer token.',
          'GET returns the plain-text Markdown manual; POST invokes an ability and returns plain text by default, or JSON when ?format=json is set.',
        ],
      }
    }
  }

  return null
}

export function getInstallPopupDetails(options) {
  return getInstallDetails(options)
}

export function Form({ integration, installDetails }) {
  const confirmDelete = useConfirmDelete()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
    successMessage: 'SkillServer integration settings updated.',
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/skillserver/${integration.id}/update`,
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
        data: { id: skillserverIntegrationId },
      } = await fetch(`/api/v1/integration/skillserver/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (skillserverIntegrationId) {
        router.push(`/integrations/skillserver/${skillserverIntegrationId}`)
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
      `/api/v1/integration/skillserver/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'SkillServer integration deleted...',
      }
    )

    if (!error) {
      router.push(`/integrations`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="integrations/skillserver"
        instance={integration}
        updateKey={updateCounter}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="SkillServer Integration Configuration">
              This information is used to configure some general options around
              the integration.
            </Headline>
            <div className="mt-6 space-y-6">
              {/* general basic options */}
              <GeneralBasicOptions instance={integration} />
              {/* skillsetId */}
              <div>
                <label className="default-label" htmlFor="skillsetId">
                  Skillset
                </label>
                <div className="mt-1">
                  <SkillsetSelect
                    className="default-input w-full max-w-xs"
                    name="skillsetId"
                    defaultValue={integration.skillsetId}
                  />
                </div>
                <p className="input-description">
                  Select an existing skillset.
                </p>
              </div>
            </div>
          </div>
          {/* advanced options */}
          <div>
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
                  letters, numbers, hyphens, and underscores only. Can be used
                  to reference this integration via @alias.
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
            {integration.id ? (
              <IntegrationInstallButton
                title="SkillServer Install Instructions"
                details={installDetails}
                docsSlug="skill-server"
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

export default function Index({ integration }) {
  const getAPIURL = useExternalAPIURL()

  const installDetails = {
    sections: {
      general: getInstallDetails({ integration, type: 'general', getAPIURL }),
      endpoints: getInstallDetails({
        integration,
        type: 'endpoints',
        getAPIURL,
      }),
    },
  }

  const installPopupDetails = {
    sections: {
      general: getInstallPopupDetails({
        integration,
        type: 'general',
        getAPIURL,
      }),
      endpoints: getInstallPopupDetails({
        integration,
        type: 'endpoints',
        getAPIURL,
      }),
    },
  }

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
          <section data-page-section-title="Install">
            <div className="main-page">
              <Headline title="SkillServer Installation Instructions">
                Follow these steps to call your skill server from an agent or
                any HTTP client.
              </Headline>
              <Expando
                titleClassName="default-link text-sm"
                title="Show Installation Instructions"
              >
                <WebhookSetupSection.Multi sections={installDetails.sections} />
              </Expando>
            </div>
          </section>
        ) : null}
        {integration.id ? (
          <section data-page-section-title="Events">
            <div className="main-page">
              <Headline title="SkillServer Integration Events">
                Keep tabs on the progress of your SkillServer integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ skillserverIntegrationId: integration.id }}
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
      breadcrumbs={['SkillServer', 'Integrations', 'ChatBotKit']}
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

  if (context.query.skillserverIntegrationId === 'new') {
    return {
      props: makeJsonSafe({
        integration: {
          // url parameters

          skillsetId: context.query.skillsetId,

          // default values

          visibleMessages: 0,
        },
      }),
    }
  }

  const integration = await prisma.skillserverIntegration.findUnique({
    where: {
      id: context.query.skillserverIntegrationId,
    },

    include: {
      skillset: {
        select: {
          id: true,

          name: true,
          description: true,
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

/**
 * @doc Skill Server
 * @description Expose your ChatBotKit skillsets as a text-first HTTP API that agents read and invoke directly - a simpler alternative to MCP that needs no client.
 * @category Integrations
 * @tags skill server, skillserver, integration, skillset, agent, api, text, http
 * @index 214
 * @date Mon, Jun 22, 2026, 12:00 AM
 *
 * The Skill Server integration turns any ChatBotKit skillset into a self-describing, text-first HTTP API. Instead of speaking the Model Context Protocol, an agent simply reads a plain-text manual that lists the available abilities and how to call them, then invokes those abilities directly with a single HTTP request. It is the sibling of the MCP Server integration - same skillset, simpler transport.
 *
 * ## What You Can Do
 *
 * - **Publish Skillsets as a Plain API**: Take any skillset and expose its abilities over a simple HTTP endpoint
 * - **No Client Required**: Any agent framework, script, or `curl` can drive it - there is no MCP client, no JSON-RPC, and no handshake
 * - **Self-Describing**: A generated manual documents every ability and its inputs, so agents discover capabilities on their own
 * - **Text-First**: Responses are plain text by default (token-cheap and truncation-friendly), with JSON available on demand
 * - **Secure Access**: Each integration gets its own static access token so you control who can call your abilities
 *
 * ## How It Works
 *
 * When you create a Skill Server integration and attach a skillset, ChatBotKit exposes two authenticated endpoints: a `manual` endpoint that returns a Markdown description of the abilities, and an `invoke` endpoint that executes a single ability by name. Both are authenticated with the integration's static access token as a bearer token.
 *
 * An agent reads the manual once to learn what is available, then calls `invoke` with the ability name and its input. ChatBotKit executes the ability and returns the result as plain text (or JSON when `?format=json` is set).
 *
 * ## Getting Started
 *
 * 1. **Create the Integration**: Give it a name and click Create
 * 2. **Select a Skillset**: Choose an existing skillset that contains the abilities you want to expose
 * 3. **Save**: Click Save to generate your endpoints and access token
 * 4. **Copy the Configuration**: Expand the Installation Instructions section for ready-to-run `curl` examples and the endpoint URLs
 * 5. **Point Your Agent at It**: Have the agent read the manual, then invoke abilities as needed
 *
 * ## Best Practices
 *
 * **Keep Skillsets Focused**: Each integration exposes one skillset. Purpose-specific skillsets keep the manual short and make it easier for an agent to pick the right ability.
 *
 * **Protect Your Access Token**: The token unlocks every ability in the skillset, including any that touch secrets, bots, spaces, or files. Store it in a secure vault and inject it via environment variables.
 *
 * **Name Abilities Clearly**: The manual is generated from your ability names and descriptions. Clear names and descriptions help the agent choose correctly.
 *
 * ## Practical Use Cases
 *
 * **Lightweight Agent Tooling**: Give a custom agent framework access to your abilities without implementing an MCP client.
 *
 * **Scripts and Automation**: Call abilities from shell scripts, cron jobs, or CI pipelines with a single `curl`.
 *
 * **Knowledge Retrieval**: Expose a search skillset so an agent can look up company knowledge over plain HTTP.
 */

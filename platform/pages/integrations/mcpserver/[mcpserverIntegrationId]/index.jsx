import { useState } from 'react'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getExternalAPIHostURL } from '@/lib/host'
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

import faq from '@/content/faqs/platform-integrations-mcpserver.yaml'

export const VISIBLE_EVENT_TYPES = [
  // @note whitelist only specific events if applicable
]

export function getInstallDetails({
  integration,
  type = 'general',
  getAPIURL = (path) => getExternalAPIHostURL(path),
}) {
  switch (type) {
    case 'general': {
      return {
        title: 'General',
        code: {
          language: 'json',
          content: JSON.stringify(
            {
              mcpServers: {
                [`chatbotkit-skillset-${integration.id}`]: {
                  command: 'npx',
                  args: [
                    'mcp-remote',
                    getAPIURL(
                      `/v1/integration/mcpserver/${integration.id}/mcp`
                    ),
                    '--header',
                    `Authorization: Bearer ${integration.accessToken}`,
                  ],
                },
              },
            },
            null,
            2
          ),
        },
        instructions: [
          'Add the configuration to your MCP client settings file.',
          'Ensure you have npx and mcp-remote installed.',
          "For enhanced security, store your access token in a secure vault such as 1Password or Bitwarden, and use the vault's CLI to inject it as an environment variable.",
        ],
      }
    }

    case 'vscode': {
      return {
        title: 'VSCode',
        code: {
          language: 'json',
          content: JSON.stringify(
            {
              servers: {
                [`chatbotkit-skillset-${integration.id}`]: {
                  type: 'http',
                  url: getAPIURL(
                    `/v1/integration/mcpserver/${integration.id}/mcp`
                  ),
                  headers: {
                    Authorization: `Bearer ${integration.accessToken}`,
                  },
                },
              },
            },
            null,
            2
          ),
        },
        instructions: [
          'Add the configuration to your VSCode MCP settings.',
          'Restart VSCode to apply the changes.',
          'The skillset will be available as MCP tools in your VSCode environment.',
        ],
      }
    }

    case 'chatgpt': {
      return {
        title: 'ChatGPT',
        endpoints: [
          {
            label: 'MCP Server URL',
            url: `${getAPIURL(
              `/v1/integration/mcpserver/${integration.id}/mcp`
            )}?client=chatgpt&authorization=${integration.accessToken}`,
          },
        ],
        instructions: [
          'Go to Settings > Apps > Advance Settings and enable Developer mode.',
          'Go to Apps > Advance Settings > Create app.',
          'Add the name, optional description, and set authentication to noauth.',
          'Use the provided MCP Server URL.',
        ],
      }
    }

    case 'github': {
      return {
        title: 'GitHub Copilot',
        code: {
          language: 'json',
          content: JSON.stringify(
            {
              mcpServers: {
                [`chatbotkit-skillset-${integration.id}`]: {
                  type: 'http',
                  url: getAPIURL(
                    `/v1/integration/mcpserver/${integration.id}/mcp`
                  ),
                  headers: {
                    Authorization: `Bearer ${integration.accessToken}`,
                  },
                  tools: ['*'],
                },
              },
            },
            null,
            2
          ),
        },
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
    successMessage: 'MCPServer integration settings updated.',
  })

  async function handleOnSubmit(event) {
    event.preventDefault()

    const data = formToData(event.target)

    if (!data) {
      return
    }

    if (integration.id) {
      const { error } = await fetch(
        `/api/v1/integration/mcpserver/${integration.id}/update`,
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
        data: { id: mcpserverIntegrationId },
      } = await fetch(`/api/v1/integration/mcpserver/create`, {
        data: scopeCreateData(data),
      })

      Object.assign(integration, data)

      if (mcpserverIntegrationId) {
        router.push(`/integrations/mcpserver/${mcpserverIntegrationId}`)
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
      `/api/v1/integration/mcpserver/${integration.id}/delete`,
      {
        data: {},

        successMessage: 'MCPServer integration deleted...',
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
        type="integrations/mcpserver"
        instance={integration}
        updateKey={updateCounter}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* general configuration */}
          <div>
            <Headline title="MCPServer Integration Configuration">
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
            {integration.id ? (
              <IntegrationInstallButton
                title="MCPServer Install Instructions"
                details={installDetails}
                docsSlug="mcp-server"
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
      vscode: getInstallDetails({ integration, type: 'vscode', getAPIURL }),
      chatgpt: getInstallDetails({ integration, type: 'chatgpt', getAPIURL }),
      github: getInstallDetails({ integration, type: 'github', getAPIURL }),
    },
  }

  const installPopupDetails = {
    sections: {
      general: getInstallPopupDetails({
        integration,
        type: 'general',
        getAPIURL,
      }),
      vscode: getInstallPopupDetails({
        integration,
        type: 'vscode',
        getAPIURL,
      }),
      chatgpt: getInstallPopupDetails({
        integration,
        type: 'chatgpt',
        getAPIURL,
      }),
      github: getInstallPopupDetails({
        integration,
        type: 'github',
        getAPIURL,
      }),
    },
  }

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader
          link="/integrations"
          caption="integrations"
          title="MCPServer"
          beta={true}
        >
          <p>
            With this integration, you can expose your ChatBotKit skillsets as
            Model Context Protocol (MCP) tools that can be discovered and used
            by AI applications like Claude Desktop, VSCode, and other
            MCP-compatible clients. Detailed instructions on how to set up this
            integration can be found at{' '}
            <DocsLink className="default-link" slug="mcp-server">
              ChatBotKit MCPServer Integration
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
          <section data-page-section-title="Install">
            <div className="main-page">
              <Headline title="MCPServer Installation Instructions">
                Follow these steps to install and configure your MCPServer
                integration in various MCP clients.
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
              <Headline title="MCPServer Integration Events">
                Keep tabs on the progress of your MCPServer integration&apos;s
                events.
              </Headline>
              <EventLog
                eventTypes={VISIBLE_EVENT_TYPES}
                autoLoad={true}
                contextFilters={{ mcpserverIntegrationId: integration.id }}
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
      breadcrumbs={['MCPServer', 'Integrations', 'ChatBotKit']}
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

  if (context.query.mcpserverIntegrationId === 'new') {
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

  const integration = await prisma.mcpserverIntegration.findUnique({
    where: {
      id: context.query.mcpserverIntegrationId,
    },

    include: {
      skillset: {
        select: {
          id: true,

          name: true,
          description: true,
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
 * @doc MCP Server
 * @description Expose your ChatBotKit skillsets as MCP tools for AI applications like Claude Desktop, VSCode, and GitHub Copilot
 * @category Integrations
 * @tags mcp, mcp server, integration, model context protocol, claude, vscode, github copilot, chatgpt, tools, skillset
 * @index 213
 * @date Sun, Mar 30, 2026, 12:00 AM
 *
 * The MCP Server integration lets you turn any ChatBotKit skillset into a set of tools that AI applications can discover and use through the Model Context Protocol (MCP). Instead of building custom APIs or plugins for every tool, you publish your skillset once and any MCP-compatible client - Claude Desktop, VSCode, GitHub Copilot, ChatGPT, and others - can pick it up automatically.
 *
 * ## What You Can Do
 *
 * With the MCP Server integration, you can:
 *
 * - **Publish Skillsets as Tools**: Take any skillset you have built in ChatBotKit and instantly make its abilities available as MCP tools
 * - **Connect to Multiple Clients**: Use the same integration with Claude Desktop, VSCode, GitHub Copilot, ChatGPT, and any other MCP-compatible application
 * - **Zero Code Required**: No custom server code or infrastructure needed - ChatBotKit hosts the MCP endpoint for you
 * - **Secure Access**: Each integration gets its own access token so you control exactly who can call your tools
 *
 * ## How It Works
 *
 * When you create an MCP Server integration and attach a skillset, ChatBotKit generates a hosted MCP endpoint. AI applications connect to this endpoint using the configuration you provide (a URL and an access token). The client discovers all available tools from your skillset and can call them during conversations. ChatBotKit handles the tool execution and returns the results back to the client.
 *
 * The whole process is transparent to the end user. They interact with their AI application as usual, and the application calls your tools whenever they are relevant to the conversation.
 *
 * ## Getting Started
 *
 * 1. **Create the Integration**: Give it a name and click Create
 * 2. **Select a Skillset**: Choose an existing skillset that contains the abilities you want to expose as MCP tools
 * 3. **Save**: Click Save to generate your MCP endpoint URL and access token
 * 4. **Copy the Configuration**: Expand the Installation Instructions section and pick the tab for your client (General, VSCode, ChatGPT, or GitHub Copilot)
 * 5. **Configure Your Client**: Paste the configuration into your client's MCP settings file and restart the application
 * 6. **Start Using Tools**: Your AI application will now discover and use the tools from your skillset
 *
 * ## Client Setup
 *
 * Each MCP client has a slightly different configuration format, but the core information is the same: an endpoint URL and your access token.
 *
 * **Claude Desktop and general clients** use a JSON configuration that runs `mcp-remote` via `npx`. Paste the provided JSON into your client's MCP settings file and make sure `npx` is available on your system.
 *
 * **VSCode** supports MCP servers natively with an HTTP transport. Add the provided configuration to your VSCode MCP settings and restart the editor. Your skillset tools will appear alongside other MCP tools.
 *
 * **GitHub Copilot** also uses an HTTP configuration. Add the JSON to your Copilot MCP settings and the tools will be available in your coding sessions.
 *
 * **ChatGPT** requires enabling Developer mode in Settings, then creating a new app with the provided MCP Server URL. Set authentication to noauth and your tools will be available in ChatGPT conversations.
 *
 * ## Best Practices
 *
 * **Keep Skillsets Focused**: Each integration exposes one skillset. Create purpose-specific skillsets rather than putting every ability into a single one. This makes it easier for AI clients to pick the right tools.
 *
 * **Protect Your Access Token**: The access token grants full access to call all tools in the integration. Store it in a secure vault like 1Password or Bitwarden and use environment variables instead of hardcoding it in configuration files.
 *
 * **Name Abilities Clearly**: MCP clients present tool names and descriptions to the AI model. Descriptive names and clear descriptions help the model choose the right tool at the right time.
 *
 * **Test Before Sharing**: After setting up the integration, try each tool from your MCP client to make sure it works as expected. Check for timeouts, missing parameters, and unexpected responses.
 *
 * ## Practical Use Cases
 *
 * **Developer Tooling**: Expose internal APIs, deployment scripts, or database queries as MCP tools so developers can trigger them directly from their coding environment.
 *
 * **Knowledge Retrieval**: Attach a skillset with document search abilities so any MCP client can look up company knowledge, product documentation, or support articles during a conversation.
 *
 * **Workflow Automation**: Combine abilities like calendar access, email sending, and CRM lookups into a single skillset. AI assistants can then orchestrate multi-step workflows by calling the right tools in sequence.
 *
 * **Customer Support Agents**: Give AI agents access to tools for checking order status, issuing refunds, or updating account details - all through a secure MCP endpoint.
 *
 * **Content Generation Pipelines**: Expose tools for image generation, translation, or content formatting so AI applications can produce rich, multi-format output in a single session.
 */

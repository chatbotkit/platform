import { useState } from 'react'

import projects from '@/examples/catalogue/projects.yaml'

import prisma from '@/prisma/client'

import { formToData } from '@/lib/form'
import { getExternalAPIHostURL } from '@/lib/host'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Dashboard from '@/layouts/Dashboard'

import AutoTextarea from '@/components/AutoTextarea'
import CodeAction from '@/components/CodeAction'
import CodeBlock from '@/components/CodeBlock'
import { useConfirmDelete, useConfirmInfo } from '@/components/Confirm'
import DocsLink from '@/components/DocsLink'
import DynamicIcon from '@/components/DynamicIcon'
import Expando from '@/components/Expando'
import FAQ from '@/components/FAQ'
import Headline from '@/components/Headline'
import Link from '@/components/Link'
import List from '@/components/List'
import ManualLink from '@/components/ManualLink'
import MetaInput from '@/components/MetaInput'
import PageSections from '@/components/PageSections'
import SimpleTabs from '@/components/SimpleTabs'
import ThisSolution from '@/components/ThisSolution'
import TokenConfigInput from '@/components/TokenConfigInput'
import WebhookSetupSection from '@/components/WebhookSetupSection'

import useExternalAPIURL from '@/hooks/useExternalAPIURL'
import useFetch from '@/hooks/useFetch'
import useRouter from '@/hooks/useRouter'

import faq from '@/content/faqs/platform-token-instance.yaml'

export function Form({ token }) {
  const confirmDelete = useConfirmDelete()
  const confirmInfo = useConfirmInfo()

  const [updateCounter, setUpdateCounter] = useState(0)

  const router = useRouter()

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

    delete data.token

    if (token.id) {
      const { error } = await fetch(`/api/v1/token/${token.id}/update`, {
        data,

        successMessage: 'Token updated.',
      })

      if (!error) {
        Object.assign(token, data)

        setUpdateCounter((updateCounter) => updateCounter + 1)
      }
    } else {
      const { data: createdToken, error } = await fetch(
        `/api/v1/token/create`,
        {
          data,

          successMessage: 'Token created.',
        }
      )

      if (!error && createdToken?.id) {
        await confirmInfo(
          <WebhookSetupSection
            secrets={[
              {
                label: 'API Token',
                value: createdToken.token,
                type: 'reveal',
                description:
                  'This token grants access to your ChatBotKit account. Keep it secret and never commit it to version control.',
                required: true,
                copyMessage: 'API token copied to clipboard',
              },
            ]}
            instructions={[
              'Copy this token now and store it securely. It cannot be recovered after this popup is closed.',
              'Add it to your application as a protected environment variable.',
              'Delete this token and create a new one if it is ever exposed or compromised.',
            ]}
          />,
          { title: 'API Token Created' }
        )

        router.push(`/tokens/${createdToken.id}`)
      }
    }
  }

  async function handleDelete(event) {
    event.preventDefault()

    if (!(await confirmDelete('Do you really want to delete this token?'))) {
      return
    }

    const { error } = await fetch(`/api/v1/token/${token.id}/delete`, {
      data: {},
    })

    if (!error) {
      router.push(`/tokens`)
    }
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      <ThisSolution
        type="token"
        instance={token}
        updateKey={updateCounter}
        portal={true}
      />
      <form className="divided-area" onSubmit={handleOnSubmit}>
        <div className="divided-area">
          {/* token configuration */}
          <div>
            <Headline title="Token Configuration">
              This information is used to configure the token.
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
                    defaultValue={token.name}
                  />
                </div>
                <p className="input-description">
                  Type any name to recognize the token from others.
                </p>
              </div>
              {/* description */}
              <div>
                <label className="default-label" htmlFor="description">
                  Description
                </label>
                <div className="mt-1">
                  <AutoTextarea
                    className="default-input w-full"
                    name="description"
                    defaultValue={token.description}
                  />
                </div>
                <p className="input-description">
                  Type description to inform what this token is about. This
                  information is not used as part of your chatbot conversations.
                </p>
              </div>
              {/* advanced options */}
              <Expando
                titleClassName="default-link text-sm"
                title="Advanced Options"
              >
                {/* config */}
                <div>
                  <label className="default-label" htmlFor="config">
                    Config
                  </label>
                  <div className="mt-1">
                    <TokenConfigInput
                      name="config"
                      defaultConfig={token.config}
                    />
                  </div>
                  <p className="input-description">
                    Configure token access restrictions using glob patterns.
                    Select a template or define custom allowed routes. For more
                    information see the token configuration{' '}
                    <DocsLink className="default-link" slug="tokens">
                      documentation
                    </DocsLink>
                    .
                  </p>
                </div>
                {/* meta */}
                <div>
                  <label className="default-label" htmlFor="meta">
                    Meta
                  </label>
                  <div className="mt-1">
                    <MetaInput name="meta" defaultMeta={token.meta} />
                  </div>
                  <p className="input-description">
                    Custom metadata for this token.
                  </p>
                </div>
              </Expando>
            </div>
          </div>
        </div>
        {/* actions */}
        <div>
          <div className="action-area">
            {/* <BackLink className="default-button" href="/tokens">
              Back To Tokens
            </BackLink> */}
            {token.id ? (
              <button
                type="button"
                className="danger-button"
                onClick={handleDelete}
              >
                Delete
              </button>
            ) : null}
            <span className="action-area-space" />
            <button type="submit" className="primary-button">
              {token.id ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </>
  )
}

export default function Index({ token, apiEndpoint, examples }) {
  const getAPIURL = useExternalAPIURL()

  return (
    <>
      {/* <div className="main-page last">
        <NavHeader link="/tokens" caption="tokens" title="Token">
          <p>
            The token is a piece of information that is used to authenticate
            your API requests. This information is sensitive and should be kept
            secret.
          </p>
        </NavHeader>
      </div> */}
      <PageSections className="pt-12">
        <section data-page-section-title="Configuration">
          <div className="main-page first">
            <Form token={token} />
          </div>
        </section>
        {token.token ? (
          <section data-page-section-title="API Access">
            <div className="main-page">
              <Headline title="API Access Configuration">
                Use this token to authenticate your API requests with the
                ChatBotKit platform. It is shown only once and cannot be
                recovered after you leave or refresh this page.
              </Headline>
              <Expando
                titleClassName="default-link text-sm"
                title="Show Usage Instructions"
              >
                <WebhookSetupSection
                  endpoints={[
                    {
                      label: 'API Endpoint',
                      url: apiEndpoint,
                      description:
                        'Use this endpoint URL for all API requests. Include your token in the Authorization header.',
                      required: true,
                      copyMessage: 'API endpoint copied to clipboard',
                    },
                  ]}
                  secrets={[
                    {
                      label: 'API Token',
                      value: token.token,
                      type: 'reveal',
                      description:
                        'This token is sensitive and should be kept secret. Never share it publicly or commit it to version control.',
                      required: true,
                      copyMessage: 'API token copied to clipboard',
                    },
                  ]}
                  instructions={[
                    "Copy the token now and store it securely in your application's environment variables.",
                    'Use this token in the Authorization header or SDK configuration as shown in the examples below.',
                    'If you suspect your token has been compromised, delete this token and create a new one.',
                  ]}
                />
              </Expando>
            </div>
          </section>
        ) : null}
        <section data-page-section-title="Getting Started">
          <div className="main-page">
            <Headline title="Getting Started">
              Learn how to use your API token to authenticate requests with the
              ChatBotKit platform.
            </Headline>
            <div className="mt-6">
              <SimpleTabs
                tabs={{
                  'Node.js SDK': (
                    <div className="space-y-4">
                      <p className="text-sm auto-text-gray-500">
                        Install the ChatBotKit SDK for Node.js to get started
                        quickly:
                      </p>
                      <CodeBlock
                        className="text-xs"
                        language="bash"
                        copy={true}
                      >
                        npm install @chatbotkit/sdk
                      </CodeBlock>
                      <p className="text-sm">
                        Use your API token to authenticate requests:
                      </p>
                      <CodeBlock
                        className="text-xs"
                        language="javascript"
                        copy={true}
                      >
                        {`import { ChatBotKit } from '@chatbotkit/sdk'

const cbk = new ChatBotKit({
  secret: 'your-api-token-here'
})

// Example: Create a conversation
const conversation = await cbk.conversation.complete(null, {
  model: 'gpt-5',
  messages: [
    {
      type: 'user',
      text: 'Hello, how are you?'
    }
  ]
})`}
                      </CodeBlock>
                      <p>
                        <ManualLink
                          className="default-link text-sm"
                          slug="node-sdk"
                        >
                          Read more about the SDK here
                        </ManualLink>
                      </p>
                    </div>
                  ),
                  'Go SDK': (
                    <div className="space-y-4">
                      <p className="text-sm auto-text-gray-500">
                        Install the ChatBotKit SDK for Go to build
                        conversational AI applications:
                      </p>
                      <CodeBlock
                        className="text-xs"
                        language="bash"
                        copy={true}
                      >
                        go get github.com/chatbotkit/go-sdk
                      </CodeBlock>
                      <p className="text-sm">
                        Use your API token to authenticate requests:
                      </p>
                      <CodeBlock className="text-xs" language="go" copy={true}>
                        {`package main

import (
	"context"
	"fmt"
	"log"

	"github.com/chatbotkit/go-sdk/agent"
	"github.com/chatbotkit/go-sdk/sdk"
)

func main() {
	client := sdk.New(sdk.Options{
		Secret: "your-api-token-here",
	})

	result, err := agent.Complete(context.Background(), client, agent.CompleteOptions{
		Model: "gpt-5",
		Messages: []agent.Message{
			{Type: "user", Text: "Hello, how are you?"},
		},
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(result.Text)
}`}
                      </CodeBlock>
                      <p>
                        <ManualLink
                          className="default-link text-sm"
                          slug="go-sdk"
                        >
                          Read more about the Go SDK here
                        </ManualLink>
                      </p>
                    </div>
                  ),
                  'HTTP API': (
                    <div className="space-y-4">
                      <p className="text-sm auto-text-gray-500">
                        You can also use the HTTP API directly with any
                        programming language:
                      </p>
                      <CodeBlock
                        className="text-xs"
                        language="bash"
                        copy={true}
                      >
                        {`curl -X POST ${getAPIURL(
                          '/v1/conversation/complete'
                        )} \\
  -H "Authorization: Bearer your-api-token-here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-5",
    "messages": [
      {
        "type": "user",
        "text": "Hello, how are you?"
      }
    ]
  }'`}
                      </CodeBlock>
                      <p>
                        <ManualLink
                          className="default-link text-sm"
                          slug="spec/v1"
                        >
                          Read more about the HTTP API documentation
                        </ManualLink>
                      </p>
                    </div>
                  ),
                  Terraform: (
                    <div className="space-y-4">
                      <p className="text-sm auto-text-gray-500">
                        Manage ChatBotKit resources as infrastructure using the
                        Terraform provider:
                      </p>
                      <CodeBlock className="text-xs" language="hcl" copy={true}>
                        {`terraform {
  required_providers {
    chatbotkit = {
      source = "chatbotkit/chatbotkit"
    }
  }
}

provider "chatbotkit" {
  # api_key = "..." # Or set CHATBOTKIT_API_KEY env var
}`}
                      </CodeBlock>
                      <p className="text-sm">
                        Create and manage resources using Terraform:
                      </p>
                      <CodeBlock className="text-xs" language="hcl" copy={true}>
                        {`# Create a new bot
resource "chatbotkit_bot" "assistant" {
  name        = "Customer Support Bot"
  description = "Handles customer inquiries"
  backstory   = "You are a helpful customer support agent..."
  model       = "gpt-5"
}

# Create a dataset
resource "chatbotkit_dataset" "knowledge" {
  name        = "Product Knowledge Base"
  description = "Contains product documentation"
}`}
                      </CodeBlock>
                      <p>
                        <Link
                          className="default-link text-sm"
                          href="https://github.com/chatbotkit/terraform-provider-chatbotkit"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Read more about the Terraform provider
                        </Link>
                      </p>
                    </div>
                  ),
                  Examples: (
                    <div className="space-y-4">
                      <p className="text-sm auto-text-gray-500">
                        Explore these examples to see how to use your API token
                        with the ChatBotKit platform:
                      </p>
                      <List>
                        {examples.map((example) => (
                          <List.Item
                            key={example.slug}
                            icon={
                              <DynamicIcon
                                className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl"
                                icon={example.icon}
                              />
                            }
                            link={`/examples/${example.slug}`}
                            target="_blank"
                            title={example.title}
                            body={example.description}
                          >
                            {example.keywords?.slice(0, 3).map((keyword) => (
                              <div key={keyword} className="tag">
                                {keyword}
                              </div>
                            ))}
                          </List.Item>
                        ))}
                      </List>
                      <p>
                        <Link
                          className="default-link text-sm"
                          href="/examples?category=projects"
                          target="_blank"
                        >
                          View all examples
                        </Link>
                      </p>
                    </div>
                  ),
                }}
              />
            </div>
          </div>
        </section>
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { token }) {
  return (
    <Dashboard
      breadcrumbs={['Tokens', 'ChatBotKit']}
      title={token.name || token.id || 'New'}
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

  if (context.query.tokenId === 'new') {
    const examples = projects
      .slice(0, 5)
      .map(({ slug, icon, title, description, keywords }) => ({
        slug,
        icon,
        title,
        description,
        keywords,
      }))

    return {
      props: makeJsonSafe({
        token: {
          config: {},
        },
        apiEndpoint: getExternalAPIHostURL('/v1'),
        examples,
      }),
    }
  }

  const token = await prisma.token.findUnique({
    where: {
      id: context.query.tokenId,
    },

    select: {
      id: true,
      userId: true,
      name: true,
      description: true,
      config: true,
      meta: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!token) {
    return {
      notFound: true,
    }
  }

  if (token.userId !== session.user.id) {
    return {
      notFound: true,
    }
  }

  const examples = projects
    .slice(0, 5)
    .map(({ slug, icon, title, description, keywords }) => ({
      slug,
      icon,
      title,
      description,
      keywords,
    }))

  return {
    props: makeJsonSafe({
      token: token,

      apiEndpoint: getExternalAPIHostURL('/v1'),

      examples,
    }),
  }
}

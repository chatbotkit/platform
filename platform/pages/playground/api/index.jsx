import { memo, useState } from 'react'

import { parseRequest } from '@/lib/http'

import Dashboard from '@/layouts/Dashboard'

import AdvancedAutoTextarea from '@/components/AdvancedAutoTextarea'
import CodeAction from '@/components/CodeAction'
import CodeBlock from '@/components/CodeBlock'
import FAQ from '@/components/FAQ'
import List from '@/components/List'
import ManualLink from '@/components/ManualLink'
import NavHeader from '@/components/NavHeader'
import SendInstructions from '@/components/SendInstructions'

import useExternalAPIURL from '@/hooks/useExternalAPIURL'
import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'

import faq from '@/content/faqs/website-playground-api.yaml'

import { Squares2X2Icon } from '@heroicons/react/24/outline'

const examples = [
  // Conversation endpoints
  {
    name: 'List Conversations',
    description: 'List all conversations with pagination',
    request: 'GET /v1/conversation/list HTTP/1.1',
    tags: ['rest', 'conversation', 'list'],
  },
  {
    name: 'Fetch Conversation',
    description: 'Retrieve a specific conversation by ID',
    request: 'GET /v1/conversation/{conversationId}/fetch HTTP/1.1',
    tags: ['rest', 'conversation', 'fetch'],
  },
  {
    name: 'Create Conversation',
    description: 'Create a new conversation with a bot',
    request: `POST /v1/conversation/create HTTP/1.1\nContent-Type: application/json\n\n{\n  "botId": "bot-123",\n  "name": "Customer Support Chat",\n  "description": "Support conversation"\n}`,
    tags: ['rest', 'conversation', 'create'],
  },
  {
    name: 'Update Conversation',
    description: 'Update an existing conversation',
    request: `POST /v1/conversation/{conversationId}/update HTTP/1.1\nContent-Type: application/json\n\n{\n  "name": "Updated Conversation Name"\n}`,
    tags: ['rest', 'conversation', 'update'],
  },
  {
    name: 'Delete Conversation',
    description: 'Delete a conversation',
    request: 'POST /v1/conversation/{conversationId}/delete HTTP/1.1',
    tags: ['rest', 'conversation', 'delete'],
  },

  // Message endpoints
  {
    name: 'Create Message',
    description: 'Create a message in a conversation',
    request: `POST /v1/conversation/{conversationId}/message/create HTTP/1.1\nContent-Type: application/json\n\n{\n  "type": "user",\n  "text": "Hello, how can you help me?"\n}`,
    tags: ['rest', 'message', 'create'],
  },
  {
    name: 'List Messages',
    description: 'List all messages in a conversation',
    request: 'GET /v1/conversation/{conversationId}/message/list HTTP/1.1',
    tags: ['rest', 'message', 'list'],
  },

  // Bot endpoints
  {
    name: 'List Bots',
    description: 'List all bots',
    request: 'GET /v1/bot/list HTTP/1.1',
    tags: ['rest', 'bot', 'list'],
  },
  {
    name: 'Fetch Bot',
    description: 'Retrieve a specific bot by ID',
    request: 'GET /v1/bot/{botId}/fetch HTTP/1.1',
    tags: ['rest', 'bot', 'fetch'],
  },
  {
    name: 'Create Bot',
    description: 'Create a new bot',
    request: `POST /v1/bot/create HTTP/1.1\nContent-Type: application/json\n\n{\n  "name": "My Assistant",\n  "description": "A helpful AI assistant",\n  "backstory": "You are a helpful assistant.",\n  "model": "gpt-4o"\n}`,
    tags: ['rest', 'bot', 'create'],
  },
  {
    name: 'Update Bot',
    description: 'Update an existing bot',
    request: `POST /v1/bot/{botId}/update HTTP/1.1\nContent-Type: application/json\n\n{\n  "name": "Updated Bot Name",\n  "backstory": "Updated backstory"\n}`,
    tags: ['rest', 'bot', 'update'],
  },
  {
    name: 'Delete Bot',
    description: 'Delete a bot',
    request: 'POST /v1/bot/{botId}/delete HTTP/1.1',
    tags: ['rest', 'bot', 'delete'],
  },

  // Dataset endpoints
  {
    name: 'List Datasets',
    description: 'List all datasets',
    request: 'GET /v1/dataset/list HTTP/1.1',
    tags: ['rest', 'dataset', 'list'],
  },
  {
    name: 'Fetch Dataset',
    description: 'Retrieve a specific dataset by ID',
    request: 'GET /v1/dataset/{datasetId}/fetch HTTP/1.1',
    tags: ['rest', 'dataset', 'fetch'],
  },
  {
    name: 'Create Dataset',
    description: 'Create a new dataset',
    request: `POST /v1/dataset/create HTTP/1.1\nContent-Type: application/json\n\n{\n  "name": "My Knowledge Base",\n  "description": "Customer FAQ dataset"\n}`,
    tags: ['rest', 'dataset', 'create'],
  },
  {
    name: 'Update Dataset',
    description: 'Update an existing dataset',
    request: `POST /v1/dataset/{datasetId}/update HTTP/1.1\nContent-Type: application/json\n\n{\n  "name": "Updated Dataset Name"\n}`,
    tags: ['rest', 'dataset', 'update'],
  },
  {
    name: 'Delete Dataset',
    description: 'Delete a dataset',
    request: 'POST /v1/dataset/{datasetId}/delete HTTP/1.1',
    tags: ['rest', 'dataset', 'delete'],
  },

  // Record endpoints
  {
    name: 'Create Record',
    description: 'Create a record in a dataset',
    request: `POST /v1/dataset/{datasetId}/record/create HTTP/1.1\nContent-Type: application/json\n\n{\n  "text": "This is a knowledge base entry",\n  "name": "FAQ Entry"\n}`,
    tags: ['rest', 'record', 'create'],
  },
  {
    name: 'List Records',
    description: 'List all records in a dataset',
    request: 'GET /v1/dataset/{datasetId}/record/list HTTP/1.1',
    tags: ['rest', 'record', 'list'],
  },

  // File endpoints
  {
    name: 'List Files',
    description: 'List all files',
    request: 'GET /v1/file/list HTTP/1.1',
    tags: ['rest', 'file', 'list'],
  },
  {
    name: 'Fetch File',
    description: 'Retrieve a specific file by ID',
    request: 'GET /v1/file/{fileId}/fetch HTTP/1.1',
    tags: ['rest', 'file', 'fetch'],
  },
  {
    name: 'Upload File',
    description: 'Upload a file',
    request: `POST /v1/file/upload HTTP/1.1\nContent-Type: multipart/form-data\n\n[Binary file data]`,
    tags: ['rest', 'file', 'upload'],
  },

  // Skillset endpoints
  {
    name: 'List Skillsets',
    description: 'List all skillsets',
    request: 'GET /v1/skillset/list HTTP/1.1',
    tags: ['rest', 'skillset', 'list'],
  },
  {
    name: 'Create Skillset',
    description: 'Create a new skillset',
    request: `POST /v1/skillset/create HTTP/1.1\nContent-Type: application/json\n\n{\n  "name": "My Skillset",\n  "description": "Custom bot abilities"\n}`,
    tags: ['rest', 'skillset', 'create'],
  },

  // Integration endpoints
  {
    name: 'List Widget Integrations',
    description: 'List all widget integrations',
    request: 'GET /v1/integration/widget/list HTTP/1.1',
    tags: ['rest', 'integration', 'widget', 'list'],
  },
  {
    name: 'Create Widget Integration',
    description: 'Create a widget integration',
    request: `POST /v1/integration/widget/create HTTP/1.1\nContent-Type: application/json\n\n{\n  "name": "Website Widget",\n  "botId": "bot-123"\n}`,
    tags: ['rest', 'integration', 'widget', 'create'],
  },

  // Report endpoints
  {
    name: 'Generate Alerts Report',
    description:
      'Get usage spike alerts, limit warnings, and feedback sentiment alerts',
    request: `POST /v1/platform/report/generate HTTP/1.1\nContent-Type: application/json\n\n{\n  "clr3m5n8k000f08jqcs1u2v6p": {\n    "periodDays": 30\n  }\n}`,
    tags: ['rest', 'report', 'alerts', 'usage'],
  },
  {
    name: 'Generate Dataset Records Report',
    description: 'Get the total number of records for a list of datasets',
    request: `POST /v1/platform/report/generate HTTP/1.1\nContent-Type: application/json\n\n{\n  "cm7k3m5n8k000008jq7h9e5b1a": {\n    "datasetIds": ["dataset-123", "dataset-456"]\n  }\n}`,
    tags: ['rest', 'report', 'dataset', 'records'],
  },
]

function ExamplesDialog() {
  const getAPIURL = useExternalAPIURL()
  const apiBase = getAPIURL('/v1')

  const localizedExamples = examples.map((ex) => ({
    ...ex,
    request: ex.request.replace('https://api.chatbotkit.com/v1', apiBase),
  }))

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const [request, setRequest] = useState('')

  const [search, setSearch] = useState('')

  return (
    <div>
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="request" value={request} />
      <div className="space-y-4 max-h-[500px] h-screen flex flex-col">
        <p className="text-sm">
          Select an API request example from the list below.
        </p>
        <input
          className="default-input w-full"
          type="search"
          placeholder="Search..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="flex-1 h-full overflow-auto">
          <List>
            {localizedExamples
              .filter(({ name, description, tags }) => {
                if (search) {
                  return (
                    name.toLowerCase().includes(search.toLowerCase()) ||
                    description.toLowerCase().includes(search.toLowerCase()) ||
                    (tags &&
                      tags.some((tag) =>
                        tag.toLowerCase().includes(search.toLowerCase())
                      ))
                  )
                } else {
                  return true
                }
              })
              .map((ex, idx) => (
                <List.Item
                  key={idx}
                  className={request === ex.request ? 'selected' : ''}
                  title={ex.name}
                  body={ex.description}
                  onClick={() => {
                    setName(ex.name)
                    setDescription(ex.description)
                    setRequest(ex.request)
                  }}
                >
                  <div className="space-y-2 w-full">
                    {ex.tags?.length > 0 ? (
                      <div className="space-x-1">
                        {ex.tags.map((tag, index) => (
                          <span key={index} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </List.Item>
              ))}
          </List>
        </div>
      </div>
    </div>
  )
}

function useExampleDialog() {
  const { popup, openPopup, closePopup } = usePopup()

  function open(options) {
    openPopup(<ExamplesDialog />, {
      title: 'API Request Examples',
      actions: {
        Use: {
          default: true,

          async fn(props) {
            options.callback(props)
            closePopup()
          },
        },
      },
    })
  }

  function close() {
    closePopup()
  }

  return [popup, open, close]
}

export function DataViewer({ data }) {
  return data ? (
    <CodeBlock className="text-xs max-h-96" language="json">
      {JSON.stringify({ ...data }, '', 2)}
    </CodeBlock>
  ) : null
}

DataViewer.Memo = memo(DataViewer)

export default function Index() {
  const getAPIURL = useExternalAPIURL()

  const [request, setRequest] = useState(
    () => `GET ${getAPIURL('/v1/conversation/list')} HTTP/1.1`
  )

  const { fetch, code, loading, data } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const [exampleDialog, openExampleDialog] = useExampleDialog()

  async function sendRequest() {
    if (!request) {
      return
    }

    const req = parseRequest(request, '\n')

    const url = new URL(req.uri, window.location.origin)

    url.protocol = window.location.protocol
    url.hostname = window.location.hostname

    if (!url.pathname.startsWith('/api')) {
      url.pathname = `/api${url.pathname}`
    }

    await fetch(url.toString(), {
      method: req.method,

      headers: req.headers,

      body: req.method !== 'GET' ? req.body : undefined,
    })
  }

  async function handleOnKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.keyCode === 13) {
      event.preventDefault()
      event.stopPropagation()

      try {
        await sendRequest()
      } catch {
        // ignore
      }
    }
  }

  async function handleOnClick(event) {
    event.preventDefault()
    event.stopPropagation()

    try {
      sendRequest()
    } catch {
      // ignore
    }
  }

  return (
    <>
      <CodeAction code={code} />
      {exampleDialog}
      <section className="section-white">
        <div className="main-page">
          <NavHeader
            link="/playground"
            caption="playgrounds"
            title="API"
            beta={true}
          >
            Test REST API endpoints directly in your browser. Send requests,
            inspect responses, or use the{' '}
            <ManualLink className="default-link" slug="spec/v1">
              Swagger spec
            </ManualLink>{' '}
            for interactive API documentation.
          </NavHeader>
          <div className="space-y-2">
            <div className="relative">
              <AdvancedAutoTextarea
                className="default-input !font-mono"
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                onKeyDown={handleOnKeyDown}
                spellCheck={false}
                disabled={loading}
              >
                <button
                  className="default-button tiny push"
                  type="button"
                  title="API Examples"
                  onClick={() => {
                    openExampleDialog({
                      callback: (example) => {
                        setRequest(example.request)
                      },
                    })
                  }}
                  disabled={loading}
                >
                  <Squares2X2Icon className="w-5 h-5" />
                </button>
                <button
                  className="primary-button small push"
                  type="button"
                  onClick={handleOnClick}
                  disabled={loading}
                >
                  Send Request
                </button>
              </AdvancedAutoTextarea>
            </div>
            <SendInstructions message="send request" />
          </div>
          <div>
            <DataViewer.Memo data={data} />
          </div>
        </div>
      </section>
    </>
  )
}

Index.getLayout = function (children) {
  return (
    <Dashboard
      breadcrumbs={['Playground', 'Platform']}
      title="API Playground"
      description="Test REST API endpoints directly in your browser. Send requests, inspect responses, and debug integrations with real-time feedback."
      keywords="api, playground, rest, endpoints, testing"
      image={`/playground/api/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 100
 *
 * ## API
 *
 * The [API Playground](https://chatbotkit.com/playground/api) lets you test REST API endpoints directly in the browser. You can send requests, inspect responses, and work through example operations without building a separate client first.
 *
 * Use it when you want to validate request shapes, debug authentication or payload issues, or learn the API surface through hands-on experimentation.
 */

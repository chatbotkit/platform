import { memo, useState } from 'react'

import Dashboard from '@/layouts/Dashboard'

import AdvancedAutoTextarea from '@/components/AdvancedAutoTextarea'
import CodeAction from '@/components/CodeAction'
import CodeBlock from '@/components/CodeBlock'
import FAQ from '@/components/FAQ'
import Link from '@/components/Link'
import List from '@/components/List'
import NavHeader from '@/components/NavHeader'
import ObjectInput from '@/components/ObjectInput'
import SendInstructions from '@/components/SendInstructions'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'

import faq from '@/content/faqs/website-playground-graphql.yaml'

import { Squares2X2Icon } from '@heroicons/react/24/outline'

// @todo the variables from the object are not properly set in the input field

const examples = [
  // Query examples - Bots
  {
    name: 'List Bots',
    description: 'List all bots with their basic information',
    query: `query {
  bots {
    edges {
      node {
        id
        name
        description
        backstory
        model
      }
    }
  }
}`,
    variables: null,
    tags: ['bots', 'list', 'query'],
  },
  {
    name: 'List Bots with Pagination',
    description: 'List bots with pagination and filters',
    query: `query ListBots($first: Int, $after: String) {
  bots(first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        name
        description
        model
        createdAt
        updatedAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`,
    variables: {
      first: 10,
      after: null,
    },
    tags: ['bots', 'list', 'query', 'pagination', 'variables'],
  },
  {
    name: 'Filter Bots by ID',
    description: 'Filter bots using botIds parameter',
    query: `query FilterBots($botIds: [ID!]) {
  bots(botIds: $botIds) {
    edges {
      node {
        id
        name
        description
        backstory
        model
        privacy
        moderation
      }
    }
  }
}`,
    variables: {
      botIds: ['bot_xxxxxx'],
    },
    tags: ['bots', 'filter', 'query', 'variables'],
  },

  // Query examples - Conversations
  {
    name: 'List Conversations',
    description: 'List all conversations with pagination',
    query: `query {
  conversations(first: 20) {
    edges {
      cursor
      node {
        id
        name
        createdAt
        updatedAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`,
    variables: null,
    tags: ['conversations', 'list', 'query', 'pagination'],
  },
  {
    name: 'Filter Conversations by Bot',
    description: 'Filter conversations by bot IDs',
    query: `query FilterConversations($botIds: [ID!], $first: Int) {
  conversations(botIds: $botIds, first: $first) {
    edges {
      cursor
      node {
        id
        name
        createdAt
        updatedAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`,
    variables: {
      botIds: ['bot_xxxxxx'],
      first: 10,
    },
    tags: ['conversations', 'filter', 'query', 'variables'],
  },

  // Query examples - Datasets
  {
    name: 'List Datasets',
    description: 'List all datasets',
    query: `query {
  datasets {
    edges {
      node {
        id
        name
        description
        createdAt
        updatedAt
      }
    }
  }
}`,
    variables: null,
    tags: ['datasets', 'list', 'query'],
  },
  {
    name: 'List Datasets with Pagination',
    description: 'List datasets with pagination',
    query: `query ListDatasets($first: Int, $after: String) {
  datasets(first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        name
        description
        createdAt
        updatedAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`,
    variables: {
      first: 10,
      after: null,
    },
    tags: ['datasets', 'list', 'query', 'pagination', 'variables'],
  },

  // Query examples - Skillsets
  {
    name: 'List Skillsets',
    description: 'List all skillsets',
    query: `query {
  skillsets {
    edges {
      node {
        id
        name
        description
        createdAt
        updatedAt
      }
    }
  }
}`,
    variables: null,
    tags: ['skillsets', 'list', 'query'],
  },

  // Query examples - Files
  {
    name: 'List Files',
    description: 'List all files',
    query: `query {
  files {
    edges {
      node {
        id
        name
        description
        type
        createdAt
        updatedAt
      }
    }
  }
}`,
    variables: null,
    tags: ['files', 'list', 'query'],
  },

  // Query examples - Messages
  {
    name: 'List Messages',
    description: 'List messages in conversations',
    query: `query {
  messages(first: 20) {
    edges {
      cursor
      node {
        id
        type
        text
        createdAt
        updatedAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`,
    variables: null,
    tags: ['messages', 'list', 'query', 'pagination'],
  },

  // Query examples - Contacts
  {
    name: 'List Contacts',
    description: 'List all contacts',
    query: `query {
  contacts {
    edges {
      node {
        id
        name
        description
        email
        phone
        createdAt
        updatedAt
      }
    }
  }
}`,
    variables: null,
    tags: ['contacts', 'list', 'query'],
  },

  // Query examples - Platform Examples
  {
    name: 'List Platform Examples',
    description: 'List platform examples with pagination',
    query: `query {
  platformExamples(first: 20) {
    edges {
      cursor
      node {
        id
        name
        description
        type
        url
        keywords
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`,
    variables: null,
    tags: ['examples', 'list', 'platform', 'query', 'pagination'],
  },
  {
    name: 'Search Platform Examples',
    description: 'Search platform examples using semantic similarity',
    query: `query SearchExamples($search: String!, $first: Int) {
  platformExamples(search: $search, first: $first) {
    edges {
      cursor
      node {
        id
        name
        description
        type
        url
        keywords
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`,
    variables: {
      search: 'chatbot',
      first: 10,
    },
    tags: ['examples', 'search', 'platform', 'query', 'variables'],
  },

  // Query examples - User
  {
    name: 'Get Current User',
    description: 'Fetch the current authenticated user',
    query: `query {
  me {
    id
    name
    description
    goal
  }
}`,
    variables: null,
    tags: ['user', 'me', 'query'],
  },

  // Mutation examples - Bots
  {
    name: 'Create Bot',
    description: 'Create a new bot using a mutation',
    query: `mutation CreateBot($input: BotCreateRequest!) {
  createBot(input: $input) {
    id
    name
    description
    backstory
    model
  }
}`,
    variables: {
      input: {
        name: 'My New Bot',
        description: 'A helpful assistant',
        backstory: 'You are a helpful AI assistant.',
        model: 'gpt-4o',
      },
    },
    tags: ['bots', 'create', 'mutation', 'variables'],
  },
  {
    name: 'Update Bot',
    description: 'Update an existing bot',
    query: `mutation UpdateBot($botId: ID!, $input: BotUpdateRequest!) {
  updateBot(botId: $botId, input: $input) {
    id
    name
    description
    backstory
  }
}`,
    variables: {
      botId: 'bot_xxxxxx',
      input: {
        name: 'Updated Bot Name',
        description: 'Updated description',
      },
    },
    tags: ['bots', 'update', 'mutation', 'variables'],
  },
  {
    name: 'Delete Bot',
    description: 'Delete a bot',
    query: `mutation DeleteBot($botId: ID!) {
  deleteBot(botId: $botId) {
    id
  }
}`,
    variables: {
      botId: 'bot_xxxxxx',
    },
    tags: ['bots', 'delete', 'mutation', 'variables'],
  },

  // Mutation examples - Datasets
  {
    name: 'Create Dataset',
    description: 'Create a new dataset',
    query: `mutation CreateDataset($input: DatasetCreateRequest!) {
  createDataset(input: $input) {
    id
    name
    description
  }
}`,
    variables: {
      input: {
        name: 'My Knowledge Base',
        description: 'Custom dataset for bot knowledge',
      },
    },
    tags: ['datasets', 'create', 'mutation', 'variables'],
  },
  {
    name: 'Update Dataset',
    description: 'Update an existing dataset',
    query: `mutation UpdateDataset($datasetId: ID!, $input: DatasetUpdateRequest!) {
  updateDataset(datasetId: $datasetId, input: $input) {
    id
    name
    description
  }
}`,
    variables: {
      datasetId: 'dataset_xxxxxx',
      input: {
        name: 'Updated Dataset Name',
      },
    },
    tags: ['datasets', 'update', 'mutation', 'variables'],
  },
  {
    name: 'Delete Dataset',
    description: 'Delete a dataset',
    query: `mutation DeleteDataset($datasetId: ID!) {
  deleteDataset(datasetId: $datasetId) {
    id
  }
}`,
    variables: {
      datasetId: 'dataset_xxxxxx',
    },
    tags: ['datasets', 'delete', 'mutation', 'variables'],
  },

  // Mutation examples - Skillsets
  {
    name: 'Create Skillset',
    description: 'Create a new skillset',
    query: `mutation CreateSkillset($input: SkillsetCreateRequest!) {
  createSkillset(input: $input) {
    id
    name
    description
  }
}`,
    variables: {
      input: {
        name: 'My Skillset',
        description: 'Custom abilities for the bot',
      },
    },
    tags: ['skillsets', 'create', 'mutation', 'variables'],
  },
  {
    name: 'Update Skillset',
    description: 'Update an existing skillset',
    query: `mutation UpdateSkillset($skillsetId: ID!, $input: SkillsetUpdateRequest!) {
  updateSkillset(skillsetId: $skillsetId, input: $input) {
    id
    name
    description
  }
}`,
    variables: {
      skillsetId: 'skillset_xxxxxx',
      input: {
        name: 'Updated Skillset Name',
      },
    },
    tags: ['skillsets', 'update', 'mutation', 'variables'],
  },
  {
    name: 'Delete Skillset',
    description: 'Delete a skillset',
    query: `mutation DeleteSkillset($skillsetId: ID!) {
  deleteSkillset(skillsetId: $skillsetId) {
    id
  }
}`,
    variables: {
      skillsetId: 'skillset_xxxxxx',
    },
    tags: ['skillsets', 'delete', 'mutation', 'variables'],
  },
]

function ExamplesDialog() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [query, setQuery] = useState('')
  const [variables, setVariables] = useState(null)

  const [search, setSearch] = useState('')

  return (
    <div>
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="query" value={query} />
      <input
        type="hidden"
        name="variables"
        value={variables ? JSON.stringify(variables) : ''}
      />
      <div className="space-y-4 max-h-[500px] h-screen flex flex-col">
        <p className="text-sm">
          Select a GraphQL query example from the list below.
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
            {examples
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
                  className={query === ex.query ? 'selected' : ''}
                  title={ex.name}
                  body={ex.description}
                  onClick={() => {
                    setName(ex.name)
                    setDescription(ex.description)
                    setQuery(ex.query)
                    setVariables(ex.variables)
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
      title: 'GraphQL Query Examples',
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
    <CodeBlock className="text-xs" language="json">
      {JSON.stringify({ ...data }, '', 2)}
    </CodeBlock>
  ) : null
}

DataViewer.Memo = memo(DataViewer)

export default function Index() {
  const [query, setQuery] = useState(`query {
  bots {
    edges {
      node {
        id
        name
        description
      }
    }
  }
}`)

  const [variablesObject, setVariablesObject] = useState(null)

  const { fetch, code, loading, data } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const [exampleDialog, openExampleDialog] = useExampleDialog()

  async function sendRequest() {
    if (!query) {
      return
    }

    const url = new URL('/api/v1/graphql', window.location.origin)

    url.protocol = window.location.protocol
    url.hostname = window.location.hostname

    const body = {
      query,
      ...(variablesObject && { variables: variablesObject }),
    }

    await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  async function handleOnQueryKeyDown(event) {
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
      await sendRequest()
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
            title="GraphQL"
            beta={true}
          >
            Test GraphQL queries and mutations directly in your browser. Explore
            the schema, run operations with variables, or use the{' '}
            <Link
              className="default-link"
              href="/playground/api"
              rel="noopener"
            >
              API Playground
            </Link>{' '}
            for REST endpoint testing.
          </NavHeader>
          <div className="space-y-2">
            <div className="relative">
              <AdvancedAutoTextarea
                className="default-input !font-mono"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleOnQueryKeyDown}
                disabled={loading}
                placeholder="Enter your GraphQL query or mutation..."
              >
                <button
                  className="default-button tiny push"
                  type="button"
                  title="GraphQL Examples"
                  onClick={() => {
                    openExampleDialog({
                      callback: (example) => {
                        setQuery(example.query)
                        setVariablesObject(
                          example.variables
                            ? JSON.parse(example.variables)
                            : null
                        )
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
            <ObjectInput
              className="default-input"
              object={variablesObject}
              setObject={setVariablesObject}
              disabled={loading}
              placeholder={'search: chatbot\nfirst: 10'}
            />
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
      title="GraphQL Playground"
      description="Test GraphQL queries and mutations directly in your browser. Explore the schema, run operations with variables, and debug responses."
      keywords="graphql, playground, api, queries, mutations"
      image={`/playground/graphql/card`}
    >
      {children}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

/**
 * @doc Playgrounds
 * @index 110
 *
 * ## GraphQL
 *
 * The [GraphQL Playground](https://chatbotkit.com/playground/graphql) gives you an interface for testing GraphQL queries and mutations. You can explore the schema, run operations with variables, and inspect response data as you build integrations.
 *
 * Use it when you want to prototype GraphQL operations quickly, verify returned fields, or debug variables and payload structure before wiring them into an application.
 */

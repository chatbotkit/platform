'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'

import { getExternalAPIHost, getExternalAPIHostURL } from '@/lib/host'
import { LuBookMarked, LuCopy, LuRefreshCcw, LuSearch } from 'react-icons/lu'

import toast from '@/lib/toast'

import CodeBlock from '@/components/CodeBlock'
import CopyButton from '@/components/CopyButton'
import Pagedown from '@/components/Pagedown'
import TimeAgo from '@/components/TimeAgo'

import {
  AppToolbar,
  ToolbarButton,
  ToolbarSearch,
  ToolbarSelect,
  ToolbarStatus,
} from '@/app/apps/_components/Toolbar'

import { fetchSpecOperation, listSpecOperations } from './server'

import clsx from 'clsx'

const METHOD_ORDER = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
]

function humanizeOperationId(value = '') {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}

function methodBadgeClass(method = 'get') {
  switch (method) {
    case 'get':
    case 'head':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
    case 'post':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300'
    case 'put':
    case 'patch':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
    case 'delete':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
    default:
      return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
  }
}

function formatOptionalValue(value, fallback = 'n/a') {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  return value
}

function Toolbar({
  filter,
  setFilter,
  method,
  setMethod,
  group,
  setGroup,
  groups,
  loading,
  updatedAt,
  onRefresh,
}) {
  return (
    <AppToolbar>
      <ToolbarButton onClick={onRefresh} title="Refresh" disabled={loading}>
        <LuRefreshCcw
          className={clsx('h-3.5 w-3.5', {
            'animate-spin': loading,
          })}
        />
        <span className="inline-block text-left">Refresh</span>
      </ToolbarButton>

      <ToolbarSearch
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search endpoints, operations, paths..."
        icon={<LuSearch className="h-3.5 w-3.5" />}
      />

      <ToolbarSelect value={method} onChange={(e) => setMethod(e.target.value)}>
        <option value="">All Methods</option>
        {METHOD_ORDER.map((m) => (
          <option key={m} value={m}>
            {m.toUpperCase()}
          </option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect value={group} onChange={(e) => setGroup(e.target.value)}>
        <option value="">All Sections</option>
        {groups.map((g) => (
          <option key={g.key} value={g.key}>
            {g.title}
          </option>
        ))}
      </ToolbarSelect>

      <ToolbarStatus>
        {updatedAt ? (
          <>
            Updated <TimeAgo time={updatedAt} tooltip />
          </>
        ) : (
          'Not Updated'
        )}
      </ToolbarStatus>
    </AppToolbar>
  )
}

function OperationRow({ item, groupTitle, selected, onClick }) {
  return (
    <button
      type="button"
      className={clsx(
        'w-full border-b border-gray-100 px-4 py-3 text-left transition-colors dark:border-gray-900',
        'hover:auto-bg-gray-100',
        {
          'auto-bg-gray-100': selected,
        }
      )}
      onClick={() => onClick(item.slug)}
    >
      <div className="mb-1 flex flex-row items-start gap-3">
        <span
          className={clsx(
            'inline-flex h-5 shrink-0 items-center rounded border px-1.5 text-[10px] font-semibold uppercase',
            methodBadgeClass(item.method)
          )}
        >
          {item.method}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium auto-text-gray-900">
            {item.title}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">
            /v1{item.path}
          </div>
        </div>
      </div>

      {item.summary ? (
        <div className="truncate text-xs text-gray-600 dark:text-gray-300">
          {item.summary}
        </div>
      ) : null}

      {groupTitle ? (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="tag text-[10px]">{groupTitle}</span>
        </div>
      ) : null}
    </button>
  )
}

const OperationRowMemo = memo(OperationRow)

function OperationList({
  items,
  groupTitleBySlug,
  selectedSlug,
  setSelectedSlug,
  loading,
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto subtle-scrollbar">
      {items.map((item) => (
        <OperationRowMemo
          key={item.slug}
          item={item}
          groupTitle={groupTitleBySlug.get(item.slug)}
          selected={item.slug === selectedSlug}
          onClick={setSelectedSlug}
        />
      ))}

      {items.length === 0 ? (
        <div className="flex h-full items-center justify-center p-8 text-center font-mono text-xs text-gray-400">
          {loading
            ? 'Loading operations...'
            : 'No endpoints match the current filters'}
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-gray-200 p-3 dark:border-gray-800">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-1 truncate font-mono text-xs auto-text-gray-900">
        {formatOptionalValue(value)}
      </div>
    </div>
  )
}

function Section({ title, badge, children }) {
  return (
    <section className="rounded border border-gray-200 dark:border-gray-800">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-800">
        <h2 className="text-sm font-semibold auto-text-gray-900">{title}</h2>
        {badge ? (
          <span className="text-[10px] font-semibold uppercase text-gray-400">
            {badge}
          </span>
        ) : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Inspector({ operation, loading }) {
  if (!operation) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center p-8 text-center font-mono text-xs text-gray-400">
        {loading
          ? 'Loading endpoint details...'
          : 'Select an endpoint to inspect its parameters, request body, and example code.'}
      </div>
    )
  }

  const title = humanizeOperationId(operation.operationId)
  const requestSchema =
    operation?.requestBody?.content?.['application/json']?.schema

  const parameters = (operation.parameters || []).filter(
    (item) => item?.name && item?.schema
  )

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="border-b border-gray-200 p-4 dark:border-gray-800">
        <div className="flex flex-row flex-wrap items-center gap-2">
          <span
            className={clsx(
              'inline-flex h-5 shrink-0 items-center rounded border px-1.5 text-[10px] font-semibold uppercase',
              methodBadgeClass(operation.method)
            )}
          >
            {operation.method}
          </span>
          <code className="truncate font-mono text-xs auto-text-gray-900">
            /v1{operation.path}
          </code>
          <CopyButton
            text={getExternalAPIHostURL(`/v1${operation.path}`)}
            message="Endpoint URL copied to your clipboard"
            className="tag hover:tag-darker ml-auto inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 px-2 text-[11px] leading-none"
          >
            <LuCopy className="h-3 w-3" />
            Copy URL
          </CopyButton>
        </div>

        <h1 className="mt-2 truncate text-lg font-semibold auto-text-gray-900">
          {title}
        </h1>
        <div className="mt-1 truncate font-mono text-[11px] text-gray-500">
          {operation.operationId}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Method" value={operation.method?.toUpperCase()} />
          <Stat
            label="Auth"
            value={operation.security?.length ? 'Bearer' : 'None'}
          />
          <Stat
            label="Request Body"
            value={requestSchema ? 'application/json' : 'None'}
          />
          <Stat label="Parameters" value={parameters.length || '0'} />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {operation.description ? (
          <Section title="Description">
            <div className="content-prose prose-code:before:content-none prose-code:after:content-none">
              <Pagedown>{operation.description}</Pagedown>
            </div>
          </Section>
        ) : null}

        {operation.security?.length ? (
          <Section title="Authorization" badge="Required">
            <div className="space-y-2 text-sm auto-text-gray-700">
              <p>
                <span className="font-medium">ChatBotKit API Secret</span>
              </p>
              <p className="text-xs">
                HTTP Authorization Scheme:{' '}
                <code className="rounded auto-bg-gray-100 px-1.5 py-0.5 auto-text-gray-900">
                  bearer
                </code>
              </p>
            </div>
          </Section>
        ) : null}

        {parameters.length ? (
          <Section title="Parameters">
            <div className="space-y-3">
              {parameters.map((item) => (
                <div
                  key={`${item.in}-${item.name}`}
                  className="border-b auto-border-gray-100 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium auto-text-gray-900">
                      {item.name}
                    </p>
                    <span className="tag text-[10px] uppercase">{item.in}</span>
                    <span className="tag text-[10px]">
                      {item.schema?.type || 'unknown'}
                    </span>
                    {item.required ? (
                      <span className="text-[10px] font-semibold uppercase text-gray-400">
                        Required
                      </span>
                    ) : null}
                  </div>
                  {item.description || item.schema?.description ? (
                    <p className="mt-1 text-xs auto-text-gray-600">
                      {item.description || item.schema?.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {requestSchema ? (
          <Section
            title="Request Body"
            badge={operation.requestBody?.required ? 'Required' : null}
          >
            <p className="text-xs auto-text-gray-600">
              Schema:{' '}
              <code className="rounded auto-bg-gray-100 px-1.5 py-0.5 auto-text-gray-900">
                application/json
              </code>
            </p>
            <RequestBodyTable schema={requestSchema} />
          </Section>
        ) : null}

        <Section title="Request">
          <RequestCodeBlock
            requestSchema={requestSchema}
            method={operation.method}
            path={operation.path}
          />
        </Section>

        <Section title="Response">
          <ResponseCodeBlock responses={operation.responses} />
        </Section>
      </div>
    </div>
  )
}

function getSchemaProperties(schema) {
  const properties = { ...(schema?.properties || {}) }

  if (schema?.oneOf?.[0]) {
    Object.assign(properties, getSchemaProperties(schema.oneOf[0]))
  }

  if (Array.isArray(schema?.allOf)) {
    schema.allOf.forEach((item) => {
      Object.assign(properties, getSchemaProperties(item))
    })
  }

  return properties
}

function isSchemaObjectLike(schema) {
  if (!schema) {
    return false
  }

  return (
    schema.type === 'object' ||
    !!schema.properties ||
    !!schema.oneOf?.length ||
    !!schema.allOf?.length
  )
}

function isSchemaArrayLike(schema) {
  return !!schema && (schema.type === 'array' || !!schema.items)
}

function getSchemaRequired(schema) {
  const required = new Set(schema?.required || [])

  if (schema?.oneOf?.[0]) {
    getSchemaRequired(schema.oneOf[0]).forEach((field) => required.add(field))
  }

  if (Array.isArray(schema?.allOf)) {
    schema.allOf.forEach((item) => {
      getSchemaRequired(item).forEach((field) => required.add(field))
    })
  }

  return required
}

function getSchemaTypeLabel(schema) {
  if (!schema) {
    return 'unknown'
  }

  if (isSchemaArrayLike(schema)) {
    const itemType = getSchemaTypeLabel(schema.items)

    return itemType ? `array<${itemType}>` : 'array'
  }

  if (isSchemaObjectLike(schema)) {
    return 'object'
  }

  return schema.type || 'unknown'
}

function flattenSchemaFields(schema, parentPath = '') {
  if (!schema) {
    return []
  }

  if (isSchemaArrayLike(schema)) {
    return flattenSchemaFields(schema.items, `${parentPath}[]`)
  }

  if (!isSchemaObjectLike(schema)) {
    return []
  }

  const properties = getSchemaProperties(schema)
  const requiredFields = getSchemaRequired(schema)

  return Object.entries(properties).flatMap(([key, value]) => {
    const fieldPath = parentPath ? `${parentPath}.${key}` : key
    const row = {
      path: fieldPath,
      type: getSchemaTypeLabel(value),
      required: requiredFields.has(key),
      description: value?.description || '',
    }

    return [row, ...flattenSchemaFields(value, fieldPath)]
  })
}

function RequestBodyTable({ schema }) {
  const rows = flattenSchemaFields(schema)

  if (!rows.length) {
    return null
  }

  return (
    <div className="mt-4 overflow-hidden rounded border auto-border-gray-200">
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_6rem_minmax(0,1.4fr)] gap-4 border-b auto-border-gray-200 auto-bg-gray-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <div>Field</div>
        <div>Type</div>
        <div>Required</div>
        <div>Description</div>
      </div>
      <div className="divide-y auto-divide-gray-100">
        {rows.map((row) => (
          <div
            key={row.path}
            className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_6rem_minmax(0,1.4fr)] gap-4 px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <code className="break-words rounded auto-bg-gray-100 px-1.5 py-0.5 text-[11px] auto-text-gray-900">
                {row.path}
              </code>
            </div>
            <div>
              <span className="tag text-[10px]">{row.type}</span>
            </div>
            <div>
              {row.required ? (
                <span className="text-[10px] font-semibold uppercase text-gray-400">
                  Required
                </span>
              ) : (
                <span className="text-[10px] uppercase text-gray-300 dark:text-gray-600">
                  Optional
                </span>
              )}
            </div>
            <div className="text-xs auto-text-gray-600">
              {row.description || '-'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function schemaToJsonExample(schema, depth = 0) {
  switch (true) {
    case !schema:
      return null

    case isSchemaObjectLike(schema): {
      const properties = getSchemaProperties(schema)

      const result = {}

      Object.entries(properties).forEach(([key, value]) => {
        result[key] = schemaToJsonExample(value, depth + 1)
      })

      return Object.keys(result).length > 0 || depth === 0 ? result : 'object'
    }

    case isSchemaArrayLike(schema):
      return [schemaToJsonExample(schema.items, depth + 1)]

    case schema.example !== undefined:
      return schema.example

    case schema.default !== undefined:
      return schema.default

    case schema.type === 'integer':
    case schema.type === 'number':
      return 0

    case schema.type === 'boolean':
      return true

    default:
      return schema?.enum?.[0] || schema?.format || schema?.type || 'string'
  }
}

function toPrettyJson(schema) {
  return JSON.stringify(schemaToJsonExample(schema), null, 2)
}

function CodeTabs({ tabs, activeTab, setActiveTab }) {
  if (!tabs?.length) {
    return null
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => setActiveTab?.(tab)}
          className={clsx(
            'rounded px-2 py-0.5 text-[11px] transition-colors',
            tab === activeTab
              ? 'auto-bg-gray-900 auto-text-gray-50'
              : 'text-gray-500 hover:auto-bg-gray-100 hover:auto-text-gray-900'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

function RequestCodeBlock({ requestSchema, method, path }) {
  const tabs = ['Node', 'Go', 'JavaScript', 'cURL', 'HTTP']
  const [activeTab, setActiveTab] = useState(tabs[0])
  const url = getExternalAPIHostURL(`/v1${path}`)

  function generateCurl(body) {
    return [
      `curl -X ${method.toUpperCase()} "${url}" \\`,
      `  -H "Authorization: Bearer $CBK_API_SECRET"${
        method !== 'get' ? ' \\' : ''
      }`,
      ...(method !== 'get'
        ? [
            '  -H "Content-Type: application/json" \\',
            '  --data-binary @- << EOF',
            toPrettyJson(body),
            'EOF',
          ]
        : []),
    ].join('\n')
  }

  function generateHttp(body) {
    return [
      `${method.toUpperCase()} /v1${path} HTTP/1.1`,
      `Host: ${getExternalAPIHost()}`,
      'Authorization: Bearer CBK_API_SECRET',
      ...(method !== 'get'
        ? ['Content-Type: application/json', '', toPrettyJson(body)]
        : []),
    ].join('\n')
  }

  function generateJavaScript(body) {
    return [
      `const response = await fetch("${url}", {`,
      `  method: "${method.toUpperCase()}",`,
      '  headers: {',
      `    Authorization: \`Bearer \${CBK_API_SECRET}\`${
        method !== 'get' ? ',' : ''
      }`,
      ...(method !== 'get' ? ['    "Content-Type": "application/json"'] : []),
      `  }${method !== 'get' ? ',' : ''}`,
      ...(method !== 'get'
        ? ['  body: JSON.stringify(', toPrettyJson(body), '  )']
        : []),
      '})',
    ].join('\n')
  }

  function generateNodeSdk() {
    const pathParts = path.split('/').filter(Boolean)
    const pathParams = pathParts
      .filter((part) => part.startsWith('{') && part.endsWith('}'))
      .map((param) => param.slice(1, -1))
    const methodChain = pathParts
      .filter((part) => !part.startsWith('{') && !part.endsWith('}'))
      .join('.')

    return [
      "import { ChatBotKit } from '@chatbotkit/sdk'",
      '',
      'const cbk = new ChatBotKit({',
      '  secret: process.env.CHATBOTKIT_API_KEY!',
      '})',
      '',
      `const response = await cbk.${methodChain}(`,
      ...(pathParams.length || (method !== 'get' && requestSchema)
        ? [
            ...pathParams.map((param) => `  ${param},`),
            ...(method !== 'get' && requestSchema
              ? [toPrettyJson(requestSchema).replace(/^/gm, '  ')]
              : []),
          ]
        : []),
      ')',
    ].join('\n')
  }

  function generateGoSdk() {
    const pathParts = path.split('/').filter(Boolean)
    const pathParams = pathParts
      .filter((part) => part.startsWith('{') && part.endsWith('}'))
      .map((param) => param.slice(1, -1))
    const clientChain = pathParts
      .filter((part) => !part.startsWith('{') && !part.endsWith('}'))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('.')

    return [
      'import (',
      '  "github.com/chatbotkit/go-sdk/sdk"',
      ...(method !== 'get' && requestSchema
        ? ['  "github.com/chatbotkit/go-sdk/types"']
        : []),
      ')',
      '',
      'client := sdk.New(sdk.Options{',
      '  Secret: os.Getenv("CHATBOTKIT_API_KEY"),',
      '})',
      '',
      `response, err := client.${clientChain}(ctx${
        pathParams.length ? `, ${pathParams.join(', ')}` : ''
      }${method !== 'get' && requestSchema ? ', types.Request{...}' : ''})`,
    ].join('\n')
  }

  function getSnippet() {
    switch (activeTab) {
      case 'cURL':
        return { language: 'bash', code: generateCurl(requestSchema) }
      case 'HTTP':
        return { language: 'http', code: generateHttp(requestSchema) }
      case 'JavaScript':
        return {
          language: 'javascript',
          code: generateJavaScript(requestSchema),
        }
      case 'Go':
        return { language: 'go', code: generateGoSdk() }
      default:
        return { language: 'javascript', code: generateNodeSdk() }
    }
  }

  const snippet = getSnippet()

  return (
    <>
      <CodeTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
      <CodeBlock className="max-h-[32rem] text-xs" language={snippet.language}>
        {snippet.code}
      </CodeBlock>
    </>
  )
}

function ResponseCodeBlock({ responses = {} }) {
  const tabs = Object.keys(responses).filter((statusCode) => {
    return responses?.[statusCode]?.content?.['application/json']?.schema
  })

  const [activeTab, setActiveTab] = useState(tabs[0] || null)

  if (!activeTab) {
    return (
      <div className="font-mono text-xs text-gray-400">
        No JSON response schema defined for this endpoint.
      </div>
    )
  }

  const response = responses[activeTab]
  const responseSchema = response?.content?.['application/json']?.schema
  const responseCode = toPrettyJson(responseSchema)

  return (
    <>
      <CodeTabs tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} />
      <CodeBlock className="max-h-[32rem] text-xs" language="json">
        {responseCode}
      </CodeBlock>
      {response?.description ? (
        <div className="mt-3 border-t auto-border-gray-200 pt-3 text-xs auto-text-gray-600">
          {response.description}
        </div>
      ) : null}
    </>
  )
}

/**
 * @param {object} props
 * @param {{ groups: Array<object>, updatedAt?: number } | null | undefined} [props.initialData]
 * @param {object | null | undefined} [props.initialOperation]
 * @param {string | undefined} [props.initialSlug]
 */
export function Main({ initialData, initialOperation, initialSlug }) {
  const [groups, setGroups] = useState(initialData?.groups || [])
  const [updatedAt, setUpdatedAt] = useState(initialData?.updatedAt || null)
  const [selectedSlug, setSelectedSlug] = useState(initialSlug || null)
  const [operationCache, setOperationCache] = useState(() => {
    const cache = new Map()

    if (initialSlug && initialOperation) {
      cache.set(initialSlug, initialOperation)
    }

    return cache
  })
  const [filter, setFilter] = useState('')
  const [method, setMethod] = useState('')
  const [group, setGroup] = useState('')
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const allItems = useMemo(() => {
    return groups.flatMap((g) => g.items)
  }, [groups])

  const groupTitleBySlug = useMemo(() => {
    const map = new Map()

    for (const g of groups) {
      for (const item of g.items) {
        map.set(item.slug, g.title)
      }
    }

    return map
  }, [groups])

  const filteredItems = useMemo(() => {
    const query = filter.trim().toLowerCase()

    return allItems.filter((item) => {
      if (method && item.method !== method) {
        return false
      }

      if (group) {
        const g = groups.find((candidate) => candidate.key === group)

        if (!g?.items.some((candidate) => candidate.slug === item.slug)) {
          return false
        }
      }

      if (!query) {
        return true
      }

      return [
        item.slug,
        item.operationId,
        item.title,
        item.method,
        item.path,
        item.summary,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [allItems, filter, method, group, groups])

  const refresh = useCallback(async () => {
    setLoading(true)

    try {
      const result = await listSpecOperations({})

      if (result && !('error' in result)) {
        setGroups(result.groups || [])
        setUpdatedAt(result.updatedAt || Date.now())
      } else if (result?.error) {
        toast.error(result.error.message)
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchDetail = useCallback(
    async (slug) => {
      if (!slug || operationCache.has(slug)) {
        return
      }

      setDetailLoading(true)

      try {
        const result = await fetchSpecOperation({ slug })

        if (result && !('error' in result)) {
          setOperationCache((cache) => {
            const next = new Map(cache)

            next.set(slug, result)

            return next
          })
        } else if (result?.error) {
          toast.error(result.error.message)
        }
      } catch (e) {
        toast.error(e.message)
      } finally {
        setDetailLoading(false)
      }
    },
    [operationCache]
  )

  useEffect(() => {
    if (selectedSlug) {
      return
    }

    const first = filteredItems[0]?.slug

    if (first) {
      setSelectedSlug(first)
    }
  }, [filteredItems, selectedSlug])

  useEffect(() => {
    if (selectedSlug) {
      fetchDetail(selectedSlug)
    }
  }, [selectedSlug, fetchDetail])

  const selectedOperation = selectedSlug
    ? operationCache.get(selectedSlug)
    : null

  return (
    <div className="flex h-screen w-full flex-col bg-white dark:bg-gray-950">
      <Toolbar
        filter={filter}
        setFilter={setFilter}
        method={method}
        setMethod={setMethod}
        group={group}
        setGroup={setGroup}
        groups={groups}
        loading={loading}
        updatedAt={updatedAt}
        onRefresh={refresh}
      />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 w-full flex-col border-r border-gray-200 dark:border-gray-800 md:w-[420px]">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-800">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold auto-text-gray-900">
                <LuBookMarked className="h-3.5 w-3.5" />
                Endpoints
              </div>
              <div className="text-xs text-gray-500">
                {filteredItems.length} of {allItems.length} operations
              </div>
            </div>
          </div>

          <OperationList
            items={filteredItems}
            groupTitleBySlug={groupTitleBySlug}
            selectedSlug={selectedSlug}
            setSelectedSlug={setSelectedSlug}
            loading={loading}
          />
        </div>

        <Inspector operation={selectedOperation} loading={detailLoading} />
      </div>
    </div>
  )
}

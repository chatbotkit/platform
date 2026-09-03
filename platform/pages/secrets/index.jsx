import { useEffect, useMemo, useState } from 'react'

import secretTemplatesData from '@/data/secrets/visible'

import { isDevelopment, isStaging } from '@/lib/env'
import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'
import { isPlatformTemplate } from '@/lib/template'

import Dashboard from '@/layouts/Dashboard'

import CodeAction from '@/components/CodeAction'
import DocsLink from '@/components/DocsLink'
import DynamicIcon from '@/components/DynamicIcon'
import FAQ from '@/components/FAQ'
import Hero from '@/components/Hero'
import Link from '@/components/Link'
import SecretList from '@/components/SecretList'

import useFetch from '@/hooks/useFetch'
import usePopup from '@/hooks/usePopup'
import useRouter from '@/hooks/useRouter'
import useScopedCreateData from '@/hooks/useScopedCreateData'

import faq from '@/content/faqs/platform-secrets.yaml'

import clsx from 'clsx'

const FILTERS = [
  { id: 'platform', label: 'Platform' },
  { id: 'standard', label: 'Templates' },
]

function TemplatesPopupContent({ platformTemplates, templates, onSelect }) {
  const [search, setSearch] = useState('')

  // @note a deployment without the platform secrets catalogue has no platform
  // templates - only offer tabs that have entries

  const filters = FILTERS.filter(({ id }) =>
    id === 'platform'
      ? Object.keys(platformTemplates).length > 0
      : Object.keys(templates).length > 0
  )

  const [selectedFilter, setSelectedFilter] = useState(
    filters[0]?.id ?? 'standard'
  )

  const [tempFilter, setTempFilter] = useState(null)

  const filter = tempFilter ?? selectedFilter

  const allTemplates = useMemo(
    () => [
      ...Object.entries(platformTemplates).map(
        ([id, { icon, name, description, type, kind }]) => ({
          id,
          icon,
          name,
          source: 'platform',
          data: { name, description, type, kind, config: { template: id } },
        })
      ),
      ...Object.entries(templates).map(
        ([id, { icon, name, description, type, kind, config }]) => ({
          id,
          icon,
          name,
          source: 'standard',
          data: { name, description, type, kind, config },
        })
      ),
    ],
    [platformTemplates, templates]
  )

  useEffect(() => {
    if (!search) {
      setTempFilter(null)

      return
    }

    const searchLower = search.toLowerCase()
    const hasMatch = allTemplates
      .filter(({ source }) => source === selectedFilter)
      .some(({ name }) => name.toLowerCase().includes(searchLower))

    if (hasMatch) {
      setTempFilter(null)
    } else {
      const fallback = filters.find(
        ({ id }) =>
          id !== selectedFilter &&
          allTemplates
            .filter(({ source }) => source === id)
            .some(({ name }) => name.toLowerCase().includes(searchLower))
      )

      setTempFilter(fallback ? fallback.id : null)
    }
  }, [search, selectedFilter, allTemplates, filters])

  const filtered = allTemplates
    .filter(({ source }) => source === filter)
    .filter(
      ({ name }) => !search || name.toLowerCase().includes(search.toLowerCase())
    )

  const showCustom = !search && filter === 'standard'

  return (
    <div className="space-y-3">
      <div className="default-input flex items-center gap-2 !p-1.5">
        {filters.map(({ id, label }) => (
          <button
            key={id}
            className={clsx(
              'text-xs px-2 py-1 rounded-md transition-colors flex-shrink-0',
              id === filter
                ? 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
            )}
            type="button"
            onClick={() => {
              setSelectedFilter(id)
              setTempFilter(null)
            }}
          >
            {label}
          </button>
        ))}
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
        <input
          className="none-input flex-1 min-w-0 text-sm"
          type="search"
          placeholder="Search secrets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      <div className="h-[50vh] overflow-y-auto">
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1">
          {showCustom && (
            <Link
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-center transition-colors"
              href="/secrets/new"
            >
              <DynamicIcon
                className="w-10 h-10 aspect-square object-cover rounded-lg"
                icon="@heroicons/key"
                fallbackIcon="@heroicons/puzzle-piece"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400 leading-tight line-clamp-2">
                Custom
              </span>
            </Link>
          )}
          {filtered.map(({ id, icon, name, data }) => (
            <button
              key={id}
              className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-center transition-colors"
              type="button"
              onClick={() => onSelect(data)}
            >
              <DynamicIcon
                className="w-10 h-10 aspect-square object-cover rounded-lg dark:grayscale"
                icon={icon}
                fallbackIcon="@heroicons/puzzle-piece"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400 leading-tight line-clamp-2">
                {name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function TemplatesButton({ templates, platformTemplates }) {
  const router = useRouter()

  const scopeCreateData = useScopedCreateData()

  const { code, fetch } = useFetch({
    loadingMessage: true,
    failureMessage: true,
  })

  const { popup, openPopup } = usePopup({ closePopupOnClickOutside: true })

  if (
    !Object.keys(platformTemplates).length &&
    !Object.keys(templates).length
  ) {
    return null
  }

  async function handleSelect(data) {
    const { error, data: result } = await fetch(`/api/v1/secret/create`, {
      data: scopeCreateData(data),
      loadingMessage: 'Creating secret...',
    })

    if (!error) {
      router.push(`/secrets/${result.id}`)
    }
  }

  function openTemplatesPopup() {
    openPopup(
      <TemplatesPopupContent
        platformTemplates={platformTemplates}
        templates={templates}
        onSelect={handleSelect}
      />,
      {
        title: 'Create Secret',
        noActions: true,
        animateContentHeight: false,
      }
    )
  }

  return (
    <>
      <CodeAction key={code} code={code} />
      {popup}
      <button
        className="primary-button"
        type="button"
        onClick={openTemplatesPopup}
      >
        Create Secret
      </button>
    </>
  )
}

export default function Index({ authenticated, templates, platformTemplates }) {
  return (
    <section className="section-white">
      <div className="main-page main-page-list">
        <SecretList
          autoLoad
          loadMore="auto"
          actions={
            authenticated ? (
              <TemplatesButton
                templates={templates}
                platformTemplates={platformTemplates}
              />
            ) : null
          }
        />
      </div>
    </section>
  )
}

Index.getLayout = function (children, { authenticated }) {
  return (
    <Dashboard
      breadcrumbs={['ChatBotKit']}
      title="Secrets"
      authenticated={authenticated}
    >
      {authenticated ? (
        children
      ) : (
        <PageHero>
          <DocsLink className="default-button" slug="secrets">
            Learn More
          </DocsLink>
          {/* <Link
          className="primary-button"
          href={{
            pathname: '/signin',
            query: {
              callbackUrl: '/secrets',
            },
          }}
        >
          Sign in
        </Link> */}
        </PageHero>
      )}
      <FAQ faq={faq} />
    </Dashboard>
  )
}

export function PageHero(props) {
  return (
    <Hero
      {...props}
      title={['Manage secrets', 'for your AI solutions']}
      description="Store sensitive information, such as API keys, and passwords in encrypted envelopes."
      compact={true}
    />
  )
}

export async function getServerSideProps(context) {
  const session = await getSoftSession(context.req, context.res)

  if (!session) {
    return {
      props: makeJsonSafe({
        authenticated: false,
      }),
    }
  }

  const templates = Object.fromEntries(
    Object.entries(secretTemplatesData)
      .filter(([id]) => !isPlatformTemplate(id))
      .filter(([, { tags }]) => {
        if (tags?.includes('hidden')) {
          return false
        }

        if (tags?.includes('alpha')) {
          if (!isDevelopment && !isStaging) {
            return false
          }
        }

        return true
      })
      .map(([id, { icon, name, description, type, kind, config }]) => {
        return [id, { icon, name, description, type, kind, config }]
      })
  )

  const platformTemplates = Object.fromEntries(
    Object.entries(secretTemplatesData)
      .filter(([id]) => isPlatformTemplate(id))
      .filter(([, { tags }]) => {
        if (tags?.includes('hidden')) {
          return false
        }

        if (tags?.includes('alpha')) {
          if (!isDevelopment && !isStaging) {
            return false
          }
        }

        return true
      })
      .map(([id, { icon, name, description, type, kind }]) => {
        return [id, { icon, name, description, type, kind }]
      })
  )

  return {
    props: makeJsonSafe({
      authenticated: true,

      templates: templates,
      platformTemplates: platformTemplates,
    }),
  }
}

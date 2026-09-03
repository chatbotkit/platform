import { useMemo, useState } from 'react'

import { getSoftSession } from '@/lib/session.get'
import { makeJsonSafe } from '@/lib/struct'

import Wizard from '@/layouts/Wizard'
import { Heading, NavigationButtons } from '@/layouts/Wizard'

import DynamicIcon from '@/components/DynamicIcon'
import Link from '@/components/Link'

import useBuilderExperience from '@/hooks/useBuilderExperience'
import useFuzzySearch from '@/hooks/useFuzzySearch'
import useRouter from '@/hooks/useRouter'

import allExamples from '@/examples'

import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

import clsx from 'clsx'

export const EXAMPLE_SEARCH_LIMIT = 9
export const EXAMPLE_SEARCH_DEBOUNCE = 150

// @note weighted so title matches rank above keyword matches above description
// matches; kept module-level so the fuse index identity stays stable across
// renders
const FUZZY_KEYS = [
  { name: 'title', weight: 3 },
  { name: 'keywords', weight: 2 },
  { name: 'description', weight: 1 },
]

// @note mirrors TemplateButton on the template picker so the browse step reads
// as the same select-then-continue interaction
export function ExampleButton({ example, selected, className, ...props }) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={!!selected}
      className={clsx(
        className,
        'relative',
        'flex flex-col items-start justify-start',
        'p-5 rounded-xl',
        'text-left',
        'transition duration-150',
        'focus:outline-none',
        'border',
        {
          'border-indigo-600 dark:border-gray-600 ring ring-indigo-50 dark:ring-gray-50 bg-gray-50/50 dark:bg-gray-950/50':
            selected,
          'border-gray-100 dark:border-gray-900 hover:bg-gray-50/50 dark:bg-gray-950/50':
            !selected,
        }
      )}
    >
      {/* @note icon lives inside the tinted circle (not on it) so DynamicIcon
          keeps its own dark-mode handling - lucide icons render black and rely
          on the component's dark:invert, which the circle's grayscale filter
          would otherwise clobber */}
      <div className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
        <DynamicIcon className="w-6 h-6" icon={example.icon || '🤖'} />
      </div>
      <h3 className="text-base mt-2 mb-1">{example.title}</h3>
      <p className="text-xs opacity-60 leading-normal line-clamp-3">
        {example.description}
      </p>
      {selected && (
        <div className="text-indigo-600 dark:text-gray-50 absolute top-3 right-3">
          <CheckCircleIcon color="" height="20px" width="20px" />
        </div>
      )}
    </button>
  )
}

export function ExampleSearch({ examples, selectedSlug, onSelect }) {
  const [search, setSearch] = useState('')

  const active = search.trim().length > 0

  // @note default suggestions are the builder-tagged examples - the catalogue's
  // editorial pick of practical, channel-ready solutions - for every
  // experience; the flag only changes the heading label below, and search
  // always spans the full list
  const isBuilderExperience = useBuilderExperience()

  const suggested = useMemo(() => {
    return examples
      .filter((item) => item.builder)
      .slice(0, EXAMPLE_SEARCH_LIMIT)
  }, [examples])

  // @note local fuzzy search (fuse.js) with an internal debounce - there is no
  // network request, so it can never re-fire on an unrelated re-render such as
  // selecting a card (which was the source of the jitter)
  const matches = useFuzzySearch(examples, search, {
    keys: FUZZY_KEYS,
    threshold: 0.4,
    limit: EXAMPLE_SEARCH_LIMIT,
    debounce: EXAMPLE_SEARCH_DEBOUNCE,
    disabled: !active,
  })

  // @note useFuzzySearch returns the source list (by reference) while it is
  // disabled or before the debounced query settles - keep showing the
  // suggestions until real matches arrive so the grid never flashes the
  // whole catalogue
  const settled = matches !== examples

  const shown = active && settled ? matches : suggested

  return (
    <div className="mt-4 md:mt-10 px-8 md:px-0">
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 opacity-40" />
        <input
          type="search"
          autoFocus
          className="default-input w-full pl-10"
          placeholder="Search examples, e.g. customer support widget or sales agent for Slack"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {!active && (
        <p className="mt-6 text-sm opacity-60">
          {isBuilderExperience ? 'Suggested solutions' : 'Featured examples'}
        </p>
      )}
      {shown.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {shown.map((item) => (
            <ExampleButton
              key={item.slug}
              example={item}
              selected={item.slug === selectedSlug}
              onClick={() => onSelect(item)}
            />
          ))}
        </div>
      ) : active ? (
        <p className="mt-6 text-sm opacity-60">
          No matching examples. Try different keywords.
        </p>
      ) : null}
      <p className="mt-6 text-xs opacity-60">
        Not finding it? Browse the full{' '}
        <Link className="default-link" href="/examples" target="_blank">
          examples gallery
        </Link>
        .
      </p>
    </div>
  )
}

export default function Page({ examples }) {
  const router = useRouter()

  const [selectedExample, setSelectedExample] = useState(null)

  const {
    template: _template,
    templateId: _templateId,
    example: _example,
    ...query
  } = router.query

  return (
    <>
      <Heading
        title="Pick an example"
        description="Start from a ready-made agent and make it your own. Search by use case or browse the featured picks."
      />
      <ExampleSearch
        examples={examples}
        selectedSlug={selectedExample?.slug}
        onSelect={setSelectedExample}
      />
      <NavigationButtons
        disabled={!selectedExample}
        onForward={() => {
          if (!selectedExample) {
            return
          }

          // @note the browse step is part of the example template, so the
          // confirm step is the next step - carry the selected slug in the url
          // the way the confirm step's getServerSideProps expects it
          router.replace({
            pathname: '/new/example',
            query: {
              ...query,

              example: selectedExample.slug,
            },
          })
        }}
      />
    </>
  )
}

Page.getLayout = function (children) {
  return (
    <Wizard
      caption="Create Solution"
      title="Examples"
      description="Pick an example to start building your solution."
    >
      {children}
    </Wizard>
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

  // @note only examples the wizard can set up are searchable - projects are
  // GitHub-only and link entries route to external pages. Hub entries stay in:
  // they carry no resources of their own, but the confirm step recognises the
  // pointer and hands them to the hub template, which clones the page they
  // point at - so the wizard can start from one like any other example.
  const examples = allExamples
    .filter((item) => {
      return !item.hidden && !item.link && !Array.isArray(item.files)
    })
    .map((item) => ({
      slug: item.slug,
      icon: item.icon || null,

      title: item.title,
      description: item.description || '',

      keywords: item.keywords || [],

      featured: !!item.featured,
      builder: !!item.builder,
    }))

  return {
    props: makeJsonSafe({
      examples,
    }),
  }
}

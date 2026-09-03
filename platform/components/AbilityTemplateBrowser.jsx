'use client'

import { useDeferredValue, useMemo, useState } from 'react'

import {
  compareProviders,
  getProviderTitle,
  getTemplateProvider,
} from '@/lib/ability.provider'

import DynamicIcon from '@/components/DynamicIcon'
import List from '@/components/List'

import useDebouncedInput from '@/hooks/useDebouncedInput'
import useFuzzySearch from '@/hooks/useFuzzySearch'

import clsx from 'clsx'

const SEARCH_KEYS = ['id', 'template', 'name', 'description', 'tags']

const ALL_PROVIDERS = null

// @note providers are slugs, so the `@` keeps this from colliding with one
const SELECTED_PROVIDER = '@selected'

/**
 * The resources a template needs linked before it can run. Templates declare
 * these themselves, so we can tell the user before they commit to one.
 */
export function getTemplateRequirements({ secret, file, bot, space }) {
  return [
    ...(secret ? ['secret'] : []),
    ...(file ? ['file'] : []),
    ...(bot ? ['bot'] : []),
    ...(space ? ['space'] : []),
  ]
}

function getTemplateTags({ id, template, tags }) {
  const key = template ?? id

  return [
    ...(/\[.*?\]/.test(key)
      ? [key.match(/\[(.*?)\]/)[1].replace(/\W+/g, ' ')]
      : []),

    ...(tags || []),
  ]
}

function ProviderRail({
  providers,
  total,
  selectedCount,
  selected,
  onSelect,
  className,
}) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {selectedCount ? (
        <>
          <ProviderRail.Item
            icon="@heroicons/check-circle"
            title="Selected"
            count={selectedCount}
            selected={selected === SELECTED_PROVIDER}
            onClick={() => onSelect(SELECTED_PROVIDER)}
          />
          <div className="my-1 border-t auto-border-gray-100" />
        </>
      ) : null}
      <ProviderRail.Item
        icon="@heroicons/squares-2x2"
        title="All abilities"
        count={total}
        selected={selected === ALL_PROVIDERS}
        onClick={() => onSelect(ALL_PROVIDERS)}
      />
      {providers.map(({ id, title, icon, count }) => (
        <ProviderRail.Item
          key={id}
          icon={icon}
          title={title}
          count={count}
          selected={selected === id}
          onClick={() => onSelect(id)}
        />
      ))}
    </div>
  )
}

ProviderRail.Item = function ProviderRailItem({
  icon,
  title,
  count,
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      className={clsx(
        'w-full flex flex-row items-center gap-2',
        'rounded-lg px-2 py-2 text-left text-sm',
        'transition-colors duration-200',
        'hover:auto-bg-gray-50',
        {
          'auto-bg-gray-100 font-medium auto-text-gray-900': selected,
        }
      )}
      onClick={onClick}
      aria-pressed={selected}
    >
      <DynamicIcon
        className="w-6 h-6 text-[1.5rem] shrink-0 rounded-full object-cover bg-white p-1"
        icon={icon || '@heroicons/cube-transparent'}
      />
      <span className="flex-1 truncate">{title}</span>
      <span className="text-xs auto-text-gray-400">{count}</span>
    </button>
  )
}

/**
 * A searchable catalogue of ability templates.
 *
 * This only browses and selects. What a selection means is up to the caller -
 * filling in an instruction field, or creating abilities on a skillset.
 */
export default function AbilityTemplateBrowser({
  templates = [],

  loading = false,

  selectedIds = [],

  onSelect,

  // @note the provider rail earns its space in a wide dialog, but crowds a
  // narrow one, so it is opt-in
  grouped = false,

  // @note requirement chips only make sense where the selection turns into a
  // real ability, so they are opt-in
  requirements = false,

  className,
}) {
  // @note useDebouncedInput uses uncontrolled input pattern to avoid React
  // re-renders on every keystroke. Only updates state after 300ms delay.

  const { value: search, inputProps: searchInputProps } = useDebouncedInput({
    delay: 300,
  })

  // @note useDeferredValue allows React to defer updating the fuzzy search
  // results during rapid typing, keeping the input responsive.

  const deferredSearch = useDeferredValue(search)

  const matchingTemplates = useFuzzySearch(templates, deferredSearch, {
    keys: useMemo(() => SEARCH_KEYS, []),
    threshold: 0.4,
    debounce: 0, // @note debounce is handled by useDebouncedInput
    disabled: !deferredSearch,
  })

  const [provider, setProvider] = useState(ALL_PROVIDERS)

  // @note the rail counts what the search actually matched, so it doubles as a
  // readout of where the results are

  const providers = useMemo(() => {
    if (!grouped) {
      return []
    }

    const groups = new Map()

    for (const template of matchingTemplates) {
      const id = getTemplateProvider(template)

      const group = groups.get(id) || {
        id,

        title: getProviderTitle(id),
        icon: template.icon,

        count: 0,
      }

      group.count += 1

      groups.set(id, group)
    }

    return [...groups.values()].sort(compareProviders)
  }, [grouped, matchingTemplates])

  // @note in the order they were picked, so the bucket reads back the way the
  // user built it rather than in catalogue order

  const selectedTemplates = useMemo(() => {
    return selectedIds
      .map((id) => templates.find((template) => template.id === id))
      .filter(Boolean)
  }, [selectedIds, templates])

  // @note a search - or clearing the selection - can empty the group the user
  // is standing in. Rather than show them nothing, fall back to every match.

  const activeProvider = useMemo(() => {
    if (provider === SELECTED_PROVIDER) {
      return selectedTemplates.length ? SELECTED_PROVIDER : ALL_PROVIDERS
    }

    return providers.some(({ id }) => id === provider)
      ? provider
      : ALL_PROVIDERS
  }, [provider, providers, selectedTemplates])

  const visibleTemplates = useMemo(() => {
    // @note the selected bucket is a review list of what you picked, so it
    // deliberately ignores the search - your picks are always all there

    if (activeProvider === SELECTED_PROVIDER) {
      return selectedTemplates
    }

    if (activeProvider === ALL_PROVIDERS) {
      return matchingTemplates
    }

    return matchingTemplates.filter(
      (template) => getTemplateProvider(template) === activeProvider
    )
  }, [activeProvider, matchingTemplates, selectedTemplates])

  return (
    <div className={clsx('flex flex-col gap-4 min-h-0', className)}>
      <input
        className="default-input w-full"
        type="search"
        placeholder="Search..."
        {...searchInputProps}
      />
      <div className="flex-1 flex flex-row gap-4 min-h-0">
        {grouped ? (
          <ProviderRail
            className="w-52 shrink-0 hidden sm:flex overflow-auto subtle-scrollbar border-r auto-border-gray-100 pr-3"
            providers={providers}
            total={matchingTemplates.length}
            selectedCount={selectedTemplates.length}
            selected={activeProvider}
            onSelect={setProvider}
          />
        ) : null}
        <div className="flex-1 overflow-auto subtle-scrollbar">
          {loading && !templates.length ? (
            <p className="text-sm">Loading templates...</p>
          ) : null}
          <List>
            {visibleTemplates.map((template) => {
              const { id, icon, name, description } = template

              const tags = getTemplateTags(template)

              const needs = requirements
                ? getTemplateRequirements(template)
                : []

              return (
                <List.Item
                  key={id}
                  selected={selectedIds.includes(id)}
                  icon={
                    <DynamicIcon
                      className="w-12 h-12 text-[3rem] rounded-full object-cover bg-white p-2"
                      icon={icon || '@heroicons/cube-transparent'}
                    />
                  }
                  title={name}
                  body={description}
                  onClick={() => onSelect?.(template)}
                >
                  <div className="space-y-2 w-full">
                    {tags.length || needs.length ? (
                      <div className="space-x-1">
                        {tags.map((tag, index) => (
                          <span key={index} className="tag">
                            {tag}
                          </span>
                        ))}
                        {tags.includes('example') ? (
                          <span className="tag darker">example</span>
                        ) : null}
                        {needs.map((need) => (
                          <span key={need} className="tag darker">
                            needs {need}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </List.Item>
              )
            })}
          </List>
        </div>
      </div>
    </div>
  )
}

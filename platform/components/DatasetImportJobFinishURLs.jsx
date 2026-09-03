import { useCallback, useEffect, useMemo, useState } from 'react'

import { jsonl } from '@/lib/fetch'
import { pathquery } from '@/lib/url'

import Link from '@/components/Link'

import useFetch from '@/hooks/useFetch'
import useDebounce from '@/hooks/useDebounce'

import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

const DEFAULT_CONTEXT_FILTERS = {}

export default function DatasetImportJobFinishURLs({
  contextFilters = DEFAULT_CONTEXT_FILTERS,

  maxUrls = 5,

  actions = {},
}) {
  const [more, setMore] = useState(false)

  const [events, setEvents] = useState([])

  const [searchQuery, setSearchQuery] = useState('')

  const debouncedSearchQuery = useDebounce(searchQuery, 250)

  const { loading, fetch } = useFetch({
    loadingMessage: false,
    failureMessage: true,
  })

  const getEvents = useCallback(async (loadingMessage) => {
    const url = new URL('/api/v1/event/log/list', window.location.origin)

    url.searchParams.append('take', 1)
    url.searchParams.append('type', ['dataset.import.job.finish'].join(','))

    Object.entries(contextFilters).forEach(([field, value]) => {
      url.searchParams.append(`context.${field}`, value)
    })

    // We use the pathquery function to remove the origin from the URL to
    // correctly prefix the path if needed.

    const { error, data } = await fetch(pathquery(url.toString()), {
      headers: {
        Accept: 'application/jsonl',
      },

      dataType: 'body',

      loadingMessage,
    })

    if (!error) {
      const items = []

      for await (const item of jsonl(data)) {
        if (item.type === 'item') {
          items.push(item.data)

          break
        }
      }

      setEvents(items)
    }
  }, [contextFilters, fetch])

  // @note it is expected to fetch twice

  useEffect(() => {
    getEvents()
  }, [getEvents])

  const urls = useMemo(() => {
    return events[0]?.meta?.urls || events[0]?.eventData?.urls || []
  }, [events])

  const normalizedSearchQuery = debouncedSearchQuery.trim().toLowerCase()

  const filteredUrls = useMemo(() => {
    if (!normalizedSearchQuery) {
      return urls
    }

    return urls.filter((url) => url.toLowerCase().includes(normalizedSearchQuery))
  }, [urls, normalizedSearchQuery])

  return (
    <div>
      {loading && events.length === 0 ? (
        <div>
          <p className="text-sm">Loading urls...</p>
        </div>
      ) : !loading && events.length == 0 ? (
        <div>
          <p className="text-sm">
            There are currently no urls from the last day.{' '}
            <button
              className="default-link text-sm"
              type="button"
              onClick={() => getEvents(true)}
            >
              Refresh
            </button>
          </p>
        </div>
      ) : urls.length ? (
        <div className="space-y-6">
          <div>
            <input
              className="default-input w-full text-sm"
              type="search"
              placeholder="Filter URLs"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <ul
            className={clsx('space-y-2', {
              'max-h-80 overflow-hidden gradient-mask-b-80':
                !more && !normalizedSearchQuery && filteredUrls.length > maxUrls,
            })}
          >
            {filteredUrls.map((url) => {
              return (
                <li
                  key={url}
                  className={clsx(
                    'group',
                    'text-sm',
                    'px-2 py-1',
                    'hover:bg-gray-100 dark:hover:bg-gray-900',
                    'rounded-md',
                    'transition-all duration-200 ease-in-out',
                    'flex flex-row gap-2'
                  )}
                >
                  <Link
                    className="default-link flex-1 min-w-0 truncate"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {url}
                  </Link>
                  {Object.entries(actions || {}).map(
                    ([label, { type, action }]) => {
                      return (
                        <button
                          key={label}
                          className={clsx(
                            'shrink-0',
                            'opacity-0 group-hover:opacity-100',
                            'transition-all duration-200 ease-in-out',
                            {
                              'default-link': type !== 'danger',
                              'danger-link': type === 'danger',
                            }
                          )}
                          type="button"
                          onClick={(event) => {
                            event.preventDefault()

                            action(url)
                          }}
                        >
                          {label}
                        </button>
                      )
                    }
                  )}
                </li>
              )
            })}
          </ul>
          {filteredUrls.length === 0 ? (
            <div>
              <p className="text-sm">No URLs match your search.</p>
            </div>
          ) : null}
          {!normalizedSearchQuery && filteredUrls.length > maxUrls ? (
            <div className="text-center">
              <button
                className="w-auto default-link text-sm inline-flex flex-row items-center space-x-3"
                type="button"
                onClick={() => setMore((prevMore) => !prevMore)}
              >
                {more ? (
                  <>
                    <ChevronUpIcon className="h-[1em]" />
                    <span>See less</span>
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="h-[1em]" />
                    <span>See all {filteredUrls.length} URLs</span>
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

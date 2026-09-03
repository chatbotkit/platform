import { useCallback, useEffect, useMemo, useState } from 'react'

import useFetch from '@/hooks/useFetch'

/**
 * Fetches the daily metric series for an Extract integration's collected fields
 * and shapes it for {@link DailyChart}, together with the per-field `display`
 * format map.
 *
 * Shared by the integration page and the blueprint designer's Extract Chart
 * tool so both render from a single source of truth.
 *
 * @param {string|null|undefined} integrationId - the extract integration id
 * @param {Record<string, any>|null|undefined} schema - the integration schema
 *   (used to discover collected fields and their `display` format)
 * @returns {{ data: Array<Record<string, number>>, formats: Record<string, string>, loading: boolean, reload: () => Promise<void> }}
 */
export default function useExtractIntegrationSeries(integrationId, schema) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  const { fetch } = useFetch({
    loadingMessage: false,
    failureMessage: true,
  })

  const collectionItems = useMemo(() => {
    if (!schema) {
      return []
    }

    return Object.keys(schema).filter((key) => schema[key]?.collect)
  }, [schema])

  const formats = useMemo(() => {
    if (!schema) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(schema)
        .filter(([, def]) => def?.collect && def?.display)
        .map(([field, def]) => [field, def.display])
    )
  }, [schema])

  const reload = useCallback(async () => {
    if (!integrationId || collectionItems.length === 0) {
      setData([])

      return
    }

    setLoading(true)

    try {
      const seriesResults = await Promise.all(
        collectionItems.map(async (field) => {
          const url = new URL(
            `/api/v1/event/metric/series/fetch`,
            window.location.origin
          )

          url.searchParams.set(
            'type',
            `integration.extract[${integrationId}].${field}`
          )

          const { error, data } = await fetch(url)

          if (error) {
            return { field, data: [] }
          }

          return { field, data: data.values || [] }
        })
      )

      const combinedData = new Map()

      seriesResults.forEach(({ field, data }) => {
        data.forEach((item) => {
          const date = item.date

          if (!combinedData.has(date)) {
            combinedData.set(date, { date })
          }

          combinedData.get(date)[field] = item.total
        })
      })

      const finalData = Array.from(combinedData.values()).sort(
        (a, b) => a.date - b.date
      )

      setData(finalData)
    } finally {
      setLoading(false)
    }
  }, [integrationId, collectionItems, fetch])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, formats, loading, reload }
}

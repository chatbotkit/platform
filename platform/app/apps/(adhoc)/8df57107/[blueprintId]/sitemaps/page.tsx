import { Error } from '@/layouts/Errata'

import { listDatasets, listSitemaps } from '../../server'
import { Main } from './components'

export default async function SitemapsPage(props: {
  params: Promise<{ blueprintId: string }>
}) {
  const params = await props.params

  const [datasetsResult, sitemapsResult] = await Promise.all([
    listDatasets({ blueprintId: params.blueprintId }),
    listSitemaps({ blueprintId: params.blueprintId }),
  ])

  if (!datasetsResult || !sitemapsResult) {
    return (
      <div className="main-page main-page-3xl">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in datasetsResult) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={datasetsResult.error.code}
          error_description={datasetsResult.error.message}
        />
      </div>
    )
  }

  if ('error' in sitemapsResult) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={sitemapsResult.error.code}
          error_description={sitemapsResult.error.message}
        />
      </div>
    )
  }

  const datasets = datasetsResult
  const sitemaps = sitemapsResult

  return (
    <div className="main-page main-page-3xl">
      <Main
        blueprintId={params.blueprintId}
        sitemaps={sitemaps}
        datasets={datasets}
      />
    </div>
  )
}

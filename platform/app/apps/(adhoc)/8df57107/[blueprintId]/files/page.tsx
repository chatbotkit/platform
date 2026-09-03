import { Error } from '@/layouts/Errata'

import { listDatasets, listFiles } from '../../server'
import { Main } from './components'

export default async function FilesPage(props: {
  params: Promise<{ blueprintId: string }>
}) {
  const params = await props.params

  const datasetsResult = await listDatasets({ blueprintId: params.blueprintId })

  if (!datasetsResult) {
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

  const datasets = datasetsResult as Array<{
    id: string
    name?: string
    description?: string
  }>

  // Get files for the first dataset (single-instance pattern)
  // Enhance files with datasetId for proper tracking
  let files: Array<Record<string, unknown>> = []

  if (datasets.length > 0) {
    const filesResult = await listFiles({ datasetId: datasets[0].id })

    if (filesResult && !('error' in filesResult)) {
      files = (filesResult as Array<Record<string, unknown>>).map((file) => ({
        ...file,
        datasetId: datasets[0].id,
      }))
    }
  }

  return (
    <div className="main-page main-page-3xl">
      <Main
        blueprintId={params.blueprintId}
        files={files}
        datasets={datasets}
      />
    </div>
  )
}

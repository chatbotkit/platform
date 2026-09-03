import { Error } from '@/layouts/Errata'

import { DatasetDetail } from '../components'
import { fetchDataset, listDatasetFiles } from '../server'

export default async function Page(props: {
  params: Promise<{ datasetId: string }>
}) {
  const params = await props.params

  const [datasetResult, filesResult] = await Promise.all([
    fetchDataset({ id: params.datasetId }),
    listDatasetFiles({ datasetId: params.datasetId }),
  ])

  if (!datasetResult || !filesResult) {
    return (
      <div className="main-page main-page-3xl">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in datasetResult) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={datasetResult.error.code}
          error_description={datasetResult.error.message}
        />
      </div>
    )
  }

  if ('error' in filesResult) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={filesResult.error.code}
          error_description={filesResult.error.message}
        />
      </div>
    )
  }

  const { dataset } = datasetResult
  const { files } = filesResult

  return (
    <div className="main-page main-page-3xl">
      <DatasetDetail dataset={dataset} initialFiles={files} />
    </div>
  )
}

import { Error } from '@/layouts/Errata'

import { fetchBlueprintViewer } from '../server'
import { BlueprintDetail } from './components'

export default async function Page(props: {
  params: Promise<{ blueprintId: string }>
}) {
  const params = await props.params

  const result = await fetchBlueprintViewer({ blueprintId: params.blueprintId })

  if (!result) {
    return (
      <div className="main-page main-page-3xl">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in result) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={result.error.code}
          error_description={result.error.message}
        />
      </div>
    )
  }

  const { blueprint, platformAbilitiesData, platformSecretsData } = result

  return (
    <div className="main-page main-page-3xl">
      <BlueprintDetail
        blueprint={blueprint}
        platformAbilitiesData={platformAbilitiesData}
        platformSecretsData={platformSecretsData}
      />
    </div>
  )
}

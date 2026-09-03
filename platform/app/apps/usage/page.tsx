import { Error } from '@/layouts/Errata'

import { Main } from './components'
import { getAll } from './server'

export default async function Page() {
  const response = await getAll({})

  if (!response) {
    return (
      <div className="main-page main-page-3xl">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in response) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={response.error.code}
          error_description={response.error.message}
        />
      </div>
    )
  }

  return <Main metrics={response.metrics} usage={response.usage} />
}

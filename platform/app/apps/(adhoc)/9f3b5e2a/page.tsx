import { Error } from '@/layouts/Errata'

import { Main } from './components'
import { listSpaces } from './server'

export default async function Page() {
  const result = await listSpaces({})

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

  const { spaces } = result

  return (
    <div className="main-page main-page-3xl">
      <Main spaces={spaces} />
    </div>
  )
}

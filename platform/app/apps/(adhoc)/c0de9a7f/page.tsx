import { Error } from '@/layouts/Errata'

import NoSsr from '@/components/NoSsr'

import { FactoriesMain } from './components'
import { listFactories } from './server'

export default async function Page() {
  const result = await listFactories({})

  if (!result) {
    return (
      <div className="main-page main-page-3xl">
        <Error error="loading" error_description="Loading factories..." />
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

  // @note client-only app embed - keep <NoSsr>, do not SSR this dashboard.
  // Server-rendering the client tree inside the apps-layout <Suspense> crashes
  // the boundary because useRouter hits a null React dispatcher.
  return (
    <div className="main-page main-page-3xl">
      <NoSsr>
        <FactoriesMain factories={result.factories} />
      </NoSsr>
    </div>
  )
}

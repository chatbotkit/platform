import { Error } from '@/layouts/Errata'

import NoSsr from '@/components/NoSsr'

import { Main } from './components'
import { getInspectorData } from './server'

function getInspect(
  searchParams?: Record<string, string | string[] | undefined>
) {
  const value = searchParams?.inspect

  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export default async function Page({ searchParams }) {
  const inspect = getInspect(await searchParams)
  const result = await getInspectorData({ inspect })

  if (!result) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in result) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4">
        <Error
          error={result.error.code}
          error_description={result.error.message}
        />
      </div>
    )
  }

  // @note the inspector is an embedded debug tool; rendering it client-only
  // avoids a server-render "Element type is invalid" inside the apps-layout
  // <Suspense> that aborts the boundary. SSR offers no
  // value here, so this both fixes the issue and is an acceptable trade-off.
  return (
    <NoSsr>
      <Main {...result} />
    </NoSsr>
  )
}

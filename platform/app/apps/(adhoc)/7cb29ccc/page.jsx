import { Error } from '@/layouts/Errata'

import NoSsr from '@/components/NoSsr'

import { Main } from './components'
import { getOverview } from './server'

export default async function Page() {
  const overview = await getOverview({})

  if (!overview) {
    return (
      <div className="main-page main-page-3xl">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in overview) {
    return (
      <div className="main-page main-page-3xl">
        <Error
          error={overview.error.code}
          error_description={overview.error.message}
        />
      </div>
    )
  }

  return (
    <div className="main-page main-page-7xl !py-4">
      {/* @note client-only app embed - keep <NoSsr>, do not SSR these dashboard
          tools. Full rationale: app/apps/layout.jsx */}
      <NoSsr>
        <Main overview={overview} />
      </NoSsr>
    </div>
  )
}

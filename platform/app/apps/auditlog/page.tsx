import { Error } from '@/layouts/Errata'

import NoSsr from '@/components/NoSsr'

import { Main } from './components'
import { listAll } from './server'

export default async function Page() {
  const result = await listAll({})

  if (!result) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Error error="loading" error_description="Loading..." />
      </div>
    )
  }

  if ('error' in result) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Error
          error={result.error.code}
          error_description={result.error.message}
        />
      </div>
    )
  }

  const { items, cursor } = result

  return (
    // @note client-only app embed - keep <NoSsr>, do not SSR these dashboard
    // tools. Full rationale: app/apps/layout.jsx
    <NoSsr>
      <Main initialItems={items} initialCursor={cursor} />
    </NoSsr>
  )
}

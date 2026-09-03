import { Error } from '@/layouts/Errata'

import NoSsr from '@/components/NoSsr'

import { getInstance } from '../server'
import { TasksMain } from './components'

export default async function Page(props) {
  const params = await props.params

  const { factory } = params

  const result = await getInstance({ factory })

  if (!result) {
    return (
      <div className="main-page main-page-3xl">
        <Error error="loading" error_description="Loading factory..." />
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

  // @note client-only app embed - keep <NoSsr>, do not SSR this dashboard
  // (see the root page for the full rationale).
  return (
    <NoSsr>
      <TasksMain factory={factory} instance={result} />
    </NoSsr>
  )
}

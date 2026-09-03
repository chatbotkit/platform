import NoSsr from '@/components/NoSsr'

import { Main } from './components'
import { listAll } from './server'

export default async function Page() {
  const initialDataResult = await listAll({
    includeIdle: false,
    take: 60,
  })

  const initialData =
    initialDataResult && !('error' in initialDataResult)
      ? initialDataResult
      : null

  return (
    // @note client-only app embed - keep <NoSsr>, do not SSR these dashboard
    // tools. Full rationale: app/apps/layout.jsx
    <NoSsr>
      <Main initialData={initialData} />
    </NoSsr>
  )
}

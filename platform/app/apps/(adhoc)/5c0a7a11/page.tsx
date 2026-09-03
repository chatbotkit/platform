import NoSsr from '@/components/NoSsr'

import { Main } from './components'
import { listAll } from './server'

function getParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string
) {
  const value = searchParams?.[key]

  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

export default async function Page({ searchParams }) {
  const params = await searchParams

  const blueprintId = getParam(params, 'blueprintId')

  const initialDataResult = await listAll({ blueprintId, take: 20 })

  const initialData =
    initialDataResult && !('error' in initialDataResult)
      ? initialDataResult
      : null

  return (
    // @note client-only app embed - keep <NoSsr>, do not SSR these dashboard
    // tools. Full rationale: app/apps/layout.jsx
    <NoSsr>
      <Main
        initialData={initialData}
        blueprintId={blueprintId}
        inspect={getParam(params, 'inspect')}
      />
    </NoSsr>
  )
}

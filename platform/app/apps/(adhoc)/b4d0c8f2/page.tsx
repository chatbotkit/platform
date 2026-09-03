import NoSsr from '@/components/NoSsr'

import { Main } from './components'
import { fetchSpecOperation, listSpecOperations } from './server'

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
  const requestedSlug = getParam(params, 'operation')

  const initialDataResult = await listSpecOperations({})

  const initialData =
    initialDataResult && !('error' in initialDataResult)
      ? initialDataResult
      : null

  const firstSlug = initialData?.groups?.[0]?.items?.[0]?.slug
  const initialSlug = requestedSlug || firstSlug || undefined

  const initialOperationResult = initialSlug
    ? await fetchSpecOperation({ slug: initialSlug })
    : null

  const initialOperation =
    initialOperationResult && !('error' in initialOperationResult)
      ? initialOperationResult
      : null

  return (
    // @note client-only app embed - keep <NoSsr>, do not SSR these dashboard
    // tools. Full rationale: app/apps/layout.jsx
    <NoSsr>
      <Main
        initialData={initialData}
        initialOperation={initialOperation}
        initialSlug={initialSlug}
      />
    </NoSsr>
  )
}

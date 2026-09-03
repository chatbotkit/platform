import { Main } from './components'
import { getConversations } from './server'

export default async function Page() {
  const initialResult = await getConversations({
    take: 24,
    order: 'desc',
  })

  const initialData =
    initialResult && !('error' in initialResult)
      ? initialResult
      : { items: [], cursor: null }

  return <Main initialData={initialData} />
}

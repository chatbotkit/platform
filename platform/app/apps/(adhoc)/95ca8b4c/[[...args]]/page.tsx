import { MainConfigurator } from '../components'
import { fetchNoteStream } from '../server'

export default async function Page(props: {
  params: Promise<{ args?: string[] }>
}) {
  const params = await props.params

  // @note the first path segment, when present, is the note stream id

  const [first] = params.args || []

  const conversationId = first ? decodeURIComponent(first) : null

  const result =
    conversationId && conversationId !== '404'
      ? await fetchNoteStream({ conversationId })
      : null

  const stream = result && !('error' in result) ? result : null

  return <MainConfigurator stream={stream} />
}

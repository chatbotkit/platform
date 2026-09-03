import { MainConfigurator } from '../components/Main'
import { fetchConversation } from '../server'

export default async function Page(props) {
  const params = await props.params
  // @note this function is only used to fetch the conversation - it is mostly
  // useful not only for the routes to be established but also to do fancy
  // stuff like preloading and caching

  let [first] = params.args || []

  first = first ? decodeURIComponent(first) : null

  const result =
    first && first !== '404' && !first.startsWith('@')
      ? await fetchConversation({ conversationId: first })
      : null

  // @note `fetchConversation` returns `null` when the conversation is not
  // accessible to this session and `{ error }` on an unexpected failure - in
  // both cases we open the chat with an empty conversation rather than passing
  // an error shape down to the UI.
  const conversation =
    result && !('error' in result)
      ? result
      : { conversationId: null, messages: [] }

  const selectedBot =
    first && first !== '404' && first.startsWith('@') ? first.slice(1) : null

  return (
    <MainConfigurator conversation={conversation} selectedBot={selectedBot} />
  )
}

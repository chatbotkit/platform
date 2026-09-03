import { errorToErrorResponse } from '@/lib/error'
import { getSortedMessages } from '@/lib/message'

import { ConversationView } from './components'
import {
  downvoteMessage,
  getConversationDetails,
  getConversationMessages,
  upvoteMessage,
} from './server'

export default async function Page(props) {
  const params = await props.params

  const { conversationId } = params

  let messages
  let conversation

  try {
    const result = await getConversationMessages({ conversationId })

    if (result.error) {
      throw errorToErrorResponse(result.error)
    }

    messages = getSortedMessages(result.messages)
  } catch {
    messages = null
  }

  try {
    const result = await getConversationDetails({ conversationId })

    if (result.error) {
      throw errorToErrorResponse(result.error)
    }

    conversation = result.conversation
  } catch {
    conversation = null
  }

  return (
    <>
      <section>
        <ConversationView
          conversationId={conversationId}
          conversation={conversation}
          messages={messages || []}
          upvoteHandler={upvoteMessage}
          downvoteHandler={downvoteMessage}
        />
      </section>
    </>
  )
}

import { useMemo, useState } from 'react'

import { getRandomId } from '@/lib/string'

import Conversation from '@/components/Conversation'
import Link from '@/components/Link'

export default function ConversationManager({
  conversationLink,
  situationLink,

  onStart,

  children,

  disabled,

  instance: _instance,

  ...props
}) {
  const [key, setKey] = useState(null)

  const [conversationId, setConversationId] = useState()

  function handleStart(conversationId, ...args) {
    setConversationId(conversationId)

    if (onStart) {
      onStart(conversationId, ...args)
    }
  }

  const instance = useMemo(() => {
    // @note how do we keep this method in sync with what we do elsewhere so
    // if a new property is added it is also reflected here

    // @todo find a way

    return {
      botId: _instance?.botId,

      backstory: _instance?.backstory,

      model: _instance?.model,

      datasetId: _instance?.datasetId,
      skillsetId: _instance?.skillsetId,

      privacy: _instance?.privacy,
      moderation: _instance?.moderation,
    }
  }, [
    _instance?.botId,

    _instance?.backstory,

    _instance?.model,

    _instance?.datasetId,
    _instance?.skillsetId,

    _instance?.privacy,
    _instance?.moderation,
  ])

  function restartConversation() {
    setKey(getRandomId())

    setConversationId(null)
  }

  return (
    <div className="space-y-6">
      <Conversation
        {...instance}
        {...props}
        key={key}
        onStart={handleStart}
        disabled={disabled}
      />
      {conversationId || children ? (
        <div className="flex flex-row flex-wrap gap-3">
          {conversationId ? (
            <button
              className="default-button"
              type="button"
              onClick={restartConversation}
              disabled={disabled}
            >
              Restart conversation
            </button>
          ) : null}
          {conversationId && conversationLink ? (
            <Link
              className="default-button"
              href={`/conversations/${conversationId}`}
              target="_blank"
              disabled={disabled}
            >
              See full conversation
            </Link>
          ) : null}
          {conversationId && situationLink ? (
            <Link
              className="default-button"
              href={`/playground/situation?conversationId=${conversationId}`}
              target="_blank"
              disabled={disabled}
            >
              Simulate situation
            </Link>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  )
}

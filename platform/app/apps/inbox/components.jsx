'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useParams, useSearchParams } from 'next/navigation'

import ConversationList from '@/components/ConversationList'

import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'

import { deleteConversation, getConversations } from './server'

// @note the page size must be shared by the initial fetch and ResourceList.
// ResourceList only renders the load more trigger once a full page has been
// returned, so a smaller initial fetch would pin the list to its first page.
const TAKE = 100

export function Conversations() {
  const [conversationsNode] = useDOMQuerySelector('#conversations')

  const conversationsNodeRef = useRef(conversationsNode)

  useEffect(() => {
    conversationsNodeRef.current = conversationsNode
  }, [conversationsNode])

  const params = useParams()

  const searchParams = useSearchParams()

  const tab = searchParams.get('tab') || 'latest'

  const getFilteredConversations = useCallback(
    async (params) => {
      const result = await getConversations({
        ...params,

        ...{
          widget: {
            meta: {
              app: 'widget',
            },
          },

          slack: {
            meta: {
              app: 'slack',
            },
          },

          discord: {
            meta: {
              app: 'discord',
            },
          },

          messenger: {
            meta: {
              app: 'messenger',
            },
          },

          whatsapp: {
            meta: {
              app: 'whatsapp',
            },
          },

          telegram: {
            meta: {
              app: 'telegram',
            },
          },

          email: {
            meta: {
              app: 'email',
            },
          },

          trigger: {
            meta: {
              app: 'trigger',
            },
          },

          moderation: {
            meta: {
              'abuse.flagged': 'true',
            },
          },

          console: {
            meta: {
              app: 'console',
            },
          },
        }[tab],
      })

      if ('error' in result) {
        return {
          items: [],
          cursor: null,
        }
      }

      return {
        items: result.items || [],
        cursor: result.cursor || null,
      }
    },
    [tab]
  )

  const [conversations, setConversations] = useState([])
  const [cursor, setCursor] = useState(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    getFilteredConversations({ take: TAKE })
      .then((response) => {
        const items = Array.isArray(response) ? response : response?.items || []
        const nextCursor =
          !Array.isArray(response) && 'cursor' in (response || {})
            ? response.cursor || null
            : null

        setConversations(items)
        setCursor(nextCursor)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [getFilteredConversations])

  return (
    <ConversationList
      items={conversations}
      setItems={setConversations}
      cursor={cursor}
      setCursor={setCursor}
      take={TAKE}
      listRoute={getFilteredConversations}
      forcePrefetch={true}
      loading={loading}
      exportRoute={null} // @todo uncomment when this is more ready
      deleteRoute={deleteConversation}
      instanceRoute={`/apps/inbox/[id]?tab=${tab}`}
      filter={false} // @todo uncomment when this is more ready
      selectedItem={params.conversationId}
      scrollContainerRef={conversationsNodeRef}
      loadMore="auto"
    />
  )
}

export function Main({ children }) {
  return (
    <div className="w-full h-screen flex flex-row">
      <div
        className="subtle-scrollbar w-full max-w-[25rem] overflow-auto p-2"
        id="conversations"
      >
        <Conversations />
      </div>
      <div
        className="w-full overflow-auto border-l border-l-gray-100 dark:border-l-gray-900"
        id="conversation"
      >
        {children}
      </div>
    </div>
  )
}

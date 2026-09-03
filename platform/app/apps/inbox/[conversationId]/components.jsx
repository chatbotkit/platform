'use client'

import { useCallback, useMemo } from 'react'
import { LuUser } from 'react-icons/lu'

import yaml from '@/lib/yaml'

import { AppNavExtra, useInfobarToggle } from '@/layouts/App'

import GoodCarousel from '@/components/Carousel'
import Conversation from '@/components/Conversation'
import Link from '@/components/Link'
import List from '@/components/List'
import { Meta } from '@/components/MetaArea'
import TimeAgo from '@/components/TimeAgo'

import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline'

function CarouselRenderer({ children }) {
  const items = useMemo(() => {
    let items = yaml.tryParse(children) || []

    if (!Array.isArray(items)) {
      items = []
    }

    items = items
      .filter(Boolean)
      .filter((item) => !!item.title || !!item.description || !!item.image)
      .map((item) => ({
        ...item,
        buttons: Array.isArray(item.buttons)
          ? item.buttons.filter((b) => !!b.caption)
          : [],
      }))

    return items
  }, [children])

  const hasEnoughItemsToScroll = items.length > 1

  if (!items.length) {
    return null
  }

  return (
    <GoodCarousel className="carousel w-full h-[400px] not-prose">
      {hasEnoughItemsToScroll ? (
        <GoodCarousel.Button
          className="cursor-pointer select-none bg-gray-100 dark:bg-gray-800 w-10 h-10 flex flex-col justify-center items-center rounded"
          position="left"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </GoodCarousel.Button>
      ) : null}
      {items.map((item, index) => (
        <GoodCarousel.Item
          key={index}
          {...item}
          className="w-[200px] [&_.carousel-content]:w-[200px] border rounded-lg text-sm"
          buttonAs={({ href, link = href, children }) =>
            link ? (
              <Link
                className="default-link whitespace-nowrap overflow-hidden text-ellipsis"
                href={link}
                target="_blank"
                rel="noreferrer"
              >
                {children}
              </Link>
            ) : (
              <button
                className="default-button small whitespace-nowrap overflow-hidden text-ellipsis"
                type="button"
              >
                {children}
              </button>
            )
          }
        />
      ))}
      {hasEnoughItemsToScroll ? (
        <GoodCarousel.Button
          className="cursor-pointer select-none bg-gray-100 dark:bg-gray-800 w-10 h-10 flex flex-col justify-center items-center rounded"
          position="right"
        >
          <ArrowRightIcon className="w-5 h-5" />
        </GoodCarousel.Button>
      ) : null}
    </GoodCarousel>
  )
}

const conversationCodeRenderers = {
  carousel: CarouselRenderer,
}

export function ConversationInfo({ conversation }) {
  const contact = conversation?.contact

  const otherConversations = useMemo(() => {
    if (!contact?.conversations?.edges) {
      return []
    }

    return contact.conversations.edges
      .map((edge) => edge.node)
      .filter((conv) => conv.id !== conversation.id)
      .slice(0, 5)
  }, [contact, conversation?.id])

  if (!conversation) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        Loading conversation details...
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y auto-divide-gray-100">
      {/* conversation details */}
      <section className="p-4 space-y-3">
        {conversation.name ? (
          <div>
            <label className="default-label">Name</label>
            <p className="mt-1 text-sm">{conversation.name}</p>
          </div>
        ) : null}
        {conversation.description ? (
          <div>
            <label className="default-label">Description</label>
            <p className="mt-1 text-sm">{conversation.description}</p>
          </div>
        ) : null}
        <div>
          <label className="default-label">Created</label>
          <p className="mt-1 text-sm">
            <TimeAgo time={conversation.createdAt} />
          </p>
        </div>
      </section>
      {/* contact section */}
      {contact ? (
        <section className="p-4">
          <label className="default-label mb-2 block">Contact</label>
          <List>
            <List.Item
              icon={
                <div className="w-10 h-10 rounded-full auto-bg-gray-100 flex items-center justify-center">
                  <LuUser className="w-5 h-5 auto-text-gray-500" />
                </div>
              }
              title={
                contact.name ||
                contact.email ||
                contact.phone ||
                contact.nick ||
                'Unknown Contact'
              }
              body={[contact.description, contact.email, contact.phone].filter(
                Boolean
              )}
              timestamp={contact.createdAt}
            />
          </List>
        </section>
      ) : null}
      {/* other conversations section */}
      {otherConversations.length > 0 ? (
        <section className="p-4">
          <label className="default-label mb-2 block">
            Recent Conversations
          </label>
          <List emptyMessage="No other conversations">
            {otherConversations.map((conv) => (
              <List.Item
                key={conv.id}
                link={`/apps/inbox/${conv.id}`}
                title={conv.name || 'Untitled Conversation'}
                body={conv.description}
                timestamp={conv.createdAt}
              />
            ))}
          </List>
        </section>
      ) : null}
      {/* metadata section */}
      {conversation.meta && Object.keys(conversation.meta).length > 0 ? (
        <section className="p-4">
          <label className="default-label mb-2 block">Metadata</label>
          <Meta meta={conversation.meta} />
        </section>
      ) : null}
    </div>
  )
}

export function useConversationInfobar(conversationId, conversation) {
  const { toggle, toRender } = useInfobarToggle({
    id: 'conversation-info',
    width: '20%',
    render: useCallback(
      () => <ConversationInfo conversation={conversation} />,
      [conversation]
    ),
    renderNav: useCallback(() => <h1>Info</h1>, []),
  })

  return { toggle, toRender }
}

export function ConversationView({
  conversationId,
  conversation,

  messages,

  upvoteHandler,
  downvoteHandler,
}) {
  const { toggle, toRender } = useConversationInfobar(
    conversationId,
    conversation
  )

  return (
    <>
      {toRender}
      <AppNavExtra>
        <button className="default-button push" type="button" onClick={toggle}>
          Info
        </button>
      </AppNavExtra>
      <div className="main-page main-page-3xl main-page-left !p-10 relative">
        <Conversation
          conversationId={conversationId}
          messages={messages}
          functional={false}
          disabled={true}
          upvoteHandler={upvoteHandler}
          downvoteHandler={downvoteHandler}
          codeRenderers={conversationCodeRenderers}
        />
      </div>
    </>
  )
}

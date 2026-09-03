'use client'

import { useMemo } from 'react'

import Emoji from '@/components/Emoji'
import ResourceList from '@/components/ResourceList'

import useGraphQLConnectionListRoute from '@/hooks/useGraphQLConnectionListRoute'
import useRouter from '@/hooks/useRouter'

const DEFAULT_LIST_ROUTE = '/api/v1/rating/list'

const RATING_LIST_QUERY = `
  query ResourceListRatings(
    $first: Int
    $last: Int
    $after: ID
    $before: ID
    $order: ListOrder
    $contactIds: [ID!]
    $conversationIds: [ID!]
    $messageIds: [ID!]
    $botIds: [ID!]
    $sentiment: RatingSentiment
    $value: String
  ) {
    ratings(
      first: $first
      last: $last
      after: $after
      before: $before
      order: $order
      contactIds: $contactIds
      conversationIds: $conversationIds
      messageIds: $messageIds
      botIds: $botIds
      sentiment: $sentiment
      value: $value
    ) {
      edges {
        node {
          id
          name
          description
          value
          reason
          meta
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`

export default function RatingList({
  kind = 'rating',

  listRoute: _listRoute = DEFAULT_LIST_ROUTE,
  listMode = _listRoute === DEFAULT_LIST_ROUTE ? 'graphql' : 'route',
  exportRoute = '/api/v1/rating/export',

  deleteRoute = '/api/v1/rating/[id]/delete',

  instanceRoute = '/ratings/[id]',

  filter = true,

  descriptionMapper = (item) => {
    return (
      item.reason ||
      item.description || (
        <span className="italic">A rating without description</span>
      )
    )
  },

  extraTags = ({ value }) => {
    return (
      <>
        <div className="tag">{value >= 0 ? 'upvote' : 'downvote'}</div>
      </>
    )
  },

  contactId,
  conversationId,
  messageId,
  botId,
  sentiment,
  value,

  ...props
}) {
  const router = useRouter()

  const rawValue = value || router.query.value

  // Sentiment (upvote/downvote) and value (a numeric comparison expression
  // such as >=10) are separate filters. ?value=upvote predates the sentiment
  // filter and keeps working by mapping onto it.
  const legacySentiment =
    rawValue === 'upvote' || rawValue === 'downvote' ? rawValue : undefined

  const selectedSentiment =
    sentiment || router.query.sentiment || legacySentiment

  const selectedValue = legacySentiment ? undefined : rawValue

  const variables = useMemo(
    () => ({
      contactIds: contactId ? [contactId] : undefined,
      conversationIds: conversationId ? [conversationId] : undefined,
      messageIds: messageId ? [messageId] : undefined,
      botIds: botId ? [botId] : undefined,
      sentiment: selectedSentiment || undefined,
      value: selectedValue || undefined,
    }),
    [
      botId,
      contactId,
      conversationId,
      messageId,
      selectedSentiment,
      selectedValue,
    ]
  )

  const graphqlListRoute = useGraphQLConnectionListRoute({
    query: RATING_LIST_QUERY,
    connection: 'ratings',
    variables,
  })

  const listRoute = useMemo(() => {
    if (contactId) {
      return `/api/v1/contact/${contactId}/rating/list`
    }

    const searchParams = new URLSearchParams()

    if (conversationId) {
      searchParams.set('conversationId', conversationId)
    }

    if (messageId) {
      searchParams.set('messageId', messageId)
    }

    if (botId) {
      searchParams.set('botId', botId)
    }

    if (searchParams.toString()) {
      return `${_listRoute}?${searchParams.toString()}`
    }

    return _listRoute
  }, [_listRoute, botId, contactId, conversationId, messageId])

  const useGraphQLListRoute =
    listMode === 'graphql' && _listRoute === DEFAULT_LIST_ROUTE

  const effectiveListRoute = useGraphQLListRoute ? graphqlListRoute : listRoute

  const key = useGraphQLListRoute
    ? `graphql:${contactId || 'all-contacts'}:${conversationId || 'all-conversations'}:${messageId || 'all-messages'}:${botId || 'all-bots'}:${selectedSentiment || 'all-sentiments'}:${selectedValue || 'all-values'}`
    : listRoute

  const ratingFilterOptions = useMemo(() => {
    return [
      {
        id: 'upvotes',
        link: '?sentiment=upvote',
        title: 'Upvotes',
        description: 'Filter upvoted items (positive feedback)',
        tag: (
          <span>
            <Emoji>👍</Emoji> upvote
          </span>
        ),
        displayName: 'upvote',
        isSelected: selectedSentiment === 'upvote',
      },
      {
        id: 'downvotes',
        link: '?sentiment=downvote',
        title: 'Downvotes',
        description: 'Filter downvoted items (negative feedback)',
        tag: (
          <span>
            <Emoji>👎</Emoji> downvote
          </span>
        ),
        displayName: 'downvote',
        isSelected: selectedSentiment === 'downvote',
      },
    ]
  }, [selectedSentiment])

  return (
    <ResourceList
      key={key}
      {...props}
      kind={kind}
      listRoute={effectiveListRoute}
      exportRoute={exportRoute}
      deleteRoute={deleteRoute}
      instanceRoute={instanceRoute}
      filter={filter}
      filterOptions={ratingFilterOptions}
      extraTags={extraTags}
      descriptionMapper={descriptionMapper}
    />
  )
}

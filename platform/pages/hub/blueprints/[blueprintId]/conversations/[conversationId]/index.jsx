import prisma from '@/prisma/client'

import { CACHE_PRESETS, applyCacheHeaders } from '@/lib/cdn'
import { getSortedMessages } from '@/lib/message'
import { redactMessagesEntropy } from '@/lib/redact.entropy'
import { makeJsonSafe } from '@/lib/struct'

import Hub from '@/layouts/Hub'

import Conversation from '@/components/Conversation'
import Emoji from '@/components/Emoji'
import Headline from '@/components/Headline'
import List from '@/components/List'
import NavHeader from '@/components/NavHeader'
import PageSections from '@/components/PageSections'
import StructuredData from '@/components/StructuredData'

// @note cap the number of messages pulled into this public, cdn-cached page so a
// very long conversation can't blow the node heap or the ssr payload; mirrors the
// engine's MAX_COMPLETE_MESSAGE_TAKE
const MAX_CONVERSATION_MESSAGE_TAKE = 1000

export default function Index({
  instance,
  conversation,
  previousConversations,
}) {
  return (
    <>
      <div className="main-page last">
        <NavHeader
          link={`/hub/blueprints/${instance.slug || instance.id}`}
          caption={instance.name || 'blueprint'}
          title={conversation.name || 'Conversation'}
        >
          {conversation.description ||
            'See how this agent handles real interactions and learn from its responses.'}
        </NavHeader>
      </div>
      <PageSections>
        <section data-page-section-title="Messages">
          <div className="main-page">
            <Headline title="Messages">
              The messages exchanged in this conversation.
            </Headline>
            <Conversation
              key={conversation.id}
              conversationId={conversation.id}
              messages={conversation.messages}
              stream={false}
              functional={false}
              disabled={true}
            />
          </div>
        </section>
        {previousConversations?.length > 0 ? (
          <section data-page-section-title="Other">
            <div className="main-page">
              <Headline title="Other Conversations">
                Explore other conversations with this agent.
              </Headline>
              <List>
                {previousConversations.map(
                  ({ id, name, description, createdAt }) => {
                    name = name?.trim() || ''
                    description = description?.trim() || ''

                    return (
                      <List.Item
                        key={id}
                        className="!gap-4"
                        link={`/hub/blueprints/${
                          instance.slug || instance.id
                        }/conversations/${id}`}
                        icon={
                          <Emoji className="tinted-icon p-2 rounded-full border flex flex-row justify-center items-center w-12 h-12 text-2xl">
                            💬
                          </Emoji>
                        }
                        title={name || 'Untitled Conversation'}
                        body={
                          <div className="space-y-2">
                            <div className="line-clamp-2">
                              {description ? (
                                <span>{description}</span>
                              ) : (
                                <span className="italic">No description</span>
                              )}
                            </div>
                          </div>
                        }
                        timestamp={createdAt}
                      />
                    )
                  }
                )}
              </List>
            </div>
          </section>
        ) : null}
      </PageSections>
    </>
  )
}

Index.getLayout = function (children, { instance, conversation }) {
  // @note build a meaningful description from the first user message if no
  // explicit description is available
  const description =
    conversation.description ||
    conversation.messages
      ?.find((m) => m.type === 'user')
      ?.text?.slice(0, 160) ||
    `A conversation with the ${instance.name || 'blueprint'} agent`

  // @note Google's DiscussionForumPosting rich result requires at least one of
  // text/image/video. Use the full conversation transcript as the post body,
  // falling back to the description so this is never empty.
  const text =
    conversation.messages
      ?.map((m) => m.text)
      .filter(Boolean)
      .join('\n\n') || description

  const blueprintSlug = instance.slug || instance.id

  return (
    <Hub
      breadcrumbs={['Conversation', 'Blueprints', 'Hub', 'ChatBotKit']}
      title={conversation.name || 'Conversation'}
      description={description}
      image={`/hub/blueprints/${blueprintSlug}/card`}
      rss={`/hub/blueprints/${blueprintSlug}/conversations/rss.xml`}
    >
      <StructuredData
        data={{
          '@context': 'https://schema.org/',
          '@type': 'DiscussionForumPosting',
          url: `/hub/blueprints/${blueprintSlug}/conversations/${conversation.id}`,
          headline: conversation.name || 'Conversation',
          description,
          text,
          datePublished: new Date(conversation.createdAt).toISOString(),
          author: {
            '@type': 'Organization',
            name: 'ChatBotKit',
            url: '/',
          },
          isPartOf: {
            '@type': 'WebPage',
            url: `/hub/blueprints/${blueprintSlug}`,
            name: instance.name,
          },
        }}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org/',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Hub',
              item: '/hub',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Blueprints',
              item: '/hub/blueprints',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: instance.name || 'Blueprint',
              item: `/hub/blueprints/${blueprintSlug}`,
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: conversation.name || 'Conversation',
            },
          ],
        }}
      />
      {children}
    </Hub>
  )
}

export async function getServerSideProps(context) {
  const blueprintId = context.query.blueprintId?.trim?.()
  const conversationId = context.query.conversationId?.trim?.()

  if (!blueprintId || !conversationId) {
    return {
      notFound: true,
    }
  }

  // @note set CDN cache headers to avoid hitting the server on every crawl
  applyCacheHeaders(context.res, CACHE_PRESETS.HUB_PAGE)

  const instance = await prisma.hubBlueprintPage.findFirst({
    where: {
      OR: [{ id: blueprintId }, { slug: blueprintId }],
    },

    select: {
      id: true,

      name: true,
      description: true,

      slug: true,

      shareLog: true,

      blueprint: {
        select: {
          id: true,
        },
      },

      user: {
        select: {
          id: true,

          name: true,
          image: true,
        },
      },
    },

    cacheStrategy: {
      ttl: 60,
      swr: 60,
    },
  })

  if (!instance) {
    return {
      notFound: true,
    }
  }

  if (!instance.shareLog) {
    return {
      notFound: true,
    }
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      bot: {
        blueprintId: instance.blueprint.id,
      },
    },

    select: {
      id: true,

      name: true,
      description: true,

      createdAt: true,

      messages: {
        select: {
          id: true,

          type: true,
          text: true,

          meta: true,

          createdAt: true,
        },

        // @note disabled because it can overfill the memory for very long messages
        // orderBy: [
        //   {
        //     createdAt: 'asc',
        //   },
        //   { id: 'asc' },
        // ],
      },
    },

    cacheStrategy: {
      ttl: 60,
      swr: 60,
    },
  })

  if (!conversation) {
    return {
      notFound: true,
    }
  }

  // @note sort ascending in memory, then keep only the most recent
  // MAX_CONVERSATION_MESSAGE_TAKE messages to cap the payload (the cap that used
  // to be a SQL `take` now happens here, after the JS sort), and redact
  // high-entropy strings that could be passwords, keys or sensitive data

  conversation.messages = redactMessagesEntropy(
    getSortedMessages(conversation.messages).slice(
      -MAX_CONVERSATION_MESSAGE_TAKE
    )
  )

  const previousConversations = await prisma.conversation.findMany({
    where: {
      bot: {
        blueprintId: instance.blueprint.id,
      },
    },

    orderBy: [
      {
        createdAt: 'desc',
      },
      {
        id: 'desc',
      },
    ],

    cursor: {
      id: conversationId,
    },

    skip: 1, // skip the current conversation

    take: 10,

    select: {
      id: true,

      name: true,
      description: true,

      createdAt: true,
    },

    cacheStrategy: {
      ttl: 60,
      swr: 60,
    },
  })

  return {
    props: makeJsonSafe({
      instance,
      conversation,
      previousConversations,
    }),
  }
}

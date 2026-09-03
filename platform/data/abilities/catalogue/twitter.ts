import {
  createAuxiliaryTemplate,
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'

import type { Schema } from '@/pages/api/auxiliary/skillset/ability/twitter/sql'

// @note the public docs say "posts" but the live X (formerly Twitter) API v2
// wire paths still use the `tweets` segment (e.g. POST /2/tweets), which is what
// the typed write helpers target here.
// @see https://docs.x.com/x-api/introduction
const BASE_URL = 'https://api.x.com/2'

const jsonHeaders = () => ({
  Authorization: secret(),
  'Content-Type': 'application/json',
})

const abilities = {
  // === SQL interface ========================================================
  //
  // @note the bulk of the read surface (post lookups, search, timelines and
  // user lookups) plus posting and deleting is exposed through a single SQL
  // ability backed by /api/auxiliary/skillset/ability/twitter/sql.

  'twitter/sql/exec': createAuxiliaryTemplate<Schema>({
    provider: 'twitter',
    icon: '@logo/x.com',
    name: 'Query X with SQL',
    description:
      'Run a simple SQL query against X (Twitter). Tables: twitter.tweets — SELECT WHERE id, WHERE query (X search operators) or WHERE author_id; INSERT to post; DELETE to remove — and twitter.users — SELECT WHERE id or username. SHOW TABLES and DESCRIBE are supported; JOINs and UPDATE are not. Writes require a user-context access token.',
    tags: ['twitter', 'x', 'sql', 'query', 'social-media', 'beta'],
    path: '/api/auxiliary/skillset/ability/twitter/sql',
    secret: '@twitter',
    instruction: {
      sql: field({
        name: 'sql',
        description:
          'the SQL query to execute - SHOW, DESCRIBE, SELECT, INSERT and DELETE are supported',
        placeholder: true,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // === Core write actions ===================================================

  'twitter/post/create': createFetchTemplate({
    provider: 'twitter',
    icon: '@logo/x.com',
    name: 'Create X Post',
    description:
      'Publish a new post (tweet), optionally quoting another post. Requires a user-context access token with the tweet.write scope.',
    tags: ['twitter', 'x', 'post', 'tweet', 'create', 'social-media', 'beta'],
    secret: '@twitter',
    instruction: {
      method: 'POST',
      url: `${BASE_URL}/tweets`,
      headers: jsonHeaders(),
      body: {
        text: field({
          name: 'text',
          description: 'the text content of the post (up to 280 characters)',
        }),
        quote_tweet_id: field({
          name: 'quotePostId',
          description: 'the ID of a post to quote (optional)',
          optional: true,
        }),
        reply_settings: field({
          name: 'replySettings',
          description: 'who is allowed to reply to this post (optional)',
          enum: ['following', 'mentionedUsers', 'subscribers'],
          optional: true,
        }),
      },
    },
  }),

  'twitter/post/reply': createFetchTemplate({
    provider: 'twitter',
    icon: '@logo/x.com',
    name: 'Reply to X Post',
    description:
      'Publish a post as a reply to an existing post. Requires a user-context access token with the tweet.write scope.',
    tags: ['twitter', 'x', 'post', 'tweet', 'reply', 'create', 'social-media'],
    secret: '@twitter',
    instruction: {
      method: 'POST',
      url: `${BASE_URL}/tweets`,
      headers: jsonHeaders(),
      body: {
        text: field({
          name: 'text',
          description: 'the text content of the reply (up to 280 characters)',
        }),
        reply: {
          in_reply_to_tweet_id: field({
            name: 'inReplyToPostId',
            description: 'the ID of the post being replied to',
            placeholder: true,
          }),
        },
      },
    },
  }),

  'twitter/post/like': createFetchTemplate({
    provider: 'twitter',
    icon: '@logo/x.com',
    name: 'Like an X Post',
    description:
      'Make the authenticated user like a post. Requires a user-context access token with the like.write scope.',
    tags: ['twitter', 'x', 'post', 'tweet', 'like', 'social-media'],
    secret: '@twitter',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/users/',
        field({
          name: 'userId',
          description: 'the ID of the authenticated user performing the like',
          placeholder: true,
        }),
        '/likes',
      ],
      headers: jsonHeaders(),
      body: {
        tweet_id: field({
          name: 'postId',
          description: 'the ID of the post to like',
          placeholder: true,
        }),
      },
    },
  }),

  'twitter/post/repost': createFetchTemplate({
    provider: 'twitter',
    icon: '@logo/x.com',
    name: 'Repost an X Post',
    description:
      'Make the authenticated user repost (retweet) a post. Requires a user-context access token with the tweet.write scope.',
    tags: [
      'twitter',
      'x',
      'post',
      'tweet',
      'repost',
      'retweet',
      'social-media',
    ],
    secret: '@twitter',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/users/',
        field({
          name: 'userId',
          description: 'the ID of the authenticated user performing the repost',
          placeholder: true,
        }),
        '/retweets',
      ],
      headers: jsonHeaders(),
      body: {
        tweet_id: field({
          name: 'postId',
          description: 'the ID of the post to repost',
          placeholder: true,
        }),
      },
    },
  }),

  'twitter/user/follow': createFetchTemplate({
    provider: 'twitter',
    icon: '@logo/x.com',
    name: 'Follow an X User',
    description:
      'Make the authenticated user follow another user. Requires a user-context access token with the follows.write scope.',
    tags: ['twitter', 'x', 'user', 'follow', 'social-media'],
    secret: '@twitter',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/users/',
        field({
          name: 'userId',
          description: 'the ID of the authenticated user performing the follow',
          placeholder: true,
        }),
        '/following',
      ],
      headers: jsonHeaders(),
      body: {
        target_user_id: field({
          name: 'targetUserId',
          description: 'the ID of the user to follow',
          placeholder: true,
        }),
      },
    },
  }),

  'twitter/dm/send': createFetchTemplate({
    provider: 'twitter',
    icon: '@logo/x.com',
    name: 'Send an X Direct Message',
    description:
      'Send a direct message to a user, creating a one-to-one conversation if needed. Requires a user-context access token with the dm.write scope.',
    tags: ['twitter', 'x', 'dm', 'message', 'send', 'social-media'],
    secret: '@twitter',
    instruction: {
      method: 'POST',
      url: BASE_URL,
      path: [
        '/dm_conversations/with/',
        field({
          name: 'participantId',
          description: 'the ID of the user to send the direct message to',
          placeholder: true,
        }),
        '/messages',
      ],
      headers: jsonHeaders(),
      body: {
        text: field({
          name: 'text',
          description: 'the text content of the direct message',
        }),
      },
    },
  }),

  // === Generic ==============================================================

  'twitter/api/call': createFetchTemplate({
    provider: 'twitter',
    icon: '@logo/x.com',
    name: 'Call X API',
    description:
      'Make a generic call to any X (Twitter) API v2 endpoint by specifying the HTTP method, full URL and an optional JSON request body. Use this for endpoints not covered by the dedicated X tools, such as bookmarks, mutes, blocks, lists, spaces and trends.',
    tags: ['twitter', 'x', 'api', 'call', 'generic'],
    secret: '@twitter',
    instruction: {
      method: field({
        name: 'method',
        description: 'the HTTP method to use (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description:
          'the full URL of the X API endpoint to call, including query string (e.g. https://api.x.com/2/users/me)',
      }),
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: field({
        name: 'body',
        description:
          'the request body as JSON text for POST, PUT or PATCH requests',
        optional: true,
      }),
    },
  }),

  // === Packs ================================================================

  'pack/twitter': createPackTemplate({
    provider: 'twitter',
    icon: '@logo/x.com',
    name: 'Install X Tools',
    description:
      'Installs X (Twitter) tools into the conversation. Query posts and users with SQL (search, lookups, timelines, posting and deleting), and post, reply, like, repost, follow and send direct messages. Write actions require a user-context access token.',
    tags: ['twitter', 'x', 'pack', 'social-media', 'beta'],
    secret: '@twitter',
    instruction: {
      abilities: [
        'twitter/sql/exec',
        'twitter/post/create',
        'twitter/post/reply',
        'twitter/post/like',
        'twitter/post/repost',
        'twitter/user/follow',
        'twitter/dm/send',
        'twitter/api/call',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/twitter[read-only]': createPackTemplate({
    provider: 'twitter',
    icon: '@logo/x.com',
    name: 'Install X Query Tools',
    description:
      'Installs read-oriented X (Twitter) tools into the conversation. Query posts and users with SQL — search posts, look up users and read timelines. Works with an app-only bearer token.',
    tags: ['twitter', 'x', 'pack', 'social-media', 'beta'],
    secret: '@twitter',
    instruction: {
      abilities: [
        'twitter/sql/exec',
        'twitter/api/call',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities

import type { Column } from '@chatbotkit-dev/sql/driver'
import { GenericDriver } from '@chatbotkit-dev/sql/driver'
import type { WhereStatement } from '@chatbotkit-dev/sql/parse'
import { getTableName, getWhereProperties } from '@chatbotkit-dev/sql/parse'

import handler from '@/lib/auxiliary.sql'
import call, { getCallError } from '@/lib/call'
import { throwNotAuthenticated } from '@/lib/response'

import pluralize from 'pluralize'
import { z } from 'zod'

const schema = z.object({
  sql: z.string(),
})

export type Schema = z.infer<typeof schema>

// @note the public docs say "posts" but the live X API v2 wire paths still use
// the `tweets` segment, so that is what we call here.
const BASE_URL = 'https://api.x.com/2'

const TWEET_FIELDS =
  'created_at,author_id,conversation_id,in_reply_to_user_id,lang,public_metrics'

const USER_FIELDS =
  'created_at,description,location,url,verified,public_metrics'

interface Row {
  id: string
  [key: string]: unknown
}

/**
 * Flattens an X post object (with its nested `public_metrics`) into a flat row.
 */
function mapTweet(tweet: Record<string, unknown>): Row {
  const metrics = (tweet.public_metrics as Record<string, unknown>) || {}

  return {
    id: String(tweet.id),
    text: tweet.text,
    author_id: tweet.author_id,
    created_at: tweet.created_at,
    conversation_id: tweet.conversation_id,
    in_reply_to_user_id: tweet.in_reply_to_user_id,
    lang: tweet.lang,
    retweet_count: metrics.retweet_count,
    reply_count: metrics.reply_count,
    like_count: metrics.like_count,
    quote_count: metrics.quote_count,
    impression_count: metrics.impression_count,
  }
}

/**
 * Flattens an X user object (with its nested `public_metrics`) into a flat row.
 */
function mapUser(user: Record<string, unknown>): Row {
  const metrics = (user.public_metrics as Record<string, unknown>) || {}

  return {
    id: String(user.id),
    username: user.username,
    name: user.name,
    description: user.description,
    location: user.location,
    url: user.url,
    verified: user.verified,
    followers_count: metrics.followers_count,
    following_count: metrics.following_count,
    tweet_count: metrics.tweet_count,
    listed_count: metrics.listed_count,
    created_at: user.created_at,
  }
}

/**
 * Maps the `twitter.tweets` table onto the X posts endpoints. SELECT resolves to
 * a lookup (by id), a recent search (by query) or a user timeline (by author_id);
 * INSERT publishes a post; DELETE removes one. UPDATE is not supported because
 * the standard X API cannot edit posts.
 */
class TweetsDriver extends GenericDriver<Row> {
  #token: string

  constructor({ token }: { token: string }) {
    super()

    this.#token = token
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id' },
      { type: 'string', name: 'text' },
      { type: 'string', name: 'author_id', readOnly: true },
      { type: 'string', name: 'created_at', readOnly: true },
      { type: 'string', name: 'conversation_id', readOnly: true },
      { type: 'string', name: 'in_reply_to_user_id', readOnly: true },
      { type: 'string', name: 'lang', readOnly: true },
      { type: 'number', name: 'retweet_count', readOnly: true },
      { type: 'number', name: 'reply_count', readOnly: true },
      { type: 'number', name: 'like_count', readOnly: true },
      { type: 'number', name: 'quote_count', readOnly: true },
      { type: 'number', name: 'impression_count', readOnly: true },
      // @note virtual/write-only columns usable in WHERE and INSERT
      { type: 'string', name: 'query' },
      { type: 'string', name: 'in_reply_to_tweet_id' },
      { type: 'string', name: 'quote_tweet_id' },
    ]
  }

  async #get(url: URL) {
    const response = await call(url.href, {
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    return (await response.json()) as { data?: unknown }
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    if (properties['id']) {
      const url = new URL(`${BASE_URL}/tweets/${properties['id']}`)

      url.searchParams.set('tweet.fields', TWEET_FIELDS)

      const { data } = await this.#get(url)

      if (!data) {
        return []
      }

      return [{ row: mapTweet(data as Record<string, unknown>) }]
    }

    if (properties['query']) {
      const url = new URL(`${BASE_URL}/tweets/search/recent`)

      url.searchParams.set('query', String(properties['query']))
      url.searchParams.set('tweet.fields', TWEET_FIELDS)
      url.searchParams.set('max_results', '25')

      const { data } = await this.#get(url)

      return ((data as Record<string, unknown>[]) || []).map((tweet) => ({
        row: mapTweet(tweet),
      }))
    }

    if (properties['author_id']) {
      const url = new URL(`${BASE_URL}/users/${properties['author_id']}/tweets`)

      url.searchParams.set('tweet.fields', TWEET_FIELDS)
      url.searchParams.set('max_results', '25')

      const { data } = await this.#get(url)

      return ((data as Record<string, unknown>[]) || []).map((tweet) => ({
        row: mapTweet(tweet),
      }))
    }

    throw new Error(
      'Selecting from twitter.tweets requires a WHERE clause on id, query (X search operators) or author_id'
    )
  }

  async doInsert(parameters: Record<string, unknown>) {
    const body: Record<string, unknown> = {}

    if (parameters['text'] !== undefined) {
      body.text = parameters['text']
    }

    if (parameters['quote_tweet_id'] !== undefined) {
      body.quote_tweet_id = parameters['quote_tweet_id']
    }

    if (parameters['in_reply_to_tweet_id'] !== undefined) {
      body.reply = { in_reply_to_tweet_id: parameters['in_reply_to_tweet_id'] }
    }

    const response = await call(`${BASE_URL}/tweets`, {
      method: 'POST',
      headers: {
        Authorization: this.#token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { data } = (await response.json()) as { data?: { id: string } }

    return { id: data?.id }
  }

  async doUpdate() {
    throw new Error('Updating posts is not supported by the X API')
  }

  async doDelete({ row }: { row: Row }) {
    const response = await call(`${BASE_URL}/tweets/${row.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }
  }
}

/**
 * Maps the `twitter.users` table onto the X users endpoints. SELECT resolves to
 * a lookup by id or by username. Users cannot be created, updated or deleted
 * through the API.
 */
class UsersDriver extends GenericDriver<Row> {
  #token: string

  constructor({ token }: { token: string }) {
    super()

    this.#token = token
  }

  async describeColumns(): Promise<Column[]> {
    return [
      { type: 'string', name: 'id' },
      { type: 'string', name: 'username' },
      { type: 'string', name: 'name', readOnly: true },
      { type: 'string', name: 'description', readOnly: true },
      { type: 'string', name: 'location', readOnly: true },
      { type: 'string', name: 'url', readOnly: true },
      { type: 'boolean', name: 'verified', readOnly: true },
      { type: 'number', name: 'followers_count', readOnly: true },
      { type: 'number', name: 'following_count', readOnly: true },
      { type: 'number', name: 'tweet_count', readOnly: true },
      { type: 'number', name: 'listed_count', readOnly: true },
      { type: 'string', name: 'created_at', readOnly: true },
    ]
  }

  async doSelect(_columns: string[], where?: WhereStatement) {
    const properties = where ? getWhereProperties(where) : {}

    let url: URL

    if (properties['id']) {
      url = new URL(`${BASE_URL}/users/${properties['id']}`)
    } else if (properties['username']) {
      url = new URL(`${BASE_URL}/users/by/username/${properties['username']}`)
    } else {
      throw new Error(
        'Selecting from twitter.users requires a WHERE clause on id or username'
      )
    }

    url.searchParams.set('user.fields', USER_FIELDS)

    const response = await call(url.href, {
      headers: {
        Authorization: this.#token,
      },
    })

    if (!response.ok) {
      throw await getCallError(response)
    }

    const { data } = (await response.json()) as { data?: unknown }

    if (!data) {
      return []
    }

    return [{ row: mapUser(data as Record<string, unknown>) }]
  }

  override async insert(): Promise<never> {
    throw new Error('Creating users is not supported by the X API')
  }

  override async update(): Promise<never> {
    throw new Error('Updating users is not supported by the X API')
  }

  override async delete(): Promise<never> {
    throw new Error('Deleting users is not supported by the X API')
  }

  async doInsert() {
    throw new Error('Creating users is not supported by the X API')
  }

  async doUpdate() {
    throw new Error('Updating users is not supported by the X API')
  }

  async doDelete() {
    throw new Error('Deleting users is not supported by the X API')
  }
}

export default handler(
  schema,
  [
    { database: 'twitter', name: 'tweets' },
    { database: 'twitter', name: 'users' },
  ],
  async (table, _parameters, headers) => {
    const token = headers.get('x-access-token')

    if (!token) {
      return throwNotAuthenticated()
    }

    const name = pluralize(table.name, 1)

    if (name === 'tweet') {
      return new TweetsDriver({ token })
    }

    if (name === 'user') {
      return new UsersDriver({ token })
    }

    throw new Error(`No driver found for table ${getTableName(table)}`)
  }
)

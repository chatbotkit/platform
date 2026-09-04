import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import {
  getUsageCountByTypeOverPeriod,
  getUsageCountByTypeSince,
} from '@/prisma/sql'
import { join } from '@/prisma/utils'

import { ttlCache } from '@/lib/cache'
import memcache from '@/lib/memcache'
import {
  getBaseLanguageModelTokenCount,
  useTypeToLanguageModelMapping,
} from '@/lib/model.utils'
import { toNumber } from '@/lib/number'
import { getUsageKey } from '@/lib/usage.record'

const tokenUsageTypes = Object.keys(useTypeToLanguageModelMapping)

/**
 * Shapes a `{ date, total }` count series from a TypedSQL query into the public
 * `{ date: Date; total: number }` form.
 *
 * @note DATE(createdAt) over the non-null createdAt column never yields null;
 * Prisma's TypedSQL types it defensively as nullable, so we narrow it here.
 */
function mapCountSeries(
  rows: {
    date: Date | string | null
    total: bigint | number | null | { toNumber?: () => number }
  }[]
): { date: Date; total: number }[] {
  return rows.flatMap(({ date, total }) => {
    if (date == null) {
      return []
    }

    return [{ date: new Date(date), total: toNumber(total) }]
  })
}

export function getUsageSeriesFromDate(
  usageSeries: {
    tokens: { date: Date; total: number }[]
    conversations: { date: Date; total: number }[]
    messages: { date: Date; total: number }[]
  },
  fromDate: Date
): {
  tokens: { date: Date; total: number }[]
  conversations: { date: Date; total: number }[]
  messages: { date: Date; total: number }[]
} {
  const startDate = new Date(fromDate)

  startDate.setHours(0, 0, 0, 0)

  const filterSeries = <T extends { date: Date }>(series: T[]) =>
    series.filter(({ date }) => new Date(date) >= startDate)

  return {
    tokens: filterSeries(usageSeries.tokens),
    conversations: filterSeries(usageSeries.conversations),
    messages: filterSeries(usageSeries.messages),
  }
}

export async function getUsage(userId: string): Promise<{
  tokens: { value: number; ttl: number }
  conversations: { value: number; ttl: number }
  messages: { value: number; ttl: number }
}> {
  const [
    tokens,
    conversations,
    messages,
    // image,
    // audio,
    // fetch,
    // email,
    tokensTtl,
    conversationsTtl,
    messagesTtl,
    // imageTtl,
    // audioTtl,
    // fetchTtl,
  ] = await memcache
    .pipeline()
    .get(getUsageKey(userId, 'token'))
    .get(getUsageKey(userId, 'conversation'))
    .get(getUsageKey(userId, 'message'))
    // .get(getUsageKey(userId, 'image'))
    // .get(getUsageKey(userId, 'audio'))
    // .get(getUsageKey(userId, 'fetch'))
    // .get(getUsageKey(userId, 'email'))
    .ttl(getUsageKey(userId, 'token'))
    .ttl(getUsageKey(userId, 'conversation'))
    .ttl(getUsageKey(userId, 'message'))
    // .ttl(getUsageKey(userId, 'image'))
    // .ttl(getUsageKey(userId, 'audio'))
    // .ttl(getUsageKey(userId, 'fetch'))
    // .ttl(getUsageKey(userId, 'email'))
    //
    // @note the result tuple is named here rather than inferred. The contract's
    // `exec` does not accumulate a type per chained command the way the Upstash
    // client's does - that machinery existed to serve two call sites, one of
    // which is JavaScript and never had the types anyway.
    .exec<[unknown, unknown, unknown, number, number, number]>()

  return {
    tokens: {
      value: parseInt(String(tokens), 10) || 0,
      ttl: Math.max(tokensTtl, 0) * 1000,
    },

    conversations: {
      value: parseInt(String(conversations), 10) || 0,
      ttl: Math.max(conversationsTtl, 0) * 1000,
    },

    messages: {
      value: parseInt(String(messages), 10) || 0,
      ttl: Math.max(messagesTtl, 0) * 1000,
    },
  }
}

export async function getUsageSeriesNow(
  userId: string,
  interval: number = 90
): Promise<{
  tokens: { date: Date; total: number }[]
  conversations: { date: Date; total: number }[]
  messages: { date: Date; total: number }[]
}> {
  // @note we intentionally use Promise.all instead of prisma.$transaction here
  // because these are read-only aggregation queries that don't require ACID
  // consistency. Using a transaction holds a single database connection for
  // all queries, which can lead to connection timeouts on high-volume users
  // where queries take 30+ seconds. With Promise.all, each query uses its own
  // connection and can complete independently.
  // @note these queries use the index: @@index(fields: [userId, type, createdAt(sort: Desc)])
  // the token query uses exact token types so MySQL can avoid the wildcard scan

  const tokenTypeList = join(tokenUsageTypes)

  // @note the period boundary is computed here (rather than with a MySQL
  // CURDATE()/INTERVAL expression) and passed as a parameter - keeps the SQL
  // portable and lets TypedSQL type the query. Same pattern as metric.ts.

  const since = new Date()

  since.setHours(0, 0, 0, 0)
  since.setDate(since.getDate() - interval)

  const [tokens, conversations, messages] = await Promise.all([
    // @todo migrate to TypedSQL (prisma/sql) - blocked on the token type IN-list,
    // which cannot be an array parameter in TypedSQL (MySQL); needs a non-array
    // approach (e.g. a LIKE '%_TOKEN' filter or a fixed type list)
    // eslint-disable-next-line custom-eslint-rules/require-typed-sql -- see @todo above
    prisma.$queryRaw`
      SELECT
        DATE(createdAt) AS date,
        type,
        SUM(count) AS total
      FROM
        Usage
      WHERE
        userId = ${userId}
        AND type IN (${tokenTypeList})
        AND createdAt >= ${since}
      GROUP BY
        DATE(createdAt), type
      ORDER BY
        DATE(createdAt) ASC;
    `,
    prisma.$queryRawTyped(
      getUsageCountByTypeSince(userId, 'CHATBOTKIT_CONVERSATION', since)
    ),
    prisma.$queryRawTyped(
      getUsageCountByTypeSince(userId, 'CHATBOTKIT_MESSAGE', since)
    ),
  ])

  return {
    tokens: Object.values(
      // @todo come up with better type-checking
      // @ts-ignore
      tokens
        .map(({ total, date, type, ...rest }) => {
          // @note MySQL returns SUM() as Decimal, SQLite as BigInt
          total = toNumber(total)

          total = getBaseLanguageModelTokenCount(
            useTypeToLanguageModelMapping[type],
            total
          )

          return {
            ...rest,

            total,

            date,
          }
        })
        .reduce((acc, { total, date, ...rest }) => {
          if (!acc[date]) {
            acc[date] = { ...rest, date: date, total: 0 }
          }

          acc[date].total += total

          return acc
        }, {})
    ),

    conversations: mapCountSeries(conversations),

    messages: mapCountSeries(messages),
  }
}

export async function getUsageSeries(
  userId: string,
  interval: number = 90
): Promise<{
  tokens: { date: Date; total: number }[]
  conversations: { date: Date; total: number }[]
  messages: { date: Date; total: number }[]
}> {
  return ttlCache(
    `usage:series:user[${userId}]:interval[${interval}]`,
    QUARTER_HOUR_IN_SECONDS,
    async () => {
      return getUsageSeriesNow(userId, interval)
    }
  )
}

export async function getUsageForPeriod(
  userId: string,
  fromDate: Date,
  toDate: Date
): Promise<{
  tokens: { date: Date; total: number }[]
  conversations: { date: Date; total: number }[]
  messages: { date: Date; total: number }[]
}> {
  // @note we intentionally use Promise.all instead of prisma.$transaction here
  // for the same reasons as getUsageSeriesNow -

  const tokenTypeList = join(tokenUsageTypes)

  const [tokens, conversations, messages] = await Promise.all([
    // @todo migrate to TypedSQL (prisma/sql) - blocked on the token type IN-list,
    // which cannot be an array parameter in TypedSQL (MySQL); needs a non-array
    // approach (e.g. a LIKE '%_TOKEN' filter or a fixed type list)
    // eslint-disable-next-line custom-eslint-rules/require-typed-sql -- see @todo above
    prisma.$queryRaw`
      SELECT
        DATE(createdAt) AS date,
        type,
        SUM(count) AS total
      FROM
        Usage
      WHERE
        userId = ${userId}
        AND type IN (${tokenTypeList})
        AND createdAt >= ${fromDate}
        AND createdAt <= ${toDate}
      GROUP BY
        DATE(createdAt), type
      ORDER BY
        DATE(createdAt) ASC;
    `,
    prisma.$queryRawTyped(
      getUsageCountByTypeOverPeriod(
        userId,
        'CHATBOTKIT_CONVERSATION',
        fromDate,
        toDate
      )
    ),
    prisma.$queryRawTyped(
      getUsageCountByTypeOverPeriod(
        userId,
        'CHATBOTKIT_MESSAGE',
        fromDate,
        toDate
      )
    ),
  ])

  return {
    tokens: Object.values(
      // @todo come up with better type-checking
      // @ts-ignore
      tokens
        .map(({ total, date, type, ...rest }) => {
          // @note MySQL returns SUM() as Decimal, SQLite as BigInt
          total = toNumber(total)

          total = getBaseLanguageModelTokenCount(
            useTypeToLanguageModelMapping[type],
            total
          )

          return {
            ...rest,

            total,

            date,
          }
        })
        .reduce((acc, { total, date, ...rest }) => {
          if (!acc[date]) {
            acc[date] = { ...rest, date: date, total: 0 }
          }

          acc[date].total += total

          return acc
        }, {})
    ),

    conversations: mapCountSeries(conversations),

    messages: mapCountSeries(messages),
  }
}

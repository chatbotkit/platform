import { useCallback, useMemo } from 'react'

import { jsonl } from '@/lib/fetch'
import { either } from '@/lib/helpers'
import it, { rateLimitWithCondition } from '@/lib/it'

import useFetch from '@/hooks/useFetch'

export async function* humanizeJsonl(body, tps) {
  yield* rateLimitWithCondition(
    jsonl(body),
    (message) => message.type === 'token',
    {
      messagesPerSecond: tps,
    }
  )
}

export default function useConversationManagerFetch({
  stream,

  headers,

  token,

  tps,

  ...props
}) {
  const { fetch: doFetch, ...rest } = useFetch({
    ...props,

    headers: useMemo(() => {
      return {
        ...headers,

        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : null),
      }
    }, [headers, token]),
  })

  const fetch = useCallback(
    async (url, options) => {
      const tkn = either(options?.token, token)

      const fn = options?.endpoint ? options.endpoint : doFetch

      const result = await fn(url, {
        ...options,

        endpoint: undefined,

        headers: {
          ...(tkn
            ? {
                Authorization: `Bearer ${tkn}`,
              }
            : null),

          ...options?.headers,
        },
      })

      return result
    },
    [token, doFetch]
  )

  const fetchStream = useCallback(
    async (url, options) => {
      const errorType = options?.errorType

      if (!errorType) {
        throw new Error('errorType is required')
      }

      const returnType = options?.returnType

      if (!returnType) {
        throw new Error('returnType is required')
      }

      const fn = options?.endpoint ? options.endpoint : fetch

      const {
        error,
        code,
        data: body,
      } = await fn(url, {
        ...options,

        endpoint: undefined,

        headers: {
          ...options?.headers,

          Accept: stream ? 'application/jsonl' : 'application/json',
        },

        dataType: stream ? 'body' : 'json',
      })

      let iter

      if (error) {
        iter = it([{ type: errorType, data: { error, code } }])
      } else {
        if (options?.endpoint) {
          if (stream) {
            iter = it(body)
          } else {
            iter = it([{ type: returnType, data: body }])
          }
        } else {
          if (stream) {
            iter = tps ? humanizeJsonl(body, tps) : jsonl(body)
          } else {
            iter = it([{ type: returnType, data: body }])
          }
        }
      }

      return iter
    },
    [stream, tps, fetch]
  )

  return {
    fetch,

    fetchStream,

    ...rest,
  }
}

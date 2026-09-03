'use client'

import { useEffect, useRef, useState } from 'react'

import { ChatBotKit } from '@chatbotkit/sdk'

const TOKEN_REFRESH_MS = 10 * 60 * 1000 // refresh well before a 15-minute token expires

type MintResult = { token?: string; error?: { message?: string } }

export interface UseMintedClientReturn {
  client: ChatBotKit | null
  error: Error | null
}

/**
 * Mint a short-lived, route-scoped token via the given facade action and expose
 * a browser SDK client built from it, refreshing before expiry so long-lived
 * views never hit an expired token.
 *
 * The client is rebuilt whenever `key` changes (e.g. the selected resource id),
 * which keeps per-resource token scoping correct. When `key` is null the client
 * is torn down (nothing selected / disabled).
 *
 * @param mint - facade action returning `{ token }` (or `{ error }`)
 * @param key - identity that scopes the token; changing it re-mints
 */
export function useMintedClient(
  mint: () => Promise<MintResult>,
  key: string | null | undefined
): UseMintedClientReturn {
  const [client, setClient] = useState<ChatBotKit | null>(null)
  const [error, setError] = useState<Error | null>(null)

  // @note keep mint in a ref so a changing function identity does not re-mint;
  // only `key` drives re-minting.
  const mintRef = useRef(mint)

  useEffect(() => {
    mintRef.current = mint
  }, [mint])

  useEffect(() => {
    if (!key) {
      setClient(null)

      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const refresh = async () => {
      try {
        const result = await mintRef.current()

        if (!result || 'error' in result || !result.token) {
          throw new Error(
            result?.error?.message || 'Failed to mint access token'
          )
        }

        if (cancelled) {
          return
        }

        // @note build an SDK client that talks to THIS origin's API, scoped by
        // the minted token. Kept here (not in cbk.sdk, which is server-only and
        // signs tokens) so no server-secret code reaches the browser bundle.
        setClient(
          new ChatBotKit({
            secret: result.token,
            host: window.location.host,
            protocol: window.location.protocol as 'http:' | 'https:',
          })
        )
        setError(null)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)))
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(refresh, TOKEN_REFRESH_MS)
        }
      }
    }

    void refresh()

    return () => {
      cancelled = true

      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [key])

  return { client, error }
}

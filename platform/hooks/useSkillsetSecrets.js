'use client'

import { useCallback, useEffect, useState } from 'react'

import { captureException } from '@/lib/error'
import fetch from '@/lib/fetch'

// @note `secrets(skillsetIds:)` resolves to the secrets this skillset's
// abilities link to, which is exactly what we want to report on.
//
// The two kinds are asked for separately on purpose. Owner-level `verification`
// only makes sense for a shared secret - verifying a personal one without a
// contact leaves `getSecretManager` with nothing to work with and the endpoint
// conflicts. A personal secret is authenticated by each contact at runtime, so
// there is nothing for the owner to verify anyway. Same split the connect app
// makes.

const SKILLSET_SECRETS_QUERY = `
  query SkillsetSecrets($skillsetIds: [ID!]) {
    shared: secrets(last: 100, kind: [shared], skillsetIds: $skillsetIds) {
      edges {
        node {
          id
          name
          description
          type
          kind
          config

          verification {
            status

            action {
              type
              url
            }
          }
        }
      }
    }

    personal: secrets(last: 100, kind: [personal], skillsetIds: $skillsetIds) {
      edges {
        node {
          id
          name
          description
          type
          kind
        }
      }
    }
  }
`

// @note a shared secret is the owner's to finish; a personal one is connected by
// each contact when they first use it, so it is never the owner's problem
export const SECRET_READY = 'authenticated'
export const SECRET_NEEDS_SETUP = 'unauthenticated'
export const SECRET_PER_CONTACT = 'contact'

const NO_SECRETS = []

function toNodes(connection) {
  return (connection?.edges || []).map((edge) => edge?.node).filter(Boolean)
}

/**
 * The secrets a skillset's abilities depend on, and whether each one is ready.
 */
export default function useSkillsetSecrets(skillsetId) {
  const [secrets, setSecrets] = useState(NO_SECRETS)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!skillsetId) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/v1/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          query: SKILLSET_SECRETS_QUERY,
          variables: { skillsetIds: [skillsetId] },
        }),
      })

      const body = await response.json()

      if (!response.ok || body?.errors?.length) {
        throw new Error(
          body?.errors?.[0]?.message || 'Unable to load skillset secrets'
        )
      }

      const shared = toNodes(body.data?.shared).map((node) => {
        return {
          ...node,

          status: node.verification?.status || SECRET_NEEDS_SETUP,

          actionUrl: node.verification?.action?.url || null,
        }
      })

      const personal = toNodes(body.data?.personal).map((node) => {
        return {
          ...node,

          status: SECRET_PER_CONTACT,

          actionUrl: null,
        }
      })

      const next = [...shared, ...personal]

      setSecrets(next)

      // @note handed back so a caller which just changed a secret can act on
      // its new state without waiting for a re-render
      return next
    } catch (error) {
      captureException(error)
    } finally {
      setLoading(false)
    }
  }, [skillsetId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { secrets, loading, refresh }
}

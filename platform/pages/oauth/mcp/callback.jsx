import { useEffect } from 'react'

import { setupRequestContext } from '@/lib/context.setup'
import { executeInContext } from '@/lib/context.store'
import { captureException } from '@/lib/error'
import { McpOAuthProvider } from '@/lib/mcp.oauth'
import { makeJsonSafe } from '@/lib/struct'

import Errata, { fail } from '@/layouts/Errata'

// @note This is the OAuth callback page for connecting to external MCP servers
// that require OAuth authentication. It runs in a popup window, exchanges the
// authorization code for tokens via McpOAuthProvider.handleCallback, then
// signals success back to the opener window via postMessage and closes itself.

export default function Page({ error, error_description, success }) {
  useEffect(() => {
    // @note it is normal for this to be called twice in non-production
    // environments so you will see the same message twice

    window.opener?.postMessage(
      { type: 'oauth', params: { error, error_description, success } },
      '*'
    )

    if (!error) {
      window.close()
    }
  }, [error, error_description, success])

  return (
    !error && (
      <div>
        <h1>Success</h1>
        <p>You have been securely authenticated with the MCP server.</p>
      </div>
    )
  )
}

Page.getLayout = function (children, props) {
  return <Errata {...props}>{children}</Errata>
}

export async function getServerSideProps(context) {
  return executeInContext(async () => {
    // @note we need to set some headers in order to get the correct context for
    // the secret manager, so we can use the correct frontend host and other
    // context information

    setupRequestContext(context.req)

    const { state, code, error, error_description } = context.query

    if (error) {
      return {
        props: makeJsonSafe({
          error,
          error_description,
        }),
      }
    }

    if (!state) {
      return fail('state_not_found', 'State parameter not found')
    }

    if (!code) {
      return fail('code_not_found', 'Authorization code not found')
    }

    try {
      await McpOAuthProvider.handleCallback(state, code)

      return {
        props: makeJsonSafe({
          success: true,
        }),
      }
    } catch (e) {
      await captureException(e)

      return fail('oauth_failed', `OAuth authentication failed: ${e.message}`)
    }
  })
}

import prisma from '@/prisma/client'

import { withFormUrlencodedPost } from '@/lib/method'
import {
  isRefreshToken,
  revokeRefreshToken,
  revokeToken,
} from '@/lib/oauth.jwt'
import { requiredUrlParam } from '@/lib/query.get'
import { badRequest, notFound, send } from '@/lib/response'

/**
 * OAuth 2.0 Token Revocation endpoint for MCP server integrations.
 * Implements RFC 7009 - OAuth 2.0 Token Revocation.
 *
 * Per RFC 7009, returns 200 OK regardless of whether the token existed to
 * prevent token enumeration attacks. Supports both access tokens and refresh
 * tokens.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7009
 */
export default withFormUrlencodedPost(async function (req) {
  const mcpserverIntegrationId = requiredUrlParam(req, 'mcpserverIntegrationId')

  const mcpserverIntegration = await prisma.mcpserverIntegration.findUnique({
    where: { id: mcpserverIntegrationId },
    select: { id: true, oAuthConnectionId: true },
  })

  if (!mcpserverIntegration?.oAuthConnectionId) {
    return notFound({
      error: 'invalid_request',
      error_description: 'OAuth not available for this MCP server integration',
    })
  }

  // Parse form-encoded body

  const rawBody = await req.text()

  const params = new URLSearchParams(rawBody)

  const token = params.get('token')
  const tokenTypeHint = params.get('token_type_hint')

  if (!token) {
    return badRequest({
      error: 'invalid_request',
      error_description: 'token parameter is required',
    })
  }

  const tokenIsRefresh =
    tokenTypeHint === 'refresh_token' || isRefreshToken(token)

  if (tokenIsRefresh) {
    await revokeRefreshToken(token)
  } else {
    await revokeToken(token)
  }

  // @note per RFC 7009 Section 2.2, return 200 regardless of whether the token
  // existed or was already revoked

  return send()
})

export const config = {
  api: {
    bodyParser: false,
  },
}

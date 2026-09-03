import type {
  IdpOAuthAuthorizationRequest,
  IdpOAuthPendingState,
} from '@/lib/oauth.connection.idp'
import {
  consumeIdpOAuthAuthorizationRequest,
  deleteIdpOAuthAuthorizationRequest,
  deleteIdpOAuthPendingState,
  generateIdpOAuthCode,
  retrieveIdpOAuthAuthorizationRequest,
  retrieveIdpOAuthPendingState,
  storeIdpOAuthAuthorizationRequest,
  storeIdpOAuthPendingState,
} from '@/lib/oauth.connection.idp'

/**
 * Caller context for the MCP server IdP OAuth flow.
 */
export interface McpIdpOAuthContext {
  mcpserverIntegrationId: string
}

/**
 * Pending state for the MCP server IdP OAuth flow.
 * @see IdpOAuthPendingState
 */
export type McpIdpOAuthPendingState = IdpOAuthPendingState<McpIdpOAuthContext>

/**
 * Authorization request type for the MCP server IdP OAuth flow.
 * @see IdpOAuthAuthorizationRequest
 */
export type McpIdpOAuthAuthorizationRequest =
  IdpOAuthAuthorizationRequest<McpIdpOAuthContext>

export function storeMcpIdpOAuthPendingState(
  idpState: string,
  state: McpIdpOAuthPendingState,
  expirySeconds?: number
): Promise<void> {
  return storeIdpOAuthPendingState(idpState, state, expirySeconds)
}

export function retrieveMcpIdpOAuthPendingState(
  idpState: string
): Promise<McpIdpOAuthPendingState | null> {
  return retrieveIdpOAuthPendingState<McpIdpOAuthContext>(idpState)
}

export function deleteMcpIdpOAuthPendingState(
  idpState: string
): Promise<boolean> {
  return deleteIdpOAuthPendingState(idpState)
}

export function generateMcpIdpOAuthCode(): string {
  return generateIdpOAuthCode()
}

export function storeMcpIdpOAuthAuthorizationRequest(
  request: McpIdpOAuthAuthorizationRequest,
  expirySeconds?: number
): Promise<void> {
  return storeIdpOAuthAuthorizationRequest(request, expirySeconds)
}

export function retrieveMcpIdpOAuthAuthorizationRequest(
  code: string
): Promise<McpIdpOAuthAuthorizationRequest | null> {
  return retrieveIdpOAuthAuthorizationRequest<McpIdpOAuthContext>(code)
}

export function consumeMcpIdpOAuthAuthorizationRequest(
  code: string
): Promise<McpIdpOAuthAuthorizationRequest | null> {
  return consumeIdpOAuthAuthorizationRequest<McpIdpOAuthContext>(code)
}

export function deleteMcpIdpOAuthAuthorizationRequest(
  code: string
): Promise<boolean> {
  return deleteIdpOAuthAuthorizationRequest(code)
}

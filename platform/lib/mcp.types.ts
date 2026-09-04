import type { McpHeaderSource, SerializableTool } from '@/lib/tool.environment'

/**
 * Common options for MCP tool installation.
 */
export interface McpInstallOptions {
  sessionId: string
  url: string
  /**
   * Swapped headers for the install-time connection. When `headerSource` is
   * given the installed tools store that instead and swap again on each call.
   */
  headers?: Record<string, string>
  headerSource?: McpHeaderSource
  tools?: string[]
  prefix?: string
}

/**
 * Request body for the MCP tool install API endpoint.
 */
export interface McpInstallRequest extends McpInstallOptions {
  conversationId?: string
  contactId?: string
  namespace?: string
}

/**
 * Response from the MCP tool install API endpoint.
 */
export interface McpInstallResponse {
  success: boolean
}

/**
 * Request body for the MCP tool call API endpoint.
 */
export interface McpCallRequest {
  conversationId?: string
  contactId?: string
  namespace?: string
  tool: SerializableTool
  args: unknown
}

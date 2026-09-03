import type { SerializableTool } from '@/lib/tool.environment'

/**
 * Common options for MCP tool installation.
 */
export interface McpInstallOptions {
  sessionId: string
  url: string
  headers?: Record<string, string>
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

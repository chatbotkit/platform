/**
 * OpenAI Skybridge Type Definitions
 *
 * Types for the OpenAI widget API that's available in ChatGPT iframes.
 */

/**
 * Structured content from a tool response
 */
export interface StructuredContent {
  result?: unknown
  [key: string]: unknown
}

/**
 * Tool response metadata provided by OpenAI
 */
export interface ToolResponseMetadata {
  /** The tool name that was called */
  toolName?: string
  /** The structured content returned by the tool */
  structuredContent?: StructuredContent
  /** Raw content array from MCP response */
  content?: Array<{
    type: string
    text?: string
    data?: unknown
  }>
  /** Whether the tool call resulted in an error */
  isError?: boolean
  /** Additional metadata */
  _meta?: Record<string, unknown>
}

/**
 * OpenAI globals available on window.openai
 */
export interface OpenAIGlobals {
  /** Tool response metadata for the current widget */
  toolResponseMetadata?: ToolResponseMetadata
  /** Notify OpenAI of the widget's intrinsic height */
  notifyIntrinsicHeight?: (height: number) => void
  /** Request user confirmation for an action */
  requestConfirmation?: (message: string) => Promise<boolean>
  /** Additional methods may be available */
  [key: string]: unknown
}

declare global {
  interface Window {
    openai?: OpenAIGlobals
  }
}

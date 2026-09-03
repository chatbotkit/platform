/**
 * OpenAI Skybridge Utilities
 *
 * Helper functions for interacting with OpenAI's widget API (Skybridge).
 * These utilities help widgets communicate with the ChatGPT host.
 *
 * @see https://developers.openai.com/apps-sdk/build/mcp-server
 */

import type { OpenAIGlobals, ToolResponseMetadata } from '../types/openai'

/**
 * Get the OpenAI global object if available
 */
export function getOpenAI(): OpenAIGlobals | undefined {
  if (typeof window !== 'undefined' && 'openai' in window) {
    return (window as unknown as { openai: OpenAIGlobals }).openai
  }
  return undefined
}

/**
 * Get the tool response metadata from OpenAI
 */
export function getToolResponseMetadata(): ToolResponseMetadata | undefined {
  return getOpenAI()?.toolResponseMetadata
}

/**
 * Notify OpenAI of the widget's intrinsic height
 * Call this whenever the widget's height changes
 */
export function notifyHeight(height?: number): void {
  const openai = getOpenAI()
  if (openai?.notifyIntrinsicHeight) {
    if (height !== undefined) {
      openai.notifyIntrinsicHeight(height)
    } else if (typeof document !== 'undefined') {
      // Auto-calculate height from document
      const body = document.body
      const html = document.documentElement
      const computedHeight = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      )
      openai.notifyIntrinsicHeight(computedHeight)
    }
  }
}

/**
 * Listen for tool response metadata updates
 */
export function onToolResponse(
  callback: (metadata: ToolResponseMetadata) => void
): () => void {
  const checkMetadata = () => {
    const metadata = getToolResponseMetadata()
    if (metadata) {
      callback(metadata)
    }
  }

  // Check immediately
  checkMetadata()

  // Also poll for changes (OpenAI may set metadata after load)
  const interval = setInterval(checkMetadata, 100)
  const timeout = setTimeout(() => clearInterval(interval), 5000)

  return () => {
    clearInterval(interval)
    clearTimeout(timeout)
  }
}

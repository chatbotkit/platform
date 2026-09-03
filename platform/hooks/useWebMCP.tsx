import { useEffect } from 'react'

export type WebMCPTool<TInput = unknown, TResult = unknown> = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (input: TInput) => TResult | Promise<TResult>
}

type NavigatorModelContext = {
  registerTool: (
    tool: WebMCPTool,
    options?: {
      signal?: AbortSignal
    }
  ) => void | Promise<void>
}

declare global {
  interface Navigator {
    modelContext?: NavigatorModelContext
  }
}

export function registerTools(
  tools: WebMCPTool | WebMCPTool[]
): (() => void) | void {
  if (typeof navigator === 'undefined') {
    return
  }

  const modelContext = navigator.modelContext

  if (!modelContext?.registerTool) {
    return
  }

  // @note only register objects shaped like a tool. Callers occasionally pass
  // a keyed map of functions ({ [name]: { ... } }) instead of an array of
  // tools; without this guard the whole map reaches `registerTool` and throws
  // on the missing top-level `description`.
  const toolsToRegister = (Array.isArray(tools) ? tools : [tools]).filter(
    (tool): tool is WebMCPTool =>
      typeof tool?.name === 'string' && typeof tool?.description === 'string'
  )

  if (!toolsToRegister.length) {
    return
  }

  const abortController = new AbortController()

  toolsToRegister.forEach((tool) => {
    // @note a single malformed tool must not prevent the rest from registering
    try {
      void modelContext.registerTool(tool, {
        signal: abortController.signal,
      })
    } catch {
      // ignore - the browser rejected this tool; keep registering the others
    }
  })

  return () => {
    abortController.abort()
  }
}

export default function useWebMCP(
  tools: WebMCPTool | WebMCPTool[] | null | undefined
): void {
  useEffect(() => {
    if (!tools) {
      return
    }

    const cleanup = registerTools(tools)

    return () => {
      if (typeof cleanup === 'function') {
        cleanup()
      }
    }
  }, [tools])
}

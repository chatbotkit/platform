import { ONE_MINUTE_IN_SECONDS } from '@chatbotkit-dev/time'

import type { User } from '@/prisma/types'

import {
  getContextContact,
  getContextConversation,
  getContextNamespace,
} from '@/lib/context.store'
import debug from '@/lib/debug'
import { SafeError, UserAuthError, UserInputError } from '@/lib/error'
import fetch, { getFetchError } from '@/lib/fetch'
import { getLocalAPIHostURL } from '@/lib/host'
import type {
  McpCallRequest,
  McpInstallOptions,
  McpInstallRequest,
  McpInstallResponse,
} from '@/lib/mcp.types'
import { NOT_AUTHENTICATED_CODE, throwConflict } from '@/lib/response'
import { getTemporaryUserToken } from '@/lib/session.temp'
import type { SerializableTool } from '@/lib/tool.environment'

export async function installMcpTools(
  user: Pick<User, 'id'>,
  { url, headers, tools, prefix }: Omit<McpInstallOptions, 'sessionId'>
): Promise<McpInstallResponse> {
  debug('installing mcp tools', {
    url,
    tools,
    prefix,
  }).log('mcp.edge.installMcpTools')

  const conversation = getContextConversation()
  const contact = getContextContact()
  const namespace = getContextNamespace()

  let sessionId: string | undefined

  {
    if (!sessionId) {
      if (conversation) {
        sessionId = `conversation-${conversation.id}`
      }
    }

    if (!sessionId) {
      if (namespace) {
        sessionId = `namespace-${namespace}`
      }
    }

    if (!sessionId) {
      if (contact) {
        sessionId = `contact-${contact.id}`
      }
    }

    if (!sessionId) {
      return throwConflict(`Cannot obtain session`)
    }
  }

  if (!url) {
    return throwConflict(`MCP server URL or client integration ID is required`)
  }

  try {
    new URL(url)
  } catch {
    throw new UserInputError(`Invalid MCP server URL: ${url}`)
  }

  const response = await fetch(
    getLocalAPIHostURL(
      `/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/install`
    ),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getTemporaryUserToken(user.id, {
          durationInSeconds: ONE_MINUTE_IN_SECONDS,
        })}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: conversation?.id,
        contactId: contact?.id,
        namespace: namespace ?? undefined,
        sessionId,
        url,
        headers,
        tools,
        prefix,
      } satisfies McpInstallRequest),
    }
  )

  if (!response.ok) {
    let error = await getFetchError(response)

    if (error.code === NOT_AUTHENTICATED_CODE) {
      error = new UserAuthError(error.message)
    } else {
      error = new SafeError(error.message, error.code)
    }

    debug('installation failed', { error }).log('mcp.edge.installMcpTools')

    throw error
  }

  const result = await response.json()

  debug('using result', { result }).log('mcp.edge.installMcpTools')

  return result
}

export async function callMcpTool(
  user: Pick<User, 'id'>,
  tool: SerializableTool,
  args: unknown
): Promise<unknown> {
  debug('calling mcp tools', { tool, args }).log('mcp.edge.callMcpTool')

  const conversation = getContextConversation()
  const contact = getContextContact()
  const namespace = getContextNamespace()

  const response = await fetch(
    getLocalAPIHostURL(
      `/api/auxiliary/skillset/ability/chatbotkit/mcp/tool/call`
    ),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getTemporaryUserToken(user.id, {
          durationInSeconds: ONE_MINUTE_IN_SECONDS,
        })}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: conversation?.id,
        contactId: contact?.id,
        namespace: namespace ?? undefined,
        tool,
        args,
      } satisfies McpCallRequest),
    }
  )

  if (!response.ok) {
    let error = await getFetchError(response, {
      toolName: tool.name,
      toolArgs: args,
    })

    if (error.code === NOT_AUTHENTICATED_CODE) {
      error = new UserAuthError(error.message)
    } else {
      error = new SafeError(error.message, error.code)
    }

    throw error
  }

  const result = await response.json()

  debug('using result', { result }).log('mcp.edge.callMcpTool')

  return result
}

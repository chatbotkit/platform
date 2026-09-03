import type { User } from '@/prisma/types'

import { getAbilityFunctionName } from '@/lib/ability.function'
import debug from '@/lib/debug'
import { UserAuthError, UserInputError, captureError } from '@/lib/error'
import type { McpStreamableHTTPClientTransport } from '@/lib/mcp.oauth'
import { McpOAuthProvider } from '@/lib/mcp.oauth'
import type { McpInstallOptions, McpInstallResponse } from '@/lib/mcp.types'
import type { McpSerializableTool } from '@/lib/tool.environment'
import {
  installEnvironmentTools,
  makeEnvironmentToolSource,
} from '@/lib/tool.environment'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'

// @note timeouts to prevent hanging on unresponsive MCP servers

const MCP_CONNECT_TIMEOUT_MS = 30_000 // 30 seconds
const MCP_REQUEST_TIMEOUT_MS = 60_000 // 60 seconds

export async function installMcpTools(
  user: Pick<User, 'id'>,
  { sessionId, url, headers, tools, prefix }: McpInstallOptions
): Promise<McpInstallResponse> {
  debug('install mcp tools', {
    sessionId,
    url,
    headers,
    tools,
    prefix,
  }).log('mcp.direct.installMcpTools')

  let transport: McpStreamableHTTPClientTransport | undefined

  let client: Client | undefined

  try {
    debug('connecting to mcp server', {
      url,
      headers,
    }).log('mcp.direct.installMcpTools')

    transport = McpOAuthProvider.getClientTransport(user, {
      sessionId,
      url,
      headers,
    })

    client = new Client({
      name: 'cbk-mcp-client',
      version: '1.0.0',
    })

    await client.connect(transport, { timeout: MCP_CONNECT_TIMEOUT_MS })

    debug('connected to mcp server', {
      url,
      headers,
    }).log('mcp.direct.installMcpTools')

    const response = await client.listTools(undefined, {
      timeout: MCP_REQUEST_TIMEOUT_MS,
    })

    debug('received tools from mcp server', { response }).log(
      'mcp.direct.installMcpTools'
    )

    let toolFilter: (tool: { name: string }) => boolean

    {
      if (tools && tools.length > 0) {
        const toolNames = tools
          .map((tool) => tool.trim().toLowerCase())
          .filter(Boolean)

        toolFilter = (tool: { name: string }) => {
          return toolNames.includes(tool.name.trim().toLowerCase())
        }
      } else {
        toolFilter = () => true
      }
    }

    // @note scope this server's tools so a re-install replaces only its own
    // tools and a same-named tool from another server is never evicted

    const source = makeEnvironmentToolSource('mcp', url, prefix)

    const success = await installEnvironmentTools(
      (response.tools || []).filter(toolFilter).map((tool) => {
        return {
          ...tool,

          name: getAbilityFunctionName({
            name: [prefix, `${tool.name}`].filter(Boolean).join(' '),
          }),

          source,

          options: {
            userId: user.id, // @note potentially not used

            sessionId,

            url,
            headers,

            toolName: tool.name,
          },

          handler: 'mcp',
        }
      })
    )

    return {
      success,
    }
  } catch (e) {
    if (!(e instanceof UserAuthError)) {
      try {
        await transport?.authProvider.cleanup()
      } catch (e) {
        await captureError(e)
      }
    }

    throw e
  } finally {
    try {
      await client?.close()
    } catch (e) {
      await captureError(e)
    }
  }
}

export async function callMcpTool(
  user: Pick<User, 'id'>,
  tool: McpSerializableTool,
  args: unknown
): Promise<unknown> {
  debug('calling mcp tool', { tool, args }).log('mcp.direct.callMcpTool')

  const { sessionId, url, headers, toolName } = tool.options

  if (!sessionId || !url || !toolName) {
    throw new UserInputError(`Missing required MCP tool options`)
  }

  debug('connecting to MCP server', {
    sessionId,
    url,
  }).log('mcp.direct.callMcpTool')

  const transport = McpOAuthProvider.getClientTransport(user, {
    sessionId,

    url,
    headers,
  })

  let client: Client | undefined

  let response: unknown

  try {
    client = new Client({
      name: 'cbk-mcp-client',
      version: '1.0.0',
    })

    await client.connect(transport, { timeout: MCP_CONNECT_TIMEOUT_MS })

    debug('connected to MCP server', {
      sessionId,
      url,
    }).log('mcp.direct.callMcpTool')

    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args as { [x: string]: unknown } | undefined,
      },
    }

    response = await client.request(request, CallToolResultSchema, {
      timeout: MCP_REQUEST_TIMEOUT_MS,

      // @note keep long-running tools alive as long as the remote server keeps
      // emitting progress notifications, instead of hard-failing at the flat
      // request timeout while work is still happening
      resetTimeoutOnProgress: true,
    })
  } finally {
    try {
      await client?.close()
    } catch (e) {
      await captureError(e)
    }
  }

  return response
}

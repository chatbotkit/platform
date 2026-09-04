import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { installMcpTools } from '@/lib/mcp.edge'
import { swapMcpHeaders } from '@/lib/mcp.headers'
import type { McpHeaderSource } from '@/lib/tool.environment'
import { uninstallEnvironmentTools } from '@/lib/tool.environment'
import { fastGetUserById } from '@/lib/user.get'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.mcp.ts for ability definitions related
// to these schemas

export const installSchema = z.object({
  url: z.string().url(),
  // @todo allow the headers to be configured as string to be parsed in order to allow for more flexibility
  headers: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  tools: z.union([z.string().array(), z.string()]).optional(),
  prefix: z.string().optional(),
})

export const INSTALL_OPERATION_NAME = 'install'

export type InstallSchema = z.infer<typeof installSchema>

export const uninstallSchema = z.object({
  url: z.string().url(),
})

export type UninstallSchema = z.infer<typeof uninstallSchema>

export const UNINSTALL_OPERATION_NAME = 'uninstall'

interface McpActionParams {
  input: string
  params: ActionParams
  options: ActionOptions
}

export async function doMcpInstall({
  input,
  params,
  options,
}: McpActionParams): Promise<ActionReturn> {
  debug('do mcp install', { input, params, options }).log(
    'action.exec.mcp.doMcpInstall'
  )

  const user = await fastGetUserById(options.userId)

  if (!user) {
    throw new Error(`User not found`)
  }

  await logEvent({
    user: { id: options.userId },
    type: 'action.mcp.install',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: params,
  })

  const {
    url,
    headers: _headers,
    tools: _tools,
    prefix,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      url: input,
    },
    schema: installSchema,
    options,
  })

  debug('using', { url, headers: _headers, prefix }).log(
    'action.exec.mcp.doMcpInstall'
  )

  // @note the template keeps its secret placeholders: the install-time swap
  // below only serves the connection that lists the tools, while the source is
  // what the installed tools store and swap again on every call

  const headerSource: McpHeaderSource = {
    headerTemplate: _headers
      ? Object.fromEntries(
          Object.entries(_headers).map(([key, value]) => [key, String(value)])
        )
      : {},

    abilityId: options.contextResources?.abilityId,
    secretId: options.linkedResources?.secretId,

    inlineSecrets: options.inlineSecrets,
  }

  const headers = await swapMcpHeaders({ id: options.userId }, headerSource)

  const tools = _tools
    ? Array.isArray(_tools)
      ? _tools
      : _tools
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
    : undefined

  const result = await installMcpTools(
    { id: options.userId },
    {
      url,
      headers,
      headerSource,

      tools,

      prefix,
    }
  )

  debug('using result', { result }).log('action.exec.mcp.doMcpInstall')

  return {
    result,
  }
}

/**
 * Uninstalls MCP tools by removing all tools matching the given URL from
 * the environment.
 */
export async function doMcpUninstall({
  input,
  params,
  options,
}: McpActionParams): Promise<ActionReturn> {
  debug('do mcp uninstall', { input, params, options }).log(
    'action.exec.mcp.doMcpUninstall'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.mcp.uninstall',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: params,
  })

  const { url } = getConfigBySchema({
    input,
    params,
    initial: {
      url: input,
    },
    schema: uninstallSchema,
    options,
  })

  debug('using', { url }).log('action.exec.mcp.doMcpUninstall')

  const { success, removedTools } = await uninstallEnvironmentTools(
    (tool) => tool.handler === 'mcp' && tool.options.url === url
  )

  return {
    result: {
      success,
      tools: removedTools,
    },
  }
}

/**
 * Executes an MCP action with the specified operation.
 */
export async function executeMcpAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug('execute mcp action', { input, params, options }).log(
    'action.exec.mcp.executeMcpAction'
  )

  let operation: typeof INSTALL_OPERATION_NAME | typeof UNINSTALL_OPERATION_NAME

  {
    switch (true) {
      case 'install' in params: {
        operation = INSTALL_OPERATION_NAME

        break
      }

      case 'activate' in params: {
        operation = INSTALL_OPERATION_NAME

        break
      }

      case 'load' in params: {
        operation = INSTALL_OPERATION_NAME

        break
      }

      case 'uninstall' in params: {
        operation = UNINSTALL_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown MCP operation`)
      }
    }
  }

  let response: ActionReturn

  switch (operation) {
    case INSTALL_OPERATION_NAME: {
      response = await doMcpInstall({ input, params, options })

      break
    }

    case UNINSTALL_OPERATION_NAME: {
      response = await doMcpUninstall({ input, params, options })

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}

/**
 * @doc Skillsets
 * @index 45
 *
 * ## MCP Action - Model Context Protocol Integration
 *
 * The Model Context Protocol (MCP) action provides a powerful way to dynamically extend your skillset's capabilities by loading tools from external MCP servers. MCP is an open standard that enables AI applications to seamlessly connect to external data sources and tools. ChatBotKit's MCP action implementation allows your skillsets to discover and utilize MCP-compatible tools in real-time.
 *
 * ### What is MCP
 *
 * Model Context Protocol (MCP) is an open standard that provides a unified way for AI applications to connect with external tools and data sources. Instead of building custom integrations for every service, MCP provides a standardized interface that allows AI models to discover available tools, understand their capabilities, and execute them safely and securely.
 *
 * ### How MCP Actions Work
 *
 * When you use an MCP action in your skillset, ChatBotKit:
 *
 * 1. **Connects** to the specified MCP server endpoint
 * 2. **Discovers** available tools and their schemas
 * 3. **Loads** the tool definitions into your conversation context
 * 4. **Enables** your chatbot to use these tools as if they were native abilities
 * 5. **Maintains** secure execution through proper authentication and isolation
 *
 * ### MCP Action Syntax
 *
 * The MCP action supports flexible syntax for loading tools from different sources:
 *
 * Basic URL Loading:
 *
 * `````markdown
 * ```mcp/install
 * https://mcp.example.com/tools
 * ```
 * `````
 *
 * With Prefix for Namespacing:
 *
 * `````markdown
 * ```mcp/install
 * url: https://mcp.notion.com/mcp
 * prefix: notion
 * ```
 * `````
 *
 * ### Available MCP Integrations
 *
 * ChatBotKit provides built-in support for several popular MCP servers:
 *
 * | Service        | URL                                                              | Prefix       | Capabilities                                        |
 * | -------------- | ---------------------------------------------------------------- | ------------ | --------------------------------------------------- |
 * | **Notion**     | [https://mcp.notion.com/mcp](https://mcp.notion.com/mcp)         | `notion`     | Page management, database queries, content creation |
 * | **Linear**     | [https://mcp.linear.app/mcp](https://mcp.linear.app/mcp)         | `linear`     | Issue tracking, project management, team workflows  |
 * | **Box**        | [https://mcp.box.com/](https://mcp.box.com/)                     | `box`        | File management, sharing, cloud storage             |
 * | **Stripe**     | [https://mcp.stripe.com](https://mcp.stripe.com/)                | `stripe`     | Payment processing, subscription management         |
 * | **PayPal**     | [https://mcp.paypal.com/mcp](https://mcp.paypal.com/mcp)         | `paypal`     | Payment processing, transaction management          |
 * | **Sentry**     | [https://mcp.sentry.io/mcp](https://mcp.sentry.io/mcp)           | `sentry`     | Error tracking, performance monitoring              |
 * | **Cloudinary** | [https://mcp.cloudinary.com/mcp](https://mcp.cloudinary.com/mcp) | `cloudinary` | Media management, image/video transformation        |
 * | **Canva**      | [https://mcp.canva.com/mcp](https://mcp.canva.com/mcp)           | `canva`      | Design creation, template management                |
 *
 * ### Integration Benefits
 *
 * Using MCP actions in your skillsets provides several advantages:
 *
 * - **Dynamic Loading**: Tools are loaded on-demand, reducing initial setup complexity
 * - **Real-time Updates**: Changes to MCP servers are automatically reflected in your abilities
 * - **Standardized Interface**: Consistent tool discovery and execution across different services
 * - **Secure Execution**: All tool calls maintain ChatBotKit's security and access control
 * - **Namespace Support**: Prefixes prevent naming conflicts when using multiple MCP servers
 *
 * ### Best Practices for MCP Actions
 *
 * - **Test Tool Availability**: Always verify that MCP tools are loaded before attempting complex operations
 * - **Use Descriptive Prefixes**: Choose clear, service-specific prefixes to avoid confusion
 * - **Handle Loading Errors**: Consider what happens if an MCP server is unavailable
 * - **Document Dependencies**: Clearly specify which MCP tools your abilities require
 * - **Monitor Performance**: Some MCP operations may take longer than local actions
 *
 * ### Example
 *
 * `````markdown
 * ```mcp/install
 * url: ((url! ys|the MCP server URL))
 * prefix: ((prefix ys|namespace prefix for tools))
 * ```
 * `````
 */

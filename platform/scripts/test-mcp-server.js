import 'dotenv/config'

import { log, runScript } from '@/lib/script'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

/**
 * Test an MCP server integration.
 *
 * Usage:
 * ```bash
 * pnpm script:test-mcp-server                    # Interactive mode
 * pnpm script:test-mcp-server --url <mcp-url>    # CLI mode
 * ```
 *
 * This script connects to an MCP server, lists available tools,
 * and optionally calls a test tool.
 */
runScript({
  name: 'test-mcp-server',
  description: 'Test an MCP server integration',
  options: {
    url: {
      type: 'string',
      short: 'u',
      description: 'MCP server URL',
      message: 'What is the MCP server URL?',
      default: 'http://localhost:8080/api/v1/integration/mcpserver/1/mcp',
      required: true,
    },
  },
  handler: async ({ url }) => {
    log(`connecting to MCP server at ${url}`)

    const client = new Client({
      name: 'test',
      version: '1.0.0',
    })

    const transport = new StreamableHTTPClientTransport(new URL(url), {
      sessionId: undefined,
    })

    await client.connect(transport)

    log(`connected`)

    const tools = await client.listTools()

    log(`tools`, JSON.stringify(tools, null, 2))

    // @note uncomment to test a specific tool
    // log(
    //   'result',
    //   await client.callTool({
    //     name: 'generate_image',
    //     arguments: { input: { prompt: 'A little duck' } },
    //   })
    // )

    await client.close()

    log(`done`)
  },
})

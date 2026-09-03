import { createMcpTemplate, field, secret } from '@/lib/ability.template'

/**
 * Catalogue of ChatBotKit MCP abilities.
 */
const abilities = {
  'conversation/mcp/install[url]': createMcpTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Install MCP',
    description: 'Bring MCP (model context protocol) functions into context',
    tags: ['mcp', 'install'],
    operation: 'install',
    instruction: {
      url: field({
        name: 'url',
        description: 'the remote MCP URL',
        placeholder: true,
      }),
      headers: {
        Authorization: secret(),
      },
    },
    secret: '#secret',
  }),

  'conversation/mcp/uninstall[url]': createMcpTemplate({
    provider: 'cbk',
    icon: '@logo/chatbotkit.com',
    name: 'Uninstall MCP',
    description: 'Remove MCP (model context protocol) functions from context',
    tags: ['mcp', 'uninstall'],
    operation: 'uninstall',
    instruction: {
      url: field({
        name: 'url',
        description: 'the remote MCP URL to uninstall',
        placeholder: true,
      }),
    },
  }),
}

export default abilities

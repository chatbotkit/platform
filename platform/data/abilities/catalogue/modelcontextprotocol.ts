import { createFetchTemplate, field } from '@/lib/ability.template'

const abilities = {
  'registry/server/list': createFetchTemplate({
    provider: 'modelcontextprotocol',
    icon: '@logo/modelcontextprotocol.io',
    name: 'List MCP Servers',
    description:
      'Retrieve a list of available Model Context Protocol (MCP) servers',
    tags: ['modelcontextprotocol', 'server', 'list'],
    instruction: {
      method: 'GET',
      url: 'https://registry.modelcontextprotocol.io',
      path: ['/v0.1/servers'],
      query: {
        limit: field({
          name: 'limit',
          description: 'Maximum number of results to return',
          type: 'number',
          optional: true,
          default: 100,
        }),
        cursor: field({
          name: 'cursor',
          description: 'Cursor for pagination through server results',
          optional: true,
        }),
      },
      headers: {
        Accept: 'application/json, application/problem+json',
      },
      options: {
        // @todo only return servers that use oauth

        jmespath: `
          servers[?
            server.remotes && 
            server.remotes[?type=='streamable-http'] && 
            _meta."io.modelcontextprotocol.registry/official".isLatest==\`true\`
          ].{
            name: server.name, 
            description: server.description, 
            url: server.remotes[?type=='streamable-http'].url | [0]
          }
        `,
      },
    },
  }),

  'registry/server/search': createFetchTemplate({
    provider: 'modelcontextprotocol',
    icon: '@logo/modelcontextprotocol.io',
    name: 'Search MCP Servers',
    description:
      'Search for Model Context Protocol (MCP) servers by name or description',
    tags: ['modelcontextprotocol', 'server', 'search'],
    instruction: {
      method: 'GET',
      url: 'https://registry.modelcontextprotocol.io',
      path: ['/v0.1/servers'],
      query: {
        limit: field({
          name: 'limit',
          description: 'Maximum number of results to return',
          type: 'number',
          optional: true,
          default: 100,
        }),
        cursor: field({
          name: 'cursor',
          description: 'Cursor for pagination through server results',
          optional: true,
        }),
        search: field({
          name: 'search',
          description: 'Search term to filter servers by name or description',
        }),
      },
      headers: {
        Accept: 'application/json, application/problem+json',
      },
      options: {
        // @todo only return servers that use oauth

        jmespath: `
          servers[?
            server.remotes && 
            server.remotes[?type=='streamable-http'] && 
            _meta."io.modelcontextprotocol.registry/official".isLatest==\`true\`
          ].{
            name: server.name, 
            description: server.description, 
            url: server.remotes[?type=='streamable-http'].url | [0]
          }
        `,
      },
    },
  }),
}

export default abilities

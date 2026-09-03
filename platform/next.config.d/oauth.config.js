/* eslint-disable import/no-anonymous-default-export */
// @ts-check

/** @type {import('next').NextConfig} */
export default {
  async rewrites() {
    return {
      beforeFiles: [],

      afterFiles: [
        {
          source: '/oauth/:path*',
          destination: '/api/oauth/:path*',
        },

        // Rewrite RFC 8414 well-known URLs for MCP server integrations so the
        // handler logic lives alongside the mcpserver routes rather than in the
        // .well-known directory.
        //
        // On api.chatbotkit.com the canonical path is /v1/... (api.config.js
        // prepends /api/ internally), on chatbotkit.com the canonical path is
        // /api/v1/... directly. Both variants must resolve.
        //
        // /.well-known/oauth-authorization-server/v1/integration/mcpserver/{id}/mcp
        // /.well-known/oauth-authorization-server/api/v1/integration/mcpserver/{id}/mcp
        //   -> /api/v1/integration/mcpserver/{id}/oauth/well-known/authorization-server
        //
        // /.well-known/oauth-protected-resource/v1/integration/mcpserver/{id}/mcp
        // /.well-known/oauth-protected-resource/api/v1/integration/mcpserver/{id}/mcp
        //   -> /api/v1/integration/mcpserver/{id}/oauth/well-known/protected-resource
        {
          source:
            '/.well-known/oauth-authorization-server/v1/integration/mcpserver/:mcpserverIntegrationId/mcp',
          destination:
            '/api/v1/integration/mcpserver/:mcpserverIntegrationId/oauth/well-known/authorization-server',
        },
        {
          source:
            '/.well-known/oauth-authorization-server/api/v1/integration/mcpserver/:mcpserverIntegrationId/mcp',
          destination:
            '/api/v1/integration/mcpserver/:mcpserverIntegrationId/oauth/well-known/authorization-server',
        },
        {
          source:
            '/.well-known/oauth-protected-resource/v1/integration/mcpserver/:mcpserverIntegrationId/mcp',
          destination:
            '/api/v1/integration/mcpserver/:mcpserverIntegrationId/oauth/well-known/protected-resource',
        },
        {
          source:
            '/.well-known/oauth-protected-resource/api/v1/integration/mcpserver/:mcpserverIntegrationId/mcp',
          destination:
            '/api/v1/integration/mcpserver/:mcpserverIntegrationId/oauth/well-known/protected-resource',
        },
      ],

      fallback: [],
    }
  },
}

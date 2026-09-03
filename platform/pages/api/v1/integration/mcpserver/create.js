// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'

import aliasSchema from '@/schemas/alias'
import blueprintIdSchema from '@/schemas/blueprintId'
import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'
import oAuthConnectionIdSchema from '@/schemas/oAuthConnectionId'
import skillsetIdSchema from '@/schemas/skillsetId'

import crypto from 'crypto'

export const bodySchema = schema.object({
  alias: aliasSchema,

  name: nameSchema,
  description: descriptionSchema,

  blueprintId: blueprintIdSchema('use'),

  skillsetId: skillsetIdSchema('use'),

  oAuthConnectionId: oAuthConnectionIdSchema,

  meta: metaSchema,
})

/**
 * @swagger
 *
 * /integration/mcpserver/create:
 *   post:
 *     operationId: createMcpServerIntegration
 *     summary: Create McpServer integration
 *     tags:
 *       - McpServer Integration
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/InstanceRefProperties'
 *               - $ref: '#/components/schemas/InstanceCrudProps'
 *               - $ref: '#/components/schemas/BlueprintProps'
 *               - type: object
 *                 properties:
 *                   skillsetId:
 *                     description: The ID of the skillset
 *                     type: string
 *                   oAuthConnectionId:
 *                     description: The ID of the OAuth connection for IdP-based authentication
 *                     type: string
 *     responses:
 *       200:
 *         description: The McpServer integration was created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the McpServer Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['database/integration'],
    withSchema(bodySchema, async function (_req, session, body) {
      const {
        alias,

        name,
        description,

        blueprintId: blueprint,

        skillsetId: skillset,

        oAuthConnectionId: oAuthConnection,

        meta,
      } = body

      const { id } = await prisma.mcpserverIntegration.create({
        data: {
          userId: session.user.id,

          // ref

          alias,

          // basic information

          name,
          description,

          // resource linking

          blueprintId: blueprint?.id || blueprint,

          skillsetId: skillset?.id || skillset,

          oAuthConnectionId: oAuthConnection?.id || oAuthConnection,

          // resource specific

          accessToken: crypto.randomBytes(32).toString('hex'),

          // meta and others

          meta,
        },

        select: {
          id: true,
        },
      })

      return ok({ id })
    })
  )
)

/**
 * @manual MCP Server Integration
 * @description MCP (Model Context Protocol) Server Integration enables you to expose your ChatBotKit skillsets as MCP-compliant servers that external applications and AI systems can connect to and utilize.
 * @category Integrations/MCPServer
 * @tags mcp, integration, model-context-protocol, skillset, export
 * @index 60
 *
 * The Model Context Protocol (MCP) Server Integration allows you to expose your
 * ChatBotKit skillsets as standardized MCP servers that external consumers can
 * connect to and use. This integration transforms your skillsets-which contain
 * abilities, tools, and functions-into MCP-compliant endpoints that can be
 * consumed by any MCP-compatible client, including other AI systems, development
 * tools, and custom applications.
 *
 * By creating an MCP server integration, you're essentially publishing your
 * skillset's capabilities through a standardized protocol, making them accessible
 * to external consumers who want to leverage your tools, functions, and AI
 * capabilities in their own applications. This enables powerful integration
 * scenarios where your ChatBotKit resources become building blocks that others
 * can incorporate into their AI workflows.
 *
 * ## Creating MCP Server Integrations
 *
 * To create an MCP server integration, you need to specify which skillset you
 * want to expose as an MCP server. The skillset contains the abilities and
 * functions that will be made available to external consumers through the MCP
 * protocol.
 *
 * Create an MCP server integration by sending a POST request:
 *
 * ```http
 * POST /api/v1/integration/mcpserver/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Customer Support Tools",
 *   "description": "Exposes customer support abilities and knowledge base access",
 *   "skillsetId": "skillset_abc123"
 * }
 * ```
 *
 * The API will return the integration ID and automatically generate a secure
 * access token for authentication:
 *
 * ```json
 * {
 *   "id": "mcpserver_xyz789"
 * }
 * ```
 *
 * ### Configuring OAuth Authentication
 *
 * To restrict MCP server access to authenticated users through your Identity
 * Provider (IdP), include an `oAuthConnectionId` when creating the integration.
 * This links the MCP server to an OAuth connection configured in your account,
 * enabling end-users to authenticate via your IdP before accessing the server.
 *
 * ```http
 * POST /api/v1/integration/mcpserver/create
 * Content-Type: application/json
 *
 * {
 *   "name": "Secure AI Tools",
 *   "description": "MCP server with IdP-based access control",
 *   "skillsetId": "skillset_abc123",
 *   "oAuthConnectionId": "oauthconnection_xyz789"
 * }
 * ```
 *
 * When an OAuth connection is configured, MCP clients such as Claude perform
 * the standard OAuth 2.0 Authorization Code flow with PKCE to obtain a
 * short-lived JWT token. This token is then passed in the `Authorization`
 * header alongside the static access token (supplied via the `authorization`
 * query parameter) on every request.
 *
 * The OAuth connection you reference must already exist in your account and
 * must be a compatible OAuth 2.0 provider. Create OAuth connections through
 * the `/api/v1/oauth/connection/create` endpoint before configuring IdP
 * authentication on an MCP server integration.
 *
 * **When to Use OAuth Authentication:**
 *
 * - **Multi-user access**: Allow multiple end-users to authenticate with their
 *   own IdP credentials rather than sharing a single static token
 * - **Enterprise SSO**: Gate MCP server access behind your corporate IdP
 * - **Contact personalization**: Automatically associate each request with the
 *   authenticated contact for personalized ability execution
 * - **Audit and compliance**: Attribute every tool invocation to a specific
 *   authenticated user identity
 *
 * ### Exposing Skillsets via MCP
 *
 * When you create an MCP server integration, you specify a `skillsetId` that
 * points to the skillset you want to expose. The skillset defines what capabilities
 * will be available to external consumers through the MCP protocol.
 *
 * All abilities, tools, and functions defined in the skillset become discoverable
 * and callable by external MCP clients. This allows you to package your AI
 * capabilities and make them available as reusable components that other
 * applications can integrate with.
 *
 * External consumers can then connect to your MCP server using standard MCP
 * clients and invoke the abilities and functions you've exposed through your
 * skillset, enabling them to leverage your AI capabilities in their own
 * applications.
 *
 * ### Access Token Security
 *
 * During integration creation, a secure access token is automatically generated.
 * This token authenticates requests from external consumers who want to access
 * your MCP server, ensuring that only authorized clients can utilize the
 * capabilities you're exposing.
 *
 * **Important Security Considerations:**
 *
 * - Store the access token securely and share it only with trusted consumers
 * - Never expose access tokens in client-side code or public repositories
 * - Treat access tokens with the same care as API keys
 * - Provide the access token to external consumers through secure channels
 * - External consumers must include this token in their MCP client configuration
 * - Consider rotating access tokens periodically for enhanced security
 * - Monitor token usage to detect unauthorized access attempts
 *
 * ## How External Consumers Use Your MCP Server
 *
 * Once you've created an MCP server integration, external consumers can connect
 * to it using any MCP-compatible client. They will need:
 *
 * **The MCP Server Endpoint**: A URL provided by ChatBotKit that points to your
 * exposed skillset capabilities.
 *
 * **The Access Token**: The authentication token generated during integration
 * creation, which you provide to authorized consumers.
 *
 * **MCP Client Software**: Any application or tool that implements the MCP client
 * protocol, such as AI development environments, automation tools, or custom
 * applications.
 *
 * External consumers configure their MCP client with these credentials, and the
 * client can then discover and invoke the abilities and functions from your
 * skillset, integrating your AI capabilities into their workflows.
 *
 * ## MCP Protocol Overview
 *
 * The Model Context Protocol defines a standard interface for exposing and
 * consuming AI capabilities. When you expose a skillset as an MCP server, it
 * provides:
 *
 * **Tools and Functions**: Your skillset's abilities become callable operations
 * that external consumers can invoke to perform specific tasks, such as querying
 * knowledge bases, processing data, or executing custom logic.
 *
 * **Context Providers**: If your skillset includes data sources or knowledge
 * bases, these become accessible to external consumers as context providers.
 *
 * **Resource Handlers**: Your skillset's resource access capabilities become
 * available to external clients through standardized MCP resource interfaces.
 *
 * **Discoverable Capabilities**: External MCP clients can automatically discover
 * what functions and tools your skillset exposes, making integration seamless.
 *
 * By exposing your skillset through MCP, you make your AI capabilities available
 * in a standardized format that any MCP-compatible system can understand and
 * utilize.
 *
 * ## Integration with Blueprints
 *
 * MCP server integrations can be associated with blueprints for organized resource
 * management. When you include a `blueprintId` during creation, the integration
 * becomes part of that blueprint's resource collection, making it easier to
 * manage related integrations, skillsets, and exposure configurations together.
 *
 * This is particularly useful when you're exposing multiple skillsets as MCP
 * servers for different purposes or consumer groups, as you can organize them
 * under blueprints for simplified management and access control.
 *
 * ## Use Cases
 *
 * MCP server integrations are ideal for:
 *
 * **Sharing AI Capabilities**: Make your custom AI tools and functions available
 * to partners, customers, or other applications.
 *
 * **Building AI Marketplaces**: Expose specialized skillsets that others can
 * subscribe to and use in their own AI systems.
 *
 * **Enterprise Integration**: Allow different departments or systems within your
 * organization to consume shared AI capabilities through a standardized protocol.
 *
 * **Partner Integrations**: Provide external partners with access to your AI
 * tools and knowledge bases through secure MCP endpoints.
 *
 * **Development Tool Integration**: Make your skillsets available to AI development
 * environments and IDEs that support the MCP protocol.
 *
 * **Multi-System Orchestration**: Enable external workflow automation systems
 * to incorporate your AI capabilities into their processes.
 *
 * ## Best Practices
 *
 * **Design Clear Skillsets**: Structure your skillsets with clear, well-documented
 * abilities that external consumers can easily understand and use.
 *
 * **Provide Documentation**: Create comprehensive documentation for consumers
 * explaining what capabilities your MCP server exposes and how to use them.
 *
 * **Monitor Usage**: Track how external consumers are using your MCP server to
 * understand usage patterns and identify optimization opportunities.
 *
 * **Implement Rate Limiting**: Consider implementing usage quotas or rate limits
 * to prevent abuse of your exposed capabilities.
 *
 * **Version Your Skillsets**: When updating skillsets exposed via MCP, consider
 * versioning to avoid breaking existing consumer integrations.
 *
 * **Secure Access Tokens**: Distribute access tokens securely and maintain
 * records of which consumers have access to which MCP servers.
 *
 * **Test Integration**: Before sharing your MCP server with external consumers,
 * test it thoroughly using MCP client tools to ensure capabilities work as expected.
 *
 * **Important Notes:**
 *
 * - The skillset you expose must contain abilities and functions for external
 *   consumers to utilize
 * - Access tokens are generated automatically and cannot be retrieved later;
 *   capture and store them securely during integration setup
 * - External consumers need both the MCP server endpoint URL and access token
 *   to connect
 * - You control what capabilities are exposed by carefully designing the skillset
 *   before creating the MCP server integration
 * - Changes to the linked skillset will be reflected in the MCP server capabilities
 * - Consider the security implications of exposing your skillset to external
 *   consumers and implement appropriate access controls
 */

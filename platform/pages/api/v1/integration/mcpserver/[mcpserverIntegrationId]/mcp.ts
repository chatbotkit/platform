import type { NextApiRequest, NextApiResponse } from 'next'

import { REQUEST_SOFT_ABORT_TIMEOUT_MS } from '@/config/server'

import prisma from '@/prisma/client'

import {
  getAbilityFunctionDescription,
  getAbilityFunctionInput,
  getAbilityFunctionName,
  getAbilityFunctionParameters,
} from '@/lib/ability.function'
import { setupRequestContext } from '@/lib/context.setup'
import {
  runInContext,
  setContextContact,
  setContextNamespace,
  setContextNextApiRequest,
  setContextNextApiResponse,
  setContextUser,
} from '@/lib/context.store'
import debug from '@/lib/debug'
import { runInDeferred } from '@/lib/defer'
import { captureException, captureUnexpectedState } from '@/lib/error'
import { extractDataFromInput } from '@/lib/extract.data'
import { getHeader } from '@/lib/header'
import {
  getExternalAPIHostURL,
  getExternalFrontendHost,
  getExternalFrontendHostURL,
  getExternalHostURL,
  getExternalStaticHostURL,
} from '@/lib/host'
import type { JsonSchemaObject } from '@/lib/jsonschema'
import { logEvent } from '@/lib/log'
import { getOrCreateSession } from '@/lib/mcp.session'
import {
  fetchWidgetManifest,
  getAllowedWidgetDomains,
  getCdnBundleUrl,
  normalizeWidgetUiValue,
  parseWidgetUiValue,
  resolveWidgetManifestUrl,
} from '@/lib/mcp.widget'
import { getSafeNamespace } from '@/lib/namespace.safe'
import { hasScope, isTokenRevoked, verifyOAuthToken } from '@/lib/oauth.jwt'
import { queryParam, requiredUrlParam } from '@/lib/query.get'
import { getActiveSkillsetAbilities } from '@/lib/skillset.abilities'
import { applySkillset } from '@/lib/skillset.apply'
import { toKebabCase } from '@/lib/string'
import { Usage } from '@/lib/usage.model'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

// @see https://developers.openai.com/apps-sdk/build/mcp-server
// @see https://developers.openai.com/apps-sdk/reference/

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const client = (queryParam(req, 'client') || 'unknown').toLowerCase().trim()

  const contextHandlerFn = runInContext(
    async () => {
      const deferredHandlerFn = runInDeferred(async () => {
        setContextNextApiRequest(req)
        setContextNextApiResponse(res)
        setupRequestContext(req)

        // @note reject GET requests - this endpoint only supports POST for
        // stateless JSON-RPC operations. GET requests would open SSE streams that
        // stay open indefinitely, causing serverless function timeouts (800s on
        // Vercel).
        // @see https://github.com/vercel/mcp-handler for reference implementation.

        if (req.method === 'GET') {
          res.status(405).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Method not allowed. Use POST for MCP requests.',
            },
            id: null,
          })

          res.end()

          return
        }

        if (!req.query.mcpserverIntegrationId) {
          res.status(400).json({
            error: 'Missing mcpserverIntegrationId',
          })

          res.end()

          return
        }

        // @note timeout detection to capture in Sentry when MCP runs into timeout issues

        const timeoutId = setTimeout(() => {
          debug('MCP handler approaching timeout').log(
            'api.v1.integration.mcpserver.instance.mcp.handler'
          )

          void captureUnexpectedState(
            `MCP handler timed out after ${REQUEST_SOFT_ABORT_TIMEOUT_MS}ms`,
            {
              mcpserverIntegrationId: req.query.mcpserverIntegrationId,
              client,
            }
          )
        }, REQUEST_SOFT_ABORT_TIMEOUT_MS)

        try {
          // @note extract tokens separately: JWT for identity/scopes, static token as
          // kill-switch. The static token is ALWAYS required regardless of whether
          // OAuth is in use. When OAuth is active the Authorization header carries the
          // JWT Bearer token, so the static token must arrive via the ?authorization=
          // query param instead to keep the two credentials from colliding.

          let headerToken: string | null = null
          let queryToken: string | null = null

          {
            const authHeader = getHeader(req, 'Authorization')

            if (authHeader) {
              headerToken = authHeader.replace(/^Bearer /i, '').trim() || null
            }

            if (typeof req.query.authorization === 'string') {
              queryToken = req.query.authorization.trim() || null
            }
          }

          const externalFrontendHostURL = getExternalFrontendHostURL()

          const externalHostURL = getExternalHostURL()

          const externalStaticHostURL = new URL(getExternalStaticHostURL())
            .origin

          const allowedWidgetOrigins = Array.from(
            getAllowedWidgetDomains(),
            (domain) => `https://${domain}`
          )

          const mcpserverIntegration =
            await prisma.mcpserverIntegration.findUnique({
              where: {
                id: requiredUrlParam(req, 'mcpserverIntegrationId'),
              },

              include: {
                user: true,
                skillset: {
                  include: {
                    abilities: true,
                  },
                },
              },
            })

          if (!mcpserverIntegration) {
            res.status(404).json({
              error: 'McpServer integration not found',
            })

            res.end()

            return
          }

          // @note tool execution may need owner-scoped resources such as linked
          // secrets so MCP requests must establish the integration owner as the
          // context user

          setContextUser(mcpserverIntegration.user)

          // @note token payload for scope enforcement when the caller presents
          // an OAuth access token minted by this integration's own token
          // endpoint (there is no other issuer)

          let jwtTokenPayload:
            | Awaited<ReturnType<typeof verifyOAuthToken>>
            | undefined

          // Try the OAuth access token first; the static access token is
          // handled below

          if (headerToken) {
            const tokenPayload = await verifyOAuthToken(headerToken)

            if (tokenPayload) {
              const revoked = await isTokenRevoked(headerToken!)

              if (revoked) {
                res.setHeader(
                  'WWW-Authenticate',
                  `Bearer realm="${externalHostURL}", error="invalid_token", error_description="Token has been revoked"`
                )
                res.status(401).json({
                  error: 'invalid_token',
                  error_description: 'Token has been revoked',
                })

                res.end()

                return
              }

              // @note oauth/token.ts writes the issuing mcpserverIntegrationId
              // into the `portalId` claim and checks it on refresh; the same
              // check applies here on access. A token from integration A
              // must not satisfy integration B's OAuth half, or A's contact
              // context would cross the boundary and B's IdP/domain policy
              // would be bypassed. Enforced before any context is set.

              if (tokenPayload.portalId !== req.query.mcpserverIntegrationId) {
                res.setHeader(
                  'WWW-Authenticate',
                  `Bearer realm="${externalHostURL}", error="invalid_token", error_description="Token was not issued for this resource"`
                )
                res.status(401).json({
                  error: 'invalid_token',
                  error_description: 'Token was not issued for this resource',
                })

                res.end()

                return
              }

              // JWT is valid - set up contact context if contactId present

              if (tokenPayload.contactId) {
                const contact = await prisma.contact.findUnique({
                  where: {
                    id: tokenPayload.contactId,
                  },
                })

                if (contact) {
                  setContextContact(contact)
                }
              }

              jwtTokenPayload = tokenPayload
            }
          }

          // @note static access token is the kill-switch - ALWAYS enforced even when
          // OAuth is active. When a JWT is present the Authorization header is taken,
          // so the static token must arrive via ?authorization= query param. Without a
          // JWT either source is accepted for backwards compatibility.

          const staticToken =
            queryToken ?? (jwtTokenPayload ? null : headerToken)

          const resourceMetadataUrl = mcpserverIntegration.oAuthConnectionId
            ? getExternalAPIHostURL(
                `/.well-known/oauth-protected-resource/v1/integration/mcpserver/${mcpserverIntegration.id}/mcp`,
                getExternalFrontendHost()
              )
            : null

          {
            if (!staticToken) {
              if (resourceMetadataUrl) {
                res.setHeader(
                  'WWW-Authenticate',
                  `Bearer resource_metadata="${resourceMetadataUrl}"`
                )
              }

              res.status(401).json({
                error: 'Missing access token',
              })

              res.end()

              return
            }

            if (mcpserverIntegration.accessToken !== staticToken) {
              if (resourceMetadataUrl) {
                res.setHeader(
                  'WWW-Authenticate',
                  `Bearer resource_metadata="${resourceMetadataUrl}", error="invalid_token", error_description="Invalid access token"`
                )
              }

              res.status(401).json({
                error: 'Invalid access token',
              })

              res.end()

              return
            }
          }

          // @note integrations with oauth configured require both credentials:
          // a valid oauth jwt for identity/scopes and the static token as the
          // kill-switch.

          if (mcpserverIntegration.oAuthConnectionId && !jwtTokenPayload) {
            res.setHeader(
              'WWW-Authenticate',
              `Bearer resource_metadata="${resourceMetadataUrl}", error="invalid_token", error_description="OAuth token is required"`
            )

            res.status(401).json({
              error: 'invalid_token',
              error_description: 'OAuth token is required',
            })

            res.end()

            return
          }

          // @note manage session id ourselves via redis since sdk stateful mode
          // requires persistent transport objects which don't work in serverless

          const incomingSessionId = getHeader(req, 'mcp-session-id')

          const sessionId = await getOrCreateSession(
            { id: mcpserverIntegration.userId },
            incomingSessionId
          )

          // @note set session id header so clients can reuse the same session

          res.setHeader('mcp-session-id', sessionId)

          // @note set namespace using our managed session id

          setContextNamespace(
            getSafeNamespace({ id: mcpserverIntegration.userId }, sessionId)
          )

          // @note prepare ability mappings and tools for the mcp server

          const nameToAbilityIdMapping: Record<string, string> = {}
          const nameToAbilityNameMapping: Record<string, string> = {}

          const tools: Array<{
            name: string
            description: string

            inputSchema: unknown

            annotations?: {
              title?: string
              readOnlyHint?: boolean
              destructiveHint?: boolean
              openWorldHint?: boolean
              idempotentHint?: boolean
            }

            _meta?: Record<string, unknown>
          }> = []

          const toolMetaMap = new Map<string, Record<string, unknown>>()

          for (const ability of getActiveSkillsetAbilities(
            mcpserverIntegration.skillset
          )) {
            debug(`adding ability`, { ability }).log(
              'api.v1.integration.mcpserver.instance.mcp.handler'
            )

            const name = getAbilityFunctionName(ability)

            nameToAbilityIdMapping[name] = ability.id
            nameToAbilityNameMapping[name] = ability.name

            tools.push({
              name: name,
              description: getAbilityFunctionDescription(ability),

              inputSchema: getAbilityFunctionParameters(ability),

              annotations: {
                title: ability.name,
                // readOnlyHint: true,
                // destructiveHint: false,
                // openWorldHint: false,
                // idempotentHint: true,
              },
            })

            toolMetaMap.set(name, ability.meta || {})
          }

          // @note in stateless mode, create a new server and transport for each
          // request to prevent request ID collisions and connection hanging - this
          // ensures the serverless function completes after handling a single
          // request

          const mcpServerDisplayName =
            mcpserverIntegration.name ||
            mcpserverIntegration.skillset?.name ||
            ''

          const server = new Server(
            {
              name:
                toKebabCase(mcpServerDisplayName) || mcpserverIntegration.id,
              title: mcpServerDisplayName || undefined,
              version: '1.0.0',
            },
            {
              capabilities: {
                tools: {},
                ...(['chatgpt'].includes(client) ? { resources: {} } : {}),
              },
            }
          )

          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // @note stateless mode - no session management
          })

          // @note cleanup on response close

          res.on('close', () => {
            debug(`connection closed - cleaning up server and transport`).log(
              'api.v1.integration.mcpserver.instance.mcp.handler'
            )

            void server.close()
            void transport.close()
          })

          // @note map of tools that have widget UIs configured (used in tool call response)

          const toolWidgetMap = new Map<
            string,
            {
              manifestUrl: string
              cdnUrl: string
              tagName: string
              propsSchema?: Record<string, unknown>
            }
          >()

          // @note setup ui handlers if supported

          // @todo consider enforce OAuth scopes for widget/UI endpoints - currently
          // only tools and resources check scopes, but widgets should also require
          // appropriate scope (consider mcp:resources or separate mcp:ui scope)

          if (['chatgpt'].includes(client)) {
            debug(`setting up UI handlers`).log(
              'api.v1.integration.mcpserver.instance.mcp.handler'
            )

            const widgets: Record<
              string,
              {
                uri: string
                name: string
                html: string
                _meta?: Record<string, unknown>
              }
            > = {}

            // @note add the widget
            {
              widgets['ui://widget/frame'] = {
                uri: 'ui://widget/frame',
                name: 'Universal Widget',
                html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="${getExternalFrontendHostURL(
    '/integrations/mcpserver/v1.js'
  )}" async></script>
</head>
<body>
</body>
</html>
`,
                _meta: {
                  'openai/widgetPrefersBorder': false,
                  // 'openai/widgetDescription': '', // @note instructions to the AI to reduce narrative
                  'openai/widgetDomain': 'https://chatgpt.com',
                  'openai/widgetCSP': {
                    connect_domains: Array.from(
                      new Set([
                        'https://chatgpt.com',
                        ...allowedWidgetOrigins,
                        externalStaticHostURL,
                        externalFrontendHostURL,
                        externalHostURL,
                      ])
                    ),
                    resource_domains: Array.from(
                      new Set([
                        ...allowedWidgetOrigins,
                        externalStaticHostURL,
                        externalFrontendHostURL,
                        externalHostURL,
                      ])
                    ),
                    frame_domains: Array.from(
                      new Set([
                        ...allowedWidgetOrigins,
                        externalStaticHostURL,
                        externalFrontendHostURL,
                        externalHostURL,
                      ])
                    ),
                  },
                },
              }
            }

            // @note add tool specific uis based on ability meta

            for (const tool of tools) {
              tool._meta ??= {}

              const abilityMeta = toolMetaMap.get(tool.name) || {}

              // @note check if ability has a widget UI configured at mcp.ui

              const mcpMeta = abilityMeta.mcp
              const rawWidgetUi =
                typeof mcpMeta === 'object' && mcpMeta !== null
                  ? (mcpMeta as Record<string, unknown>).ui
                  : undefined

              // @note validate and parse the widget UI value silently

              const widgetUiValue = parseWidgetUiValue(rawWidgetUi)

              if (widgetUiValue) {
                // @note normalize to object format for consistent handling

                const widgetConfig = normalizeWidgetUiValue(widgetUiValue)

                const widgetManifestUrl = resolveWidgetManifestUrl(
                  widgetConfig.widget
                )

                debug(`tool has widget UI configured`, {
                  toolName: tool.name,
                  widgetConfig,
                  widgetManifestUrl,
                }).log('api.v1.integration.mcpserver.instance.mcp.handler')

                // @note fetch manifest to get the widget's tag name

                const manifest = await fetchWidgetManifest(widgetManifestUrl)

                if (!manifest) {
                  debug(`failed to fetch widget manifest, skipping widget UI`, {
                    toolName: tool.name,
                    widgetManifestUrl,
                  }).log('api.v1.integration.mcpserver.instance.mcp.handler')

                  continue
                }

                const cdnUrl = getCdnBundleUrl(widgetManifestUrl)

                // @note store widget info including tagName and propsSchema for use in tool call response

                toolWidgetMap.set(tool.name, {
                  manifestUrl: widgetManifestUrl,
                  cdnUrl: cdnUrl,
                  tagName: manifest.tagName,
                  propsSchema: manifest.propsSchema,
                })

                // @note configure tool to use widget output template

                tool._meta['openai/outputTemplate'] = `ui://widget/${tool.name}`
                tool._meta['openai/widgetAccessible'] = true

                // @note apply tool invocation status text from config

                if (widgetConfig.invokingText) {
                  tool._meta['openai/toolInvocation/invoking'] =
                    widgetConfig.invokingText
                }

                if (widgetConfig.invokedText) {
                  tool._meta['openai/toolInvocation/invoked'] =
                    widgetConfig.invokedText
                }

                // @note register tool-specific widget resource

                widgets[`ui://widget/${tool.name}`] = {
                  uri: `ui://widget/${tool.name}`,
                  name: manifest.displayName || `${tool.name} Widget`,
                  html: '', // @note will be populated dynamically via ReadResource
                  _meta: {
                    'openai/widgetPrefersBorder':
                      widgetConfig.prefersBorder ?? false,
                    'openai/widgetDomain': 'https://chatgpt.com',
                    'openai/widgetCSP': {
                      connect_domains: ['https://chatgpt.com'],
                      resource_domains: [
                        'https://unpkg.com',
                        'https://cdn.jsdelivr.net',
                      ],
                    },
                    // @note add description if provided to reduce model narration
                    ...(widgetConfig.description && {
                      'openai/widgetDescription': widgetConfig.description,
                    }),
                  },
                }
              }
            }

            // server resource handlers

            server.setRequestHandler(ListResourcesRequestSchema, () => {
              debug(`received resource list request`).log(
                'api.v1.integration.mcpserver.instance.mcp.handler'
              )

              // Enforce scope when JWT token is used

              if (
                jwtTokenPayload &&
                !hasScope(jwtTokenPayload.scope, 'mcp:resources')
              ) {
                debug(`insufficient scope for resource list`, {
                  requiredScope: 'mcp:resources',
                  providedScope: jwtTokenPayload.scope,
                }).log('api.v1.integration.mcpserver.instance.mcp.handler')

                throw new McpError(
                  ErrorCode.InvalidRequest,
                  'Insufficient scope: mcp:resources required for resource access',
                  { requiredScope: 'mcp:resources' }
                )
              }

              return {
                resources: Object.values(widgets).map((widget) => ({
                  uri: widget.uri,
                  name: widget.name,
                  mimeType: 'text/html+skybridge',
                })),
              }
            })

            server.setRequestHandler(ReadResourceRequestSchema, (request) => {
              debug(`received resource read request`, { request }).log(
                'api.v1.integration.mcpserver.instance.mcp.handler'
              )

              // Enforce scope when JWT token is used

              if (
                jwtTokenPayload &&
                !hasScope(jwtTokenPayload.scope, 'mcp:resources')
              ) {
                debug(`insufficient scope for resource read`, {
                  requiredScope: 'mcp:resources',
                  providedScope: jwtTokenPayload.scope,
                }).log('api.v1.integration.mcpserver.instance.mcp.handler')

                throw new McpError(
                  ErrorCode.InvalidRequest,
                  'Insufficient scope: mcp:resources required for resource access',
                  { requiredScope: 'mcp:resources' }
                )
              }

              const contents: {
                uri: string
                mimeType: string
                text?: string
                data?: Uint8Array
                _meta: Record<string, unknown>
              }[] = []

              const widget = widgets[request.params.uri]

              if (widget) {
                // @note for tool widgets, generate HTML dynamically with CDN script
                // extract tool name from uri: ui://widget/{toolName}

                const toolName = request.params.uri.replace('ui://widget/', '')
                const widgetInfo = toolWidgetMap.get(toolName)

                let html = widget.html

                if (widgetInfo && !html) {
                  // @note generate widget HTML using the mcp-widgets loader pattern
                  // the loader handles extracting props from OpenAI metadata and
                  // rendering

                  html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  <script src="${widgetInfo.cdnUrl}"></script>
  <script src="https://unpkg.com/mcp-widgets@latest/cdn/loaders/chatgpt.js"></script>
  <script>MCPWidgets.render('${widgetInfo.tagName}');</script>
</body>
</html>`
                }

                contents.push({
                  uri: widget.uri,
                  mimeType: 'text/html+skybridge',
                  text: html,
                  _meta: widget._meta || {},
                })
              }

              return {
                contents,
              }
            })
          }

          // @note https://github.com/modelcontextprotocol/servers/blob/main/src/sequentialthinking/index.ts for inspiration how this part of the code was written

          server.setRequestHandler(ListToolsRequestSchema, (request) => {
            debug(`received tool list request`, { request }).log(
              'api.v1.integration.mcpserver.instance.mcp.handler'
            )

            // Enforce scope when JWT token is used

            if (
              jwtTokenPayload &&
              !hasScope(jwtTokenPayload.scope, 'mcp:tools')
            ) {
              debug(`insufficient scope for tool list`, {
                requiredScope: 'mcp:tools',
                providedScope: jwtTokenPayload.scope,
              }).log('api.v1.integration.mcpserver.instance.mcp.handler')

              throw new McpError(
                ErrorCode.InvalidRequest,
                'Insufficient scope: mcp:tools required for tool access',
                { requiredScope: 'mcp:tools' }
              )
            }

            return {
              tools,
            }
          })

          server.setRequestHandler(CallToolRequestSchema, async (request) => {
            debug(`received tool call request`, { request }).log(
              'api.v1.integration.mcpserver.instance.mcp.handler'
            )

            // Enforce scope when JWT token is used

            if (
              jwtTokenPayload &&
              !hasScope(jwtTokenPayload.scope, 'mcp:tools')
            ) {
              return {
                content: [
                  {
                    type: 'text',
                    text: 'Insufficient scope: mcp:tools required for tool execution',
                  },
                ],
                isError: true,
              }
            }

            const tool = tools.find((tool) => tool.name === request.params.name)

            if (!tool) {
              debug(`unknown tool requested`, {
                name: request.params.name,
              }).log('api.v1.integration.mcpserver.instance.mcp.handler')

              return {
                content: [
                  {
                    type: 'text',
                    text: `Unknown tool: ${request.params.name}`,
                  },
                ],
                isError: true,
              }
            }

            if (!mcpserverIntegration.skillset) {
              debug(`skillset not found on integration`).log(
                'api.v1.integration.mcpserver.instance.mcp.handler'
              )

              return {
                content: [
                  {
                    type: 'text',
                    text: `Skillset not found`,
                  },
                ],
                isError: true,
              }
            }

            const ability = getActiveSkillsetAbilities(
              mcpserverIntegration.skillset
            ).find(
              (ability) =>
                ability.id === nameToAbilityIdMapping[request.params.name]
            )

            if (!ability) {
              debug(`ability not found`, { name: request.params.name }).log(
                'api.v1.integration.mcpserver.instance.mcp.handler'
              )

              return {
                content: [
                  {
                    type: 'text',
                    text: `Ability not found`,
                  },
                ],
                isError: true,
              }
            }

            const input = getAbilityFunctionInput(
              ability,
              request.params.arguments
            )

            debug(`applying skillset`, { input }).log(
              'api.v1.integration.mcpserver.instance.mcp.handler'
            )

            try {
              const { usage, error, result, messages } = await applySkillset(
                mcpserverIntegration.userId,

                mcpserverIntegration.skillset,

                nameToAbilityNameMapping[request.params.name],

                input
              )

              error // @todo how do we surface errors
              messages // @todo how do we surface messages

              await logEvent({
                user: { id: mcpserverIntegration.userId },
                name: 'MCP Tool Call',
                description: `Executed MCP tool ${request.params.name}`,
                type: 'action.mcpserver.tool.call',
                relations: {
                  mcpserverIntegrationId: mcpserverIntegration.id,
                  skillsetId: mcpserverIntegration.skillset.id,
                  abilityId: ability.id,
                },
                meta: {
                  toolName: request.params.name,
                  arguments: input,
                  client,
                },
              })

              await Usage.createAndRecord({
                user: { id: mcpserverIntegration.userId },
                token: usage.token,
                model: usage.model,
                meta: {
                  reason: 'ability/execute',
                },
                references: {
                  skillsetId: mcpserverIntegration.skillset.id,
                },
              })

              // @note check if tool has an associated widget for data transformation

              const widgetInfo = toolWidgetMap.get(request.params.name)

              let widgetProps: Record<string, unknown> | null = null

              if (widgetInfo && widgetInfo.propsSchema) {
                // @note transform tool result to match widget's propsSchema

                const propsSchema =
                  widgetInfo.propsSchema as unknown as JsonSchemaObject

                debug(`transforming tool result for widget`, {
                  toolName: request.params.name,
                  propsSchema: propsSchema,
                }).log('api.v1.integration.mcpserver.instance.mcp.handler')

                try {
                  const extractResult = await extractDataFromInput(
                    JSON.stringify(result),
                    propsSchema,
                    { user: { id: mcpserverIntegration.userId } }
                  )

                  if (extractResult.data) {
                    widgetProps = extractResult.data

                    // @note record usage for the extraction

                    await extractResult.usage.recordBaseTokens({
                      user: { id: mcpserverIntegration.userId },
                      meta: { reason: 'widget/transform' },
                      references: {
                        skillsetId: mcpserverIntegration.skillset.id,
                      },
                    })
                  }

                  debug(`widget props extracted`, { widgetProps }).log(
                    'api.v1.integration.mcpserver.instance.mcp.handler'
                  )
                } catch (extractError) {
                  debug(`failed to extract widget props`, { extractError }).log(
                    'api.v1.integration.mcpserver.instance.mcp.handler'
                  )

                  // @note continue without widget props on error
                }
              }

              return {
                // @note deliberately wrapped in an object in case result is not an object
                structuredContent: {
                  result,
                },
                // @note content is still required for backwards compatibility
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result), // @todo decide if we should use yaml - if not document why
                  },
                ],
                _meta: {
                  mcpserverIntegrationId: mcpserverIntegration.id,

                  // @note widget props stored in dedicated property to avoid conflicts

                  ...(widgetProps && { widget: widgetProps }),
                },
                isError: false,
              }
            } catch (e) {
              await captureException(e)

              const errorMessage =
                e instanceof Error ? e.message : 'Unknown error'

              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: ${errorMessage}`,
                  },
                ],
                isError: true,
              }
            }
          })

          debug(`connecting server to transport`).log(
            'api.v1.integration.mcpserver.instance.mcp.handler'
          )

          await server.connect(transport)

          debug(`handling single request then closing`).log(
            'api.v1.integration.mcpserver.instance.mcp.handler'
          )

          // @note handle the request - in stateless mode this will complete after
          // processing the request, allowing the serverless function to terminate

          await transport.handleRequest(req, res, req.body)
        } finally {
          clearTimeout(timeoutId)
        }
      })

      await deferredHandlerFn()
    },
    {
      disableContextInheritance: true,
    }
  )

  await contextHandlerFn()
}

/**
 * @manual MCP Server Integration
 * @category Integrations/MCPServer
 * @index 50
 *
 * ## Authentication
 *
 * Every request to an MCP Server Integration endpoint requires a static access
 * token. This token acts as a kill-switch: rotating it in the dashboard
 * immediately revokes access for all clients, regardless of any other
 * credentials they hold. It is always required.
 *
 * ### Standard Authentication
 *
 * Pass the access token in the `Authorization` header using the Bearer scheme:
 *
 * ```http
 * POST /api/v1/integration/mcpserver/{mcpserverIntegrationId}/mcp
 * Authorization: Bearer YOUR_ACCESS_TOKEN
 * Content-Type: application/json
 * ```
 *
 * You can also pass it as an `authorization` query parameter, which is useful
 * for tools that do not support custom headers:
 *
 * ```http
 * POST /api/v1/integration/mcpserver/{mcpserverIntegrationId}/mcp?authorization=YOUR_ACCESS_TOKEN
 * Content-Type: application/json
 * ```
 *
 * ### OAuth / IdP Authentication
 *
 * When an OAuth connection is configured on the integration, end-users
 * authenticate through your Identity Provider (IdP) using the standard OAuth
 * 2.0 Authorization Code flow with PKCE. The MCP client (e.g. Claude) receives
 * a short-lived JWT Bearer token issued by ChatBotKit after the IdP login
 * completes, and sends it in the `Authorization` header.
 *
 * Because the `Authorization` header is occupied by the JWT in this flow, the
 * static access token **must** be supplied via the `authorization` query
 * parameter at the same time:
 *
 * ```http
 * POST /api/v1/integration/mcpserver/{mcpserverIntegrationId}/mcp?authorization=YOUR_ACCESS_TOKEN
 * Authorization: Bearer OAUTH_JWT_TOKEN
 * Content-Type: application/json
 * ```
 *
 * Both credentials are validated on every request. If either is missing or
 * invalid the server responds with `401 Unauthorized`.
 *
 * ### Revoking Access
 *
 * To immediately cut off all access to an integration - for example after a
 * security incident - rotate the static access token from the dashboard. The
 * new token takes effect instantly. Existing OAuth sessions become invalid on
 * the next request because the static token check always runs, even for users
 * with valid JWT tokens.
 *
 * ## Session Management
 *
 * MCP Server Integrations use session management to maintain context and state
 * across multiple requests from client applications. Sessions enable your
 * skillsets to provide consistent, contextual responses throughout extended
 * interactions, similar to how conversations maintain continuity in chat
 * applications.
 *
 * ### Understanding Sessions
 *
 * A session represents a persistent context for interactions between a client
 * application and your MCP server integration. Each session is uniquely
 * identified and bound to your user account, ensuring that different clients
 * or applications maintain separate, isolated contexts.
 *
 * Sessions are managed automatically through HTTP headers, requiring minimal
 * implementation effort from client applications. The platform handles session
 * creation, validation, and lifecycle management transparently, allowing you
 * to focus on building your integration logic.
 *
 * ### Session Lifecycle
 *
 * When a client application connects to your MCP server endpoint, the session
 * lifecycle proceeds as follows:
 *
 * 1. **Initial Connection**: The first request from a client automatically
 *    creates a new session. The server returns a unique session identifier in
 *    the `mcp-session-id` response header.
 *
 * 2. **Session Reuse**: Subsequent requests from the same client should include
 *    the `mcp-session-id` header to continue using the same session. This
 *    maintains context across multiple tool invocations.
 *
 * 3. **Session Validation**: Each request validates that the session belongs
 *    to the authenticated user. Sessions from other users or invalid session
 *    identifiers result in automatic creation of new sessions.
 *
 * 4. **Session Expiration**: Sessions automatically expire after 24 hours of
 *    inactivity. Active sessions are kept alive automatically - each request
 *    extends the session lifetime by another 24 hours.
 *
 * ### Implementing Session Support
 *
 * To implement session support in your client application, capture the
 * `mcp-session-id` header from the initial response and include it in
 * subsequent requests:
 *
 * **Initial Request:**
 *
 * ```http
 * POST /api/v1/integration/mcpserver/{mcpserverIntegrationId}/mcp
 * Authorization: Bearer YOUR_ACCESS_TOKEN
 * Content-Type: application/json
 *
 * {
 *   "jsonrpc": "2.0",
 *   "method": "tools/list",
 *   "id": 1
 * }
 * ```
 *
 * **Server Response:**
 *
 * ```http
 * HTTP/1.1 200 OK
 * mcp-session-id: clx8k9j2m0000abcdefghijk
 * Content-Type: application/json
 *
 * {
 *   "jsonrpc": "2.0",
 *   "result": { ... },
 *   "id": 1
 * }
 * ```
 *
 * **Subsequent Requests:**
 *
 * ```http
 * POST /api/v1/integration/mcpserver/{mcpserverIntegrationId}/mcp
 * Authorization: Bearer YOUR_ACCESS_TOKEN
 * mcp-session-id: clx8k9j2m0000abcdefghijk
 * Content-Type: application/json
 *
 * {
 *   "jsonrpc": "2.0",
 *   "method": "tools/call",
 *   "params": { ... },
 *   "id": 2
 * }
 * ```
 *
 * ### Session Security and Isolation
 *
 * Sessions are strictly bound to the authenticated user account. The platform
 * enforces the following security guarantees:
 *
 * - **User Isolation**: Sessions cannot be shared between different user
 *   accounts. Each session is validated against the authentication token on
 *   every request.
 *
 * - **Integration Isolation**: Each MCP server integration maintains separate
 *   session namespaces, preventing cross-contamination between different
 *   integrations.
 *
 * - **Automatic Security**: Invalid or tampered session identifiers are
 *   rejected automatically, with new sessions created as needed to ensure
 *   service continuity.
 *
 * - **Secure Storage**: Session data is encrypted and stored securely,
 *   protecting sensitive context information.
 *
 * ### Best Practices
 *
 * When implementing session management in your client applications:
 *
 * - **Always preserve session IDs**: Store the `mcp-session-id` header value
 *   and include it in all subsequent requests to maintain context.
 *
 * - **Handle session expiration gracefully**: If a session expires, the server
 *   will automatically create a new session. Your client should detect this
 *   (by comparing session IDs) and reset any local context as needed.
 *
 * - **Don't share sessions**: Each client instance should maintain its own
 *   session. Sharing session IDs between different clients or users will
 *   result in authentication failures.
 *
 * - **Monitor session activity**: For long-running applications, be aware of
 *   the 24-hour inactivity timeout. Regular requests keep sessions alive
 *   automatically.
 *
 * **Note**: Session management is optional but recommended. Clients that don't
 * implement session support will receive a new session for each request, which
 * may limit the ability of your skillsets to maintain context across multiple
 * interactions.
 */

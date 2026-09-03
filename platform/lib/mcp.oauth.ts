import {
  ONE_DAY_IN_SECONDS,
  QUARTER_HOUR_IN_SECONDS,
} from '@chatbotkit-dev/time'

import type { User } from '@/prisma/types'

import { decrypt, encrypt } from '@/lib/cloak'
import debug from '@/lib/debug'
import egressFetch from '@/lib/egress.fetch'
import { UserAuthError, captureException } from '@/lib/error'
import { getExternalFrontendHostURL, getExternalHostURL } from '@/lib/host'
import { sign, verify } from '@/lib/jwt'
import memcache from '@/lib/memcache'
import { getTempShortURL } from '@/lib/short'

import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { StreamableHTTPClientTransportOptions } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type {
  OAuthClientInformation,
  OAuthClientInformationFull,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'

/**
 *
 */
export class McpStreamableHTTPClientTransport extends StreamableHTTPClientTransport {
  private readonly mcpAuthProvider: McpOAuthProvider

  constructor(
    url: URL,
    ops: StreamableHTTPClientTransportOptions & {
      authProvider: McpOAuthProvider
    }
  ) {
    super(url, ops)

    this.mcpAuthProvider = ops.authProvider
  }

  get authProvider(): McpOAuthProvider {
    return this.mcpAuthProvider
  }
}

/**
 *
 */
interface McpOAuthState {
  userId: string

  sessionId: string

  url: string
  headers?: Record<string, string>

  timestamp: number
}

/**
 * Redis-backed OAuth client provider for MCP integrations that implements
 * secure state management using encryption and signing
 */
export class McpOAuthProvider implements OAuthClientProvider {
  private readonly userId: string

  private readonly sessionId: string

  private readonly url: string
  private readonly headers?: Record<string, string>

  private readonly clientKey: string
  private readonly tokensKey: string
  private readonly codeVerifierKey: string

  constructor(
    user: Pick<User, 'id'>,
    {
      sessionId,

      url,
      headers,
    }: {
      sessionId: string

      url: string
      headers?: Record<string, string>
    }
  ) {
    this.userId = user.id

    this.sessionId = sessionId

    this.url = url
    this.headers = headers

    // @note create unique keys for Redis storage based on user and session

    this.clientKey = `mcp:oauth:client:${this.userId}:${this.sessionId}`
    this.tokensKey = `mcp:oauth:tokens:${this.userId}:${this.sessionId}`
    this.codeVerifierKey = `mcp:oauth:codeVerifier:${this.userId}:${this.sessionId}`
  }

  //
  // GETTERS
  //

  get redirectUrl(): string {
    const redirectUrl = getExternalHostURL('/oauth/mcp/callback')

    debug(`computed redirect URL`, { redirectUrl }).log(
      'mcp.oauth.McpOAuthProvider.redirectUrl'
    )

    return redirectUrl
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'MCP Client',
      redirect_uris: Array.from(
        new Set([
          this.redirectUrl,
          getExternalHostURL('/oauth/mcp/callback'),
          getExternalFrontendHostURL('/oauth/mcp/callback'),
        ])
      ),
      grant_types: ['authorization_code', 'refresh_token'],
      logo_uri: undefined,
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      tos_uri: undefined,
      scope: 'mcp:tools',
    }
  }

  //
  // FLOW
  //

  /**
   * Validates resource URL for RFC 8707 Resource Indicator
   */
  async validateResourceURL(
    url: string | URL,
    resource?: string
  ): Promise<URL | undefined> {
    debug(`validating resource URL`, { url, resource }).log(
      'mcp.oauth.McpOAuthProvider.validateResourceURL'
    )

    if (!url) {
      throw new Error('URL is required for resource validation')
    }

    if (!resource) {
      return undefined
    }

    const expectedUrl = new URL(url)
    const resourceUrl = new URL(resource)

    // @note ensure resource URL matches the expected MCP server

    if (resourceUrl.origin !== expectedUrl.origin) {
      throw new Error('Resource URL does not match MCP server origin')
    }

    debug(`resource URL validated`, { resourceUrl }).log(
      'mcp.oauth.McpOAuthProvider.validateResourceURL'
    )

    return resourceUrl
  }

  /**
   * Generates a signed and encrypted state parameter
   */
  async state(): Promise<string> {
    const stateData: McpOAuthState = {
      userId: this.userId,

      sessionId: this.sessionId,

      url: this.url,
      headers: this.headers,

      timestamp: Date.now(),
    }

    debug(`generating state`, { stateData }).log(
      'mcp.oauth.McpOAuthProvider.state'
    )

    const signedState = await sign(stateData, QUARTER_HOUR_IN_SECONDS)

    return signedState
  }

  /**
   * Redirects the user to the OAuth authorization URL
   */
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    debug(`redirecting to authorization`, {
      url: authorizationUrl.toString(),
    }).log('mcp.oauth.McpOAuthProvider.redirectToAuthorization')

    const shortUrl = new URL(await getTempShortURL(authorizationUrl.toString()))

    shortUrl.searchParams.set('auth', '1')
    shortUrl.searchParams.set('cbk', '1')
    shortUrl.searchParams.set('unfurl', '0')

    throw new UserAuthError(
      `OAuth authentication required: visit ${shortUrl.toString()} to authorize MCP server access and try again`
    )
  }

  //
  // SAVE AND RETRIEVE
  //

  async saveClientInformation(
    clientInformation: OAuthClientInformationFull
  ): Promise<void> {
    const encrypted = await encrypt(JSON.stringify(clientInformation))

    // @note store with longer expiration (24 hours) as client info is more persistent

    await memcache.setex(this.clientKey, ONE_DAY_IN_SECONDS, encrypted)
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    const stored = await memcache.get(this.clientKey)

    if (!stored) {
      return undefined
    }

    try {
      const decrypted = await decrypt(stored as string)

      return JSON.parse(decrypted) as OAuthClientInformation
    } catch (error) {
      await captureException(error)

      return undefined
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    const encrypted = await encrypt(JSON.stringify(tokens))

    const expiresIn = tokens.expires_in || ONE_DAY_IN_SECONDS

    await memcache.setex(this.tokensKey, expiresIn, encrypted)
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const stored = await memcache.get(this.tokensKey)

    if (!stored) {
      return undefined
    }

    try {
      const decrypted = await decrypt(stored as string)
      const tokens = JSON.parse(decrypted)

      return tokens as OAuthTokens
    } catch (error) {
      await captureException(error)

      return undefined
    }
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    debug(`saving code verifier`).log(
      'mcp.oauth.McpOAuthProvider.saveCodeVerifier'
    )

    const encrypted = await encrypt(codeVerifier)

    // @note store with short expiration (15 minutes) as it's only needed
    // during auth flow

    await memcache.setex(this.codeVerifierKey, QUARTER_HOUR_IN_SECONDS, encrypted)
  }

  async codeVerifier(): Promise<string> {
    const stored = await memcache.get(this.codeVerifierKey)

    if (!stored) {
      throw new Error('No code verifier found')
    }

    try {
      const decrypted = await decrypt(stored as string)

      debug(`retrieved code verifier`).log(
        'mcp.oauth.McpOAuthProvider.codeVerifier'
      )

      return decrypted
    } catch (error) {
      await captureException(error)

      throw new Error('Failed to decrypt code verifier')
    }
  }

  //
  // CLEANUP
  //

  async cleanup(): Promise<void> {
    debug(`cleaning up OAuth data`).log('McpOAuthProvider.cleanup')

    await memcache
      .pipeline()
      .del(this.clientKey)
      .del(this.tokensKey)
      .del(this.codeVerifierKey)
      .exec()
  }

  //
  // STATIC
  //

  static getClientTransport(
    user: Pick<User, 'id'>,
    {
      sessionId,

      url,
      headers,
    }: {
      sessionId: string

      url: string
      headers?: Record<string, string>
    }
  ) {
    const oauthProvider = new McpOAuthProvider(
      { id: user.id },
      { sessionId, url, headers }
    )

    const transport = new McpStreamableHTTPClientTransport(new URL(url), {
      authProvider: oauthProvider,
      requestInit: {
        headers: headers,
      },
      // @note the MCP server URL is the user's choice, so every connection
      // the SDK opens - including redirects - goes through the egress
      // boundary rather than the SDK's own fetch
      fetch: egressFetch,
    })

    return transport
  }

  /**
   * Handles the OAuth callback by validating state and exchanging code for
   * tokens - this would typically be called from the OAuth callback page
   */
  static async handleCallback(state: string, code: string): Promise<void> {
    debug(`handling oauth callback`, {
      state,
      code: code.substring(0, 10) + '...',
    }).log('mcp.oauth.McpOAuthProvider.handleCallback')

    const data = (await verify(state)) as McpOAuthState

    const transport = McpOAuthProvider.getClientTransport(
      { id: data.userId },
      { sessionId: data.sessionId, url: data.url, headers: data.headers }
    )

    await transport.finishAuth(code)
  }
}

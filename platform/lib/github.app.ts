/* eslint-disable @typescript-eslint/no-explicit-any */
import { ttlCache } from '@/lib/cache'
import fetch, { FetchError } from '@/lib/fetch'
import { statusToCodeMap } from '@/lib/response'

import crypto from 'crypto'

const GITHUB_API = 'https://api.github.com'

// @note installation tokens live 60 min; cache with a 10 min safety buffer
const INSTALLATION_TOKEN_TTL_SECONDS = 50 * 60

// @note the App slug is stable; cache for a day
const APP_SLUG_TTL_SECONDS = 24 * 60 * 60

interface GithubRequestOptions {
  method?: string
  body?: unknown
  token: string
}

/**
 * Minimal authenticated GitHub REST helper. The `token` may be an installation
 * access token, a personal access token, an OAuth token, or an App JWT
 * (depending on the endpoint).
 */
export async function githubRequest(
  path: string,
  { method = 'GET', body, token }: GithubRequestOptions
): Promise<any> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method,

    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'chatbotkit',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },

    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')

    // @note throw a FetchError (not a plain Error) so the auxiliary handler
    // treats a GitHub 4xx/5xx as an upstream-API issue and returns it to the
    // agent without capturing it to Sentry. The status/body are kept in the
    // message so the agent can see exactly what failed and self-correct (e.g.
    // GET /orgs/{org}/issues 404s under installation-token auth - see
    // the related regressions).
    throw new FetchError(
      `GitHub API ${method} ${path} failed: ${response.status} ${text}`,
      statusToCodeMap[response.status] || statusToCodeMap[500],
      { method, path, status: response.status }
    )
  }

  if (response.status === 204) {
    return null
  }

  return await response.json()
}

// --- App JWT + installation token minting (per-integration GitHub App) ---

function base64url(input: string): string {
  return Buffer.from(input).toString('base64url')
}

/**
 * Signs a short-lived (≤10 min) App JWT with the integration's App private key (RS256).
 */
function createAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))

  // @note iat backdated 60s for clock skew, exp capped at 9 minutes
  const payload = base64url(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId })
  )

  const signingInput = `${header}.${payload}`

  const signer = crypto.createSign('RSA-SHA256')

  signer.update(signingInput)
  signer.end()

  // @note the stored private key may carry literal \n escapes; normalize them
  const signature = signer
    .sign(privateKey.replace(/\\n/g, '\n'))
    .toString('base64url')

  return `${signingInput}.${signature}`
}

/** This integration's GitHub App credentials. */
interface GithubAppCredentials {
  appId: string
  privateKey: string
}

function assertAppCredentials(app: {
  appId?: string | null
  privateKey?: string | null
}): GithubAppCredentials {
  if (!app.appId || !app.privateKey) {
    throw new Error('GitHub integration is missing its App id / private key')
  }

  return { appId: app.appId, privateKey: app.privateKey }
}

/**
 * Mints a 1-hour installation access token scoped to the installation's repos
 * and permissions, using this integration's own GitHub App credentials. Cached
 * by (appId, installationId) for just under the token's lifetime so repeated
 * events on the same installation don't re-mint.
 */
export async function mintInstallationToken({
  appId,
  privateKey,
  installationId,
}: GithubAppCredentials & { installationId: string }): Promise<string> {
  return await ttlCache(
    `github:installation-token:${appId}:${installationId}`,
    INSTALLATION_TOKEN_TTL_SECONDS,
    async () => {
      const jwt = createAppJwt(appId, privateKey)

      const data = await githubRequest(
        `/app/installations/${installationId}/access_tokens`,
        { method: 'POST', token: jwt }
      )

      return data.token as string
    }
  )
}

/**
 * Looks up the App's installation id for a given repo (via an App JWT) and
 * mints a token for it. Used by agent-initiated abilities, which know the
 * owner/repo but not the installation id (inbound events carry it directly).
 */
export async function getInstallationTokenForRepo({
  appId,
  privateKey,
  owner,
  repo,
}: GithubAppCredentials & {
  owner: string
  repo: string
}): Promise<string> {
  const jwt = createAppJwt(appId, privateKey)

  const installation = await githubRequest(
    `/repos/${owner}/${repo}/installation`,
    { token: jwt }
  )

  return await mintInstallationToken({
    appId,
    privateKey,
    installationId: String(installation.id),
  })
}

/**
 * Looks up the App's installation for an account (org or user) and mints a
 * token for it. Used by the generic API-call ability, which derives the account
 * from the request path rather than taking owner/repo parameters.
 */
export async function getInstallationTokenForOwner({
  appId,
  privateKey,
  owner,
}: GithubAppCredentials & { owner: string }): Promise<string> {
  const jwt = createAppJwt(appId, privateKey)

  // @note an installation belongs to an account (org or user); try org first
  const installation = await githubRequest(`/orgs/${owner}/installation`, {
    token: jwt,
  }).catch(() => githubRequest(`/users/${owner}/installation`, { token: jwt }))

  return await mintInstallationToken({
    appId,
    privateKey,
    installationId: String(installation.id),
  })
}

/**
 * Mints an installation token to hand to a CLI / git client, down-scoped to a
 * single repository (and optional permissions). Returns the token and its
 * expiry. NOT cached - the scoping varies per call, and the caller owns the
 * (sensitive) token's lifecycle.
 */
export async function createScopedInstallationToken({
  appId,
  privateKey,
  owner,
  repo,
  permissions,
}: GithubAppCredentials & {
  owner: string
  repo: string
  permissions?: Record<string, string>
}): Promise<{ token: string; expiresAt: string }> {
  const jwt = createAppJwt(appId, privateKey)

  const installation = await githubRequest(
    `/repos/${owner}/${repo}/installation`,
    { token: jwt }
  )

  const data = await githubRequest(
    `/app/installations/${installation.id}/access_tokens`,
    {
      method: 'POST',
      body: {
        repositories: [repo],
        ...(permissions && Object.keys(permissions).length
          ? { permissions }
          : {}),
      },
      token: jwt,
    }
  )

  return { token: data.token, expiresAt: data.expires_at }
}

/**
 * Fetches this integration's GitHub App metadata (including its `slug`) via an
 * App JWT. The slug is the handle the bot is @mentioned by.
 */
export async function getApp({
  appId,
  privateKey,
}: GithubAppCredentials): Promise<any> {
  const jwt = createAppJwt(appId, privateKey)

  return await githubRequest('/app', { token: jwt })
}

/**
 * Lists the App's installations (via an App JWT). Doubles as a credential
 * probe: it only succeeds if the App ID + private key are valid.
 */
export async function listAppInstallations({
  appId,
  privateKey,
}: GithubAppCredentials): Promise<any[]> {
  const jwt = createAppJwt(appId, privateKey)

  return (
    (await githubRequest('/app/installations?per_page=100', { token: jwt })) ||
    []
  )
}

/** The App's slug (the handle the bot is @mentioned by), cached by appId. */
export async function getAppSlug({
  appId,
  privateKey,
}: GithubAppCredentials): Promise<string | undefined> {
  return await ttlCache(
    `github:app-slug:${appId}`,
    APP_SLUG_TTL_SECONDS,
    async () => {
      const app = await getApp({ appId, privateKey })

      return app?.slug as string
    }
  )
}

export { assertAppCredentials }

// --- High-level write helpers ---

export async function postIssueComment({
  token,
  owner,
  repo,
  issueNumber,
  body,
}: {
  token: string
  owner: string
  repo: string
  issueNumber: number
  body: string
}): Promise<any> {
  return await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    { method: 'POST', body: { body }, token }
  )
}

/**
 * Adds a reaction to an issue/PR - the closest GitHub equivalent to a Slack
 * "typing" indicator (e.g. 👀 to acknowledge the bot is working).
 */
export async function createIssueReaction({
  token,
  owner,
  repo,
  issueNumber,
  content = 'eyes',
}: {
  token: string
  owner: string
  repo: string
  issueNumber: number
  content?: string
}): Promise<any> {
  return await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/reactions`,
    { method: 'POST', body: { content }, token }
  )
}

export async function createCommentReaction({
  token,
  owner,
  repo,
  commentId,
  content = 'eyes',
}: {
  token: string
  owner: string
  repo: string
  commentId: number
  content?: string
}): Promise<any> {
  return await githubRequest(
    `/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
    { method: 'POST', body: { content }, token }
  )
}

// --- Triage write helpers ---

export async function addIssueLabels({
  token,
  owner,
  repo,
  issueNumber,
  labels,
}: {
  token: string
  owner: string
  repo: string
  issueNumber: number
  labels: string[]
}): Promise<any> {
  return await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
    { method: 'POST', body: { labels }, token }
  )
}

export async function addIssueAssignees({
  token,
  owner,
  repo,
  issueNumber,
  assignees,
}: {
  token: string
  owner: string
  repo: string
  issueNumber: number
  assignees: string[]
}): Promise<any> {
  return await githubRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/assignees`,
    { method: 'POST', body: { assignees }, token }
  )
}

export async function updateIssueState({
  token,
  owner,
  repo,
  issueNumber,
  state,
  stateReason,
}: {
  token: string
  owner: string
  repo: string
  issueNumber: number
  state: 'open' | 'closed'
  stateReason?: string
}): Promise<any> {
  return await githubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: {
      state,
      ...(stateReason ? { state_reason: stateReason } : {}),
    },
    token,
  })
}

/** Reads a single file's contents from a repo (decoded from base64). */
export async function getRepoFile({
  token,
  owner,
  repo,
  path,
  ref,
}: {
  token: string
  owner: string
  repo: string
  path: string
  ref?: string
}): Promise<{
  path: string
  sha: string
  size: number
  content: string
}> {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : ''

  const data = await githubRequest(
    `/repos/${owner}/${repo}/contents/${path}${query}`,
    { token }
  )

  const content = data?.content
    ? Buffer.from(data.content, 'base64').toString('utf8')
    : ''

  return { path: data?.path, sha: data?.sha, size: data?.size, content }
}

/** Lists files and directories at a path in a repo (one level). */
export async function listRepoContents({
  token,
  owner,
  repo,
  path = '',
  ref,
}: {
  token: string
  owner: string
  repo: string
  path?: string
  ref?: string
}): Promise<
  Array<{ name: string; path: string; type: string; size: number; sha: string }>
> {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : ''

  const data = await githubRequest(
    `/repos/${owner}/${repo}/contents/${path}${query}`,
    { token }
  )

  // @note the Contents API returns an array for a directory and an object for a
  // single file - normalize to an array
  const entries = Array.isArray(data) ? data : [data]

  return entries.map((entry: any) => ({
    name: entry.name,
    path: entry.path,
    type: entry.type,
    size: entry.size,
    sha: entry.sha,
  }))
}

// --- Context fetching (for building the conversation) ---

export async function getIssue({
  token,
  owner,
  repo,
  issueNumber,
}: {
  token: string
  owner: string
  repo: string
  issueNumber: number
}): Promise<any> {
  return await githubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
    token,
  })
}

export async function listIssueComments({
  token,
  owner,
  repo,
  issueNumber,
  perPage = 20,
}: {
  token: string
  owner: string
  repo: string
  issueNumber: number
  perPage?: number
}): Promise<any[]> {
  return (
    (await githubRequest(
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=${perPage}`,
      { token }
    )) || []
  )
}

const MAX_DIFF_CHARS = 60_000

/**
 * Fetches a pull request's unified diff (truncated). Useful context for the
 * agent when summoned on a PR.
 */
export async function getPullRequestDiff({
  token,
  owner,
  repo,
  pullNumber,
}: {
  token: string
  owner: string
  repo: string
  pullNumber: number
}): Promise<string> {
  const response = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pullNumber}`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github.v3.diff',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'chatbotkit',
      },
    }
  )

  if (!response.ok) {
    // @note FetchError (not a plain Error) so an upstream GitHub failure isn't
    // captured to Sentry - see the note in githubRequest above.
    throw new FetchError(
      `GitHub diff fetch failed: ${response.status}`,
      statusToCodeMap[response.status] || statusToCodeMap[500],
      { owner, repo, pullNumber, status: response.status }
    )
  }

  const diff = await response.text()

  return diff.length > MAX_DIFF_CHARS
    ? diff.slice(0, MAX_DIFF_CHARS) + '\n... [diff truncated]'
    : diff
}

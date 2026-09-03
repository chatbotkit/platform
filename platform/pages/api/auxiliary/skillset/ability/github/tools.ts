import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import type { Session } from '@/lib/session.handler'
import call, { getCallError } from '@/lib/call'
import debug from '@/lib/debug'
import { throwNotAuthenticated } from '@/lib/response'
import { z } from '@/lib/zod.schema'

// --- Handler Names ---

export const REPOSITORY_TOKEN_CREATE_HANDLER_NAME =
  'repository/token/create' as const

// --- Schemas ---

export const repositoryTokenCreateSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  permissions: z.record(z.string()).optional(),
})

export type RepositoryTokenCreateSchema = z.infer<
  typeof repositoryTokenCreateSchema
>

// --- Helper Functions ---

function getJwtToken(headers: Headers): string {
  const token = headers.get('x-access-token')

  if (!token) {
    return throwNotAuthenticated()
  }

  if (/^bearer\s+/i.test(token)) {
    return token
  }

  return `Bearer ${token.replace(/^(token|bearer)\s+/i, '')}`
}

// --- Repository Token Create Handler ---

async function repositoryTokenCreateHandler(
  _session: Session,
  parameters: RepositoryTokenCreateSchema,
  headers: Headers
) {
  debug(`github/repository/token/create`, { parameters }).log(
    'auxiliary.github.repositoryTokenCreateHandler'
  )

  const { owner, repo, permissions } = parameters

  const token = getJwtToken(headers)

  const installationResponse = await call(
    `https://api.github.com/repos/${encodeURIComponent(
      owner
    )}/${encodeURIComponent(repo)}/installation`,
    {
      headers: {
        Authorization: token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!installationResponse.ok) {
    throw await getCallError(installationResponse)
  }

  const installation = await installationResponse.json()

  const accessTokenResponse = await call(
    `https://api.github.com/app/installations/${installation.id}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: token,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        repositories: [repo],
        ...(permissions ? { permissions } : {}),
      }),
    }
  )

  if (!accessTokenResponse.ok) {
    throw await getCallError(accessTokenResponse)
  }

  const data = await accessTokenResponse.json()

  return {
    token: data.token,
    expiresAt: data.expires_at,
    permissions: data.permissions,
    repositorySelection: data.repository_selection,
    repositories: data.repositories?.map(
      (repository: {
        id: number
        name: string
        full_name: string
        private: boolean
        html_url: string
      }) => ({
        id: repository.id,
        name: repository.name,
        fullName: repository.full_name,
        private: repository.private,
        url: repository.html_url,
      })
    ),
  }
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [REPOSITORY_TOKEN_CREATE_HANDLER_NAME]: {
    schema: repositoryTokenCreateSchema,
    fn: repositoryTokenCreateHandler,
  },
})

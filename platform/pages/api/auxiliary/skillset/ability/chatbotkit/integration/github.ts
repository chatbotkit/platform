import prisma from '@/prisma/client'

import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import {
  addIssueAssignees,
  addIssueLabels,
  createScopedInstallationToken,
  getInstallationTokenForOwner,
  getInstallationTokenForRepo,
  getRepoFile,
  githubRequest,
  listRepoContents,
  postIssueComment,
  updateIssueState,
} from '@/lib/github.app'
import type { Session } from '@/lib/session.handler'

import { z } from 'zod'

// --- Path and Handler Constants ---

export const GITHUB_INTEGRATION_API_PATH =
  '/api/auxiliary/skillset/ability/chatbotkit/integration/github'

export const POST_COMMENT_HANDLER_NAME = 'postComment'
export const ADD_LABELS_HANDLER_NAME = 'addLabels'
export const ASSIGN_USERS_HANDLER_NAME = 'assignUsers'
export const SET_STATE_HANDLER_NAME = 'setState'
export const READ_FILE_HANDLER_NAME = 'readFile'
export const LIST_FILES_HANDLER_NAME = 'listFiles'
export const API_CALL_HANDLER_NAME = 'apiCall'
export const CREATE_TOKEN_HANDLER_NAME = 'createToken'

// --- Shared schema fields ---

const baseFields = {
  githubIntegrationId: z
    .string()
    .min(1)
    .describe('The ID of the GitHub integration to use'),
  repository: z
    .string()
    .min(1)
    .describe(
      'The repository as owner/repo or a GitHub URL, e.g. acme/web or https://github.com/acme/web'
    ),
}

// --- Schemas ---

const postCommentSchema = z.object({
  ...baseFields,
  issueNumber: z
    .number()
    .int()
    .describe('The issue or pull request number to comment on'),
  body: z.string().min(1).describe('The markdown body of the comment to post'),
})

const addLabelsSchema = z.object({
  ...baseFields,
  issueNumber: z
    .number()
    .int()
    .describe('The issue or pull request number to label'),
  labels: z
    .array(z.string())
    .min(1)
    .describe('The labels to add to the issue or pull request'),
})

const assignUsersSchema = z.object({
  ...baseFields,
  issueNumber: z
    .number()
    .int()
    .describe('The issue or pull request number to assign'),
  assignees: z
    .array(z.string())
    .min(1)
    .describe('The GitHub logins to assign to the issue or pull request'),
})

const setStateSchema = z.object({
  ...baseFields,
  issueNumber: z
    .number()
    .int()
    .describe('The issue or pull request number to open or close'),
  state: z.enum(['open', 'closed']).describe('The desired state'),
  reason: z
    .string()
    .optional()
    .describe(
      "Optional reason when closing: 'completed', 'not_planned', or 'reopened'"
    ),
})

const readFileSchema = z.object({
  ...baseFields,
  path: z
    .string()
    .min(1)
    .describe('The path of the file within the repository'),
  ref: z
    .string()
    .optional()
    .describe(
      'Optional branch, tag, or commit SHA (defaults to the default branch)'
    ),
})

const listFilesSchema = z.object({
  ...baseFields,
  path: z
    .string()
    .optional()
    .describe('Optional directory path within the repo (defaults to the root)'),
  ref: z
    .string()
    .optional()
    .describe(
      'Optional branch, tag, or commit SHA (defaults to the default branch)'
    ),
})

const apiCallSchema = z.object({
  githubIntegrationId: baseFields.githubIntegrationId,
  method: z
    .enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
    .describe('The HTTP method'),
  path: z
    .string()
    .min(1)
    .describe(
      'The GitHub REST API path, e.g. /repos/{owner}/{repo}/issues/{n}/comments. The account is taken from the path to mint the token.'
    ),
  body: z
    .string()
    .optional()
    .describe('Optional request body as a JSON string (for POST/PATCH/PUT)'),
})

const createTokenSchema = z.object({
  ...baseFields,
  permissions: z
    .record(z.string())
    .optional()
    .describe(
      'Optional permissions to down-scope the token, e.g. { "contents": "read" }'
    ),
})

export type PostCommentSchema = z.infer<typeof postCommentSchema>
export type AddLabelsSchema = z.infer<typeof addLabelsSchema>
export type AssignUsersSchema = z.infer<typeof assignUsersSchema>
export type SetStateSchema = z.infer<typeof setStateSchema>
export type ReadFileSchema = z.infer<typeof readFileSchema>
export type ListFilesSchema = z.infer<typeof listFilesSchema>
export type ApiCallSchema = z.infer<typeof apiCallSchema>
export type CreateTokenSchema = z.infer<typeof createTokenSchema>

// --- Helpers ---

/**
 * Resolves a repository reference to its `owner` and `repo` parts. Accepts the
 * plain `owner/repo` full name as well as common URL forms:
 *   - https://github.com/owner/repo (with optional .git, trailing slash, or a
 *     deeper path like /owner/repo/issues/1)
 *   - github.com/owner/repo
 *   - https://api.github.com/repos/owner/repo
 *   - git@github.com:owner/repo.git
 * @throws UserInputError if the repository cannot be parsed into owner/repo
 */
function splitRepository(repository: string): { owner: string; repo: string } {
  let value = repository.trim()

  value = value
    .replace(/^[a-z]+:\/\//i, '') // strip scheme (https://, http://, ssh://)
    .replace(/^git@github\.com:/i, '') // strip scp-style ssh prefix
    .replace(/^(www\.|api\.)?github\.com\//i, '') // strip host
    .replace(/^repos\//i, '') // strip the api /repos/ prefix

  // @note take the first two path segments as owner/repo; ignore anything
  // deeper (e.g. /issues/1, /tree/main) and a trailing .git
  const parts = value.split('/').filter(Boolean)

  const owner = parts[0]
  const repo = parts[1]?.replace(/\.git$/i, '')

  if (!owner || !repo) {
    throw new UserInputError(
      'repository must be owner/repo or a GitHub repository URL, e.g. acme/web or https://github.com/acme/web'
    )
  }

  return { owner, repo }
}

/**
 * Verifies ownership of the integration and returns its GitHub App credentials.
 */
async function resolveCredentials(
  session: Session,
  githubIntegrationId: string
): Promise<{ appId: string; privateKey: string }> {
  const integration = await prisma.githubIntegration.findUniqueByIdentifier(
    session.user,
    githubIntegrationId,
    {
      select: {
        id: true,
        userId: true,
        appId: true,
        privateKey: true,
      },
    }
  )

  if (!integration) {
    throw new UserInputError('GitHub integration not found')
  }

  if (integration.userId !== session.user.id) {
    throw new UserInputError('Not authorized to use this GitHub integration')
  }

  if (!integration.appId || !integration.privateKey) {
    throw new UserInputError(
      'This GitHub integration is missing its App credentials'
    )
  }

  return { appId: integration.appId, privateKey: integration.privateKey }
}

/**
 * Verifies ownership and mints an installation token for the target repo using
 * the integration's own GitHub App credentials.
 */
async function resolveToken(
  session: Session,
  githubIntegrationId: string,
  owner: string,
  repo: string
): Promise<string> {
  const { appId, privateKey } = await resolveCredentials(
    session,
    githubIntegrationId
  )

  return await getInstallationTokenForRepo({ appId, privateKey, owner, repo })
}

// --- Handlers ---

async function postComment(
  session: Session,
  parameters: z.infer<typeof postCommentSchema>
) {
  debug('post comment', { parameters }).log(
    'api.auxiliary.skillset.ability.chatbotkit.integration.github.postComment'
  )

  const { githubIntegrationId, repository, issueNumber, body } = parameters

  const { owner, repo } = splitRepository(repository)

  const token = await resolveToken(session, githubIntegrationId, owner, repo)

  await postIssueComment({ token, owner, repo, issueNumber, body })

  return { success: true, repository, issueNumber }
}

async function addLabels(
  session: Session,
  parameters: z.infer<typeof addLabelsSchema>
) {
  debug('add labels', { parameters }).log(
    'api.auxiliary.skillset.ability.chatbotkit.integration.github.addLabels'
  )

  const { githubIntegrationId, repository, issueNumber, labels } = parameters

  const { owner, repo } = splitRepository(repository)

  const token = await resolveToken(session, githubIntegrationId, owner, repo)

  await addIssueLabels({ token, owner, repo, issueNumber, labels })

  return { success: true, repository, issueNumber, labels }
}

async function assignUsers(
  session: Session,
  parameters: z.infer<typeof assignUsersSchema>
) {
  debug('assign users', { parameters }).log(
    'api.auxiliary.skillset.ability.chatbotkit.integration.github.assignUsers'
  )

  const { githubIntegrationId, repository, issueNumber, assignees } = parameters

  const { owner, repo } = splitRepository(repository)

  const token = await resolveToken(session, githubIntegrationId, owner, repo)

  await addIssueAssignees({ token, owner, repo, issueNumber, assignees })

  return { success: true, repository, issueNumber, assignees }
}

async function setState(
  session: Session,
  parameters: z.infer<typeof setStateSchema>
) {
  debug('set state', { parameters }).log(
    'api.auxiliary.skillset.ability.chatbotkit.integration.github.setState'
  )

  const { githubIntegrationId, repository, issueNumber, state, reason } =
    parameters

  const { owner, repo } = splitRepository(repository)

  const token = await resolveToken(session, githubIntegrationId, owner, repo)

  await updateIssueState({
    token,
    owner,
    repo,
    issueNumber,
    state,
    stateReason: reason,
  })

  return { success: true, repository, issueNumber, state }
}

async function readFile(
  session: Session,
  parameters: z.infer<typeof readFileSchema>
) {
  debug('read file', { parameters }).log(
    'api.auxiliary.skillset.ability.chatbotkit.integration.github.readFile'
  )

  const { githubIntegrationId, repository, path, ref } = parameters

  const { owner, repo } = splitRepository(repository)

  const token = await resolveToken(session, githubIntegrationId, owner, repo)

  return await getRepoFile({ token, owner, repo, path, ref })
}

async function listFiles(
  session: Session,
  parameters: z.infer<typeof listFilesSchema>
) {
  debug('list files', { parameters }).log(
    'api.auxiliary.skillset.ability.chatbotkit.integration.github.listFiles'
  )

  const { githubIntegrationId, repository, path, ref } = parameters

  const { owner, repo } = splitRepository(repository)

  const token = await resolveToken(session, githubIntegrationId, owner, repo)

  const entries = await listRepoContents({ token, owner, repo, path, ref })

  return { entries }
}

async function apiCall(
  session: Session,
  parameters: z.infer<typeof apiCallSchema>
) {
  debug('api call', { parameters }).log(
    'api.auxiliary.skillset.ability.chatbotkit.integration.github.apiCall'
  )

  const { githubIntegrationId, method, path, body } = parameters

  const { appId, privateKey } = await resolveCredentials(
    session,
    githubIntegrationId
  )

  // @note derive the account from the path (/repos/{owner}/…, /orgs/{org}/…,
  // /users/{user}/…) to know which installation to mint a token from
  const match = path.match(/^\/?(?:repos|orgs|users)\/([^/]+)/)

  if (!match) {
    throw new UserInputError(
      'Could not determine the GitHub account from the path; use a path under /repos/{owner}/…, /orgs/{org}/…, or /users/{user}/…'
    )
  }

  const token = await getInstallationTokenForOwner({
    appId,
    privateKey,
    owner: match[1],
  })

  let parsedBody

  if (body) {
    try {
      parsedBody = JSON.parse(body)
    } catch {
      throw new UserInputError('body must be a valid JSON string')
    }
  }

  const result = await githubRequest(path, { method, body: parsedBody, token })

  // @note normalize 204 No Content (e.g. DELETE) to a success object
  return result ?? { ok: true }
}

async function createToken(
  session: Session,
  parameters: z.infer<typeof createTokenSchema>
) {
  debug('create token', {
    parameters: { ...parameters, permissions: undefined },
  }).log(
    'api.auxiliary.skillset.ability.chatbotkit.integration.github.createToken'
  )

  const { githubIntegrationId, repository, permissions } = parameters

  const { owner, repo } = splitRepository(repository)

  const { appId, privateKey } = await resolveCredentials(
    session,
    githubIntegrationId
  )

  return await createScopedInstallationToken({
    appId,
    privateKey,
    owner,
    repo,
    permissions,
  })
}

export default authenticatedMultiHandler({
  [POST_COMMENT_HANDLER_NAME]: { schema: postCommentSchema, fn: postComment },
  [ADD_LABELS_HANDLER_NAME]: { schema: addLabelsSchema, fn: addLabels },
  [ASSIGN_USERS_HANDLER_NAME]: { schema: assignUsersSchema, fn: assignUsers },
  [SET_STATE_HANDLER_NAME]: { schema: setStateSchema, fn: setState },
  [READ_FILE_HANDLER_NAME]: { schema: readFileSchema, fn: readFile },
  [LIST_FILES_HANDLER_NAME]: { schema: listFilesSchema, fn: listFiles },
  [API_CALL_HANDLER_NAME]: { schema: apiCallSchema, fn: apiCall },
  [CREATE_TOKEN_HANDLER_NAME]: { schema: createTokenSchema, fn: createToken },
})

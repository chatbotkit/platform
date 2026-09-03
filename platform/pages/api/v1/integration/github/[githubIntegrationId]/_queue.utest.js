/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import {
  createCommentReaction,
  getAppSlug,
  mintInstallationToken,
  postIssueComment,
} from '@/lib/github.app'
import { accountConversationalLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import memcache from '@/lib/memcache'

import { handleInteractEvent } from '@/pages/api/v1/integration/github/[githubIntegrationId]/queue'

jest.mock('@/lib/queue2', () => ({
  withQueueHandlerBounded: jest.fn(() => jest.fn()),
}))

jest.mock('@/prisma/client', () => ({
  githubIntegration: { findUnique: jest.fn() },
}))

jest.mock('@/lib/github.app', () => ({
  assertAppCredentials: jest.fn(() => ({
    appId: 'app-1',
    privateKey: 'private-key',
  })),
  createCommentReaction: jest.fn(async () => undefined),
  createIssueReaction: jest.fn(async () => undefined),
  getAppSlug: jest.fn(async () => 'mybot'),
  getIssue: jest.fn(async () => ({ title: 'Issue', body: 'Body' })),
  getPullRequestDiff: jest.fn(async () => 'diff'),
  listIssueComments: jest.fn(async () => []),
  mintInstallationToken: jest.fn(async () => 'token-123'),
  postIssueComment: jest.fn(async () => undefined),
}))

jest.mock('@/lib/activity', () => ({
  makeActivityMessagePair: jest.fn(() => []),
}))

jest.mock('@/lib/limit.core', () => ({
  accountConversationalLimitsOk: jest.fn(),
}))

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(),
  set: jest.fn(),
}))

jest.mock('@/lib/log', () => ({ logEvent: jest.fn() }))

jest.mock('@/lib/context.store', () => ({ setContextUser: jest.fn() }))

jest.mock('@/lib/session.context', () => ({ updateSessionStore: jest.fn() }))

jest.mock('@/lib/session.duration', () => ({
  resolveSessionDuration: jest.fn(() => ({ persist: false, ttlSecs: 0 })),
}))

jest.mock('@/lib/user.session', () => ({
  userToSessionUser: jest.fn((u) => u),
}))

jest.mock('@/lib/integration.context', () => ({
  setupFrontendHostContext: jest.fn(async () => undefined),
}))

jest.mock('@/lib/contact.create', () => ({
  createContactFingerprint: jest.fn(() => 'fingerprint'),
  ensureTrustedContact: jest.fn(async () => ({ id: 'contact-1' })),
}))

jest.mock('@/lib/conversation.find', () => ({
  hasConversation: jest.fn(async () => false),
}))

jest.mock('@/lib/conversation.create', () => ({
  createConversation: jest.fn(async () => ({ id: 'conv-1' })),
}))

jest.mock('@/lib/bot.conversation', () => ({
  getConversationDetails: jest.fn(() => ({})),
}))

jest.mock('@/lib/conversation.engine', () => ({
  getStatefulConversationEngine: jest.fn(async () => ({
    send: jest.fn(async () => undefined),
    receive: jest.fn(async () => ({ text: 'reply' })),
    dispose: jest.fn(async () => undefined),
  })),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
  captureInputError: jest.fn(),
}))

jest.mock('@/lib/queue', () => jest.fn())

jest.mock('@/lib/zod.schema', () => ({
  parseAsync: jest.fn(async () => undefined),
}))

jest.mock(
  '@/pages/api/v1/integration/github/[githubIntegrationId]/setup',
  () => ({
    doSetup: jest.fn(async () => undefined),
  })
)

jest.mock('@/lib/response', () => ({
  throwLimitsReached: jest.fn(() => {
    throw new Error('limits reached')
  }),
  throwNotFound: jest.fn(() => {
    throw new Error('not found')
  }),
}))

jest.mock('@/lib/debug', () => {
  const debug = () => ({ log: jest.fn() })

  return { __esModule: true, default: debug }
})

describe('GitHub queue allowFrom gate', () => {
  const githubIntegrationId = 'gh-1'

  function mockIntegration(allowFrom) {
    prisma.githubIntegration.findUnique.mockResolvedValue({
      id: githubIntegrationId,
      userId: 'user-1',
      user: { id: 'user-1', name: 'Test' },
      bot: { id: 'bot-1' },
      appId: 'app-1',
      privateKey: 'private-key',
      sessionDuration: 0,
      contactCollection: false,
      allowFrom,
    })
  }

  function payload(overrides = {}) {
    return {
      installationId: 42,
      eventName: 'issue_comment',
      action: 'created',
      owner: 'chatbotkit',
      repo: 'docs',
      issueNumber: 7,
      commentId: 99,
      senderLogin: 'octocat',
      authorAssociation: 'NONE',
      body: '@mybot summarise this',
      ...overrides,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    accountConversationalLimitsOk.mockResolvedValue(true)

    memcache.get.mockResolvedValue(null)
    memcache.set.mockResolvedValue(undefined)

    getAppSlug.mockResolvedValue('mybot')

    mockIntegration('*')
  })

  it('answers a stranger when allowFrom is a wildcard', async () => {
    await handleInteractEvent(githubIntegrationId, payload())

    expect(postIssueComment).toHaveBeenCalled()
  })

  it('answers a listed login', async () => {
    mockIntegration('@octocat')

    await handleInteractEvent(githubIntegrationId, payload())

    expect(postIssueComment).toHaveBeenCalled()
  })

  it('answers a collaborator under @collaborators', async () => {
    mockIntegration('@collaborators')

    await handleInteractEvent(
      githubIntegrationId,
      payload({ authorAssociation: 'COLLABORATOR' })
    )

    expect(postIssueComment).toHaveBeenCalled()
  })

  it('blocks a stranger under @collaborators and logs the block', async () => {
    mockIntegration('@collaborators')

    await handleInteractEvent(
      githubIntegrationId,
      payload({ authorAssociation: 'NONE' })
    )

    expect(postIssueComment).not.toHaveBeenCalled()

    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'integration.github.blocked',
        relations: expect.objectContaining({ githubIntegrationId }),
      })
    )
  })

  it('blocks an unlisted login', async () => {
    mockIntegration('@someone-else')

    await handleInteractEvent(githubIntegrationId, payload())

    expect(postIssueComment).not.toHaveBeenCalled()
  })

  it('blocks everyone when allowFrom is empty', async () => {
    mockIntegration('')

    await handleInteractEvent(githubIntegrationId, payload())

    expect(postIssueComment).not.toHaveBeenCalled()
  })

  it('blocks everyone when allowFrom is null', async () => {
    mockIntegration(null)

    await handleInteractEvent(githubIntegrationId, payload())

    expect(postIssueComment).not.toHaveBeenCalled()
  })

  it('blocks a summon from a repository outside the allowed owner', async () => {
    mockIntegration('chatbotkit/*')

    await handleInteractEvent(
      githubIntegrationId,
      payload({ owner: 'attacker', repo: 'evil' })
    )

    expect(postIssueComment).not.toHaveBeenCalled()
  })

  it('spends nothing on GitHub or the account when blocking', async () => {
    mockIntegration('@collaborators')

    await handleInteractEvent(githubIntegrationId, payload())

    // @note the gate must sit ahead of everything that costs the owner: no
    // token minted, no reaction written, no limits consumed
    expect(mintInstallationToken).not.toHaveBeenCalled()
    expect(createCommentReaction).not.toHaveBeenCalled()
    expect(accountConversationalLimitsOk).not.toHaveBeenCalled()
  })

  it('does not log a block for ordinary chatter that never mentions the bot', async () => {
    mockIntegration('@collaborators')

    await handleInteractEvent(
      githubIntegrationId,
      payload({ body: 'just two humans talking' })
    )

    expect(postIssueComment).not.toHaveBeenCalled()
    expect(logEvent).not.toHaveBeenCalled()
  })
})

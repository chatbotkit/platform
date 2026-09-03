/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './execute'

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStream: (fn) => fn,
}))

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      skillset: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/skillset.apply', () => ({
  applySkillset: jest.fn(),
}))

jest.mock('@/lib/usage.model', () => ({
  Usage: {
    createAndRecord: jest.fn().mockResolvedValue({}),
  },
}))

jest.mock('@/lib/response', () => ({
  throwNotFound: jest.fn(() => {
    throw Object.assign(new Error('Not found'), { code: 'NOT_FOUND' })
  }),
  throwNotAuthorized: jest.fn(() => {
    throw Object.assign(new Error('Not authorized'), { code: 'NOT_AUTHORIZED' })
  }),
}))

jest.mock('@/lib/context.store', () => ({
  setContextContact: jest.fn(),
  setContextNamespace: jest.fn(),
}))

jest.mock('@/lib/namespace.safe', () => ({
  getSafeNamespace: jest.fn((_user, ns) => `safe-${ns}`),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/error', () => ({
  ...jest.requireActual('@/lib/error'),
  captureError: jest.fn(),
}))

describe('POST /api/v1/skillset/{skillsetId}/ability/{abilityId}/execute', () => {
  const mockSession = {
    user: {
      id: 'user-123',
    },
  }

  const mockReq = {
    query: {
      skillsetId: 'skillset-abc',
      abilityId: 'ability-xyz',
    },
  }

  const mockStream = {
    error: jest.fn().mockResolvedValue(undefined),
    result: jest.fn().mockResolvedValue(undefined),
    push: jest.fn().mockResolvedValue(undefined),
    abortSignal: undefined,
  }

  const mockAbility = {
    id: 'ability-xyz',
    name: 'weather-lookup',
    description: 'Look up weather',
    instruction: 'Look up the weather for {{ input }}',
  }

  const mockSkillset = {
    id: 'skillset-abc',
    userId: 'user-123',
    name: 'My Skillset',
    abilities: [mockAbility],
  }

  const defaultApplyResult = {
    usage: { token: 100, model: 'gpt-4-turbo' },
    error: null,
    result: { temperature: '72°F' },
    messages: [{ type: 'context', text: 'done' }],
  }

  beforeEach(() => {
    jest.clearAllMocks()

    const { applySkillset } = require('@/lib/skillset.apply')

    applySkillset.mockResolvedValue(defaultApplyResult)
  })

  describe('authorization and lookup', () => {
    it('throws not-found when skillset does not exist', async () => {
      const prisma = require('@/prisma/client').default
      const { throwNotFound } = require('@/lib/response')

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(null)

      await expect(
        handler(mockReq, mockStream, mockSession, { input: 'hello' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })

      expect(throwNotFound).toHaveBeenCalled()
    })

    it('throws not-authorized when skillset belongs to a different user', async () => {
      const prisma = require('@/prisma/client').default
      const { throwNotAuthorized } = require('@/lib/response')

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
        ...mockSkillset,
        userId: 'other-user-999',
      })

      await expect(
        handler(mockReq, mockStream, mockSession, { input: 'hello' })
      ).rejects.toMatchObject({ code: 'NOT_AUTHORIZED' })

      expect(throwNotAuthorized).toHaveBeenCalled()
    })

    it('throws not-found when ability is not in the skillset', async () => {
      const prisma = require('@/prisma/client').default
      const { throwNotFound } = require('@/lib/response')

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue({
        ...mockSkillset,
        abilities: [], // ability filtered out by the query
      })

      await expect(
        handler(mockReq, mockStream, mockSession, { input: 'hello' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })

      expect(throwNotFound).toHaveBeenCalled()
    })

    it('looks up skillset by correct identifiers from URL params', async () => {
      const prisma = require('@/prisma/client').default

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)

      await handler(mockReq, mockStream, mockSession, { input: '' })

      expect(prisma.skillset.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'skillset-abc',
        expect.objectContaining({
          include: expect.objectContaining({
            abilities: expect.objectContaining({
              where: { id: 'ability-xyz' },
            }),
          }),
        })
      )
    })
  })

  describe('successful execution', () => {
    beforeEach(() => {
      const prisma = require('@/prisma/client').default

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
    })

    it('calls applySkillset with correct userId, skillset, abilityName, and input', async () => {
      const { applySkillset } = require('@/lib/skillset.apply')

      await handler(mockReq, mockStream, mockSession, {
        input: 'San Francisco',
      })

      expect(applySkillset).toHaveBeenCalledWith(
        'user-123',
        mockSkillset,
        'weather-lookup',
        'San Francisco',
        expect.any(Object)
      )
    })

    it('streams the result from applySkillset', async () => {
      await handler(mockReq, mockStream, mockSession, { input: 'hello' })

      expect(mockStream.result).toHaveBeenCalledWith({
        usage: defaultApplyResult.usage,
        error: defaultApplyResult.error,
        result: defaultApplyResult.result,
        messages: defaultApplyResult.messages,
      })
    })

    it('records usage after successful execution', async () => {
      const { Usage } = require('@/lib/usage.model')

      await handler(mockReq, mockStream, mockSession, { input: 'hello' })

      expect(Usage.createAndRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockSession.user,
          token: defaultApplyResult.usage.token,
          model: defaultApplyResult.usage.model,
          meta: expect.objectContaining({ reason: 'ability/execute' }),
          references: expect.objectContaining({
            skillsetId: 'skillset-abc',
            abilityId: 'ability-xyz',
          }),
        })
      )
    })

    it('passes default substitution placeholders to applySkillset', async () => {
      const { applySkillset } = require('@/lib/skillset.apply')

      await handler(mockReq, mockStream, mockSession, { input: '' })

      expect(applySkillset).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          substitutions: expect.objectContaining({
            NAMESPACE: '""',
            CONTACT_ID: '""',
            CONVERSATION_ID: '""',
            BOT_ID: '""',
            EXTERNAL_ID: '""',
          }),
        })
      )
    })

    it('passes abort signal from stream to applySkillset', async () => {
      const { applySkillset } = require('@/lib/skillset.apply')
      const abortController = new AbortController()
      const streamWithSignal = {
        ...mockStream,
        abortSignal: abortController.signal,
      }

      await handler(mockReq, streamWithSignal, mockSession, { input: 'hello' })

      expect(applySkillset).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ signal: abortController.signal })
      )
    })

    it('converts sink errors to safe JSON errors for non-streaming responses', async () => {
      const { applySkillset } = require('@/lib/skillset.apply')

      applySkillset.mockImplementation(
        async (_userId, _skillset, _name, _input, options) => {
          await options.sink.push('error', new Error('Secret provider failure'))

          return defaultApplyResult
        }
      )

      await handler(mockReq, mockStream, mockSession, { input: 'hello' })

      expect(mockStream.error).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'GENERIC_ERROR',
          message: 'Something went wrong',
        })
      )
      expect(mockStream.push).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      )
    })

    it('streams sink errors as safe event envelopes for streaming responses', async () => {
      const { applySkillset } = require('@/lib/skillset.apply')
      const streamingStream = {
        ...mockStream,
        acceptFormat: 'jsonl',
      }

      applySkillset.mockImplementation(
        async (_userId, _skillset, _name, _input, options) => {
          await options.sink.push('error', new Error('Secret provider failure'))

          return defaultApplyResult
        }
      )

      await handler(mockReq, streamingStream, mockSession, { input: 'hello' })

      expect(streamingStream.push).toHaveBeenCalledWith({
        type: 'error',
        createdAt: expect.any(Number),
        data: {
          code: 'GENERIC_ERROR',
          message: 'Something went wrong',
        },
      })
      expect(streamingStream.error).not.toHaveBeenCalled()
    })

    it('handles empty input (defaults to empty string)', async () => {
      const { applySkillset } = require('@/lib/skillset.apply')

      await handler(mockReq, mockStream, mockSession, { input: '' })

      expect(applySkillset).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.any(String),
        '',
        expect.any(Object)
      )

      expect(mockStream.result).toHaveBeenCalled()
    })
  })

  describe('context injection', () => {
    beforeEach(() => {
      const prisma = require('@/prisma/client').default

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
    })

    it('sets contact context when contactId is provided', async () => {
      const { setContextContact } = require('@/lib/context.store')

      await handler(mockReq, mockStream, mockSession, {
        input: 'test',
        contactId: 'contact-456',
      })

      expect(setContextContact).toHaveBeenCalledWith('contact-456')
    })

    it('does not set contact context when contactId is absent', async () => {
      const { setContextContact } = require('@/lib/context.store')

      await handler(mockReq, mockStream, mockSession, { input: 'test' })

      expect(setContextContact).not.toHaveBeenCalled()
    })

    it('sets namespace context when namespace is provided', async () => {
      const { setContextNamespace } = require('@/lib/context.store')
      const { getSafeNamespace } = require('@/lib/namespace.safe')

      getSafeNamespace.mockReturnValue('safe-my-ns')

      await handler(mockReq, mockStream, mockSession, {
        input: 'test',
        namespace: 'my-ns',
      })

      expect(setContextNamespace).toHaveBeenCalledWith('safe-my-ns')
    })

    it('does not set namespace context when namespace is absent', async () => {
      const { setContextNamespace } = require('@/lib/context.store')

      await handler(mockReq, mockStream, mockSession, { input: 'test' })

      expect(setContextNamespace).not.toHaveBeenCalled()
    })

    it('applies getSafeNamespace to sanitize namespace before setting context', async () => {
      const { getSafeNamespace } = require('@/lib/namespace.safe')

      await handler(mockReq, mockStream, mockSession, {
        input: 'test',
        namespace: 'raw-ns',
      })

      expect(getSafeNamespace).toHaveBeenCalledWith(mockSession.user, 'raw-ns')
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      const prisma = require('@/prisma/client').default

      prisma.skillset.findUniqueByIdentifier.mockResolvedValue(mockSkillset)
    })

    it('streams error and returns when applySkillset throws', async () => {
      const { applySkillset } = require('@/lib/skillset.apply')
      const { captureError } = require('@/lib/error')
      const execError = new Error('External API unavailable')

      applySkillset.mockRejectedValue(execError)

      await handler(mockReq, mockStream, mockSession, { input: 'hello' })

      expect(mockStream.error).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'GENERIC_ERROR',
          message: 'Something went wrong',
        })
      )
      expect(captureError).toHaveBeenCalledWith(execError)
      // result must NOT be called after an error
      expect(mockStream.result).not.toHaveBeenCalled()
    })

    it('streams safe error envelopes when applySkillset throws for streaming responses', async () => {
      const { applySkillset } = require('@/lib/skillset.apply')
      const streamingStream = {
        ...mockStream,
        acceptFormat: 'jsonl',
      }

      applySkillset.mockRejectedValue(new Error('External API unavailable'))

      await handler(mockReq, streamingStream, mockSession, { input: 'hello' })

      expect(streamingStream.push).toHaveBeenCalledWith({
        type: 'error',
        createdAt: expect.any(Number),
        data: {
          code: 'GENERIC_ERROR',
          message: 'Something went wrong',
        },
      })
      expect(streamingStream.error).not.toHaveBeenCalled()
      expect(streamingStream.result).not.toHaveBeenCalled()
    })

    it('does not record usage when execution throws', async () => {
      const { applySkillset } = require('@/lib/skillset.apply')
      const { Usage } = require('@/lib/usage.model')

      applySkillset.mockRejectedValue(new Error('failure'))

      await handler(mockReq, mockStream, mockSession, { input: 'hello' })

      expect(Usage.createAndRecord).not.toHaveBeenCalled()
    })
  })
})

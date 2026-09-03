/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

let capturedHandlers = null

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlers) => {
    capturedHandlers = handlers

    return jest.fn()
  }),
}))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    space: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/space.storage', () => ({
  deleteStorageDirectory: jest.fn(),
  downloadStorageFile: jest.fn(),
  listStorage: jest.fn(),
  moveStorageFile: jest.fn(),
  storageDirectoryExists: jest.fn(),
  uploadStorageFile: jest.fn(),
}))

jest.mock('@chatbotkit-dev/buffer', () => ({
  buf2str: jest.fn((buf) => new TextDecoder().decode(buf)),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

// Import after mocks so capturedHandlers is populated
require('@/pages/api/auxiliary/skillset/ability/space/skill')

const prisma = require('@/prisma/client').default
const { downloadStorageFile } = require('@/lib/space.storage')
const { BotInputError, UserInputError } = require('@/lib/error')

describe('auxiliary/skillset/ability/space/skill readSkills', () => {
  const mockSession = { user: { id: 'user-123' } }
  const mockHeaders = new Headers()
  const space = { id: 'space-1', userId: 'user-123' }

  /** @returns {Function} the readSkills handler fn */
  function readSkills(session, parameters) {
    return capturedHandlers.readSkills.fn(session, parameters, mockHeaders)
  }

  function noSuchKeyError() {
    const error = new Error('The specified key does not exist.')

    error.name = 'NoSuchKey'

    return error
  }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.space.findUniqueByIdentifier.mockResolvedValue(space)
  })

  it('returns the file content for each requested path', async () => {
    const bodyOf = (text) => ({
      body: { arrayBuffer: async () => new TextEncoder().encode(text).buffer },
    })

    downloadStorageFile
      .mockResolvedValueOnce(bodyOf('content-a'))
      .mockResolvedValueOnce(bodyOf('content-b'))

    const result = await readSkills(mockSession, {
      spaceId: 'space-1',
      paths: ['.skills/a/SKILL.md', '.skills/b/SKILL.md'],
    })

    expect(result).toEqual({
      items: [
        { path: '.skills/a/SKILL.md', content: 'content-a' },
        { path: '.skills/b/SKILL.md', content: 'content-b' },
      ],
    })
  })

  it('returns empty content when the object has no body', async () => {
    downloadStorageFile.mockResolvedValueOnce({ Body: undefined })

    const result = await readSkills(mockSession, {
      spaceId: 'space-1',
      paths: ['.skills/a/SKILL.md'],
    })

    expect(result).toEqual({
      items: [{ path: '.skills/a/SKILL.md', content: '' }],
    })
  })

  it('converts a missing S3 object into a BotInputError naming the path', async () => {
    // @note this is the regression fix: a path the bot guessed that does
    // not exist must surface as bot input (kept out of Sentry), not an
    // unhandled S3 NoSuchKey exception.
    downloadStorageFile.mockRejectedValueOnce(noSuchKeyError())

    const promise = readSkills(mockSession, {
      spaceId: 'space-1',
      paths: ['.skills/missing/SKILL.md'],
    })

    await expect(promise).rejects.toBeInstanceOf(BotInputError)
    await expect(promise).rejects.toThrow(
      'Skill file not found: .skills/missing/SKILL.md'
    )
  })

  it('rethrows non-NoSuchKey storage errors unchanged so real bugs are still captured', async () => {
    const error = new Error('connection reset')

    downloadStorageFile.mockRejectedValueOnce(error)

    let thrown

    try {
      await readSkills(mockSession, {
        spaceId: 'space-1',
        paths: ['.skills/a/SKILL.md'],
      })
    } catch (e) {
      thrown = e
    }

    expect(thrown).toBe(error)
    expect(thrown).not.toBeInstanceOf(BotInputError)
  })

  it('fails the batch with a BotInputError when any path is missing', async () => {
    downloadStorageFile
      .mockResolvedValueOnce({ Body: 'content-a' })
      .mockRejectedValueOnce(noSuchKeyError())

    await expect(
      readSkills(mockSession, {
        spaceId: 'space-1',
        paths: ['.skills/a/SKILL.md', '.skills/missing/SKILL.md'],
      })
    ).rejects.toThrow('Skill file not found: .skills/missing/SKILL.md')
  })

  it('throws when the space is not found before touching storage', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

    await expect(
      readSkills(mockSession, {
        spaceId: 'space-missing',
        paths: ['.skills/a/SKILL.md'],
      })
    ).rejects.toBeInstanceOf(UserInputError)

    expect(downloadStorageFile).not.toHaveBeenCalled()
  })

  it('throws when the space belongs to another user', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space-1',
      userId: 'other-user',
    })

    await expect(
      readSkills(mockSession, {
        spaceId: 'space-1',
        paths: ['.skills/a/SKILL.md'],
      })
    ).rejects.toBeInstanceOf(UserInputError)

    expect(downloadStorageFile).not.toHaveBeenCalled()
  })
})

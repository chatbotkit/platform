// @note this suite used to be a thousand lines of Redis keys, session recovery
// and mount reconciliation, because the module used to do all of that. It does
// not any more - that moved into whichever sandbox implementation is installed,
// along with its tests. What is left is the platform's own half: which stores an
// agent may reach and where, what the model is told is reachable, and what a
// user sees when it fails.
//
// The provider is mocked here rather than exercised. `@chatbotkit-dev/sandbox`
// has its own suite that runs real commands; repeating that through this seam
// would test the mock.

import { exec, readFile, runCode, writeFile } from '@/lib/sandbox.shell'

const provider = {
  exec: jest.fn(),
  runCode: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}

jest.mock('@chatbotkit-dev/sandbox', () => ({
  __esModule: true,
  default: {
    exec: (...args) => provider.exec(...args),
    runCode: (...args) => provider.runCode(...args),
    readFile: (...args) => provider.readFile(...args),
    writeFile: (...args) => provider.writeFile(...args),
  },
}))

const getMounts = jest.fn()

jest.mock('@chatbotkit-dev/storage', () => ({
  getMounts: (...args) => getMounts(...args),
}))

jest.mock('@/lib/space.storage', () => ({
  getSpaceStorageMountConfig: jest.fn(() => ({
    scope: 'space',
    prefix: 'spaces/space-1/data',
  })),
}))

jest.mock('@/lib/conversation.attachment', () => ({
  getConversationStorageBucketInfo: jest.fn(() => ({
    scope: 'conversation',
    prefix: 'conversation-1',
  })),
}))

const captureException = jest.fn()

jest.mock('@/lib/error', () => ({
  captureException: (...args) => captureException(...args),
}))

/** Builds an error shaped the way the contract brands them. */
function sandboxError(code, message = 'boom', detail = 'underlying detail') {
  const error = new Error(message)

  error.sandbox = true
  error.code = code
  error.detail = detail

  return error
}

beforeEach(() => {
  jest.clearAllMocks()

  provider.exec.mockResolvedValue({
    exitCode: 0,
    stdout: 'out',
    stderr: '',
    mountedPaths: [],
  })

  provider.runCode.mockResolvedValue({
    exitCode: 0,
    stdout: 'out',
    stderr: '',
    mountedPaths: [],
  })

  provider.readFile.mockResolvedValue({ contents: 'contents', mountedPaths: [] })
  provider.writeFile.mockResolvedValue({ mountedPaths: [] })

  getMounts.mockResolvedValue({
    endpoint: 'https://storage.example.com',
    credentials: { accessKeyId: 'k', secretAccessKey: 's' },
    mounts: [
      { scope: 'space', container: 'bucket', prefix: 'spaces/space-1/data' },
    ],
  })
})

describe('mount plan', () => {
  it('asks for nothing when there is no space or conversation', async () => {
    await exec({ sandboxId: 'sandbox-1', cmd: 'ls' })

    expect(provider.exec.mock.calls[0][0].mounts).toBeUndefined()
  })

  it('places a space at /space and a conversation at /conversation', async () => {
    await exec({
      sandboxId: 'sandbox-1',
      cmd: 'ls',
      spaceId: 'space-1',
      conversationId: 'conversation-1',
    })

    expect(provider.exec.mock.calls[0][0].mounts.requests).toEqual([
      { path: '/space', scope: 'space', prefix: 'spaces/space-1/data' },
      {
        path: '/conversation',
        scope: 'conversation',
        prefix: 'conversation-1',
      },
    ])
  })

  // @note the property the whole mount design exists for. Credentials are
  // scoped and short lived, and most calls run against a sandbox that already
  // has its storage attached, so building the plan must not mint any. Only the
  // implementation knows whether it needs them.

  it('does not issue credentials while building the plan', async () => {
    await exec({ sandboxId: 'sandbox-1', cmd: 'ls', spaceId: 'space-1' })

    expect(getMounts).not.toHaveBeenCalled()
  })

  it('issues credentials for exactly the requested stores when resolved', async () => {
    await exec({
      sandboxId: 'sandbox-1',
      cmd: 'ls',
      spaceId: 'space-1',
      conversationId: 'conversation-1',
    })

    await provider.exec.mock.calls[0][0].mounts.resolve()

    expect(getMounts).toHaveBeenCalledWith([
      { scope: 'space', prefix: 'spaces/space-1/data' },
      { scope: 'conversation', prefix: 'conversation-1' },
    ])
  })
})

describe('what the model is told is mounted', () => {
  // @note derived from what came back, not from what was asked for. The version
  // this replaced announced /space whenever a spaceId was in scope, so a
  // storage backend that could not issue credentials produced an agent writing
  // confidently into a folder that did not exist.

  it('reports a mount the implementation actually attached', async () => {
    provider.exec.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      mountedPaths: ['/space'],
    })

    const result = await exec({
      sandboxId: 'sandbox-1',
      cmd: 'ls',
      spaceId: 'space-1',
    })

    expect(result.mounts).toEqual([{ folder: '/space', spaceId: 'space-1' }])
  })

  it('reports nothing when the implementation mounted nothing', async () => {
    const result = await exec({
      sandboxId: 'sandbox-1',
      cmd: 'ls',
      spaceId: 'space-1',
      conversationId: 'conversation-1',
    })

    expect(result.mounts).toEqual([])
  })

  it('reports only the mount that succeeded', async () => {
    provider.exec.mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
      mountedPaths: ['/conversation'],
    })

    const result = await exec({
      sandboxId: 'sandbox-1',
      cmd: 'ls',
      spaceId: 'space-1',
      conversationId: 'conversation-1',
    })

    expect(result.mounts).toEqual([
      { folder: '/conversation', conversationId: 'conversation-1' },
    ])
  })
})

describe('exec', () => {
  it('passes the command through and reports success on a zero exit', async () => {
    provider.exec.mockResolvedValue({
      exitCode: 0,
      stdout: 'hello',
      stderr: '',
      mountedPaths: [],
    })

    const result = await exec({ sandboxId: 'sandbox-1', cmd: 'echo hello' })

    expect(provider.exec.mock.calls[0][0].cmd).toBe('echo hello')
    expect(result).toMatchObject({
      success: true,
      exitCode: 0,
      stdout: 'hello',
    })
  })

  it('reports a non-zero exit as a failed but complete result', async () => {
    provider.exec.mockResolvedValue({
      exitCode: 2,
      stdout: '',
      stderr: 'no such file',
      mountedPaths: [],
    })

    const result = await exec({ sandboxId: 'sandbox-1', cmd: 'cat missing' })

    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toBe('no such file')

    // @note a command that ran and failed is not an incident.

    expect(captureException).not.toHaveBeenCalled()
  })

  it('forwards resources only when limits were given', async () => {
    await exec({ sandboxId: 'sandbox-1', cmd: 'ls' })

    expect(provider.exec.mock.calls[0][0].resources).toBeUndefined()

    await exec({ sandboxId: 'sandbox-1', cmd: 'ls', memoryMb: 512 })

    expect(provider.exec.mock.calls[1][0].resources).toEqual({
      memoryMb: 512,
      diskMb: undefined,
    })
  })
})

describe('runCode', () => {
  it('folds stderr into the output so the model sees the traceback', async () => {
    provider.runCode.mockResolvedValue({
      exitCode: 1,
      stdout: 'partial',
      stderr: 'ValueError: nope',
      mountedPaths: [],
    })

    const result = await runCode({ sandboxId: 'sandbox-1', code: 'x' })

    expect(result.success).toBe(false)
    expect(result.output).toBe('partial\nValueError: nope')
    expect(result.error).toBe('ValueError: nope')
  })

  it('defaults to python', async () => {
    await runCode({ sandboxId: 'sandbox-1', code: 'print(1)' })

    expect(provider.runCode.mock.calls[0][0].language).toBe('python')
  })
})

describe('files', () => {
  it('reads', async () => {
    provider.readFile.mockResolvedValue({
      contents: 'file body',
      mountedPaths: [],
    })

    const result = await readFile({ sandboxId: 'sandbox-1', path: '/a.txt' })

    expect(result).toMatchObject({ success: true, contents: 'file body' })
  })

  it('writes', async () => {
    const result = await writeFile({
      sandboxId: 'sandbox-1',
      path: '/a.txt',
      contents: 'body',
      mode: '644',
    })

    expect(result.success).toBe(true)
    expect(provider.writeFile.mock.calls[0][0]).toMatchObject({
      path: '/a.txt',
      contents: 'body',
      mode: '644',
    })
  })
})

describe('failures', () => {
  it('hands the model a failed result rather than throwing', async () => {
    provider.exec.mockRejectedValue(sandboxError('EXEC_TIMEOUT'))

    const result = await exec({ sandboxId: 'sandbox-1', cmd: 'sleep 999' })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/timed out/i)
    expect(result.errorDetail).toBe('underlying detail')
  })

  it.each([
    ['SANDBOX_NOT_FOUND', /expired/i],
    ['SESSION_NOT_FOUND', /expired/i],
    ['SANDBOX_UNAVAILABLE', /temporarily unavailable/i],
    ['FILE_NOT_FOUND', /file not found/i],
    ['MOUNT_FAILED', /storage mount/i],
    ['UNSUPPORTED_OPERATION', /does not support/i],
  ])('turns %s into a message a user can act on', async (code, expected) => {
    provider.exec.mockRejectedValue(sandboxError(code))

    const result = await exec({ sandboxId: 'sandbox-1', cmd: 'ls' })

    expect(result.error).toMatch(expected)
  })

  // @note agents read paths that do not exist and sandboxes get reaped for
  // idleness. Paging on either buries the failures that mean something.

  it.each([
    'SANDBOX_NOT_FOUND',
    'SANDBOX_UNAVAILABLE',
    'SESSION_NOT_FOUND',
    'EXEC_FAILED',
    'EXEC_TIMEOUT',
    'FILE_NOT_FOUND',
    'FILE_READ_FAILED',
    'FILE_WRITE_FAILED',
    'UNSUPPORTED_OPERATION',
  ])('does not report %s', async (code) => {
    provider.exec.mockRejectedValue(sandboxError(code))

    await exec({ sandboxId: 'sandbox-1', cmd: 'ls' })

    expect(captureException).not.toHaveBeenCalled()
  })

  it.each(['MOUNT_FAILED', 'VALIDATION_FAILED', 'UNKNOWN'])(
    'reports %s',
    async (code) => {
      provider.exec.mockRejectedValue(sandboxError(code))

      await exec({ sandboxId: 'sandbox-1', cmd: 'ls' })

      expect(captureException).toHaveBeenCalled()
    }
  )

  // @note anything without the contract's brand did not come from the sandbox -
  // storage refusing to issue credentials, most likely. Nothing here can say
  // what it was, so it gets reported.

  it('reports an unbranded error and stays generic with the user', async () => {
    provider.exec.mockRejectedValue(new Error('sts: access denied'))

    const result = await exec({ sandboxId: 'sandbox-1', cmd: 'ls' })

    expect(captureException).toHaveBeenCalled()
    expect(result.error).toBe('Sandbox operation failed. Please try again.')
    expect(result.errorDetail).toBe('sts: access denied')
  })

  it('reports no mounts on a failure', async () => {
    provider.exec.mockRejectedValue(sandboxError('SANDBOX_UNAVAILABLE'))

    const result = await exec({
      sandboxId: 'sandbox-1',
      cmd: 'ls',
      spaceId: 'space-1',
    })

    expect(result.mounts).toEqual([])
  })

  it('fails runCode the same way, with no output', async () => {
    provider.runCode.mockRejectedValue(sandboxError('EXEC_TIMEOUT'))

    const result = await runCode({ sandboxId: 'sandbox-1', code: 'x' })

    expect(result).toMatchObject({ success: false, output: '', mounts: [] })
    expect(result.error).toMatch(/timed out/i)
  })

  it('fails the read and the write the same way', async () => {
    provider.readFile.mockRejectedValue(sandboxError('FILE_NOT_FOUND'))
    provider.writeFile.mockRejectedValue(sandboxError('FILE_WRITE_FAILED'))

    await expect(
      readFile({ sandboxId: 'sandbox-1', path: '/a.txt' })
    ).resolves.toMatchObject({ success: false, contents: '' })

    await expect(
      writeFile({ sandboxId: 'sandbox-1', path: '/a.txt', contents: 'x' })
    ).resolves.toMatchObject({ success: false })
  })
})

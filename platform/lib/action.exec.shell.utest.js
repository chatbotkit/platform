import {
  doShellExec,
  doShellSkillsetInstall,
  doShellScript,
  doShellEval,
  doShellImport,
  doShellRead,
  doShellReplace,
  doShellWrite,
  executeShellAction,
} from '@/lib/action.exec.shell'

import prisma from '@/prisma/client'

import { fastGetUserById } from '@/lib/user.get'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    skillset: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/sandbox.shell', () => ({
  exec: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  runCode: jest.fn(),
}))

// @note the catalogue is read from LIMITS_CONFIG, which the test environment
// does not carry; the assertions below expect the 512/1024 shell allocation
// regardless of which plan the test user resolves to.
jest.mock('@/config/limits', () => ({
  __esModule: true,

  hasPlans: true,

  PLAN_KEYS: [],

  overrides: {},

  default: new Proxy(
    {},
    {
      get(_target, prop) {
        return typeof prop === 'string'
          ? { shell: { memory: 512, disk: 1_024 } }
          : undefined
      },
    }
  ),
}))

jest.mock('@/lib/context.store', () => ({
  getContextNamespace: jest.fn(),
  getContextConversation: jest.fn(),
}))

jest.mock('@/lib/usage.model', () => ({
  Usage: {
    createAndRecord: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/lib/call', () => jest.fn())

jest.mock('@/lib/fetch', () => ({
  withLimit: jest.fn((fn) => fn),
  withRetry: jest.fn((fn) => fn),
  withTimeout: jest.fn((fn) => fn),
  withBodyTimeout: jest.fn((fn) => fn),
}))

describe('action.exec.shell', () => {
  beforeEach(async () => {
    jest.clearAllMocks()

    const { exec, readFile, writeFile, runCode } = await import(
      '@/lib/sandbox.shell'
    )
    const { getContextNamespace, getContextConversation } = await import(
      '@/lib/context.store'
    )
    const { Usage } = await import('@/lib/usage.model')

    getContextNamespace.mockReturnValue('test-namespace')
    getContextConversation.mockReturnValue(null)
    Usage.createAndRecord.mockResolvedValue(undefined)

    exec.mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'command output',
      stderr: '',
      mounts: [],
    })

    readFile.mockResolvedValue({
      success: true,
      contents: 'file contents',
      mounts: [],
    })

    writeFile.mockResolvedValue({
      success: true,
      mounts: [],
    })

    runCode.mockResolvedValue({
      success: true,
      output: 'code output',
      mounts: [],
    })
  })

  describe('doShellSkillsetInstall', () => {
    it('should resolve the full user before shared skillset lookup', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        parentId: 'parent-456',
      }

      fastGetUserById.mockResolvedValue(mockUser)
      prisma.skillset.findUniqueByIdentifier.mockRejectedValue(
        new Error('lookup failed')
      )

      await expect(
        doShellSkillsetInstall({
          session: 'test-namespace',
          input: '@shared@global-github-tools',
          params: {},
          options: { userId: 'user-123', linkedResources: {} },
        })
      ).rejects.toThrow('lookup failed')

      expect(fastGetUserById).toHaveBeenCalledWith('user-123')
      expect(prisma.skillset.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockUser,
        '@shared@global-github-tools',
        expect.objectContaining({
          select: expect.any(Object),
        })
      )
    })
  })

  describe('doShellExec', () => {
    it('should execute shell command with basic parameters', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      const result = await doShellExec({
        session: 'test-namespace',
        input: 'echo hello world',
        params: { cmd: 'echo hello world' },
        options: { userId: 'user-123' },
      })

      expect(exec).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: undefined,
        conversationId: undefined,
        cmd: 'echo hello world',
        files: [],
      })

      // @note result is now YAML formatted

      expect(result.result).toContain('success: true')
      expect(result.result).toContain('exitCode: 0')
      expect(result.result).toContain('stdout: command output')
      expect(result.messages).toEqual([])
    })

    it('should handle command execution with files', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      // @note schema validation requires non-empty path and contents

      const files = [
        { path: 'script.py', contents: 'print("hello")' },
        { path: 'valid.txt', contents: 'valid content' },
      ]

      await doShellExec({
        session: 'test-namespace',
        input: 'python script.py',
        params: { cmd: 'python script.py', files },
        options: { userId: 'user-123' },
      })

      expect(exec).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: undefined,
        conversationId: undefined,
        cmd: 'python script.py',
        files: [
          { path: 'script.py', contents: 'print("hello")' },
          { path: 'valid.txt', contents: 'valid content' },
        ],
      })
    })

    it('should throw error when cmd is missing', async () => {
      await expect(
        doShellExec({
          session: 'test-namespace',
          input: '',
          params: {},
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow()
    })

    it('should record token usage', async () => {
      const { Usage } = await import('@/lib/usage.model')

      await doShellExec({
        session: 'test-namespace',
        input: 'echo test',
        params: { cmd: 'echo test' },
        options: { userId: 'user-456' },
      })

      expect(Usage.createAndRecord).toHaveBeenCalledWith({
        user: { id: 'user-456' },
        token: 1,
        model: 'base',
        meta: {
          reason: 'shell/exec',
        },
        references: {},
      })
    })

    it('should handle empty output gracefully', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      exec.mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
        mounts: [],
      })

      const result = await doShellExec({
        session: 'test-namespace',
        input: 'echo test',
        params: { cmd: 'echo test' },
        options: { userId: 'user-123' },
      })

      expect(result.result).toContain('success: true')
      expect(result.result).toContain('exitCode: 0')
    })

    it('should include explicit sandbox errors without exposing errorDetail', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      exec.mockResolvedValue({
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: '',
        error: 'command timed out after 1m30s',
        errorDetail:
          'timed out waiting 1m35s for sandbox response (request timeout 1m30s, grace 5s)',
        mounts: [],
      })

      const result = await doShellExec({
        session: 'test-namespace',
        input: 'npm install',
        params: { cmd: 'npm install' },
        options: { userId: 'user-123' },
      })

      expect(result.result).toContain('success: false')
      expect(result.result).toContain('exitCode: -1')
      expect(result.result).toContain('error: command timed out after 1m30s')
      expect(result.result).not.toContain('errorDetail:')
    })

    it('should not expose errorDetail for script execution results', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      exec.mockResolvedValue({
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: '',
        error: 'command timed out after 1m30s',
        errorDetail:
          'timed out waiting 1m35s for sandbox response (request timeout 1m30s, grace 5s)',
        mounts: [],
      })

      const result = await doShellScript({
        session: 'test-namespace',
        input: 'console.log("ok")',
        params: {
          source: 'console.log("ok")',
          runtime: 'node',
        },
        options: { userId: 'user-123' },
      })

      expect(result.result).toContain('error: command timed out after 1m30s')
      expect(result.result).not.toContain('errorDetail:')
    })

    it('should not expose errorDetail for eval execution results', async () => {
      const { runCode } = await import('@/lib/sandbox.shell')

      runCode.mockResolvedValue({
        success: false,
        output: '',
        error: 'sandbox operation timed out',
        errorDetail:
          'timed out waiting 1m35s for sandbox response (request timeout 1m30s, grace 5s)',
        mounts: [],
      })

      const result = await doShellEval({
        session: 'test-namespace',
        input: 'print("ok")',
        params: { code: 'print("ok")', runtime: 'python' },
        options: { userId: 'user-123' },
      })

      expect(result.result).toContain('error: sandbox operation timed out')
      expect(result.result).not.toContain('errorDetail:')
    })

    it('should pass space and conversation context', async () => {
      const { getContextConversation } = await import('@/lib/context.store')
      const { exec } = await import('@/lib/sandbox.shell')

      getContextConversation.mockReturnValue({
        id: 'conv-123',
        spaceId: 'space-456',
      })

      await doShellExec({
        session: 'test-namespace',
        input: 'ls',
        params: { cmd: 'ls' },
        options: { userId: 'user-123' },
      })

      expect(exec).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: 'space-456',
        conversationId: 'conv-123',
        cmd: 'ls',
        files: [],
        sessionId: undefined,
      })
    })

    it('should use custom sessionId when provided', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      await doShellExec({
        session: 'test-namespace',
        input: 'echo hello',
        params: { cmd: 'echo hello', sessionId: 'custom-session-123' },
        options: { userId: 'user-123' },
      })

      expect(exec).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: undefined,
        conversationId: undefined,
        cmd: 'echo hello',
        files: [],
        sessionId: 'custom-session-123',
      })
    })

    it('should use linkedResources.spaceId when provided', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      await doShellExec({
        session: 'test-namespace',
        input: 'ls',
        params: { cmd: 'ls' },
        options: {
          userId: 'user-123',
          linkedResources: { spaceId: 'linked-space-123' },
        },
      })

      expect(exec).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: 'linked-space-123',
        conversationId: undefined,
        cmd: 'ls',
        files: [],
        sessionId: undefined,
      })
    })

    it('should prefer explicit spaceId param over linkedResources', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      await doShellExec({
        session: 'test-namespace',
        input: 'ls',
        params: { cmd: 'ls', spaceId: 'explicit-space-456' },
        options: {
          userId: 'user-123',
          linkedResources: { spaceId: 'linked-space-123' },
        },
      })

      expect(exec).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: 'explicit-space-456',
        conversationId: undefined,
        cmd: 'ls',
        files: [],
        sessionId: undefined,
      })
    })

    it('should prefer linkedResources.spaceId over contextConversation.spaceId', async () => {
      const { getContextConversation } = await import('@/lib/context.store')
      const { exec } = await import('@/lib/sandbox.shell')

      getContextConversation.mockReturnValue({
        id: 'conv-123',
        spaceId: 'context-space-789',
      })

      await doShellExec({
        session: 'test-namespace',
        input: 'ls',
        params: { cmd: 'ls' },
        options: {
          userId: 'user-123',
          linkedResources: { spaceId: 'linked-space-123' },
        },
      })

      expect(exec).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: 'linked-space-123',
        conversationId: 'conv-123',
        cmd: 'ls',
        files: [],
        sessionId: undefined,
      })
    })

    it('should pass timeout through for exec when no buckets are mounted', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      await doShellExec({
        session: 'test-namespace',
        input: 'echo timeout',
        params: { cmd: 'echo timeout', timeout: 120000 },
        options: { userId: 'user-123' },
      })

      expect(exec).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: undefined,
        conversationId: undefined,
        cmd: 'echo timeout',
        files: [],
        timeout: 120000,
        sessionId: undefined,
      })
    })

    it('should enforce minimum timeout for exec when conversation storage is mounted', async () => {
      const { exec } = await import('@/lib/sandbox.shell')
      const { getContextConversation } = await import('@/lib/context.store')

      getContextConversation.mockReturnValue({
        id: 'conv-123',
        spaceId: undefined,
      })

      await doShellExec({
        session: 'test-namespace',
        input: 'echo timeout',
        params: { cmd: 'echo timeout', timeout: 1000 },
        options: { userId: 'user-123' },
      })

      expect(exec).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: undefined,
        conversationId: 'conv-123',
        cmd: 'echo timeout',
        files: [],
        timeout: 90000,
        sessionId: undefined,
      })
    })
  })

  describe('doShellScript', () => {
    it('should write script to /tmp and execute with python runtime in session', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      await doShellScript({
        session: 'test-namespace',
        input: 'print("hello")',
        params: {
          source: 'print("hello")',
          runtime: 'python',
          sessionId: 'python-session-123',
        },
        options: { userId: 'user-123' },
      })

      const call = exec.mock.calls[0][0]

      expect(call.sessionId).toBe('python-session-123')
      expect(call.files).toHaveLength(1)
      expect(call.files[0].path).toMatch(/^\/tmp\/cbk-script-python-.*\.py$/)
      expect(call.files[0].contents).toBe('print("hello")')
      expect(call.cmd).toBe(`python ${call.files[0].path}`)
    })

    it('should write script to /tmp and execute with node runtime', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      await doShellScript({
        session: 'test-namespace',
        input: 'console.log("ok")',
        params: {
          source: 'console.log("ok")',
          runtime: 'node',
        },
        options: { userId: 'user-123' },
      })

      const call = exec.mock.calls[0][0]

      expect(call.sessionId).toBe('script-node')
      expect(call.files).toHaveLength(1)
      expect(call.files[0].path).toMatch(/^\/tmp\/cbk-script-node-.*\.js$/)
      expect(call.files[0].contents).toBe('console.log("ok")')
      expect(call.cmd).toBe(`node ${call.files[0].path}`)
    })

    it('should unwrap fenced markdown source before writing script file', async () => {
      const { exec } = await import('@/lib/sandbox.shell')

      await doShellScript({
        session: 'test-namespace',
        input: '```python\nprint("hello")\n```',
        params: {
          source: '```python\nprint("hello")\n```',
          runtime: 'python',
        },
        options: { userId: 'user-123' },
      })

      const call = exec.mock.calls[0][0]

      expect(call.files[0].contents).toBe('print("hello")')
    })
  })

  describe('doShellEval', () => {
    it('should execute eval via runCode with timeout passthrough when no buckets are mounted', async () => {
      const { runCode } = await import('@/lib/sandbox.shell')

      const result = await doShellEval({
        session: 'test-namespace',
        input: 'print("hello")',
        params: {
          code: 'print("hello")',
          runtime: 'python',
          timeout: 30000,
        },
        options: { userId: 'user-123' },
      })

      expect(runCode).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        sessionId: undefined,
        spaceId: undefined,
        conversationId: undefined,
        code: 'print("hello")',
        language: 'python',
        timeout: 30000,
      })

      expect(result.result).toContain('success: true')
      expect(result.result).toContain('output: code output')
    })

    it('should enforce minimum timeout for eval when space storage is mounted', async () => {
      const { runCode } = await import('@/lib/sandbox.shell')

      await doShellEval({
        session: 'test-namespace',
        input: 'console.log("x")',
        params: {
          code: 'console.log("x")',
          runtime: 'node',
          timeout: 1000,
          spaceId: 'space-123',
        },
        options: { userId: 'user-123' },
      })

      expect(runCode).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        sessionId: undefined,
        spaceId: 'space-123',
        conversationId: undefined,
        code: 'console.log("x")',
        language: 'javascript',
        timeout: 90000,
      })
    })

    it('should unwrap fenced markdown code before eval execution', async () => {
      const { runCode } = await import('@/lib/sandbox.shell')

      await doShellEval({
        session: 'test-namespace',
        input: '```python\nprint("hello")\n```',
        params: {
          code: '```python\nprint("hello")\n```',
          runtime: 'python',
        },
        options: { userId: 'user-123' },
      })

      expect(runCode).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        sessionId: undefined,
        spaceId: undefined,
        conversationId: undefined,
        code: 'print("hello")',
        language: 'python',
        timeout: undefined,
      })
    })
  })

  describe('doShellRead', () => {
    it('should read file content', async () => {
      const { readFile } = await import('@/lib/sandbox.shell')

      const result = await doShellRead({
        session: 'test-namespace',
        input: '/path/to/file.txt',
        params: { file: '/path/to/file.txt' },
        options: { userId: 'user-123' },
      })

      expect(readFile).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: undefined,
        conversationId: undefined,
        path: '/path/to/file.txt',
        sessionId: undefined,
      })

      expect(result.result).toContain('success: true')
      expect(result.result).toContain('file contents')
    })

    it('should use custom sessionId when provided', async () => {
      const { readFile } = await import('@/lib/sandbox.shell')

      await doShellRead({
        session: 'test-namespace',
        input: 'data.txt',
        params: { file: 'data.txt', sessionId: 'custom-session-read' },
        options: { userId: 'user-123' },
      })

      expect(readFile).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: undefined,
        conversationId: undefined,
        path: 'data.txt',
        sessionId: 'custom-session-read',
      })
    })

    it('should throw error when file parameter is missing', async () => {
      await expect(
        doShellRead({
          session: 'test-namespace',
          input: '',
          params: {},
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow()
    })

    it('should record token usage for read operation', async () => {
      const { Usage } = await import('@/lib/usage.model')

      await doShellRead({
        session: 'test-namespace',
        input: 'test.txt',
        params: { file: 'test.txt' },
        options: { userId: 'user-789' },
      })

      expect(Usage.createAndRecord).toHaveBeenCalledWith({
        user: { id: 'user-789' },
        token: 1,
        model: 'base',
        meta: {
          reason: 'shell/read',
        },
        references: {},
      })
    })

    it('should use linkedResources.spaceId when provided', async () => {
      const { readFile } = await import('@/lib/sandbox.shell')

      await doShellRead({
        session: 'test-namespace',
        input: 'data.txt',
        params: { file: 'data.txt' },
        options: {
          userId: 'user-123',
          linkedResources: { spaceId: 'linked-space-read' },
        },
      })

      expect(readFile).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: 'linked-space-read',
        conversationId: undefined,
        path: 'data.txt',
        sessionId: undefined,
      })
    })

    it('should prefer explicit spaceId param over linkedResources', async () => {
      const { readFile } = await import('@/lib/sandbox.shell')

      await doShellRead({
        session: 'test-namespace',
        input: 'data.txt',
        params: { file: 'data.txt', spaceId: 'explicit-space-read' },
        options: {
          userId: 'user-123',
          linkedResources: { spaceId: 'linked-space-read' },
        },
      })

      expect(readFile).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: 'explicit-space-read',
        conversationId: undefined,
        path: 'data.txt',
        sessionId: undefined,
      })
    })

    describe('line range extraction', () => {
      // @note create content with 200 lines to satisfy .min(100) validation on endLine
      const multiLineContent = Array.from(
        { length: 200 },
        (_, i) => `line${i + 1}`
      ).join('\n')

      beforeEach(async () => {
        const { readFile } = await import('@/lib/sandbox.shell')

        readFile.mockResolvedValue({
          success: true,
          contents: multiLineContent,
        })
      })

      it('should return full content when no range specified', async () => {
        const result = await doShellRead({
          session: 'test-namespace',
          input: 'data.txt',
          params: { file: 'data.txt' },
          options: { userId: 'user-123' },
        })

        expect(result.result).toContain('line1')
        expect(result.result).toContain('line200')
        expect(result.result).toContain('totalLines: 200')
      })

      it('should return lines starting from startLine (1-indexed)', async () => {
        const result = await doShellRead({
          session: 'test-namespace',
          input: 'data.txt',
          params: { file: 'data.txt', startLine: 50 },
          options: { userId: 'user-123' },
        })

        // @note should NOT contain line1-49, but should contain line50-200
        expect(result.result).not.toContain('line1\n')
        expect(result.result).not.toContain('line49\n')
        expect(result.result).toContain('line50')
        expect(result.result).toContain('line200')
        expect(result.result).toContain('totalLines: 200')
        expect(result.result).toContain('startLine: 50')
      })

      it('should return lines up to endLine (inclusive, 1-indexed)', async () => {
        const result = await doShellRead({
          session: 'test-namespace',
          input: 'data.txt',
          params: { file: 'data.txt', endLine: 100 },
          options: { userId: 'user-123' },
        })

        expect(result.result).toContain('line1')
        expect(result.result).toContain('line100')
        // @note line101 and later should not be in the output
        expect(result.result).not.toContain('line101')
        expect(result.result).not.toContain('line200')
        expect(result.result).toContain('totalLines: 200')
        expect(result.result).toContain('endLine: 100')
      })

      it('should return lines in range (both startLine and endLine)', async () => {
        const result = await doShellRead({
          session: 'test-namespace',
          input: 'data.txt',
          params: { file: 'data.txt', startLine: 50, endLine: 150 },
          options: { userId: 'user-123' },
        })

        // @note should contain line50-150 only
        expect(result.result).toContain('line50')
        expect(result.result).toContain('line100')
        expect(result.result).toContain('line150')
        // @note should NOT contain line1-49 or line151-200
        expect(result.result).not.toContain('line1\n')
        expect(result.result).not.toContain('line49\n')
        expect(result.result).not.toContain('line151')
        expect(result.result).toContain('totalLines: 200')
        expect(result.result).toContain('startLine: 50')
        expect(result.result).toContain('endLine: 150')
      })

      it('should handle single line extraction', async () => {
        const result = await doShellRead({
          session: 'test-namespace',
          input: 'data.txt',
          params: { file: 'data.txt', startLine: 100, endLine: 100 },
          options: { userId: 'user-123' },
        })

        expect(result.result).toContain('line100')
        expect(result.result).not.toContain('line99\n')
        expect(result.result).not.toContain('line101')
        expect(result.result).toContain('totalLines: 200')
      })

      it('should handle startLine at first line (1-indexed)', async () => {
        const result = await doShellRead({
          session: 'test-namespace',
          input: 'data.txt',
          params: { file: 'data.txt', startLine: 1, endLine: 100 },
          options: { userId: 'user-123' },
        })

        expect(result.result).toContain('line1')
        expect(result.result).toContain('line100')
        expect(result.result).not.toContain('line101')
        expect(result.result).toContain('totalLines: 200')
      })

      it('should handle startLine beyond content by returning empty', async () => {
        const result = await doShellRead({
          session: 'test-namespace',
          input: 'data.txt',
          params: { file: 'data.txt', startLine: 300 },
          options: { userId: 'user-123' },
        })

        // @note contents should be empty but totalLines should still be reported
        expect(result.result).toContain('totalLines: 200')
        expect(result.result).toContain('startLine: 300')
      })

      it('should handle endLine beyond content by clamping', async () => {
        const result = await doShellRead({
          session: 'test-namespace',
          input: 'data.txt',
          params: { file: 'data.txt', startLine: 190, endLine: 500 },
          options: { userId: 'user-123' },
        })

        expect(result.result).toContain('line190')
        expect(result.result).toContain('line200')
        expect(result.result).toContain('totalLines: 200')
        expect(result.result).toContain('startLine: 190')
        expect(result.result).toContain('endLine: 500')
      })

      it('should handle string startLine and endLine params (coercion)', async () => {
        const result = await doShellRead({
          session: 'test-namespace',
          input: 'data.txt',
          params: { file: 'data.txt', startLine: '50', endLine: '150' },
          options: { userId: 'user-123' },
        })

        expect(result.result).toContain('line50')
        expect(result.result).toContain('line150')
        expect(result.result).toContain('totalLines: 200')
      })
    })
  })

  describe('doShellWrite', () => {
    it('should write content to file', async () => {
      const { writeFile } = await import('@/lib/sandbox.shell')

      const result = await doShellWrite({
        session: 'test-namespace',
        input: '',
        params: { file: 'output.txt', contents: 'Hello, World!' },
        options: { userId: 'user-123' },
      })

      expect(writeFile).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: undefined,
        conversationId: undefined,
        path: 'output.txt',
        contents: 'Hello, World!',
        sessionId: undefined,
      })

      expect(result.result).toContain('success: true')
    })

    it('should use custom sessionId when provided', async () => {
      const { writeFile } = await import('@/lib/sandbox.shell')

      await doShellWrite({
        session: 'test-namespace',
        input: '',
        params: {
          file: 'output.txt',
          contents: 'Test data',
          sessionId: 'custom-session-write',
        },
        options: { userId: 'user-123' },
      })

      expect(writeFile).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: undefined,
        conversationId: undefined,
        path: 'output.txt',
        contents: 'Test data',
        sessionId: 'custom-session-write',
      })
    })

    it('should throw error when file parameter is missing', async () => {
      await expect(
        doShellWrite({
          session: 'test-namespace',
          input: '',
          params: { contents: 'some content' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow()
    })

    it('should throw error when contents parameter is missing', async () => {
      await expect(
        doShellWrite({
          session: 'test-namespace',
          input: '',
          params: { file: 'output.txt' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow()
    })

    it('should warn when a line range falls outside the file', async () => {
      const { readFile, writeFile } = await import('@/lib/sandbox.shell')

      // @note 3-line file, but the agent asks to replace lines 50-60
      readFile.mockResolvedValue({
        success: true,
        contents: 'a\nb\nc',
        mounts: [],
      })
      writeFile.mockResolvedValue({ success: true, mounts: [] })

      const result = await doShellWrite({
        session: 'test-namespace',
        input: '',
        params: {
          file: 'small.txt',
          contents: 'X',
          startLine: 50,
          endLine: 60,
        },
        options: { userId: 'user-123' },
      })

      expect(result.result).toContain('warning:')
      expect(result.result).toContain('past the end of the file')
      // @note the agent can see where it actually landed vs what it asked for
      expect(result.result).toContain('startLine: 50')
      expect(result.result).toContain('affectedStartLine: 4')
    })

    it('should record token usage for write operation', async () => {
      const { Usage } = await import('@/lib/usage.model')

      await doShellWrite({
        session: 'test-namespace',
        input: '',
        params: { file: 'test.txt', contents: 'test content' },
        options: { userId: 'user-abc' },
      })

      expect(Usage.createAndRecord).toHaveBeenCalledWith({
        user: { id: 'user-abc' },
        token: 1,
        model: 'base',
        meta: {
          reason: 'shell/write',
        },
        references: {},
      })
    })

    it('should use linkedResources.spaceId when provided', async () => {
      const { writeFile } = await import('@/lib/sandbox.shell')

      await doShellWrite({
        session: 'test-namespace',
        input: '',
        params: { file: 'output.txt', contents: 'test data' },
        options: {
          userId: 'user-123',
          linkedResources: { spaceId: 'linked-space-write' },
        },
      })

      expect(writeFile).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: 'linked-space-write',
        conversationId: undefined,
        path: 'output.txt',
        contents: 'test data',
        sessionId: undefined,
      })
    })

    it('should prefer explicit spaceId param over linkedResources', async () => {
      const { writeFile } = await import('@/lib/sandbox.shell')

      await doShellWrite({
        session: 'test-namespace',
        input: '',
        params: {
          file: 'output.txt',
          contents: 'test data',
          spaceId: 'explicit-space-write',
        },
        options: {
          userId: 'user-123',
          linkedResources: { spaceId: 'linked-space-write' },
        },
      })

      expect(writeFile).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: 'explicit-space-write',
        conversationId: undefined,
        path: 'output.txt',
        contents: 'test data',
        sessionId: undefined,
      })
    })
  })

  describe('doShellReplace', () => {
    it('should replace all occurrences and write the result back', async () => {
      const { readFile, writeFile } = await import('@/lib/sandbox.shell')

      readFile.mockResolvedValue({
        success: true,
        contents: 'foo\nbar\nfoo',
        mounts: [],
      })

      const result = await doShellReplace({
        session: 'test-namespace',
        input: '',
        params: { file: 'a.txt', search: 'foo', replace: 'baz' },
        options: { userId: 'user-123' },
      })

      expect(writeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'a.txt',
          contents: 'baz\nbar\nbaz',
        })
      )

      expect(result.result).toContain('success: true')
      expect(result.result).toContain('replacements: 2')
      expect(result.result).toContain('preview:')
    })

    it('should respect the count parameter', async () => {
      const { writeFile } = await import('@/lib/sandbox.shell')
      const { readFile } = await import('@/lib/sandbox.shell')

      readFile.mockResolvedValue({
        success: true,
        contents: 'foo foo foo',
        mounts: [],
      })

      const result = await doShellReplace({
        session: 'test-namespace',
        input: '',
        params: { file: 'a.txt', search: 'foo', replace: 'x', count: 2 },
        options: { userId: 'user-123' },
      })

      expect(writeFile).toHaveBeenCalledWith(
        expect.objectContaining({ contents: 'x x foo' })
      )
      expect(result.result).toContain('replacements: 2')
    })

    it('should report changed false and warn when search is not found', async () => {
      const { readFile, writeFile } = await import('@/lib/sandbox.shell')

      readFile.mockResolvedValue({
        success: true,
        contents: 'nothing to see here',
        mounts: [],
      })

      const result = await doShellReplace({
        session: 'test-namespace',
        input: '',
        params: { file: 'a.txt', search: 'absent', replace: 'x' },
        options: { userId: 'user-123' },
      })

      // @note a no-op must not be silently reported as a successful edit
      expect(writeFile).not.toHaveBeenCalled()
      expect(result.result).toContain('replacements: 0')
      expect(result.result).toContain('changed: false')
      expect(result.result).toContain('search text not found')
    })

    it('should return success false when the file cannot be read', async () => {
      const { readFile, writeFile } = await import('@/lib/sandbox.shell')

      readFile.mockResolvedValue({
        success: false,
        contents: '',
        error: 'File not found',
        mounts: [],
      })

      const result = await doShellReplace({
        session: 'test-namespace',
        input: '',
        params: { file: 'missing.txt', search: 'a', replace: 'b' },
        options: { userId: 'user-123' },
      })

      expect(writeFile).not.toHaveBeenCalled()
      expect(result.result).toContain('success: false')
      expect(result.result).toContain('File not found')
    })

    it('should throw when the search parameter is missing', async () => {
      await expect(
        doShellReplace({
          session: 'test-namespace',
          input: '',
          params: { file: 'a.txt', replace: 'b' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow()
    })

    it('should record token usage for replace operation', async () => {
      const { Usage } = await import('@/lib/usage.model')
      const { readFile } = await import('@/lib/sandbox.shell')

      readFile.mockResolvedValue({
        success: true,
        contents: 'foo',
        mounts: [],
      })

      await doShellReplace({
        session: 'test-namespace',
        input: '',
        params: { file: 'a.txt', search: 'foo', replace: 'bar' },
        options: { userId: 'user-123' },
      })

      expect(Usage.createAndRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ reason: 'shell/replace' }),
        })
      )
    })
  })

  describe('doShellImport', () => {
    let mockCall

    beforeEach(async () => {
      mockCall = (await import('@/lib/call')).default

      const { writeFile } = await import('@/lib/sandbox.shell')

      // @note reset mock for writeFile
      writeFile.mockResolvedValue({
        success: true,
        mounts: [],
      })

      // @note create a mock response for the fetch call
      mockCall.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/plain']]),
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('Hello World')),
      })
    })

    it('should import data from URL and write to file', async () => {
      const { writeFile } = await import('@/lib/sandbox.shell')

      const result = await doShellImport({
        session: 'test-namespace',
        input: '',
        params: { url: 'https://example.com/data.txt', path: 'data.txt' },
        options: { userId: 'user-123' },
      })

      expect(mockCall).toHaveBeenCalledWith('https://example.com/data.txt', {
        method: 'GET',
        headers: {},
      })

      expect(writeFile).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: undefined,
        conversationId: undefined,
        path: 'data.txt',
        contents: 'Hello World',
        sessionId: undefined,
      })

      expect(result.result).toContain('success: true')
      expect(result.result).toContain('url: https://example.com/data.txt')
      expect(result.result).toContain('path: data.txt')
    })

    it('should pass custom headers to import request', async () => {
      await doShellImport({
        session: 'test-namespace',
        input: '',
        params: {
          url: 'https://api.example.com/data',
          path: 'api-data.json',
          headers: { Authorization: '******' },
        },
        options: { userId: 'user-123' },
      })

      expect(mockCall).toHaveBeenCalledWith('https://api.example.com/data', {
        method: 'GET',
        headers: { Authorization: '******' },
      })
    })

    it('should handle HTTP errors gracefully', async () => {
      mockCall.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map(),
      })

      const result = await doShellImport({
        session: 'test-namespace',
        input: '',
        params: { url: 'https://example.com/notfound.txt', path: 'data.txt' },
        options: { userId: 'user-123' },
      })

      expect(result.result).toContain('success: false')
      expect(result.result).toContain('HTTP error: 404 Not Found')
    })

    it('should handle network errors gracefully', async () => {
      mockCall.mockRejectedValue(new Error('Network timeout'))

      const result = await doShellImport({
        session: 'test-namespace',
        input: '',
        params: { url: 'https://example.com/data.txt', path: 'data.txt' },
        options: { userId: 'user-123' },
      })

      expect(result.result).toContain('success: false')
      expect(result.result).toContain('Network timeout')
    })

    it('should throw error for invalid URL', async () => {
      await expect(
        doShellImport({
          session: 'test-namespace',
          input: '',
          params: { url: 'not-a-valid-url', path: 'data.txt' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow('Invalid URL')
    })

    it('should throw error for unsupported protocol', async () => {
      await expect(
        doShellImport({
          session: 'test-namespace',
          input: '',
          params: { url: 'ftp://example.com/file.txt', path: 'data.txt' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow('Unsupported protocol')
    })

    it('should record token usage', async () => {
      const { Usage } = await import('@/lib/usage.model')

      await doShellImport({
        session: 'test-namespace',
        input: '',
        params: { url: 'https://example.com/data.txt', path: 'data.txt' },
        options: { userId: 'user-456' },
      })

      expect(Usage.createAndRecord).toHaveBeenCalledWith({
        user: { id: 'user-456' },
        token: 1,
        model: 'base',
        meta: {
          reason: 'shell/import',
        },
        references: {},
      })
    })

    it('should use linkedResources.spaceId when provided', async () => {
      const { writeFile } = await import('@/lib/sandbox.shell')

      await doShellImport({
        session: 'test-namespace',
        input: '',
        params: { url: 'https://example.com/data.txt', path: 'data.txt' },
        options: {
          userId: 'user-123',
          linkedResources: { spaceId: 'linked-space-import' },
        },
      })

      expect(writeFile).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: 'linked-space-import',
        conversationId: undefined,
        path: 'data.txt',
        contents: 'Hello World',
        sessionId: undefined,
      })
    })

    it('should use custom sessionId when provided', async () => {
      const { writeFile } = await import('@/lib/sandbox.shell')

      await doShellImport({
        session: 'test-namespace',
        input: '',
        params: {
          url: 'https://example.com/data.txt',
          path: 'data.txt',
          sessionId: 'custom-session-import',
        },
        options: { userId: 'user-123' },
      })

      expect(writeFile).toHaveBeenCalledWith({
        sandboxId: 'session-test-namespace',
        spaceId: undefined,
        conversationId: undefined,
        path: 'data.txt',
        contents: 'Hello World',
        sessionId: 'custom-session-import',
      })
    })

    it('should include content-type in response', async () => {
      mockCall.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        arrayBuffer: jest
          .fn()
          .mockResolvedValue(Buffer.from('{"key":"value"}')),
      })

      const result = await doShellImport({
        session: 'test-namespace',
        input: '',
        params: { url: 'https://api.example.com/data.json', path: 'data.json' },
        options: { userId: 'user-123' },
      })

      expect(result.result).toContain('contentType: application/json')
    })

    it('should throw error when url parameter is missing', async () => {
      await expect(
        doShellImport({
          session: 'test-namespace',
          input: '',
          params: { path: 'data.txt' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow()
    })

    it('should throw error when path parameter is missing', async () => {
      await expect(
        doShellImport({
          session: 'test-namespace',
          input: '',
          params: { url: 'https://example.com/data.txt' },
          options: { userId: 'user-123' },
        })
      ).rejects.toThrow()
    })
  })

  describe('executeShellAction', () => {
    it('should execute shell exec operation', async () => {
      const { getContextNamespace } = await import('@/lib/context.store')

      getContextNamespace.mockReturnValue('action-namespace')

      const result = await executeShellAction(
        'ls -la',
        { exec: true },
        { userId: 'user-123' }
      )

      expect(result.result).toContain('success: true')
      expect(result.messages).toEqual([])
    })

    it('should execute shell exec script operation', async () => {
      const { getContextNamespace } = await import('@/lib/context.store')
      const { exec } = await import('@/lib/sandbox.shell')

      getContextNamespace.mockReturnValue('action-namespace')

      await executeShellAction(
        'print("ok")',
        {
          script: true,
          source: 'print("ok")',
          runtime: 'python',
          sessionId: 'script-session-1',
        },
        { userId: 'user-123' }
      )

      const call = exec.mock.calls[0][0]

      expect(call.sessionId).toBe('script-session-1')
      expect(call.files).toHaveLength(1)
      expect(call.files[0].path).toMatch(/^\/tmp\/cbk-script-python-.*\.py$/)
      expect(call.cmd).toBe(`python ${call.files[0].path}`)
    })

    it('should execute shell read operation', async () => {
      const { getContextNamespace } = await import('@/lib/context.store')

      getContextNamespace.mockReturnValue('action-namespace')

      const result = await executeShellAction(
        'data.txt',
        { read: true },
        { userId: 'user-123' }
      )

      expect(result.result).toContain('success: true')
      expect(result.messages).toEqual([])
    })

    it('should execute shell write operation', async () => {
      const { getContextNamespace } = await import('@/lib/context.store')

      getContextNamespace.mockReturnValue('action-namespace')

      const result = await executeShellAction(
        '',
        { write: true, file: 'output.txt', contents: 'test data' },
        { userId: 'user-123' }
      )

      expect(result.result).toContain('success: true')
      expect(result.messages).toEqual([])
    })

    it('should execute shell replace operation', async () => {
      const { getContextNamespace } = await import('@/lib/context.store')
      const { readFile, writeFile } = await import('@/lib/sandbox.shell')

      getContextNamespace.mockReturnValue('action-namespace')
      readFile.mockResolvedValue({
        success: true,
        contents: 'file contents',
        mounts: [],
      })
      writeFile.mockResolvedValue({ success: true, mounts: [] })

      const result = await executeShellAction(
        '',
        { replace: 'X', file: 'a.txt', search: 'file' },
        { userId: 'user-123' }
      )

      expect(result.result).toContain('success: true')
      expect(result.result).toContain('replacements: 1')
      expect(result.messages).toEqual([])
    })

    it('should execute shell import operation', async () => {
      const { getContextNamespace } = await import('@/lib/context.store')
      const mockCall = (await import('@/lib/call')).default
      const { writeFile } = await import('@/lib/sandbox.shell')

      getContextNamespace.mockReturnValue('action-namespace')
      mockCall.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/plain']]),
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('imported data')),
      })
      writeFile.mockResolvedValue({ success: true, mounts: [] })

      const result = await executeShellAction(
        '',
        { import: true, url: 'https://example.com/data.txt', path: 'data.txt' },
        { userId: 'user-123' }
      )

      expect(result.result).toContain('success: true')
      expect(result.messages).toEqual([])
    })

    it('should execute shell eval operation', async () => {
      const { getContextNamespace } = await import('@/lib/context.store')
      const { runCode } = await import('@/lib/sandbox.shell')

      getContextNamespace.mockReturnValue('action-namespace')

      const result = await executeShellAction(
        'print("ok")',
        { eval: true, runtime: 'python', timeout: 5000 },
        { userId: 'user-123' }
      )

      expect(runCode).toHaveBeenCalledWith({
        sandboxId: 'session-aadc4748-b290-5efe-80b0-f143cf8377f1-action-namespace',
        sessionId: undefined,
        spaceId: undefined,
        conversationId: undefined,
        code: 'print("ok")',
        language: 'python',
        timeout: 5000,
        memoryMb: 512,
        diskMb: 1024,
      })

      expect(result.result).toContain('success: true')
      expect(result.messages).toEqual([])
    })

    it('should fall back to conversation id when namespace is missing', async () => {
      const { getContextNamespace, getContextConversation } = await import(
        '@/lib/context.store'
      )
      const { exec } = await import('@/lib/sandbox.shell')

      getContextNamespace.mockReturnValue(null)
      getContextConversation.mockReturnValue({
        id: 'conv-123',
        spaceId: 'space-456',
      })

      await executeShellAction('echo test', { exec: true }, { userId: 'user-123' })

      expect(exec).toHaveBeenCalledWith({
        sandboxId: 'session-aadc4748-b290-5efe-80b0-f143cf8377f1-conv-123',
        sessionId: undefined,
        spaceId: 'space-456',
        conversationId: 'conv-123',
        cmd: 'echo test',
        files: [],
        timeout: undefined,
        memoryMb: 512,
        diskMb: 1024,
      })
    })

    it('should throw error when both namespace and conversation are missing', async () => {
      const { getContextNamespace, getContextConversation } = await import(
        '@/lib/context.store'
      )

      getContextNamespace.mockReturnValue(null)
      getContextConversation.mockReturnValue(null)

      await expect(
        executeShellAction('echo test', { exec: true }, { userId: 'user-123' })
      ).rejects.toThrow('Missing namespace')
    })

    it('should throw error for unknown operation', async () => {
      const { getContextNamespace } = await import('@/lib/context.store')

      getContextNamespace.mockReturnValue('test-namespace')

      await expect(
        executeShellAction(
          'echo test',
          { unknown: true },
          { userId: 'user-123' }
        )
      ).rejects.toThrow('Unknown operation')
    })

    it('should handle multiple operation parameters and pick the first valid one', async () => {
      const { getContextNamespace } = await import('@/lib/context.store')
      const { exec } = await import('@/lib/sandbox.shell')

      getContextNamespace.mockReturnValue('action-namespace')

      // exec should be processed since it comes first in the switch statement

      await executeShellAction(
        'echo test',
        { exec: true, read: true },
        { userId: 'user-123' }
      )

      // verify exec was called, not readFile

      expect(exec).toHaveBeenCalledWith({
        sandboxId: 'session-aadc4748-b290-5efe-80b0-f143cf8377f1-action-namespace',
        sessionId: undefined,
        spaceId: undefined,
        conversationId: undefined,
        cmd: 'echo test',
        files: [],
        timeout: undefined,
        memoryMb: 512,
        diskMb: 1024,
      })
    })
  })
})

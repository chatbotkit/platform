/**
 * @jest-environment node
 */
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'

import handlers, {
  GIT_CACHE_MAX_ENTRIES,
  GIT_CACHE_TTL_MS,
  GIT_HTTP_MAX_RESPONSE_BYTES,
  GIT_REPOSITORY_MAX_BYTES,
  GIT_REPOSITORY_MAX_FILES,
  pruneGitCache,
  request,
} from '@/pages/api/auxiliary/skillset/ability/chatbotkit/url/git'

import fs from 'fs'
import git from 'isomorphic-git'

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  isDevelopment: false,
}))

jest.mock('@/lib/egress.fetch', () => jest.fn())

jest.mock('@/lib/auxiliary.handler', () => ({
  authenticatedMultiHandler: jest.fn((handlersMap) => {
    // @note return an object with the handler functions for direct testing
    const result = {}

    for (const [name, handler] of Object.entries(handlersMap)) {
      // @note every auxiliary route is authenticated; bind a mock session so
      // the tests keep calling the inner function as (parameters, headers)
      result[name] = (
        parameters,
        headers,
        session = { user: { id: 'test-user-id' } }
      ) => handler.fn(session, parameters, headers)
    }

    return result
  }),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  chmodSync: jest.fn(),
  lstatSync: jest.fn(),
  mkdirSync: jest.fn(),
  realpathSync: jest.fn((value) => value),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  rmSync: jest.fn(),
  utimesSync: jest.fn(),
}))

jest.mock('isomorphic-git', () => ({
  clone: jest.fn(),
  checkout: jest.fn(),
  fetch: jest.fn(),
  listFiles: jest.fn(),
  setConfig: jest.fn(),
}))

const mockFs = fs
const mockGit = git

describe('git handlers', () => {
  const mockHeaders = new Headers()

  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock implementations
    mockFs.existsSync.mockReturnValue(true)
    mockFs.statSync.mockReturnValue({
      isDirectory: () => false,
      mtimeMs: Date.now(),
      size: 1024,
    })
    mockFs.lstatSync.mockImplementation((value) => ({
      isDirectory: () =>
        String(value).startsWith('/tmp/git-repos') &&
        !/\.[^/]+$/.test(String(value)),
      isSymbolicLink: () => false,
      mtimeMs: Date.now(),
      size: 1024,
    }))
    mockFs.readFileSync.mockReturnValue('file content here')
    mockFs.readdirSync.mockReturnValue([])
    mockGit.clone.mockReset().mockResolvedValue(undefined)
    mockGit.checkout.mockReset().mockResolvedValue(undefined)
    mockGit.fetch.mockReset().mockResolvedValue(undefined)
    mockGit.listFiles.mockResolvedValue([])
    mockGit.setConfig.mockResolvedValue(undefined)
  })

  describe('file handler', () => {
    describe('parseGitUrl', () => {
      it('should parse GitHub URLs correctly', async () => {
        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'README.md',
        }

        const result = await handlers.file(parameters, mockHeaders)

        expect(result).toEqual({
          path: 'README.md',
          content: 'file content here',
          size: 1024,
          ref: 'main',
        })
      })

      it('should parse GitHub URLs with .git extension', async () => {
        const parameters = {
          url: 'https://github.com/owner/repo.git',
          ref: 'main',
          filePath: 'src/index.ts',
        }

        const result = await handlers.file(parameters, mockHeaders)

        expect(result.path).toBe('src/index.ts')
        expect(result.content).toBe('file content here')
      })

      it('should parse GitLab URLs correctly', async () => {
        const parameters = {
          url: 'https://gitlab.com/owner/project',
          ref: 'develop',
          filePath: 'lib/main.js',
        }

        const result = await handlers.file(parameters, mockHeaders)

        expect(result.path).toBe('lib/main.js')
        expect(result.ref).toBe('develop')
      })

      it('should parse Bitbucket URLs correctly', async () => {
        const parameters = {
          url: 'https://bitbucket.org/owner/repo',
          ref: 'master',
          filePath: 'package.json',
        }

        const result = await handlers.file(parameters, mockHeaders)

        expect(result.path).toBe('package.json')
      })

      it('should handle generic Git URLs', async () => {
        const parameters = {
          url: 'https://git.example.com/custom/repo.git',
          ref: 'main',
          filePath: 'config.yml',
        }

        const result = await handlers.file(parameters, mockHeaders)

        expect(result.path).toBe('config.yml')
      })
    })

    describe('ref parameter', () => {
      it('should use default ref when not specified', async () => {
        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'file.txt',
        }

        const result = await handlers.file(parameters, mockHeaders)

        expect(result.ref).toBe('main')
      })

      it('should use custom ref when specified', async () => {
        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'feature-branch',
          filePath: 'file.txt',
        }

        const result = await handlers.file(parameters, mockHeaders)

        expect(result.ref).toBe('feature-branch')
      })

      it('should work with tag refs', async () => {
        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'v1.0.0',
          filePath: 'CHANGELOG.md',
        }

        const result = await handlers.file(parameters, mockHeaders)

        expect(result.ref).toBe('v1.0.0')
      })

      it('should work with commit SHAs', async () => {
        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'abc123def456',
          filePath: 'src/app.js',
        }

        const result = await handlers.file(parameters, mockHeaders)

        expect(result.ref).toBe('abc123def456')
      })
    })

    describe('git operations', () => {
      it('should clone repository if not cached', async () => {
        mockFs.existsSync.mockImplementation((path) => {
          return !path.includes('.git')
        })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'README.md',
        }

        await handlers.file(parameters, mockHeaders)

        expect(mockGit.clone).toHaveBeenCalled()
        expect(mockGit.clone).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://github.com/owner/repo',
            ref: 'main',
            singleBranch: true,
            depth: 1,
          })
        )
      })

      it('should use cached repository if available', async () => {
        mockFs.existsSync.mockReturnValue(true)

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'README.md',
        }

        await handlers.file(parameters, mockHeaders)

        expect(mockGit.clone).not.toHaveBeenCalled()
      })

      it('should checkout branch if repo exists', async () => {
        mockFs.existsSync.mockReturnValue(true)

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'develop',
          filePath: 'README.md',
        }

        await handlers.file(parameters, mockHeaders)

        expect(mockGit.checkout).toHaveBeenCalledWith(
          expect.objectContaining({
            ref: 'develop',
          })
        )
      })

      it('should fetch and retry checkout on failure', async () => {
        mockFs.existsSync.mockReturnValue(true)
        mockGit.checkout
          .mockRejectedValueOnce(new Error('Branch not found'))
          .mockResolvedValueOnce(undefined)

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'new-branch',
          filePath: 'file.txt',
        }

        await handlers.file(parameters, mockHeaders)

        expect(mockGit.checkout).toHaveBeenCalledTimes(2)
        expect(mockGit.fetch).toHaveBeenCalledTimes(1)
      })
    })

    describe('file operations', () => {
      it('should read file content', async () => {
        const fileContent = 'export default function() { return "hello"; }'

        mockFs.readFileSync.mockReturnValue(fileContent)
        mockFs.statSync.mockReturnValue({
          isDirectory: () => false,
          size: fileContent.length,
        })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'src/index.js',
        }

        const result = await handlers.file(parameters, mockHeaders)

        expect(result.content).toBe(fileContent)
        expect(result.size).toBe(fileContent.length)
      })

      it('should handle nested file paths', async () => {
        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'src/components/Button/index.tsx',
        }

        const result = await handlers.file(parameters, mockHeaders)

        expect(result.path).toBe('src/components/Button/index.tsx')
      })
    })

    describe('error handling', () => {
      it('should throw error when file does not exist', async () => {
        mockFs.existsSync.mockImplementation((path) => {
          if (path.includes('.git')) {
            return true
          }

          if (path.includes('nonexistent.txt')) {
            return false
          }

          return true
        })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'nonexistent.txt',
        }

        await expect(handlers.file(parameters, mockHeaders)).rejects.toThrow(
          'File not found: nonexistent.txt'
        )
      })

      it('should throw error when path is a directory', async () => {
        mockFs.statSync.mockReturnValue({
          isDirectory: () => true,
          size: 0,
        })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'src',
        }

        await expect(handlers.file(parameters, mockHeaders)).rejects.toThrow(
          'Path is a directory, not a file: src'
        )
      })

      it('should throw error on git clone failure', async () => {
        mockFs.existsSync.mockImplementation((path) => {
          return !path.includes('.git')
        })

        mockGit.clone.mockRejectedValue(new Error('Network error'))

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'README.md',
        }

        await expect(handlers.file(parameters, mockHeaders)).rejects.toThrow(
          'Network error'
        )
      })

      it('redacts credentials from Git errors before logging or returning them', async () => {
        mockFs.existsSync.mockImplementation(
          (value) => !String(value).endsWith('.git')
        )
        mockGit.clone.mockRejectedValue(
          new Error(
            'Clone failed for https://alice:error-secret@git.example.com/owner/repo?token=error-query-secret'
          )
        )

        let captured

        try {
          await handlers.file(
            {
              url: 'https://git.example.com/owner/repo',
              ref: 'main',
              filePath: 'README.md',
            },
            mockHeaders
          )
        } catch (error) {
          captured = error
        }

        expect(captured).toBeInstanceOf(Error)

        const serialized = JSON.stringify({
          error: captured.message,
          debug: debug.mock.calls,
        })

        expect(serialized).not.toContain('error-secret')
        expect(serialized).not.toContain('error-query-secret')
      })

      it('should throw error on file read failure', async () => {
        mockFs.readFileSync.mockImplementation(() => {
          throw new Error('Permission denied')
        })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'secret.key',
        }

        await expect(handlers.file(parameters, mockHeaders)).rejects.toThrow(
          'Permission denied'
        )
      })
    })

    describe('cache directory management', () => {
      it('should create cache directory if it does not exist', async () => {
        mockFs.existsSync.mockImplementation((path) => {
          if (String(path) === '/tmp/git-repos') {
            return false
          }

          return true
        })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'README.md',
        }

        await handlers.file(parameters, mockHeaders)

        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining('git-repos'),
          expect.objectContaining({ recursive: true })
        )
      })

      it('isolates same-name repositories by tenant and canonical origin', async () => {
        mockFs.existsSync.mockImplementation(
          (value) => !String(value).endsWith('.git')
        )

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          filePath: 'README.md',
        }

        await handlers.file(parameters, mockHeaders, {
          user: { id: 'tenant-a' },
        })
        await handlers.file(
          { ...parameters, url: 'https://git.example.com/owner/repo' },
          mockHeaders,
          { user: { id: 'tenant-a' } }
        )
        await handlers.file(parameters, mockHeaders, {
          user: { id: 'tenant-b' },
        })

        const directories = mockGit.clone.mock.calls.map(([options]) =>
          String(options.dir)
        )

        expect(new Set(directories).size).toBe(3)
        expect(
          directories.every((dir) => dir.startsWith('/tmp/git-repos/'))
        ).toBe(true)
      })

      it('removes credentials from clone URLs, cache paths and debug logs', async () => {
        mockFs.existsSync.mockImplementation(
          (value) => !String(value).endsWith('.git')
        )

        await handlers.file(
          {
            url: 'https://alice:super-secret@git.example.com/owner/repo.git?token=query-secret',
            ref: 'main',
            filePath: 'README.md',
          },
          mockHeaders
        )
        await handlers.file(
          {
            url: 'https://bob:different-secret@git.example.com/owner/repo?token=another-query-secret',
            ref: 'main',
            filePath: 'README.md',
          },
          mockHeaders
        )

        expect(mockGit.clone).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://git.example.com/owner/repo',
          })
        )
        expect(mockGit.setConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            path: 'remote.origin.url',
            value: 'https://git.example.com/owner/repo',
          })
        )

        const serializedCalls = JSON.stringify({
          debug: debug.mock.calls,
          git: mockGit.clone.mock.calls,
          mkdir: mockFs.mkdirSync.mock.calls,
        })

        expect(serializedCalls).not.toContain('super-secret')
        expect(serializedCalls).not.toContain('query-secret')
        expect(serializedCalls).not.toContain('different-secret')
        expect(serializedCalls).not.toContain('another-query-secret')
        expect(mockGit.clone.mock.calls[0][0].dir).toBe(
          mockGit.clone.mock.calls[1][0].dir
        )
      })

      it('removes and reclones an expired cached repository', async () => {
        const now = Date.now()

        mockFs.existsSync.mockReturnValue(true)
        mockFs.lstatSync.mockImplementation((value) => ({
          isDirectory: () => true,
          isSymbolicLink: () => false,
          mtimeMs:
            String(value).split('/git-repos/')[1]?.split('/').length === 2
              ? now - GIT_CACHE_TTL_MS - 1
              : now,
          size: 1024,
        }))

        await handlers.file(
          {
            url: 'https://github.com/owner/repo',
            ref: 'main',
            filePath: 'README.md',
          },
          mockHeaders
        )

        expect(mockFs.rmSync).toHaveBeenCalledWith(
          expect.stringContaining('/tmp/git-repos/'),
          { recursive: true, force: true }
        )
        expect(mockGit.clone).toHaveBeenCalledTimes(1)
      })

      it('rejects repositories that exceed the file-count limit', async () => {
        mockFs.existsSync.mockImplementation(
          (value) => !String(value).endsWith('.git')
        )
        mockGit.listFiles.mockResolvedValue(
          Array.from(
            { length: GIT_REPOSITORY_MAX_FILES + 1 },
            (_, index) => `file-${index}.txt`
          )
        )

        await expect(
          handlers.file(
            {
              url: 'https://github.com/owner/repo',
              ref: 'main',
              filePath: 'README.md',
            },
            mockHeaders
          )
        ).rejects.toThrow(/file-count limit/i)

        expect(mockFs.rmSync).toHaveBeenCalledWith(
          expect.stringContaining('/tmp/git-repos/'),
          { recursive: true, force: true }
        )
      })

      it('rejects repositories that exceed the size limit', async () => {
        mockFs.existsSync.mockImplementation(
          (value) => !String(value).endsWith('.git')
        )
        mockGit.listFiles.mockResolvedValue(['large.bin'])
        mockFs.lstatSync.mockImplementation((value) => ({
          isDirectory: () => !String(value).endsWith('large.bin'),
          isSymbolicLink: () => false,
          mtimeMs: Date.now(),
          size: String(value).endsWith('large.bin')
            ? GIT_REPOSITORY_MAX_BYTES + 1
            : 0,
        }))

        await expect(
          handlers.file(
            {
              url: 'https://github.com/owner/repo',
              ref: 'main',
              filePath: 'README.md',
            },
            mockHeaders
          )
        ).rejects.toThrow(/size limit/i)

        expect(mockFs.rmSync).toHaveBeenCalledWith(
          expect.stringContaining('/tmp/git-repos/'),
          { recursive: true, force: true }
        )
      })

      it('rejects file paths that escape the repository', async () => {
        await expect(
          handlers.file(
            {
              url: 'https://github.com/owner/repo',
              ref: 'main',
              filePath: '../../etc/passwd',
            },
            mockHeaders
          )
        ).rejects.toThrow(/must stay within the repository/i)

        expect(mockFs.readFileSync).not.toHaveBeenCalled()
      })

      it('replaces a symlinked repository cache instead of following it', async () => {
        mockFs.existsSync.mockReturnValue(true)
        mockFs.lstatSync.mockImplementation((value) => {
          const cacheParts = String(value).split('/git-repos/')[1]?.split('/')

          return {
            isDirectory: () => cacheParts?.length !== 2,
            isSymbolicLink: () => cacheParts?.length === 2,
            mtimeMs: Date.now(),
            size: 0,
          }
        })

        await handlers.file(
          {
            url: 'https://github.com/owner/repo',
            ref: 'main',
            filePath: 'README.md',
          },
          mockHeaders
        )

        expect(mockFs.rmSync).toHaveBeenCalledWith(
          expect.stringContaining('/tmp/git-repos/'),
          { recursive: true, force: true }
        )
        expect(mockGit.clone).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('tree handler', () => {
    beforeEach(() => {
      // @note statSync for tree: directories don't have file extensions, files do
      mockFs.statSync.mockImplementation((path) => {
        const hasExtension = /\.\w+$/.test(path)
        const endsWithRepoName = path.endsWith('owner-repo') || path === ''

        return {
          isDirectory: () => !hasExtension || endsWithRepoName,
          size: 100,
        }
      })
    })

    describe('basic functionality', () => {
      it('should fetch all files from repository root', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: 'README.md', isDirectory: () => false },
          { name: 'package.json', isDirectory: () => false },
        ])

        mockFs.readFileSync
          .mockReturnValueOnce('# Project Title')
          .mockReturnValueOnce('{"name": "test"}')

        mockFs.statSync.mockImplementation((path) => ({
          isDirectory: () => !path.includes('.'),
          size: 100,
        }))

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: '',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.files).toHaveLength(2)
        expect(result.summary.totalFiles).toBe(2)
        expect(result.files[0].path).toBe('README.md')
        expect(result.files[1].path).toBe('package.json')
      })

      it('should fetch files from specific subdirectory', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: 'index.ts', isDirectory: () => false },
          { name: 'utils.ts', isDirectory: () => false },
        ])

        mockFs.readFileSync
          .mockReturnValueOnce('export default function() {}')
          .mockReturnValueOnce('export const util = () => {}')

        mockFs.statSync.mockImplementation((path) => ({
          isDirectory: () => !path.match(/\.\w+$/),
          size: 50,
        }))

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: 'src',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.path).toBe('src')
        expect(result.files).toHaveLength(2)
      })

      it('should recursively read nested directories', async () => {
        mockFs.readdirSync
          .mockReturnValueOnce([
            { name: 'components', isDirectory: () => true },
            { name: 'index.ts', isDirectory: () => false },
          ])
          .mockReturnValueOnce([
            { name: 'Button.tsx', isDirectory: () => false },
            { name: 'Input.tsx', isDirectory: () => false },
          ])

        mockFs.readFileSync
          .mockReturnValueOnce('export * from "./components"')
          .mockReturnValueOnce('export const Button = () => {}')
          .mockReturnValueOnce('export const Input = () => {}')

        mockFs.statSync.mockImplementation((path) => ({
          isDirectory: () =>
            (path.endsWith('src') || path.includes('components')) &&
            !path.match(/\.\w+$/),
          size: 75,
        }))

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: 'src',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.files.length).toBeGreaterThan(0)
        expect(result.summary.totalFiles).toBeGreaterThan(0)
      })
    })

    describe('ref parameter', () => {
      it('should use default ref when not specified', async () => {
        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: '',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.ref).toBe('main')
      })

      it('should use custom ref when specified', async () => {
        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'develop',
          path: 'src',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.ref).toBe('develop')
      })
    })

    describe('default exclusions', () => {
      it('should exclude node_modules directory', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: 'node_modules', isDirectory: () => true },
          { name: 'src', isDirectory: () => true },
          { name: 'index.js', isDirectory: () => false },
        ])

        mockFs.readFileSync.mockReturnValue('console.log("test")')

        mockFs.statSync
          .mockReturnValueOnce({ isDirectory: () => true, size: 0 })
          .mockReturnValue({
            isDirectory: () => false,
            size: 20,
          })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: '',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(
          result.files.every((f) => !f.path.includes('node_modules'))
        ).toBe(true)
      })

      it('should exclude .git directory', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: '.git', isDirectory: () => true },
          { name: 'README.md', isDirectory: () => false },
        ])

        mockFs.readFileSync.mockReturnValue('# README')

        mockFs.statSync
          .mockReturnValueOnce({ isDirectory: () => true, size: 0 })
          .mockReturnValue({
            isDirectory: () => false,
            size: 10,
          })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: '',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.files.every((f) => !f.path.includes('.git'))).toBe(true)
      })

      it('should exclude build directories', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: 'dist', isDirectory: () => true },
          { name: 'build', isDirectory: () => true },
          { name: '.next', isDirectory: () => true },
          { name: 'src', isDirectory: () => true },
        ])

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: '',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(
          result.files.every(
            (f) =>
              !f.path.includes('dist') &&
              !f.path.includes('build') &&
              !f.path.includes('.next')
          )
        ).toBe(true)
      })

      it('should exclude hidden files except .gitignore', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: '.gitignore', isDirectory: () => false },
          { name: '.env', isDirectory: () => false },
          { name: '.secret', isDirectory: () => false },
          { name: 'visible.txt', isDirectory: () => false },
        ])

        mockFs.readFileSync.mockReturnValue('content')

        mockFs.statSync
          .mockReturnValueOnce({ isDirectory: () => true, size: 0 })
          .mockReturnValue({ isDirectory: () => false, size: 7 })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: '',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        const paths = result.files.map((f) => f.path)

        // .gitignore should be included as exception to hidden file rule
        expect(paths).toContain('.gitignore')
        expect(paths).toContain('visible.txt')
        // Other hidden files should be excluded
        expect(paths).not.toContain('.env')
        expect(paths).not.toContain('.secret')
        expect(result.files).toHaveLength(2)
      })
    })

    describe('custom exclusions', () => {
      it('should exclude files matching custom patterns', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: 'test.spec.ts', isDirectory: () => false },
          { name: 'app.test.ts', isDirectory: () => false },
          { name: 'index.ts', isDirectory: () => false },
        ])

        mockFs.readFileSync.mockReturnValue('export default {}')

        mockFs.statSync
          .mockReturnValueOnce({ isDirectory: () => true, size: 0 })
          .mockReturnValue({
            isDirectory: () => false,
            size: 20,
          })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: 'src',
          excludePatterns: ['*.spec.ts', '*.test.ts'],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.files).toHaveLength(1)
        expect(result.files[0].path).toBe('index.ts')
      })

      it('should support wildcard patterns', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: 'component.tsx', isDirectory: () => false },
          { name: 'component.test.tsx', isDirectory: () => false },
          { name: 'utils.ts', isDirectory: () => false },
        ])

        mockFs.readFileSync.mockReturnValue('code')

        mockFs.statSync
          .mockReturnValueOnce({ isDirectory: () => true, size: 0 })
          .mockReturnValue({
            isDirectory: () => false,
            size: 4,
          })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: '',
          excludePatterns: ['*.test.*'],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.files.every((f) => !f.path.includes('.test.'))).toBe(true)
      })

      it('should support substring matching', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: 'legacy-code.js', isDirectory: () => false },
          { name: 'deprecated-util.js', isDirectory: () => false },
          { name: 'new-code.js', isDirectory: () => false },
        ])

        mockFs.readFileSync.mockReturnValue('function() {}')

        mockFs.statSync
          .mockReturnValueOnce({ isDirectory: () => true, size: 0 })
          .mockReturnValue({
            isDirectory: () => false,
            size: 12,
          })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: '',
          excludePatterns: ['legacy', 'deprecated'],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.files).toHaveLength(1)
        expect(result.files[0].path).toBe('new-code.js')
      })
    })

    describe('git operations', () => {
      it('should clone repository if not cached', async () => {
        // @note reset mocks to clear any previous rejections
        mockGit.clone.mockReset()
        mockGit.clone.mockResolvedValue(undefined)

        mockFs.existsSync.mockImplementation((path) => {
          return !path.includes('.git')
        })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: '',
          excludePatterns: [],
        }

        await handlers.tree(parameters, mockHeaders)

        expect(mockGit.clone).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://github.com/owner/repo',
            ref: 'main',
            singleBranch: true,
            depth: 1,
          })
        )
      })

      it('should checkout branch if repo exists', async () => {
        mockFs.existsSync.mockReturnValue(true)

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'feature-branch',
          path: '',
          excludePatterns: [],
        }

        await handlers.tree(parameters, mockHeaders)

        expect(mockGit.checkout).toHaveBeenCalledWith(
          expect.objectContaining({
            ref: 'feature-branch',
          })
        )
      })
    })

    describe('response format', () => {
      it('should return summary with correct totals', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: 'file1.txt', isDirectory: () => false },
          { name: 'file2.txt', isDirectory: () => false },
          { name: 'file3.txt', isDirectory: () => false },
        ])

        mockFs.readFileSync
          .mockReturnValueOnce('a'.repeat(100))
          .mockReturnValueOnce('b'.repeat(200))
          .mockReturnValueOnce('c'.repeat(300))

        mockFs.statSync
          .mockReturnValueOnce({ isDirectory: () => true, size: 0 })
          .mockReturnValueOnce({ isDirectory: () => false, size: 100 })
          .mockReturnValueOnce({ isDirectory: () => false, size: 200 })
          .mockReturnValueOnce({ isDirectory: () => false, size: 300 })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: '',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.summary.totalFiles).toBe(3)
        expect(result.summary.totalSize).toBe(600)
      })

      it('should include file metadata', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: 'example.js', isDirectory: () => false },
        ])

        mockFs.readFileSync.mockReturnValue('const x = 1;')
        mockFs.statSync
          .mockReturnValueOnce({ isDirectory: () => true, size: 0 })
          .mockReturnValue({
            isDirectory: () => false,
            size: 12,
          })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: 'src',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.files[0]).toEqual({
          path: 'example.js',
          content: 'const x = 1;',
          size: 12,
        })
      })
    })

    describe('error handling', () => {
      it('should throw error when path does not exist', async () => {
        mockFs.existsSync.mockImplementation((path) => {
          if (path.includes('nonexistent')) {
            return false
          }

          return true
        })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: 'nonexistent',
          excludePatterns: [],
        }

        await expect(handlers.tree(parameters, mockHeaders)).rejects.toThrow(
          'Path not found: nonexistent'
        )
      })

      it('should throw error when path is not a directory', async () => {
        mockFs.statSync.mockReturnValue({
          isDirectory: () => false,
          size: 100,
        })

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: 'README.md',
          excludePatterns: [],
        }

        await expect(handlers.tree(parameters, mockHeaders)).rejects.toThrow(
          'Path is not a directory: README.md'
        )
      })

      it('should skip unreadable files', async () => {
        mockFs.readdirSync.mockReturnValueOnce([
          { name: 'readable.txt', isDirectory: () => false },
          { name: 'unreadable.bin', isDirectory: () => false },
        ])

        mockFs.readFileSync
          .mockReturnValueOnce('readable content')
          .mockImplementationOnce(() => {
            throw new Error('Cannot read binary file')
          })

        mockFs.statSync.mockImplementation((p) => ({
          isDirectory: () => !p.match(/\.\w+$/) || p.endsWith('owner-repo'),
          size: 16,
        }))

        const parameters = {
          url: 'https://github.com/owner/repo',
          ref: 'main',
          path: '',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.files).toHaveLength(1)
        expect(result.files[0].path).toBe('readable.txt')
      })

      it('should reject subtree paths that escape the repository', async () => {
        await expect(
          handlers.tree(
            {
              url: 'https://github.com/owner/repo',
              ref: 'main',
              path: '../../etc',
              excludePatterns: [],
            },
            mockHeaders
          )
        ).rejects.toThrow(/must stay within the repository/i)
      })
    })

    describe('parseGitUrl', () => {
      it('should parse GitHub URLs', async () => {
        const parameters = {
          url: 'https://github.com/facebook/react',
          ref: 'main',
          path: 'packages',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.path).toBe('packages')
      })

      it('should parse GitLab URLs', async () => {
        const parameters = {
          url: 'https://gitlab.com/gitlab-org/gitlab',
          ref: 'master',
          path: 'app',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.ref).toBe('master')
      })

      it('should parse Bitbucket URLs', async () => {
        const parameters = {
          url: 'https://bitbucket.org/atlassian/python-bitbucket',
          ref: 'develop',
          path: 'lib',
          excludePatterns: [],
        }

        const result = await handlers.tree(parameters, mockHeaders)

        expect(result.ref).toBe('develop')
      })
    })
  })

  describe('skill list handler', () => {
    it('rejects skill directories that escape the repository', async () => {
      await expect(
        handlers.skillList(
          {
            url: 'https://github.com/owner/repo',
            ref: 'main',
            directory: '../../skills',
          },
          mockHeaders
        )
      ).rejects.toThrow(/must stay within the repository/i)
    })
  })
})

describe('git cache pruning', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('removes expired entries and caps the number of retained caches', () => {
    const now = Date.now()
    const tenantName = 'a'.repeat(64)
    const entries = Array.from(
      { length: GIT_CACHE_MAX_ENTRIES + 2 },
      (_, index) => ({
        name: index.toString(16).padStart(64, '0'),
        isDirectory: () => true,
        isSymbolicLink: () => false,
      })
    )

    mockFs.existsSync.mockReturnValue(true)
    mockFs.readdirSync
      .mockReturnValueOnce([
        {
          name: tenantName,
          isDirectory: () => true,
          isSymbolicLink: () => false,
        },
      ])
      .mockReturnValueOnce(entries)
    mockFs.statSync.mockImplementation((value) => {
      const index = Number.parseInt(String(value).split('/').at(-1), 16)

      return {
        mtimeMs: index === 0 ? now - GIT_CACHE_TTL_MS - 1 : now - index * 1000,
      }
    })

    pruneGitCache(now)

    expect(mockFs.rmSync).toHaveBeenCalledWith(
      expect.stringContaining('/' + '0'.repeat(64)),
      { recursive: true, force: true }
    )
    expect(mockFs.rmSync.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('deletes legacy flat cache directories without walking them', () => {
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readdirSync.mockReturnValueOnce([
      {
        name: 'owner-repo',
        isDirectory: () => true,
        isSymbolicLink: () => false,
      },
    ])

    pruneGitCache()

    expect(mockFs.rmSync).toHaveBeenCalledWith('/tmp/git-repos/owner-repo', {
      recursive: true,
      force: true,
    })
    expect(mockFs.readdirSync).toHaveBeenCalledTimes(1)
  })
})

async function* chunks(...parts) {
  for (const part of parts) {
    yield new Uint8Array(part)
  }
}

async function drain(iterable) {
  const out = []

  for await (const chunk of iterable) {
    out.push(...chunk)
  }

  return out
}

describe('git http client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('refuses a private-IP literal repository URL before any connection is attempted', async () => {
    fetch.mockImplementation((...args) =>
      jest.requireActual('@/lib/egress.fetch').default(...args)
    )

    let captured

    try {
      await request({ url: 'http://127.0.0.1/repo.git/info/refs' })
    } catch (e) {
      captured = e
    }

    expect(captured).toBeDefined()
    expect(String(captured?.cause?.message)).toMatch(
      /egress to 127\.0\.0\.1 is not allowed: not a public address/
    )
  })

  it('forwards the collected request body and iterates the response body', async () => {
    fetch.mockResolvedValue(
      new Response(new Uint8Array([7, 8, 9]), {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/x-git-upload-pack-result' },
      })
    )

    const result = await request({
      url: 'https://example.com/repo.git/git-upload-pack',
      method: 'POST',
      headers: { 'content-type': 'application/x-git-upload-pack-request' },
      body: chunks([1, 2], [3]),
    })

    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, init] = fetch.mock.calls[0]

    expect(url).toBe('https://example.com/repo.git/git-upload-pack')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      'content-type': 'application/x-git-upload-pack-request',
    })
    expect(Array.from(init.body)).toEqual([1, 2, 3])

    expect(result.method).toBe('POST')
    expect(result.statusCode).toBe(200)
    expect(result.statusMessage).toBe('OK')
    expect(result.headers).toEqual({
      'content-type': 'application/x-git-upload-pack-result',
    })
    expect(await drain(result.body)).toEqual([7, 8, 9])
  })

  it('sends no body for GET requests', async () => {
    fetch.mockResolvedValue(new Response(null, { status: 200 }))

    const result = await request({
      url: 'https://example.com/repo.git/info/refs',
    })

    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      body: undefined,
    })
    expect(await drain(result.body)).toEqual([])
  })

  it('rejects a declared Git response larger than the download limit', async () => {
    fetch.mockResolvedValue(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: {
          'content-length': String(GIT_HTTP_MAX_RESPONSE_BYTES + 1),
        },
      })
    )

    await expect(
      request({ url: 'https://example.com/repo.git/info/refs' })
    ).rejects.toThrow(/size limit/i)
  })
})

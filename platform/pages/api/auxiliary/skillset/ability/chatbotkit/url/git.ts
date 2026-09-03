import { authenticatedMultiHandler } from '@/lib/auxiliary.handler'
import debug from '@/lib/debug'
import fetch from '@/lib/egress.fetch'
import type { Session } from '@/lib/session.handler'
import { z } from '@/lib/zod.schema'

import { createHash } from 'crypto'
import fs from 'fs'
import git from 'isomorphic-git'
import type {
  GitHttpRequest,
  GitHttpResponse,
  HttpClient,
} from 'isomorphic-git/http/node'
import yaml from 'js-yaml'
import path from 'path'

export const FILE_HANDLER_NAME = 'file'
export const TREE_HANDLER_NAME = 'tree'
export const SKILL_LIST_HANDLER_NAME = 'skillList'

// @note default directory scanned for skills. `skills/` is the public
// convention for shareable skills; the dotted variants (.skills, .claude/skills,
// .github/skills) are normally internal, so they are NOT scanned by default -
// pass `directory` explicitly to target one. A skill is any folder within it
// containing a SKILL.md.
const DEFAULT_SKILL_DIRECTORY = 'skills'
const SKILL_FILENAME = 'SKILL.md'

const GIT_CACHE_ROOT = path.join('/tmp', 'git-repos')
const GIT_CACHE_COMPONENT_PATTERN = /^[a-f\d]{64}$/

export const GIT_CACHE_TTL_MS = 15 * 60 * 1000
export const GIT_CACHE_MAX_ENTRIES = 20
export const GIT_REPOSITORY_MAX_FILES = 10_000
export const GIT_REPOSITORY_MAX_BYTES = 50 * 1024 * 1024
export const GIT_HTTP_MAX_RESPONSE_BYTES = 50 * 1024 * 1024

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Normalize a caller-provided repository URL without retaining credentials or
 * query parameters in cache identity, Git configuration, errors or logs.
 *
 * @throws {Error} when the URL is not an HTTP(S) repository destination
 */
export function getCredentialFreeGitUrl(value: string): string {
  const url = new URL(value)

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Git repository URL must use HTTP or HTTPS')
  }

  url.username = ''
  url.password = ''
  url.search = ''
  url.hash = ''
  url.pathname = url.pathname.replace(/\/+$/, '').replace(/\.git$/i, '')

  if (!url.pathname || url.pathname === '/') {
    throw new Error('Git repository URL must include a repository path')
  }

  return url.toString().replace(/\/$/, '')
}

function getGitCacheLocation(
  userId: string,
  repositoryUrl: string,
  ref: string
) {
  const url = getCredentialFreeGitUrl(repositoryUrl)
  const tenantDir = path.join(GIT_CACHE_ROOT, hash(userId))
  const repoDir = path.join(tenantDir, hash(`${url}\0${ref}`))

  return { repoDir, tenantDir, url }
}

function removeCacheDirectory(directory: string) {
  fs.rmSync(directory, { recursive: true, force: true })
}

function ensurePrivateCacheDirectory(directory: string) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  }

  const stat = fs.lstatSync(directory)

  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Git cache path must be a private directory')
  }

  fs.chmodSync(directory, 0o700)
}

function isExpired(directory: string, now: number): boolean {
  try {
    const { mtimeMs } = fs.lstatSync(directory)

    return Number.isFinite(mtimeMs) && now - mtimeMs > GIT_CACHE_TTL_MS
  } catch {
    return true
  }
}

/**
 * Remove expired cache entries and retain only the newest bounded set. Cache
 * paths contain hashes only, so this walk never consumes caller-provided path
 * components.
 */
export function pruneGitCache(now: number = Date.now()): void {
  if (!fs.existsSync(GIT_CACHE_ROOT)) {
    return
  }

  const retained: Array<{ directory: string; mtimeMs: number }> = []

  for (const tenant of fs.readdirSync(GIT_CACHE_ROOT, {
    withFileTypes: true,
  })) {
    const tenantDir = path.join(GIT_CACHE_ROOT, tenant.name)

    if (
      !tenant.isDirectory() ||
      tenant.isSymbolicLink() ||
      !GIT_CACHE_COMPONENT_PATTERN.test(tenant.name)
    ) {
      removeCacheDirectory(tenantDir)

      continue
    }

    for (const repository of fs.readdirSync(tenantDir, {
      withFileTypes: true,
    })) {
      const directory = path.join(tenantDir, repository.name)

      if (
        !repository.isDirectory() ||
        repository.isSymbolicLink() ||
        !GIT_CACHE_COMPONENT_PATTERN.test(repository.name)
      ) {
        removeCacheDirectory(directory)

        continue
      }

      try {
        const { mtimeMs } = fs.statSync(directory)

        if (!Number.isFinite(mtimeMs) || now - mtimeMs > GIT_CACHE_TTL_MS) {
          removeCacheDirectory(directory)
        } else {
          retained.push({ directory, mtimeMs })
        }
      } catch {
        removeCacheDirectory(directory)
      }
    }
  }

  retained
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(GIT_CACHE_MAX_ENTRIES)
    .forEach(({ directory }) => removeCacheDirectory(directory))
}

function isWithinDirectory(root: string, target: string): boolean {
  const relative = path.relative(root, target)

  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

function resolveRepositoryPath(repoDir: string, value: string): string {
  const target = path.resolve(repoDir, value)

  if (!isWithinDirectory(repoDir, target)) {
    throw new Error('Git path must stay within the repository')
  }

  if (path.relative(repoDir, target).split(path.sep).includes('.git')) {
    throw new Error('Git metadata paths cannot be read')
  }

  if (fs.existsSync(target)) {
    const realRepoDir = fs.realpathSync(repoDir)
    const realTarget = fs.realpathSync(target)

    if (!isWithinDirectory(realRepoDir, realTarget)) {
      throw new Error('Git path must stay within the repository')
    }
  }

  return target
}

function sanitizeGitError(error: unknown): Error {
  const message =
    error instanceof Error ? error.message : 'Unknown Git operation error'
  const sanitized = message
    .replace(/([a-z][a-z\d+.-]*:\/\/)[^/\s@]+@/gi, '$1')
    .replace(
      /([?&](?:access_token|auth|key|password|secret|token)=)[^&\s]+/gi,
      '$1[redacted]'
    )

  return new Error(sanitized)
}

function pruneGitCacheSafely() {
  try {
    pruneGitCache()
  } catch {
    debug(`error pruning Git cache`)
  }
}

async function enforceRepositoryLimits(repoDir: string): Promise<void> {
  const files = await git.listFiles({ fs, dir: repoDir })

  if (files.length > GIT_REPOSITORY_MAX_FILES) {
    throw new Error(
      `Git repository exceeds the ${GIT_REPOSITORY_MAX_FILES} file-count limit`
    )
  }

  let totalSize = 0

  for (const file of files) {
    const target = path.resolve(repoDir, file)

    if (!isWithinDirectory(repoDir, target)) {
      throw new Error('Git repository contains an invalid file path')
    }

    totalSize += fs.lstatSync(target).size

    if (totalSize > GIT_REPOSITORY_MAX_BYTES) {
      throw new Error(
        `Git repository exceeds the ${GIT_REPOSITORY_MAX_BYTES} byte size limit`
      )
    }
  }
}

/**
 * isomorphic-git `http` client on the egress boundary. Same shape as
 * `isomorphic-git/http/node`, but every request goes through
 * `@/lib/egress.fetch`, so a caller-chosen repository URL and each of its
 * redirect hops are checked against `lib/egress.core.ts` at connect time.
 */

async function collect(iterable: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = []

  for await (const chunk of iterable) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

async function* iterate(body: Response['body']) {
  if (!body) {
    return
  }

  const reader = body.getReader()
  let totalSize = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        return
      }

      totalSize += value.byteLength

      if (totalSize > GIT_HTTP_MAX_RESPONSE_BYTES) {
        throw new Error(
          `Git response exceeds the ${GIT_HTTP_MAX_RESPONSE_BYTES} byte size limit`
        )
      }

      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

export async function request({
  url,
  method = 'GET',
  headers = {},
  body,
}: GitHttpRequest): Promise<GitHttpResponse> {
  // @note isomorphic-git hands over an async iterable, fetch wants bytes it
  // can send in one go; upload-pack requests are small
  const response = await fetch(url, {
    method,
    headers,
    body: body ? await collect(body) : undefined,
  })
  const contentLength = Number(response.headers.get('content-length'))

  if (
    Number.isFinite(contentLength) &&
    contentLength > GIT_HTTP_MAX_RESPONSE_BYTES
  ) {
    throw new Error(
      `Git response exceeds the ${GIT_HTTP_MAX_RESPONSE_BYTES} byte size limit`
    )
  }

  return {
    url: response.url,
    method,
    statusCode: response.status,
    statusMessage: response.statusText,
    body: iterate(response.body),
    headers: Object.fromEntries(response.headers.entries()),
  }
}

const http: HttpClient = { request }

/**
 * Ensure repository is cloned and checked out to the correct ref
 */
async function ensureRepo(userId: string, repoUrl: string, ref: string) {
  const { repoDir, tenantDir, url } = getGitCacheLocation(userId, repoUrl, ref)
  const now = Date.now()

  try {
    ensurePrivateCacheDirectory(GIT_CACHE_ROOT)
    ensurePrivateCacheDirectory(tenantDir)
  } catch (error) {
    throw sanitizeGitError(error)
  }

  let cached = fs.existsSync(path.join(repoDir, '.git'))

  if (cached) {
    const stat = fs.lstatSync(repoDir)

    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      removeCacheDirectory(repoDir)
      cached = false
    }
  }

  if (cached && isExpired(repoDir, now)) {
    removeCacheDirectory(repoDir)
    cached = false
  }

  try {
    // @note clone repo if not already cached - shallow clone for efficiency
    if (!cached) {
      await git.clone({
        fs,
        http,
        dir: repoDir,
        url,
        ref,
        singleBranch: true,
        depth: 1,
      })
    } else {
      try {
        await git.checkout({ fs, dir: repoDir, ref })
      } catch {
        await git.fetch({
          fs,
          http,
          dir: repoDir,
          ref,
          singleBranch: true,
          depth: 1,
        })

        await git.checkout({ fs, dir: repoDir, ref })
      }
    }

    // @note set the persisted remote explicitly even for reused caches
    await git.setConfig({
      fs,
      dir: repoDir,
      path: 'remote.origin.url',
      value: url,
    })

    await enforceRepositoryLimits(repoDir)

    fs.utimesSync(repoDir, new Date(now), new Date(now))

    return repoDir
  } catch (error) {
    removeCacheDirectory(repoDir)

    throw sanitizeGitError(error)
  }
}

// --- File Handler ---

export const fileSchema = z.object({
  url: z.string().url().describe('Git repository URL'),
  ref: z
    .string()
    .default('main')
    .describe('Git reference (branch, tag, or commit SHA)'),
  filePath: z.string().describe('Path to the file within the repository'),
})

export type FileSchema = z.infer<typeof fileSchema>

async function fileHandler(
  session: Session,
  parameters: FileSchema,
  _headers: Headers
) {
  const { url, ref, filePath } = parameters
  const safeUrl = getCredentialFreeGitUrl(url)

  debug(`git/file`, { parameters: { ...parameters, url: safeUrl } })

  try {
    const repoDir = await ensureRepo(session.user.id, url, ref as string)

    const targetPath = resolveRepositoryPath(repoDir, filePath)

    if (!fs.existsSync(targetPath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    const stat = fs.statSync(targetPath)

    if (stat.isDirectory()) {
      throw new Error(`Path is a directory, not a file: ${filePath}`)
    }

    const content = fs.readFileSync(targetPath, 'utf-8')

    const result = {
      path: filePath,
      content,
      size: stat.size,
      ref,
    }

    debug(`fetched file`, { path: result.path, size: result.size })

    return result
  } catch (error) {
    const safeError = sanitizeGitError(error)

    debug(`error fetching file`, {
      error: { name: safeError.name, message: safeError.message },
    })

    throw safeError
  } finally {
    pruneGitCacheSafely()
  }
}

// --- Tree Handler ---

export const treeSchema = z.object({
  url: z.string().url().describe('Git repository URL'),
  ref: z
    .string()
    .default('main')
    .describe('Git reference (branch, tag, or commit SHA)'),
  path: z
    .string()
    .default('')
    .describe('Path to the subtree within the repository'),
  excludePatterns: z
    .array(z.string())
    .default([])
    .describe('Patterns to exclude from the subtree'),
})

export type TreeSchema = z.infer<typeof treeSchema>

/**
 * Check if path matches any exclude pattern
 */
function shouldExclude(
  filePath: string,
  excludePatterns: string[],
  defaultExcludes: string[]
): boolean {
  // @note check default excludes with exact path component matching
  const isDefaultExcluded = defaultExcludes.some((pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      )

      return regex.test(filePath)
    }

    // @note match as exact path component to avoid false positives
    // e.g., '.git' matches '.git/' or 'foo/.git/bar' but not '.gitignore'
    const pathParts = filePath.split('/')

    return pathParts.some((part) => part === pattern)
  })

  if (isDefaultExcluded) {
    return true
  }

  // @note check custom excludes with substring/glob matching
  return excludePatterns.some((pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      )

      return regex.test(filePath)
    }

    // @note custom patterns allow substring matching for flexibility
    return filePath.includes(pattern)
  })
}

async function treeHandler(
  session: Session,
  parameters: TreeSchema,
  _headers: Headers
) {
  const { url, ref, path: subtreePath, excludePatterns } = parameters
  const safeUrl = getCredentialFreeGitUrl(url)

  debug(`git/tree`, { parameters: { ...parameters, url: safeUrl } })

  try {
    const repoDir = await ensureRepo(session.user.id, url, ref as string)

    const files: Array<{ path: string; content: string; size: number }> = []

    const targetDir = resolveRepositoryPath(repoDir, subtreePath as string)

    if (!fs.existsSync(targetDir)) {
      throw new Error(`Path not found: ${subtreePath}`)
    }

    const stat = fs.statSync(targetDir)

    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${subtreePath}`)
    }

    const defaultExcludes = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      '.stackblitzrc',
      '.DS_Store',
      'coverage',
      '.nyc_output',
      '__pycache__',
      '*.pyc',
      '.pytest_cache',
      'target',
      'vendor',
    ]

    async function readDir(dir: string, baseDir: string = dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relativePath = path.relative(baseDir, fullPath)

        if (entry.isSymbolicLink?.()) {
          continue
        }

        if (
          shouldExclude(
            relativePath,
            excludePatterns as string[],
            defaultExcludes
          )
        ) {
          continue
        }

        if (entry.name.startsWith('.') && entry.name !== '.gitignore') {
          continue
        }

        if (entry.isDirectory()) {
          await readDir(fullPath, baseDir)
        } else {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8')
            const stat = fs.statSync(fullPath)

            files.push({
              path: relativePath,
              content,
              size: stat.size,
            })
          } catch {
            // @note skip unreadable files (binary files or permission issues)
          }
        }
      }
    }

    await readDir(targetDir)

    debug(`fetched subtree`, {
      filesCount: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
    })

    return {
      ref,
      path: subtreePath,
      files,
      summary: {
        totalFiles: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
      },
    }
  } catch (error) {
    const safeError = sanitizeGitError(error)

    debug(`error fetching subtree`, {
      error: { name: safeError.name, message: safeError.message },
    })

    throw safeError
  } finally {
    pruneGitCacheSafely()
  }
}

// --- Skill Handlers ---

/**
 * Extract YAML frontmatter from a SKILL.md file. Mirrors the space skill
 * loader so skills read from a repo and skills read from a space behave the
 * same way. Returns empty data (not an error) when there is no frontmatter.
 */
function parseFrontmatter(content: string): {
  data: Record<string, unknown>
  body: string
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  if (!match) {
    return { data: {}, body: content }
  }

  try {
    const data = (yaml.load(match[1]) as Record<string, unknown>) || {}

    return { data, body: match[2] }
  } catch {
    return { data: {}, body: content }
  }
}

/**
 * Recursively collect SKILL.md paths (relative to the repo root) under a skill
 * directory. Returns an empty list when the directory is absent.
 */
function collectSkillFiles(repoDir: string, dir: string): string[] {
  const rootDir = resolveRepositoryPath(repoDir, dir)

  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    return []
  }

  const results: string[] = []

  function walk(current: string) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (
        entry.name === '.git' ||
        entry.name === 'node_modules' ||
        entry.isSymbolicLink?.()
      ) {
        continue
      }

      const fullPath = path.join(current, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.name === SKILL_FILENAME) {
        results.push(path.relative(repoDir, fullPath))
      }
    }
  }

  walk(rootDir)

  return results
}

export const skillListSchema = z.object({
  url: z.string().url().describe('Git repository URL'),
  ref: z
    .string()
    .default('main')
    .describe('Git reference (branch, tag, or commit SHA)'),
  directory: z
    .string()
    .min(1)
    .default(DEFAULT_SKILL_DIRECTORY)
    .describe(
      'Directory to scan for skills, holding skill folders each with a SKILL.md. Defaults to "skills". Pass an internal convention such as ".claude/skills" or ".github/skills" to target it instead.'
    ),
})

export type SkillListSchema = z.infer<typeof skillListSchema>

async function skillListHandler(
  session: Session,
  parameters: SkillListSchema,
  _headers: Headers
) {
  const { url, ref, directory } = parameters
  const safeUrl = getCredentialFreeGitUrl(url)

  debug(`git/skill/list`, { parameters: { ...parameters, url: safeUrl } })

  try {
    const repoDir = await ensureRepo(session.user.id, url, ref as string)

    const skills: Array<{ path: string; name: string; description: string }> =
      []

    for (const relativePath of collectSkillFiles(repoDir, directory)) {
      try {
        const content = fs.readFileSync(
          path.join(repoDir, relativePath),
          'utf-8'
        )

        const { data } = parseFrontmatter(content)

        skills.push({
          path: relativePath,
          name: typeof data.name === 'string' ? data.name : '',
          description:
            typeof data.description === 'string' ? data.description : '',
        })
      } catch {
        // @note skip unreadable or unparseable skill files
      }
    }

    debug(`listed skills`, { count: skills.length })

    return { ref, skills }
  } catch (error) {
    const safeError = sanitizeGitError(error)

    debug(`error listing skills`, {
      error: { name: safeError.name, message: safeError.message },
    })

    throw safeError
  } finally {
    pruneGitCacheSafely()
  }
}

// --- Export Multi Handler ---

export default authenticatedMultiHandler({
  [FILE_HANDLER_NAME]: {
    schema: fileSchema,
    fn: fileHandler,
  },
  [TREE_HANDLER_NAME]: {
    schema: treeSchema,
    fn: treeHandler,
  },
  [SKILL_LIST_HANDLER_NAME]: {
    schema: skillListSchema,
    fn: skillListHandler,
  },
})

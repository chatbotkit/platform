import { applyCacheHeaders } from '@/lib/cdn'
import { makeJsonSafe } from '@/lib/struct'

import examples from '@/examples'

import fs from 'fs'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import path from 'path'

export default function Index() {}

/**
 * Parse GitHub URL to extract owner, repo, branch, and path
 */
function parseGitHubUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/)

  if (!match) {
    return null
  }

  return {
    owner: match[1],
    repo: match[2],
    ref: match[3],
    path: match[4],
  }
}

/**
 * Read all files from a git repository path
 */
async function readFilesFromGitRepo(owner, repo, filePath, ref) {
  const cacheDir = path.join('/tmp', 'git-repos')
  const repoDir = path.join(cacheDir, `${owner}-${repo}`)

  const files = []

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }

  if (!fs.existsSync(path.join(repoDir, '.git'))) {
    await git.clone({
      fs,
      http,
      dir: repoDir,
      url: `https://github.com/${owner}/${repo}`,
      ref,
      singleBranch: true,
      depth: 1,
    })
  }

  const targetDir = path.join(repoDir, filePath)

  if (!fs.existsSync(targetDir)) {
    return files
  }

  async function readDir(dir, baseDir = dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === '.next' ||
        entry.name === '.stackblitzrc' ||
        entry.name.startsWith('.')
      ) {
        continue
      }

      if (entry.isDirectory()) {
        await readDir(fullPath, baseDir)
      } else {
        const relativePath = path.relative(baseDir, fullPath)

        try {
          const content = fs.readFileSync(fullPath, 'utf-8')

          files.push({ path: relativePath, content })
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await readDir(targetDir)

  return files
}

export async function getServerSideProps(context) {
  const { slug } = context.params

  const example = examples.find((e) => e.slug === slug)

  if (!example) {
    return {
      notFound: true,
    }
  }

  if (!example.url || !example.url.includes('github.com')) {
    context.res.setHeader('Content-Type', 'application/json; charset=utf-8')

    applyCacheHeaders(context.res, {
      maxAge: 60,
      cdnMaxAge: 300,
      vercelMaxAge: 3600,
    })

    context.res.write(JSON.stringify([]))
    context.res.end()

    return {
      props: makeJsonSafe({}),
    }
  }

  const gitInfo = parseGitHubUrl(example.url)

  if (!gitInfo) {
    context.res.setHeader('Content-Type', 'application/json; charset=utf-8')

    applyCacheHeaders(context.res, {
      maxAge: 60,
      cdnMaxAge: 300,
      vercelMaxAge: 3600,
    })

    context.res.write(JSON.stringify([]))
    context.res.end()

    return {
      props: makeJsonSafe({}),
    }
  }

  try {
    const files = await readFilesFromGitRepo(
      gitInfo.owner,
      gitInfo.repo,
      gitInfo.path,
      gitInfo.ref
    )

    context.res.setHeader('Content-Type', 'application/json; charset=utf-8')

    applyCacheHeaders(context.res, {
      maxAge: 60,
      cdnMaxAge: 300,
      vercelMaxAge: 3600,
    })

    context.res.write(JSON.stringify(files, null, 2))
    context.res.end()

    return {
      props: makeJsonSafe({}),
    }
  } catch {
    context.res.setHeader('Content-Type', 'application/json; charset=utf-8')

    applyCacheHeaders(context.res, { maxAge: 10 })

    context.res.write(JSON.stringify({ error: 'Failed to fetch files' }))
    context.res.end()

    return {
      props: makeJsonSafe({}),
    }
  }
}

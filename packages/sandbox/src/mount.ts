// @note a storage scope, served to the guest as a directory.
//
// AgentOS lets a mount be backed by a plain object on the host: every
// filesystem call the guest makes on that path arrives here as a method call,
// in this process. That is what a FUSE filesystem is, minus the kernel, and
// it is how a space or a conversation's files reach an agent without the
// object store's credentials ever entering the VM - the driver holds nothing
// but a scope and a prefix, and speaks the storage contract like any other
// platform code.
//
// The mapping is the obvious one and deliberately nothing cleverer: an object
// is a file, a key prefix is a directory, and an empty directory is the same
// trailing-slash marker object the platform's own space browser writes. What
// the guest writes is what the platform reads back, as it is.
//
// Two things about the guest's access pattern shape the caches. `ls` asks for
// a directory listing and then stats every entry, so a listing seeds the stat
// cache with what it already knows. Reads arrive as 64KB `pread` slices, so
// the first slice fetches the object whole and the rest are served from
// memory; a write drops the copy.

import type {
  StorageListingItem,
  StorageProvider,
  StorageScope,
} from '@chatbotkit-dev/storage-spec'

import type * as AgentOsNamespace from '@rivet-dev/agentos-core'

type AgentOsCreateOptions = NonNullable<
  Parameters<(typeof AgentOsNamespace.AgentOs)['create']>[0]
>

type MountConfig = NonNullable<AgentOsCreateOptions['mounts']>[number]

/** The host-side driver a guest path can be backed by. */
export type VirtualFileSystem = Extract<MountConfig, { driver: unknown }>['driver']

type VirtualStat = Awaited<ReturnType<VirtualFileSystem['stat']>>

type VirtualDirEntry = Awaited<
  ReturnType<VirtualFileSystem['readDirWithTypes']>
>[number]

/** The part of the storage contract a mount needs. */
export type MountStore = Pick<
  StorageProvider,
  | 'listObjects'
  | 'headObject'
  | 'getObject'
  | 'putObject'
  | 'moveObject'
  | 'deleteObject'
>

export interface StorageDriverOptions {
  store: MountStore
  scope: StorageScope
  /** The key prefix the mount is rooted at, without a trailing slash. */
  prefix: string
  /** The identity every entry is reported as owned by. */
  uid: number
  gid: number
}

/** How long a stat is trusted before the store is asked again. */
const STAT_TTL_MS = 3_000

/** The most file content kept in memory per mount. */
const CONTENT_CACHE_BYTES = 64 * 1024 * 1024

const LIST_PAGE = 1000

const DIRECTORY_MODE = 0o40755
const FILE_MODE = 0o100644

/**
 * @note the guest kernel reads `code` and the message prefix; both are set so
 * that neither convention is a guess. The codes are the POSIX ones a shell
 * turns into its usual sentences.
 */
class FsError extends Error {
  readonly code: string

  constructor(code: string, path: string, detail: string) {
    super(`${code}: ${detail}, '${path}'`)

    this.name = 'FsError'
    this.code = code
  }
}

const enoent = (path: string) =>
  new FsError('ENOENT', path, 'no such file or directory')

const eisdir = (path: string) => new FsError('EISDIR', path, 'is a directory')

const enotdir = (path: string) => new FsError('ENOTDIR', path, 'not a directory')

const enotempty = (path: string) =>
  new FsError('ENOTEMPTY', path, 'directory not empty')

const enotsup = (path: string, what: string) =>
  new FsError('ENOTSUP', path, `${what} is not supported on this mount`)

function isEnoent(error: unknown): boolean {
  return error instanceof FsError && error.code === 'ENOENT'
}

/**
 * Normalises a guest path to a key-relative one: no leading slash, no empty
 * or dot segments, and an empty string for the mount root.
 *
 * @note `..` is refused rather than resolved. The guest kernel resolves paths
 * before they get here, so a `..` reaching this point is not a path, and the
 * store's own guard rejects it a second time anyway.
 *
 * @throws ENOENT when the path climbs above the mount root
 */
function toRelative(path: string): string {
  const segments = path.split('/').filter((segment) => segment && segment !== '.')

  if (segments.includes('..')) {
    throw enoent(path)
  }

  return segments.join('/')
}

function parentOf(relative: string): string {
  const index = relative.lastIndexOf('/')

  return index < 0 ? '' : relative.slice(0, index)
}

/**
 * @note inode numbers are expected to be stable for a path across calls and
 * distinct across paths; a hash of the path is both, and needs no state.
 */
function toInode(relative: string): number {
  let hash = 0x811c9dc5

  for (let i = 0; i < relative.length; i++) {
    hash ^= relative.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0) || 1
}

function toBytes(content: string | Uint8Array): Uint8Array {
  return typeof content === 'string' ? new TextEncoder().encode(content) : content
}

export function createStorageDriver(
  options: StorageDriverOptions
): VirtualFileSystem {
  const { store, scope, prefix, uid, gid } = options

  const stats = new Map<string, { stat: VirtualStat; expires: number }>()

  const contents = new Map<string, Uint8Array>()

  let contentBytes = 0

  // --- keys ---

  const keyOf = (relative: string) => (relative ? `${prefix}/${relative}` : prefix)

  const directoryKeyOf = (relative: string) => `${keyOf(relative)}/`

  // --- stats ---

  function makeStat(
    relative: string,
    kind: 'file' | 'directory',
    size: number,
    updatedAt: Date | undefined
  ): VirtualStat {
    const time = (updatedAt ?? new Date()).getTime()

    return {
      mode: kind === 'directory' ? DIRECTORY_MODE : FILE_MODE,
      size,
      blocks: Math.ceil(size / 512),
      dev: 0,
      rdev: 0,
      isDirectory: kind === 'directory',
      isSymbolicLink: false,
      atimeMs: time,
      mtimeMs: time,
      ctimeMs: time,
      birthtimeMs: time,
      ino: toInode(relative),
      nlink: 1,
      uid,
      gid,
    }
  }

  function remember(relative: string, stat: VirtualStat): VirtualStat {
    stats.set(relative, { stat, expires: Date.now() + STAT_TTL_MS })

    return stat
  }

  function forget(relative: string): void {
    stats.delete(relative)

    const cached = contents.get(relative)

    if (cached) {
      contents.delete(relative)

      contentBytes -= cached.byteLength
    }
  }

  function forgetAll(): void {
    stats.clear()
    contents.clear()

    contentBytes = 0
  }

  function rememberContent(relative: string, bytes: Uint8Array): void {
    if (bytes.byteLength > CONTENT_CACHE_BYTES) {
      return
    }

    forget(relative)

    // @note oldest-first eviction is enough here: the cache exists so the
    // slices of one read hit the store once, not to hold a working set

    for (const [key, value] of contents) {
      if (contentBytes + bytes.byteLength <= CONTENT_CACHE_BYTES) {
        break
      }

      contents.delete(key)

      contentBytes -= value.byteLength
    }

    contents.set(relative, bytes)

    contentBytes += bytes.byteLength
  }

  /**
   * @note a directory in an object store is a prefix something lives under, or
   * the marker object the platform writes for an empty one. Both answer a
   * one-item listing, which is the cheapest question the store can be asked.
   */
  async function isDirectory(relative: string): Promise<boolean> {
    const listing = await store.listObjects(scope, directoryKeyOf(relative), {
      maxKeys: 1,
    })

    return listing.items.length > 0 || listing.prefixes.length > 0
  }

  async function stat(path: string): Promise<VirtualStat> {
    const relative = toRelative(path)

    if (!relative) {
      return makeStat('', 'directory', 0, undefined)
    }

    const cached = stats.get(relative)

    if (cached && cached.expires > Date.now()) {
      return cached.stat
    }

    try {
      const info = await store.headObject(scope, keyOf(relative))

      return remember(
        relative,
        makeStat(relative, 'file', info.size ?? 0, info.updatedAt)
      )
    } catch {
      // @note not an object; a directory is the other thing it can be
    }

    if (await isDirectory(relative)) {
      return remember(relative, makeStat(relative, 'directory', 0, undefined))
    }

    throw enoent(path)
  }

  // --- listings ---

  async function listDirectory(path: string): Promise<VirtualDirEntry[]> {
    const relative = toRelative(path)

    if (relative && !(await stat(path)).isDirectory) {
      throw enotdir(path)
    }

    const directoryKey = directoryKeyOf(relative)

    const entries = new Map<string, VirtualDirEntry>()

    const seed = (item: StorageListingItem) => {
      const name = item.key.slice(directoryKey.length)

      // @note the directory's own marker lists as an empty name

      if (!name) {
        return
      }

      const child = relative ? `${relative}/${name}` : name

      remember(child, makeStat(child, 'file', item.size, item.updatedAt))

      entries.set(name, { name, isDirectory: false })
    }

    let continuationToken: string | undefined

    do {
      const listing = await store.listObjects(scope, directoryKey, {
        delimiter: '/',
        maxKeys: LIST_PAGE,
        ...(continuationToken ? { continuationToken } : {}),
      })

      for (const item of listing.items) {
        seed(item)
      }

      for (const childPrefix of listing.prefixes) {
        const name = childPrefix.slice(directoryKey.length).replace(/\/$/, '')

        if (!name) {
          continue
        }

        const child = relative ? `${relative}/${name}` : name

        remember(child, makeStat(child, 'directory', 0, undefined))

        entries.set(name, { name, isDirectory: true })
      }

      continuationToken = listing.truncated ? listing.nextToken : undefined
    } while (continuationToken)

    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  // --- contents ---

  async function readBytes(path: string): Promise<Uint8Array> {
    const relative = toRelative(path)

    const cached = contents.get(relative)

    if (cached) {
      return cached
    }

    const current = await stat(path)

    if (current.isDirectory) {
      throw eisdir(path)
    }

    const object = await store.getObject(scope, keyOf(relative))

    const bytes = object.body
      ? new Uint8Array(await object.body.arrayBuffer())
      : new Uint8Array()

    rememberContent(relative, bytes)

    return bytes
  }

  async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    const relative = toRelative(path)

    if (!relative) {
      throw eisdir(path)
    }

    await store.putObject(scope, keyOf(relative), bytes)

    rememberContent(relative, bytes)

    remember(relative, makeStat(relative, 'file', bytes.byteLength, undefined))

    stats.delete(parentOf(relative))
  }

  // --- moves ---

  async function moveTree(fromRelative: string, toRelative: string) {
    const fromKey = directoryKeyOf(fromRelative)
    const toKey = directoryKeyOf(toRelative)

    let continuationToken: string | undefined

    do {
      const listing = await store.listObjects(scope, fromKey, {
        maxKeys: LIST_PAGE,
        ...(continuationToken ? { continuationToken } : {}),
      })

      for (const item of listing.items) {
        await store.moveObject(
          scope,
          item.key,
          `${toKey}${item.key.slice(fromKey.length)}`
        )
      }

      continuationToken = listing.truncated ? listing.nextToken : undefined
    } while (continuationToken)
  }

  // --- the driver ---

  return {
    stat,

    lstat: stat,

    async exists(path) {
      try {
        await stat(path)

        return true
      } catch (error) {
        if (isEnoent(error)) {
          return false
        }

        throw error
      }
    },

    async realpath(path) {
      return `/${toRelative(path)}`
    },

    async readDir(path) {
      return (await listDirectory(path)).map((entry) => entry.name)
    },

    readDirWithTypes: listDirectory,

    readFile: readBytes,

    async readTextFile(path) {
      return new TextDecoder().decode(await readBytes(path))
    },

    async pread(path, offset, length) {
      const bytes = await readBytes(path)

      return bytes.slice(offset, offset + length)
    },

    async writeFile(path, content) {
      await writeBytes(path, toBytes(content))
    },

    async pwrite(path, offset, data) {
      let current: Uint8Array

      try {
        current = await readBytes(path)
      } catch (error) {
        if (!isEnoent(error)) {
          throw error
        }

        current = new Uint8Array()
      }

      const next = new Uint8Array(
        Math.max(current.byteLength, offset + data.byteLength)
      )

      next.set(current)
      next.set(data, offset)

      await writeBytes(path, next)
    },

    async truncate(path, length) {
      const current = await readBytes(path)

      const next = new Uint8Array(length)

      next.set(current.subarray(0, length))

      await writeBytes(path, next)
    },

    async mkdir(path) {
      const relative = toRelative(path)

      if (!relative) {
        return
      }

      // @note the same marker the platform's space browser writes, so an empty
      // directory made here is an empty directory there

      await store.putObject(scope, directoryKeyOf(relative), new Uint8Array())

      remember(relative, makeStat(relative, 'directory', 0, undefined))

      stats.delete(parentOf(relative))
    },

    async createDir(path) {
      await this.mkdir(path)
    },

    async removeFile(path) {
      const relative = toRelative(path)

      if (!relative) {
        throw eisdir(path)
      }

      if ((await stat(path)).isDirectory) {
        throw eisdir(path)
      }

      await store.deleteObject(scope, keyOf(relative))

      forget(relative)

      stats.delete(parentOf(relative))
    },

    async removeDir(path) {
      const relative = toRelative(path)

      if (!relative) {
        throw new FsError('EBUSY', path, 'resource busy or locked')
      }

      if (!(await stat(path)).isDirectory) {
        throw enotdir(path)
      }

      const directoryKey = directoryKeyOf(relative)

      const listing = await store.listObjects(scope, directoryKey, { maxKeys: 2 })

      if (
        listing.prefixes.length > 0 ||
        listing.items.some((item) => item.key !== directoryKey)
      ) {
        throw enotempty(path)
      }

      // @note the marker may not exist, when the directory was implicit and
      // its last file has just gone; either way it is gone now

      try {
        await store.deleteObject(scope, directoryKey)
      } catch {
        // @note already absent is the outcome wanted here
      }

      forget(relative)

      stats.delete(parentOf(relative))
    },

    async rename(oldPath, newPath) {
      const fromRelative = toRelative(oldPath)
      const toRelativePath = toRelative(newPath)

      if (!fromRelative || !toRelativePath) {
        throw new FsError('EBUSY', oldPath, 'resource busy or locked')
      }

      const current = await stat(oldPath)

      if (current.isDirectory) {
        await moveTree(fromRelative, toRelativePath)
      } else {
        await store.moveObject(scope, keyOf(fromRelative), keyOf(toRelativePath))
      }

      // @note a move touches the source, the destination and both parents;
      // dropping everything is simpler than being clever about four entries

      forgetAll()
    },

    async symlink(_target, linkPath) {
      throw enotsup(linkPath, 'symlink')
    },

    async readlink(path) {
      throw enotsup(path, 'readlink')
    },

    async link(_oldPath, newPath) {
      throw enotsup(newPath, 'link')
    },

    // @note ownership, permissions and timestamps are not properties an object
    // store has; the guest asks after every write and is told it succeeded,
    // because the alternative is every `cp` and `mkdir` reporting a failure
    // for something that did work

    async chmod() {},

    async chown() {},

    async utimes() {},
  }
}

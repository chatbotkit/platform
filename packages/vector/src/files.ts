// @note the storage half of the community default: one JSON file per dataset,
// holding the records and their vectors.
//
// This is the part that makes the default a development tool rather than a
// small production store, and the limits are worth stating plainly rather than
// discovering. A search reads the whole dataset into memory and compares every
// record; a write rewrites the whole file. Both are linear in dataset size, so
// a few thousand records are comfortable and a few hundred thousand are not.
// An implementation backed by a real index does not have either limit.
//
// The single-process assumption is the other one. Writes are serialised per
// dataset by a promise chain and land through a rename, so nothing in *this*
// process can interleave a read-modify-write or observe a half-written file.
// Two processes sharing a directory can still lose a write, and no amount of
// care short of a lock file fixes that. A deployment where that matters has
// outgrown this package.

import type * as nodeFs from 'node:fs/promises'
import type * as nodePath from 'node:path'

import { VectorError } from './error'

export interface StoredRecord {
  id: string
  text: string
  source?: string
  meta?: Record<string, unknown>
  embedding: number[]
  createdAt: number
  updatedAt: number
  expiresAt?: number
}

export interface StoredDataset {
  records: Record<string, StoredRecord>
}

let cachedDirectory: string | undefined

function getDirectory(): string {
  if (!cachedDirectory) {
    cachedDirectory = process.env.VECTOR_DATA_DIR || '.vector'
  }

  return cachedDirectory
}

/** One promise chain per dataset, so writes to it never interleave. */
const writes = new Map<string, Promise<unknown>>()

/**
 * @note exported for the tests, which need a fresh directory per case.
 */
export function resetDirectory(): void {
  cachedDirectory = undefined

  writes.clear()
}

/**
 * @note `node:fs` and `node:path` are imported lazily, and cached, so that
 * merely importing this package does not pull Node built-ins into a bundle
 * targeting a runtime that has neither. Nothing here runs until a record is
 * actually written.
 */
let loading:
  | Promise<{ fs: typeof nodeFs; path: typeof nodePath }>
  | undefined

function load() {
  if (!loading) {
    loading = Promise.all([
      import('node:fs/promises'),
      import('node:path'),
    ]).then(([fs, path]) => ({ fs, path }))
  }

  return loading
}

/**
 * @note `encodeURIComponent` rather than a character allowlist, because the
 * name arriving here is the platform's dataset id, and an allowlist that maps
 * two distinct ids onto one filename silently merges two datasets. Escaping is
 * reversible, so it cannot collide - and it takes `/` and `..` out of the
 * name, which is the other half of the job.
 */
async function getPath(datasetId: string) {
  const { path } = await load()

  const directory = getDirectory()

  return {
    directory,

    file: path.join(directory, `${encodeURIComponent(datasetId)}.json`),
  }
}

export async function read(datasetId: string): Promise<StoredDataset> {
  const { fs } = await load()

  const { file } = await getPath(datasetId)

  let contents: string

  try {
    contents = await fs.readFile(file, 'utf8')
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      // @note a dataset nobody has written to is empty rather than missing.
      // The contract says a search over one returns no matches, and this is
      // where that becomes true.

      return { records: {} }
    }

    throw new VectorError(
      'VECTOR_UNAVAILABLE',
      `could not read the dataset file at ${file}`,
      { detail: (error as Error).message, cause: error }
    )
  }

  try {
    return JSON.parse(contents) as StoredDataset
  } catch (error) {
    throw new VectorError(
      'VECTOR_UNAVAILABLE',
      `the dataset file at ${file} is not valid JSON, so its records cannot be read`,
      { detail: (error as Error).message, cause: error }
    )
  }
}

async function write(
  datasetId: string,
  dataset: StoredDataset
): Promise<void> {
  const { fs } = await load()

  const { directory, file } = await getPath(datasetId)

  const temporary = `${file}.${process.pid}.tmp`

  try {
    await fs.mkdir(directory, { recursive: true })

    // @note written aside and renamed, because a reader arriving during a
    // direct write sees a truncated file, and the parse above turns that into
    // a dataset that cannot be read at all. Rename is atomic within a
    // filesystem.

    await fs.writeFile(temporary, JSON.stringify(dataset), 'utf8')

    await fs.rename(temporary, file)
  } catch (error) {
    throw new VectorError(
      'VECTOR_UNAVAILABLE',
      `could not write the dataset file at ${file}`,
      { detail: (error as Error).message, cause: error }
    )
  }
}

/**
 * Reads a dataset, hands it to `change`, and writes back whatever comes out.
 *
 * @note serialised per dataset. Two concurrent upserts into the same dataset
 * would otherwise both read the same state and the second would write away the
 * first, which is a record silently disappearing rather than any error.
 */
export async function update<T>(
  datasetId: string,
  change: (dataset: StoredDataset) => T | Promise<T>
): Promise<T> {
  const previous = writes.get(datasetId) ?? Promise.resolve()

  const next = previous.then(async () => {
    const dataset = await read(datasetId)

    const result = await change(dataset)

    await write(datasetId, dataset)

    return result
  })

  // @note the stored link swallows failures, because a rejection left in the
  // chain is inherited by every later write to the same dataset. The caller's
  // copy still rejects.

  writes.set(
    datasetId,
    next.catch(() => undefined)
  )

  return next
}

/**
 * @note the readiness check needs to know the directory can be written to, and
 * writing to it is the only way to find out that is not a guess.
 */
export async function verifyWritable(): Promise<string> {
  const { fs, path } = await load()

  const directory = getDirectory()

  const probe = path.join(directory, `.probe.${process.pid}`)

  await fs.mkdir(directory, { recursive: true })

  await fs.writeFile(probe, '', 'utf8')

  await fs.rm(probe, { force: true })

  return directory
}

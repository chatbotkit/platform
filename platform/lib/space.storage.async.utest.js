// @note the async half of space storage: the functions that translate a
// listing or a head response into what the space UI and the agent abilities
// consume. Nothing covered them before - space.storage.utest.js exercises only
// the pure path helpers and never mocks the storage module - which made them
// the least protected part of the object storage migration, since that is
// exactly where the AWS response shapes were replaced with contract shapes.
import {
  getStoragePathMetadata,
  listStorage,
  storageDirectoryExists,
  storageFileExists,
  storagePathExists,
} from './space.storage'
import { headObject, listObjects } from '@/lib/storage'

jest.mock('@/lib/storage', () => ({
  headObject: jest.fn(),
  listObjects: jest.fn(),
  getObject: jest.fn(),
  putObject: jest.fn(),
  copyObject: jest.fn(),
  moveObject: jest.fn(),
  deleteObject: jest.fn(),
  deleteObjects: jest.fn(),
  getObjectDownloadUrl: jest.fn(),
  getObjectUploadUrl: jest.fn(),
  sanitizeObjectKey: jest.fn((key) => key),
}))

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

const spaceId = 'space-1'

function notFound() {
  const error = new Error('NotFound')

  error.name = 'NotFound'

  return error
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('listStorage', () => {
  it('turns prefixes into directories and items into files', async () => {
    const updatedAt = new Date('2026-03-04T05:06:07Z')

    listObjects.mockResolvedValue({
      prefixes: [`space-${spaceId}/data/docs/`],
      items: [
        { key: `space-${spaceId}/data/notes.txt`, size: 42, updatedAt },
      ],
      nextToken: 'next',
      truncated: false,
    })

    const result = await listStorage({ spaceId, path: '/' })

    expect(result.items).toEqual([
      expect.objectContaining({
        path: 'docs',
        size: 0,
        updatedAt: 0,
        isDirectory: true,
      }),
      expect.objectContaining({
        path: 'notes.txt',
        size: 42,
        updatedAt: updatedAt.getTime(),
        isDirectory: false,
      }),
    ])

    expect(result.nextToken).toBe('next')
  })

  it('reports file times in milliseconds, not as a Date', async () => {
    const updatedAt = new Date('2026-03-04T05:06:07Z')

    listObjects.mockResolvedValue({
      prefixes: [],
      items: [{ key: `space-${spaceId}/data/a.txt`, size: 1, updatedAt }],
      truncated: false,
    })

    const [item] = (await listStorage({ spaceId, path: '/' })).items

    // @note the contract hands back a Date and StorageItem carries an epoch,
    // so a missed conversion would surface as NaN in the UI rather than a throw
    expect(typeof item.updatedAt).toBe('number')
    expect(item.updatedAt).toBe(updatedAt.getTime())
  })

  it('skips the directory marker for the listed prefix itself', async () => {
    listObjects.mockResolvedValue({
      prefixes: [],
      items: [
        { key: `space-${spaceId}/data/`, size: 0, updatedAt: new Date() },
        { key: `space-${spaceId}/data/real.txt`, size: 5, updatedAt: new Date() },
      ],
      truncated: false,
    })

    const result = await listStorage({ spaceId, path: '/' })

    expect(result.items.map((item) => item.path)).toEqual(['real.txt'])
  })

  it('asks for a delimiter unless the listing is recursive', async () => {
    listObjects.mockResolvedValue({ prefixes: [], items: [], truncated: false })

    await listStorage({ spaceId, path: '/' })
    await listStorage({ spaceId, path: '/', recursive: true })

    expect(listObjects.mock.calls[0][2]).toMatchObject({ delimiter: '/' })
    expect(listObjects.mock.calls[1][2].delimiter).toBeUndefined()
  })

  it('returns an empty list rather than throwing when the store is empty', async () => {
    listObjects.mockResolvedValue({ prefixes: [], items: [], truncated: false })

    const result = await listStorage({ spaceId, path: '/' })

    expect(result.items).toEqual([])
    expect(result.nextToken).toBeUndefined()
  })
})

describe('getStoragePathMetadata', () => {
  it('maps head metadata onto the storage item', async () => {
    const updatedAt = new Date('2026-04-05T06:07:08Z')

    headObject.mockResolvedValue({
      size: 1024,
      contentType: 'text/plain',
      metadata: { owner: 'me' },
      updatedAt,
    })

    expect(
      await getStoragePathMetadata({ spaceId, path: '/notes.txt' })
    ).toEqual(
      expect.objectContaining({
        path: 'data/notes.txt',
        size: 1024,
        contentType: 'text/plain',
        metadata: { owner: 'me' },
        updatedAt: updatedAt.getTime(),
        isDirectory: false,
      })
    )
  })

  it('defaults a missing size and time rather than emitting undefined', async () => {
    headObject.mockResolvedValue({})

    const item = await getStoragePathMetadata({ spaceId, path: '/notes.txt' })

    expect(item.size).toBe(0)
    expect(typeof item.updatedAt).toBe('number')
  })

  it('falls back to a directory when the key is absent but the prefix has items', async () => {
    headObject.mockRejectedValue(notFound())
    listObjects.mockResolvedValue({
      items: [{ key: 'x', size: 1, updatedAt: new Date() }],
      prefixes: [],
      truncated: false,
    })

    const item = await getStoragePathMetadata({ spaceId, path: '/docs' })

    expect(item.isDirectory).toBe(true)
    expect(item.size).toBe(0)
  })

  it('treats a prefix-only match as a directory too', async () => {
    headObject.mockRejectedValue(notFound())
    listObjects.mockResolvedValue({
      items: [],
      prefixes: ['space-1/data/docs/sub/'],
      truncated: false,
    })

    // @note this branch reads `prefixes`, which did not exist before the
    // migration - the old code read `CommonPrefixes`
    expect(
      (await getStoragePathMetadata({ spaceId, path: '/docs' })).isDirectory
    ).toBe(true)
  })

  it('rethrows when the path is neither a file nor a directory', async () => {
    headObject.mockRejectedValue(notFound())
    listObjects.mockResolvedValue({ items: [], prefixes: [], truncated: false })

    await expect(
      getStoragePathMetadata({ spaceId, path: '/missing' })
    ).rejects.toThrow()
  })

  it('recognises a 404 status as well as a NotFound name', async () => {
    const error = new Error('nope')

    error.$metadata = { httpStatusCode: 404 }

    headObject.mockRejectedValue(error)
    listObjects.mockResolvedValue({
      items: [{ key: 'x', size: 1, updatedAt: new Date() }],
      prefixes: [],
      truncated: false,
    })

    expect(
      (await getStoragePathMetadata({ spaceId, path: '/docs' })).isDirectory
    ).toBe(true)
  })
})

describe('existence checks', () => {
  it('storageFileExists is true when the head succeeds', async () => {
    headObject.mockResolvedValue({ size: 1 })

    expect(await storageFileExists({ spaceId, path: '/a.txt' })).toBe(true)
  })

  it('storageFileExists is false when the head fails', async () => {
    headObject.mockRejectedValue(notFound())

    expect(await storageFileExists({ spaceId, path: '/a.txt' })).toBe(false)
  })

  it('storageDirectoryExists reads the listing rather than the head', async () => {
    listObjects.mockResolvedValue({
      items: [{ key: 'x', size: 1, updatedAt: new Date() }],
      prefixes: [],
      truncated: false,
    })

    expect(await storageDirectoryExists({ spaceId, path: '/docs' })).toBe(true)
  })

  it('storageDirectoryExists is false for an empty listing', async () => {
    listObjects.mockResolvedValue({ items: [], prefixes: [], truncated: false })

    expect(await storageDirectoryExists({ spaceId, path: '/docs' })).toBe(false)
  })

  it('storagePathExists accepts either a file or a directory', async () => {
    headObject.mockResolvedValue({ size: 1 })

    expect(await storagePathExists({ spaceId, path: '/a.txt' })).toBe(true)

    headObject.mockRejectedValue(notFound())
    listObjects.mockResolvedValue({
      items: [{ key: 'x', size: 1, updatedAt: new Date() }],
      prefixes: [],
      truncated: false,
    })

    expect(await storagePathExists({ spaceId, path: '/docs' })).toBe(true)
  })
})

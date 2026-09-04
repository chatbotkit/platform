// @note this file covers the part of the module the migration actually
// introduced: the translation between the AWS SDK's shapes and the neutral
// contract, and the resolution of a logical scope to a physical bucket.
//
// It matters more than it looks. Every consumer in platform mocks the storage
// module wholesale, so a mapping mistake here - reading `Size` into the wrong
// field, dropping `truncated`, losing the continuation token - would be
// invisible in every other suite while quietly corrupting listings in
// production.
//
// @note the client and the environment are resolved on first use and then
// cached, so cases that change the environment load their own copy.
import { jest } from '@jest/globals'

const send = jest.fn()
const getSignedUrl = jest.fn(async () => 'https://signed.example.com/object')

class Command {
  constructor(input) {
    this.input = input
  }
}

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn((config) => ({ send, config })),
  ListObjectsV2Command: class extends Command {},
  HeadObjectCommand: class extends Command {},
  GetObjectCommand: class extends Command {},
  PutObjectCommand: class extends Command {},
  CopyObjectCommand: class extends Command {},
  DeleteObjectCommand: class extends Command {},
  DeleteObjectsCommand: class extends Command {},
}))

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl,
}))

async function load() {
  jest.resetModules()

  return await import('./index')
}

const {
  copyObject,
  deleteObject,
  deleteObjects,
  ephemeralUrlPattern,
  getObject,
  getObjectDownloadUrl,
  getObjectUploadUrl,
  headObject,
  listObjects,
  moveObject,
  putObject,
} = await import('./index')

beforeEach(() => {
  send.mockReset()
  getSignedUrl.mockClear()

  Object.assign(process.env, {
    STORAGE_REGION: 'eu-west-1',
    STORAGE_ACCESS_KEY_ID: 'key',
    STORAGE_SECRET_ACCESS_KEY: 'secret',

    FILE_S3_BUCKET_NAME: 'files-bucket',
    SPACE_S3_BUCKET_NAME: 'spaces-bucket',
    CONVERSATION_S3_BUCKET_NAME: 'conversations-bucket',
  })
})

describe('scope resolution', () => {
  it('sends the bucket the scope maps to, not the scope itself', async () => {
    send.mockResolvedValue({})

    await headObject('file', 'a/b')

    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: 'files-bucket',
      Key: 'a/b',
    })
  })

  it('maps each scope to its own bucket', async () => {
    send.mockResolvedValue({})

    await headObject('space', 'k')
    await headObject('conversation', 'k')

    expect(send.mock.calls[0][0].input.Bucket).toBe('spaces-bucket')
    expect(send.mock.calls[1][0].input.Bucket).toBe('conversations-bucket')
  })

  it('names the missing variable when a scope has no bucket behind it', async () => {
    delete process.env.VIDEO_S3_BUCKET_NAME

    const storage = await load()

    await expect(storage.headObject('video', 'k')).rejects.toThrow(
      /VIDEO_S3_BUCKET_NAME is not set/
    )
  })
})

describe('listObjects', () => {
  it('translates the AWS listing into the contract shape', async () => {
    const modified = new Date('2026-01-02T03:04:05Z')

    send.mockResolvedValue({
      Contents: [{ Key: 'a.txt', Size: 12, LastModified: modified }],
      CommonPrefixes: [{ Prefix: 'sub/' }],
      NextContinuationToken: 'token-2',
      IsTruncated: true,
    })

    expect(await listObjects('file', 'prefix/', { maxKeys: 10 })).toEqual({
      items: [{ key: 'a.txt', size: 12, updatedAt: modified }],
      prefixes: ['sub/'],
      nextToken: 'token-2',
      truncated: true,
    })
  })

  it('returns empty collections rather than undefined when the store is empty', async () => {
    send.mockResolvedValue({})

    const listing = await listObjects('file', 'prefix/')

    // @note callers iterate these without guarding, which is only safe because
    // the contract promises arrays even for an empty listing
    expect(listing.items).toEqual([])
    expect(listing.prefixes).toEqual([])
    expect(listing.truncated).toBe(false)
    expect(listing.nextToken).toBeUndefined()
  })

  it('drops entries with no key and prefixes with no prefix', async () => {
    send.mockResolvedValue({
      Contents: [{ Size: 1 }, { Key: 'real.txt', Size: 2 }],
      CommonPrefixes: [{}, { Prefix: 'kept/' }],
    })

    const listing = await listObjects('file', '')

    expect(listing.items).toEqual([
      { key: 'real.txt', size: 2, updatedAt: expect.any(Date) },
    ])
    expect(listing.prefixes).toEqual(['kept/'])
  })

  it('defaults a missing size to zero', async () => {
    send.mockResolvedValue({
      Contents: [{ Key: 'a', LastModified: new Date() }],
    })

    expect((await listObjects('file', '')).items[0].size).toBe(0)
  })

  it('passes paging options through', async () => {
    send.mockResolvedValue({})

    await listObjects('file', 'p/', {
      delimiter: '/',
      maxKeys: 5,
      continuationToken: 'tok',
    })

    expect(send.mock.calls[0][0].input).toMatchObject({
      Delimiter: '/',
      MaxKeys: 5,
      ContinuationToken: 'tok',
    })
  })
})

describe('headObject', () => {
  it('translates the AWS metadata names into the contract names', async () => {
    const modified = new Date('2026-02-03T00:00:00Z')

    send.mockResolvedValue({
      ContentType: 'image/png',
      ContentLength: 2048,
      ContentDisposition: 'attachment; filename=x.png',
      Metadata: { owner: 'me' },
      LastModified: modified,
    })

    expect(await headObject('file', 'k')).toEqual({
      contentType: 'image/png',
      size: 2048,
      contentDisposition: 'attachment; filename=x.png',
      metadata: { owner: 'me' },
      updatedAt: modified,
    })
  })
})

describe('getObject body', () => {
  it('exposes the SDK stream through the three contract methods', async () => {
    const bytes = new TextEncoder().encode('hello')
    const webStream = Symbol('web-stream')

    send.mockResolvedValue({
      Body: {
        transformToByteArray: jest.fn(async () => bytes),
        transformToString: jest.fn(async () => 'hello'),
        transformToWebStream: jest.fn(() => webStream),
      },
      ContentType: 'text/plain',
    })

    const object = await getObject('file', 'k')

    expect(new TextDecoder().decode(await object.body.arrayBuffer())).toBe(
      'hello'
    )
    expect(await object.body.text()).toBe('hello')
    expect(object.body.stream()).toBe(webStream)
    expect(object.contentType).toBe('text/plain')
  })

  it('leaves body undefined when the object has no content', async () => {
    send.mockResolvedValue({ Body: undefined, ContentType: 'text/plain' })

    const object = await getObject('file', 'k')

    // @note callers branch on this, so an empty object must not present a body
    // that then throws when read
    expect(object.body).toBeUndefined()
    expect(object.contentType).toBe('text/plain')
  })
})

describe('putObject', () => {
  it('passes content type and metadata through', async () => {
    send.mockResolvedValue({})

    await putObject('file', 'k', 'data', {
      contentType: 'text/plain',
      metadata: { a: '1' },
    })

    expect(send.mock.calls[0][0].input).toMatchObject({
      Bucket: 'files-bucket',
      Key: 'k',
      Body: 'data',
      ContentType: 'text/plain',
      Metadata: { a: '1' },
    })
  })
})

describe('copyObject', () => {
  it('url-encodes the copy source', async () => {
    send.mockResolvedValue({})

    await copyObject('file', 'has space+plus.txt', 'dest.txt')

    // @note the SDK does not encode CopySource itself, and an unencoded source
    // silently fails for keys with spaces, colons or umlauts
    expect(send.mock.calls[0][0].input.CopySource).toBe(
      encodeURIComponent('files-bucket/has space+plus.txt')
    )
  })
})

describe('moveObject', () => {
  it('copies then deletes the source', async () => {
    send.mockResolvedValue({})

    await moveObject('file', 'from.txt', 'to.txt')

    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0][0].input.Key).toBe('to.txt')
    expect(send.mock.calls[1][0].input.Key).toBe('from.txt')
  })
})

describe('deleteObjects', () => {
  it('normalises the prefix to a folder before deleting', async () => {
    send.mockResolvedValueOnce({ Contents: [{ Key: 'p/a', Size: 1 }] })
    send.mockResolvedValueOnce({})

    await deleteObjects('file', '  p  ')

    expect(send.mock.calls[0][0].input.Prefix).toBe('p/')
  })

  it('does nothing when the prefix is already empty', async () => {
    send.mockResolvedValueOnce({ Contents: [] })

    await deleteObjects('file', 'p/')

    expect(send).toHaveBeenCalledTimes(1)
  })

  it('keeps deleting while the listing is truncated', async () => {
    send
      .mockResolvedValueOnce({ Contents: [{ Key: 'p/a' }], IsTruncated: true })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Contents: [{ Key: 'p/b' }], IsTruncated: false })
      .mockResolvedValueOnce({})

    await deleteObjects('file', 'p/')

    // @note a single pass would silently leave everything past the first page
    expect(send).toHaveBeenCalledTimes(4)
  })

  it('refuses an empty prefix', async () => {
    await expect(deleteObjects('file', '   ')).rejects.toThrow()
  })
})

describe('deleteObject', () => {
  it('rejects a key that could traverse out of its prefix', async () => {
    await expect(deleteObject('file', '../other/key')).rejects.toThrow()
  })
})

describe('getObjectDownloadUrl', () => {
  it('asks for an attachment disposition only when download is requested', async () => {
    await getObjectDownloadUrl('file', 'k')
    await getObjectDownloadUrl('file', 'k', { download: true })

    expect(
      getSignedUrl.mock.calls[0][1].input.ResponseContentDisposition
    ).toBeUndefined()
    expect(getSignedUrl.mock.calls[1][1].input.ResponseContentDisposition).toBe(
      'attachment'
    )
  })
})

describe('error propagation', () => {
  // @note eight places in the platform branch on the SDK's own error shape -
  // `name === 'NotFound'`, `$metadata.httpStatusCode === 404`, `NoSuchKey` -
  // to tell "missing" from "broken". The contract says nothing about errors,
  // so those branches only keep working because this implementation re-throws
  // what the SDK gave it. Wrapping errors here would silently turn every
  // "missing file" into a hard failure.

  it.each([
    ['headObject', (s) => s.headObject('file', 'k')],
    ['getObject', (s) => s.getObject('file', 'k')],
    ['listObjects', (s) => s.listObjects('file', 'p/')],
    ['putObject', (s) => s.putObject('file', 'k', 'b')],
    ['deleteObject', (s) => s.deleteObject('file', 'k')],
  ])('%s rethrows the SDK error untouched', async (_, call) => {
    const sdkError = new Error('The specified key does not exist.')

    sdkError.name = 'NoSuchKey'
    sdkError.$metadata = { httpStatusCode: 404 }

    send.mockRejectedValue(sdkError)

    const storage = await import('./index')

    const thrown = await call(storage).catch((e) => e)

    expect(thrown).toBe(sdkError)
    expect(thrown.name).toBe('NoSuchKey')
    expect(thrown.$metadata.httpStatusCode).toBe(404)
  })
})

describe('getObjectUploadUrl', () => {
  it('maps the contract options onto the AWS fields', async () => {
    await getObjectUploadUrl('file', 'k', {
      size: 1024,
      type: 'image/png',
      name: 'photo.png',
      metadata: { owner: 'me' },
    })

    expect(getSignedUrl.mock.calls[0][1].input).toMatchObject({
      Bucket: 'files-bucket',
      Key: 'k',
      ContentLength: 1024,
      ContentType: 'image/png',
      ContentDisposition: 'attachment; filename=photo.png',
      Metadata: { owner: 'me' },
    })
  })

  it('omits fields the caller did not supply', async () => {
    await getObjectUploadUrl('file', 'k')

    const { input } = getSignedUrl.mock.calls[0][1]

    // @note sending an empty ContentType or a zero ContentLength is not the
    // same as not constraining the upload at all
    expect(input.ContentLength).toBeUndefined()
    expect(input.ContentType).toBeUndefined()
    expect(input.ContentDisposition).toBeUndefined()
    expect(input.Metadata).toBeUndefined()
  })

  it('honours a custom expiry', async () => {
    await getObjectUploadUrl('file', 'k', { expiresIn: 60 })

    expect(getSignedUrl.mock.calls[0][2]).toMatchObject({ expiresIn: 60 })
  })

  it('rejects a traversing key', async () => {
    await expect(getObjectUploadUrl('file', '../escape')).rejects.toThrow()
  })
})

describe('public endpoint', () => {
  // @note SigV4 signs the host, so a URL a browser will use has to be signed
  // against the address the browser reaches - not the one the server does

  afterEach(() => {
    delete process.env.STORAGE_ENDPOINT
    delete process.env.STORAGE_PUBLIC_ENDPOINT
    delete process.env.STORAGE_FORCE_PATH_STYLE
  })

  it('presigns against the public endpoint and sends through the server one', async () => {
    Object.assign(process.env, {
      STORAGE_ENDPOINT: 'http://garage:3900',
      STORAGE_PUBLIC_ENDPOINT: 'http://localhost:3900',
      STORAGE_FORCE_PATH_STYLE: 'true',
    })

    const storage = await load()

    send.mockResolvedValue({})

    await storage.headObject('file', 'k')
    await storage.getObjectUploadUrl('file', 'k')
    await storage.getObjectDownloadUrl('file', 'k')

    const { S3Client } = await import('@aws-sdk/client-s3')

    expect(S3Client.mock.calls.map(([config]) => config.endpoint)).toEqual([
      'http://garage:3900',
      'http://localhost:3900',
    ])

    for (const [client] of getSignedUrl.mock.calls) {
      expect(client.config).toMatchObject({
        endpoint: 'http://localhost:3900',
        forcePathStyle: true,
        region: 'eu-west-1',
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
      })
    }
  })

  it('presigns against the server endpoint when no public one is set', async () => {
    Object.assign(process.env, { STORAGE_ENDPOINT: 'http://garage:3900' })

    delete process.env.STORAGE_PUBLIC_ENDPOINT

    const storage = await load()

    await storage.getObjectUploadUrl('file', 'k')

    expect(getSignedUrl.mock.calls[0][0].config.endpoint).toBe(
      'http://garage:3900'
    )
  })

  it('never bakes a body checksum into a presigned URL', async () => {
    // @note the body is unknown at minting time; a checksum computed then is
    // that of an empty body, and a store that honours it rejects the upload
    const storage = await load()

    send.mockResolvedValue({})

    await storage.putObject('file', 'k', 'b')
    await storage.getObjectUploadUrl('file', 'k')

    const { S3Client } = await import('@aws-sdk/client-s3')

    expect(S3Client.mock.calls[0][0].requestChecksumCalculation).toBeUndefined()
    expect(getSignedUrl.mock.calls[0][0].config.requestChecksumCalculation).toBe(
      'WHEN_REQUIRED'
    )
  })
})

describe('ephemeralUrlPattern', () => {
  it('matches a presigned URL', () => {
    const url =
      'https://files-bucket.s3.eu-west-1.amazonaws.com/k?X-Amz-Expires=86400&X-Amz-Signature=abc'

    expect(url).toMatch(new RegExp(ephemeralUrlPattern.source))
  })

  it('does not match a URL that never expires', () => {
    // @note the platform strips matches out of model output before persisting
    // it, so over-matching would delete durable links from conversations
    expect('https://chatbotkit.com/docs').not.toMatch(
      new RegExp(ephemeralUrlPattern.source)
    )
  })
})

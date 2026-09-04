/**
 * @jest-environment node
 */

// @note the AWS SDK's stream collector reaches for a global `FileReader`, which
// Node still does not provide - verified on 22.16, the version the deploy
// workflow pins. This module installs a minimal one at import.
//
// It runs only where `FileReader` is absent, so it is unreachable under the
// jsdom environment the rest of this package's tests use. That is why it has
// its own file with its own environment, rather than being quietly untested.
import { jest } from '@jest/globals'

class Command {
  constructor(input) {
    this.input = input
  }
}

jest.unstable_mockModule('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn() })),
  ListObjectsV2Command: class extends Command {},
  HeadObjectCommand: class extends Command {},
  GetObjectCommand: class extends Command {},
  PutObjectCommand: class extends Command {},
  CopyObjectCommand: class extends Command {},
  DeleteObjectCommand: class extends Command {},
  DeleteObjectsCommand: class extends Command {},
}))

jest.unstable_mockModule('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}))

jest.unstable_mockModule('@aws-sdk/client-sts', () => ({
  STSClient: jest.fn(() => ({ send: jest.fn() })),
  AssumeRoleCommand: class extends Command {},
}))

Object.assign(process.env, {
  STORAGE_REGION: 'eu-west-1',
  STORAGE_ACCESS_KEY_ID: 'key',
  STORAGE_SECRET_ACCESS_KEY: 'secret',
})

const absentBefore = typeof globalThis.FileReader === 'undefined'

await import('./index')

function read(blob) {
  const reader = new globalThis.FileReader()

  return new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader)
    reader.onerror = () => reject(reader.error)

    reader.readAsDataURL(blob)
  })
}

describe('FileReader polyfill', () => {
  it('is needed at all on this runtime', () => {
    // @note if Node ever ships FileReader, this fails and the polyfill can go
    expect(absentBefore).toBe(true)
  })

  it('installs a FileReader', () => {
    expect(typeof globalThis.FileReader).toBe('function')
  })

  it('reads a blob as a base64 data url carrying its type', async () => {
    const reader = await read(new Blob(['hello'], { type: 'text/plain' }))

    expect(reader.result).toBe(
      `data:text/plain;base64,${Buffer.from('hello').toString('base64')}`
    )
    expect(reader.readyState).toBe(2)
  })

  it('falls back to a generic type when the blob has none', async () => {
    const reader = await read(new Blob(['x']))

    expect(reader.result).toMatch(/^data:application\/octet-stream;base64,/)
  })

  it('reports failure through onerror rather than throwing', async () => {
    const reader = new globalThis.FileReader()

    const failure = new Error('unreadable')

    const settled = new Promise((resolve) => {
      reader.onerror = () => resolve(reader)
    })

    reader.readAsDataURL({
      type: 'text/plain',
      arrayBuffer: async () => {
        throw failure
      },
    })

    expect((await settled).error).toBe(failure)
    expect(reader.readyState).toBe(2)
  })

  it('settles as aborted when abort is called', () => {
    const reader = new globalThis.FileReader()

    const onabort = jest.fn()

    reader.onabort = onabort
    reader.abort()

    expect(onabort).toHaveBeenCalled()
    expect(reader.readyState).toBe(2)
  })
})

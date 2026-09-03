import { roundToNearestNMinutes } from '@chatbotkit-dev/time'

import {
  getTempFileLocation,
  readTimeFileMeta,
  ttlFileBuffer,
  ttlFileLocation,
  writeTempFileMeta,
} from './fs.cache'

import fsPromises from 'fs/promises'
import { v5 as uuidv5 } from 'uuid'

jest.mock('@chatbotkit-dev/time', () => ({
  roundToNearestNMinutes: jest.fn((n) => {
    return new Date(Date.UTC(2025, 0, 1, 0, n, 0, 0))
  }),
}))

jest.mock('uuid', () => ({
  v5: jest.fn((name, namespace) => {
    return `uuid-${namespace}-${name}`
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  jest
    .spyOn(fsPromises, 'readFile')
    .mockImplementation(() =>
      Promise.reject(new Error('unconfigured readFile call'))
    )
  jest
    .spyOn(fsPromises, 'writeFile')
    .mockImplementation(() => Promise.resolve())
})

describe('getTempFileLocation', () => {
  it('should build deterministic path using namespace, generated id, rounded time and extension', () => {
    const result = getTempFileLocation({
      namespace: 'ns',
      name: 'fileName',
      ext: 'txt',
      ttlInMinutes: 15,
    })

    const expectedTime = new Date(Date.UTC(2025, 0, 1, 0, 15, 0, 0)).getTime()

    expect(result).toBe(`/tmp/uuid-ns-fileName-${expectedTime}.txt`)
    expect(uuidv5).toHaveBeenCalledWith('fileName', 'ns')
    expect(roundToNearestNMinutes).toHaveBeenCalledWith(15)
  })

  it('should normalize extension passed with leading dot', () => {
    const result = getTempFileLocation({
      namespace: 'ns',
      name: 'fileName',
      ext: '.csv',
      ttlInMinutes: 5,
    })

    const expectedTime = new Date(Date.UTC(2025, 0, 1, 0, 5, 0, 0)).getTime()

    expect(result).toBe(`/tmp/uuid-ns-fileName-${expectedTime}.csv`)
  })
})

describe('readTimeFileMeta', () => {
  it('should return null when meta file missing or read fails', async () => {
    fsPromises.readFile.mockRejectedValueOnce(new Error('not found'))

    const meta = await readTimeFileMeta({
      namespace: 'ns',
      name: 'f',
      ttlInMinutes: 5,
    })

    expect(meta).toBeNull()
  })

  it('should parse and return meta object when file exists', async () => {
    const metaObj = {
      name: 'orig',
      ext: '.bin',
      type: 'application/octet-stream',
    }

    fsPromises.readFile.mockResolvedValueOnce(JSON.stringify(metaObj))

    const meta = await readTimeFileMeta({
      namespace: 'ns',
      name: 'f',
      ttlInMinutes: 10,
    })

    expect(meta).toEqual(metaObj)
  })

  it('should return null on invalid JSON', async () => {
    fsPromises.readFile.mockResolvedValueOnce('{invalid json')

    const meta = await readTimeFileMeta({
      namespace: 'ns',
      name: 'f',
      ttlInMinutes: 10,
    })

    expect(meta).toBeNull()
  })
})

describe('writeTempFileMeta', () => {
  it('should write meta file (no directory creation now)', async () => {
    fsPromises.writeFile.mockResolvedValueOnce(undefined)

    const metaObj = { name: 'orig', ext: '.dat', type: 'data/custom' }

    await writeTempFileMeta({
      namespace: 'ns',
      name: 'f',
      ttlInMinutes: 20,
      meta: metaObj,
    })

    const expectedTime = new Date(Date.UTC(2025, 0, 1, 0, 20, 0, 0)).getTime()

    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      `/tmp/uuid-ns-f-${expectedTime}.meta`,
      JSON.stringify(metaObj),
      'utf-8'
    )
  })
})

describe('ttlFileLocation', () => {
  it('should return existing cached location without creating new file', async () => {
    const metaObj = {
      name: 'loc',
      ext: '.bin',
      type: 'application/octet-stream',
    }

    fsPromises.readFile.mockResolvedValueOnce(JSON.stringify(metaObj)) // meta

    const result = await ttlFileLocation({
      namespace: 'ns',
      name: 'loc',
      ttlInMinutes: 9,
      loader: jest.fn(),
    })

    const expectedTime = new Date(Date.UTC(2025, 0, 1, 0, 9, 0, 0)).getTime()

    expect(result.location).toBe(`/tmp/uuid-ns-loc-${expectedTime}.bin`)
    expect(result.meta).toEqual(metaObj)
    expect(result.created).toBe(false)
  })

  it('should create file and return location on cache miss', async () => {
    fsPromises.readFile.mockRejectedValueOnce(new Error('no meta'))
    fsPromises.writeFile.mockResolvedValue(undefined)

    const loaderBuffer = new TextEncoder().encode('newdata').buffer

    const metaObj = {
      name: 'locNew',
      ext: '.dat',
      type: 'application/octet-stream',
    }

    const loader = jest
      .fn()
      .mockResolvedValue({ buffer: loaderBuffer, meta: metaObj })

    const result = await ttlFileLocation({
      namespace: 'ns',
      name: 'locNew',
      ttlInMinutes: 11,
      loader,
    })

    const expectedTime = new Date(Date.UTC(2025, 0, 1, 0, 11, 0, 0)).getTime()

    expect(result.location).toBe(`/tmp/uuid-ns-locNew-${expectedTime}.dat`)
    expect(result.meta).toEqual(metaObj)
    expect(result.created).toBe(true)
    expect(loader).toHaveBeenCalled()
  })
})

describe('ttlFileBuffer', () => {
  it('should return buffer on cache hit reusing ttlFileLocation logic', async () => {
    const metaObj = { name: 'buf', ext: '.txt', type: 'text/plain' }

    fsPromises.readFile.mockResolvedValueOnce(JSON.stringify(metaObj)) // meta

    const fileContent = Buffer.from('cached-buffer')

    fsPromises.readFile.mockResolvedValueOnce(fileContent) // file

    const loader = jest.fn()

    const result = await ttlFileBuffer({
      namespace: 'ns',
      name: 'buf',
      ttlInMinutes: 13,
      loader,
    })

    expect(loader).not.toHaveBeenCalled()
    expect(new TextDecoder().decode(result.buffer)).toBe('cached-buffer')
    expect(result.meta).toEqual(metaObj)
  })

  it('should create file then read buffer on miss', async () => {
    fsPromises.readFile.mockRejectedValueOnce(new Error('no meta'))
    fsPromises.writeFile.mockResolvedValue(undefined)

    const loaderBuffer = new TextEncoder().encode('generated').buffer

    const metaObj = {
      name: 'gen',
      ext: '.bin',
      type: 'application/octet-stream',
    }

    const loader = jest
      .fn()
      .mockResolvedValue({ buffer: loaderBuffer, meta: metaObj })

    fsPromises.readFile.mockResolvedValueOnce(Buffer.from(loaderBuffer))

    const result = await ttlFileBuffer({
      namespace: 'ns',
      name: 'gen',
      ttlInMinutes: 17,
      loader,
    })

    expect(loader).toHaveBeenCalled()
    expect(result.meta).toEqual(metaObj)
    expect(new TextDecoder().decode(result.buffer)).toBe('generated')
  })
})

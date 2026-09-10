import fetch from '@/lib/fetch'
import { createImage, editImage } from '@/lib/image'
import { accountLimitsOk } from '@/lib/limit.core'
import { recordImageUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'

import {
  createAssetUpload,
  editImageNode,
  generateImage,
  getAssetUrls,
  saveProject,
} from './api'
import { buildAssetUrls, ensureSpace, readProject, writeProject } from './space'

// @note the route handler is reduced to a passthrough so each handler can be
// invoked with its input directly; the session/contact plumbing has its own
// tests in lib/app.route.utest.js
jest.mock('@/lib/app.route', () => ({
  appContactRouteHandler:
    (_app, _namespace, _configSchema, inputSchema, handler) =>
    async (input) => {
      return handler(
        {},
        { user: { id: 'user-123' } },
        { id: 'contact-123' },
        await inputSchema.parseAsync(input),
        {}
      )
    },
}))

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'uuid-1'),
}))

jest.mock('@/lib/fetch', () => jest.fn())

jest.mock('@/lib/image', () => ({
  createImage: jest.fn(),
  editImage: jest.fn(),
}))

jest.mock('@/lib/limit.core', () => ({
  accountLimitsOk: jest.fn(),
}))

const mockUsage = {
  addImageTokens: jest.fn(),
  recordBaseTokens: jest.fn(),
}

jest.mock('@/lib/usage.model', () => ({
  Usage: jest.fn(() => mockUsage),
}))

jest.mock('@/lib/usage.record', () => ({
  recordImageUsage: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('./space', () => ({
  buildAssetUrls: jest.fn(),
  ensureSpace: jest.fn(),
  readProject: jest.fn(),
  writeProject: jest.fn(),
}))

describe('f2a9c7d4/api', () => {
  let client

  beforeEach(() => {
    jest.clearAllMocks()

    client = {
      space: {
        storage: {
          upload: jest.fn().mockResolvedValue({
            path: 'projects/p1/assets/uuid-1.png',
            uploadRequest: { method: 'PUT', url: 'https://put', headers: {} },
          }),
          download: jest
            .fn()
            .mockImplementation(async (_spaceId, path) => ({
              url: `https://get/${path}`,
            })),
        },
      },
    }

    ensureSpace.mockResolvedValue({ client, spaceId: 'space-1' })
    fastGetUserById.mockResolvedValue({ id: 'user-123' })
    accountLimitsOk.mockResolvedValue(true)
  })

  describe('generateImage', () => {
    it('generates, records usage and stores the asset', async () => {
      createImage.mockResolvedValue({
        urls: ['https://generated/1.png'],
        usage: { inputTokens: 10, outputTokens: 20, model: 'gpt-image-2' },
      })

      const result = await generateImage({
        projectId: 'p1',
        prompt: 'a cat',
        model: 'gpt-image-2',
        size: '1024x1024',
      })

      expect(accountLimitsOk).toHaveBeenCalledWith({ id: 'user-123' }, [
        'token',
        'image',
      ])
      expect(createImage).toHaveBeenCalledWith('a cat', {
        model: 'gpt-image-2/size=1024x1024',
        user: 'user-123',
      })
      expect(mockUsage.recordBaseTokens).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        meta: { reason: 'image/create' },
      })
      expect(recordImageUsage).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        count: 1,
        model: 'gpt-image-2',
        meta: { reason: 'image/create' },
      })
      expect(client.space.storage.upload).toHaveBeenCalledWith(
        'space-1',
        'projects/p1/assets/uuid-1.png',
        { file: 'https://generated/1.png' }
      )
      expect(result).toEqual({
        assetPath: 'projects/p1/assets/uuid-1.png',
        assetUrl: 'https://get/projects/p1/assets/uuid-1.png',
      })
    })

    it('refuses to generate when the account is over its limits', async () => {
      accountLimitsOk.mockResolvedValue(false)

      await expect(
        generateImage({ projectId: 'p1', prompt: 'a cat' })
      ).rejects.toThrow('You have reached your usage limit.')

      expect(createImage).not.toHaveBeenCalled()
    })

    it('rejects an empty prompt at the schema boundary', async () => {
      await expect(
        generateImage({ projectId: 'p1', prompt: '' })
      ).rejects.toThrow()

      expect(createImage).not.toHaveBeenCalled()
    })
  })

  describe('editImageNode', () => {
    it('feeds every source asset to the edit model', async () => {
      const blob = { size: 3 }

      fetch.mockResolvedValue({ ok: true, blob: async () => blob })

      editImage.mockResolvedValue({
        urls: ['https://generated/2.png'],
        usage: { inputTokens: 1, outputTokens: 2, model: 'gpt-image-2' },
      })

      const result = await editImageNode({
        projectId: 'p1',
        prompt: 'make it blue',
        sourceAssetPaths: ['projects/p1/assets/a.png', 'projects/p1/assets/b.png'],
      })

      expect(client.space.storage.download).toHaveBeenCalledWith(
        'space-1',
        'projects/p1/assets/a.png'
      )
      expect(client.space.storage.download).toHaveBeenCalledWith(
        'space-1',
        'projects/p1/assets/b.png'
      )
      expect(editImage).toHaveBeenCalledWith('make it blue', [blob, blob], {
        model: 'gpt-image-2',
        user: 'user-123',
      })
      expect(recordImageUsage).toHaveBeenCalledWith(
        expect.objectContaining({ meta: { reason: 'image/edit' } })
      )
      expect(result.assetPath).toBe('projects/p1/assets/uuid-1.png')
    })

    it('fails when a source image cannot be loaded', async () => {
      fetch.mockResolvedValue({ ok: false })

      await expect(
        editImageNode({
          projectId: 'p1',
          prompt: 'make it blue',
          sourceAssetPaths: ['projects/p1/assets/a.png'],
        })
      ).rejects.toThrow('Failed to load a source image')

      expect(editImage).not.toHaveBeenCalled()
    })
  })

  describe('saveProject', () => {
    const nodes = [
      {
        id: 'n1',
        type: 'image',
        position: { x: 0, y: 0 },
        data: {
          prompt: 'a cat',
          model: 'gpt-image-2',
          size: 'auto',
          assetPath: null,
          status: 'empty',
        },
      },
    ]

    it('writes the graph onto the stored project', async () => {
      readProject.mockResolvedValue({
        id: 'p1',
        name: 'Project',
        nodes: [],
        edges: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })

      const result = await saveProject({ projectId: 'p1', nodes, edges: [] })

      expect(writeProject).toHaveBeenCalledWith(
        client,
        'space-1',
        expect.objectContaining({ id: 'p1', name: 'Project', nodes, edges: [] })
      )
      expect(writeProject.mock.calls[0][2].updatedAt).not.toBe(
        '2026-01-01T00:00:00.000Z'
      )
      expect(result).toEqual({ id: 'p1' })
    })

    it('fails when the project does not exist', async () => {
      readProject.mockResolvedValue(null)

      await expect(
        saveProject({ projectId: 'missing', nodes, edges: [] })
      ).rejects.toThrow('Project not found')

      expect(writeProject).not.toHaveBeenCalled()
    })
  })

  describe('createAssetUpload', () => {
    it('mints an upload request with the extension of the mime type', async () => {
      const result = await createAssetUpload({
        projectId: 'p1',
        file: { type: 'image/webp', size: 42 },
      })

      expect(client.space.storage.upload).toHaveBeenCalledWith(
        'space-1',
        'projects/p1/assets/uuid-1.webp',
        { file: { type: 'image/webp', size: 42 } }
      )
      expect(result).toEqual({
        path: 'projects/p1/assets/uuid-1.png',
        uploadRequest: { method: 'PUT', url: 'https://put', headers: {} },
      })
    })
  })

  describe('getAssetUrls', () => {
    it('signs the requested paths', async () => {
      buildAssetUrls.mockResolvedValue({ 'a.png': 'https://get/a.png' })

      const result = await getAssetUrls({ projectId: 'p1', paths: ['a.png'] })

      expect(buildAssetUrls).toHaveBeenCalledWith(client, 'space-1', ['a.png'])
      expect(result).toEqual({ assetUrls: { 'a.png': 'https://get/a.png' } })
    })
  })
})

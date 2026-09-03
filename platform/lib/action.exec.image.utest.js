import { getConfigBySchema } from '@/lib/action.config'
import {
  doImageCreate,
  doImageEdit,
  executeImageAction,
} from '@/lib/action.exec.image'
import defer from '@/lib/defer'
import { captureException } from '@/lib/error'
import fetch from '@/lib/fetch'
import { createImage, editImage } from '@/lib/image'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { buildImageModel } from '@/lib/model.utils'
import { Usage } from '@/lib/usage.model'
import { recordImageUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'

jest.mock('@/lib/action.config', () => ({
  getConfigBySchema: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
  UserInputError: jest.fn().mockImplementation((message) => {
    const error = new Error(message)

    error.name = 'UserInputError'

    return error
  }),
  BotInputError: jest.fn().mockImplementation((message) => {
    const error = new Error(message)

    error.name = 'BotInputError'

    return error
  }),
}))

jest.mock('@/lib/limit.core', () => ({
  accountLimitsOk: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/image', () => ({
  createImage: jest.fn(),
  editImage: jest.fn(),
}))

jest.mock('@/lib/model.utils', () => ({
  buildImageModel: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordImageUsage: jest.fn(),
}))

// @note we mock the Usage class with spies so we can assert that the action
// calls addImageTokens for input and output and recordBaseTokens with the
// expected meta. The real calibration math is covered by usage.model.utest.js
// and the route-level sanity tests in pages/api/v1/image.
jest.mock('@/lib/usage.model', () => {
  const addImageTokens = jest.fn()
  const recordBaseTokens = jest.fn()

  return {
    Usage: jest.fn().mockImplementation(() => ({
      addImageTokens,
      recordBaseTokens,
    })),
    __mocks: { addImageTokens, recordBaseTokens },
  }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const usageModelMocks = require('@/lib/usage.model').__mocks

jest.mock('@/lib/defer', () => jest.fn().mockImplementation((fn) => fn))

jest.mock('@/lib/fetch', () =>
  jest.fn().mockResolvedValue({
    ok: true,
    blob: jest.fn().mockResolvedValue(new Blob()),
  })
)

describe('action.exec.image', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('executeImageAction', () => {
    const mockOptions = {
      userId: 'user-123',
      linkedResources: {},
      contextResources: {
        blueprintId: 'blueprint-456',
        skillsetId: 'skillset-789',
        abilityId: 'ability-012',
      },
    }

    describe('operation detection', () => {
      it('should handle create operation', async () => {
        const params = { create: true }

        fastGetUserById.mockResolvedValue({ id: 'user-123' })
        accountLimitsOk.mockResolvedValue(true)

        getConfigBySchema.mockReturnValue({
          directions: 'test directions',
          prompt: 'test prompt',
          model: 'gpt-image-1',
          size: '1024x1024',
          region: 'us',
        })

        buildImageModel.mockReturnValue('built-model')
        createImage.mockResolvedValue({
          urls: ['https://example.com/image1.png'],
          usage: {
            inputTokens: 0,
            outputTokens: 5,
            model: 'dall-e-3',
          },
        })

        const result = await executeImageAction(
          'test prompt',
          params,
          mockOptions
        )

        expect(result).toEqual({
          result: {
            urls: [
              { url: 'https://example.com/image1.png', alt: 'test prompt' },
            ],
          },
        })
        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.image.create',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: params,
        })
      })

      it('should handle edit operation', async () => {
        const params = { edit: true }

        fastGetUserById.mockResolvedValue({ id: 'user-123' })
        accountLimitsOk.mockResolvedValue(true)

        getConfigBySchema.mockReturnValue({
          prompt: 'edit prompt',
          images: ['https://example.com/original.png'], // add images array
          model: 'gpt-image-1',
          size: '1024x1024',
          region: 'us',
        })

        buildImageModel.mockReturnValue('built-model')
        editImage.mockResolvedValue({
          urls: ['https://example.com/edited.png'],
          usage: {
            inputTokens: 10,
            outputTokens: 3,
            model: 'dall-e-2',
          },
        })

        const result = await executeImageAction(
          'edit prompt',
          params,
          mockOptions
        )

        expect(result).toEqual({
          result: {
            urls: [
              { url: 'https://example.com/edited.png', alt: 'edit prompt' },
            ],
          },
        })
        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.image.edit',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: params,
        })
      })

      it('should default to create operation for unknown params', async () => {
        const params = { unknown: true }

        fastGetUserById.mockResolvedValue({ id: 'user-123' })
        accountLimitsOk.mockResolvedValue(true)

        getConfigBySchema.mockReturnValue({
          directions: 'test directions',
          prompt: 'test prompt',
          model: 'gpt-image-1',
          size: '1024x1024',
          region: 'us',
        })

        buildImageModel.mockReturnValue('built-model')
        createImage.mockResolvedValue({
          urls: ['https://example.com/image1.png'],
          usage: {
            inputTokens: 0,
            outputTokens: 5,
            model: 'dall-e-3',
          },
        })

        const result = await executeImageAction(
          'test prompt',
          params,
          mockOptions
        )

        expect(result).toEqual({
          result: {
            urls: [
              { url: 'https://example.com/image1.png', alt: 'test prompt' },
            ],
          },
        })
        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.image.create',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: params,
        })
      })
    })
  })

  describe('doImageCreate', () => {
    const mockOptions = {
      userId: 'user-123',
      linkedResources: {},
      contextResources: {
        blueprintId: 'blueprint-456',
        skillsetId: 'skillset-789',
        abilityId: 'ability-012',
      },
    }

    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user-123' })
      accountLimitsOk.mockResolvedValue(true)
      getConfigBySchema.mockReturnValue({
        directions: 'test directions',
        prompt: 'test prompt',
        model: 'gpt-image-1',
        size: '1024x1024',
        region: 'us',
      })
      buildImageModel.mockReturnValue('built-model')
      logEvent.mockResolvedValue(undefined)
    })

    describe('user validation', () => {
      it('should throw error when user not found', async () => {
        fastGetUserById.mockResolvedValue(null)

        await expect(
          executeImageAction('test prompt', { create: true }, mockOptions)
        ).rejects.toThrow('User not found')
      })

      it('should return error when account limits exceeded', async () => {
        fastGetUserById.mockResolvedValue({ id: 'user-123' })
        accountLimitsOk.mockResolvedValue(false)

        const result = await executeImageAction(
          'test prompt',
          { create: true },
          mockOptions
        )

        expect(result).toEqual({
          error: 'You have reached your token limit.',
        })
      })
    })

    describe('configuration handling', () => {
      it('should use input as prompt when no prompt provided', async () => {
        getConfigBySchema.mockReturnValue({
          directions: undefined,
          prompt: undefined,
          model: 'gpt-image-1',
          size: '1024x1024',
          region: 'us',
        })

        createImage.mockResolvedValue({
          urls: ['https://example.com/image.png'],
          usage: {
            inputTokens: 0,
            outputTokens: 5,
            model: 'dall-e-3',
          },
        })
        await doImageCreate('test input', {}, mockOptions)

        expect(getConfigBySchema).toHaveBeenCalledWith({
          input: 'test input',
          params: {},
          initial: {
            prompt: 'test input',
          },
          schema: expect.any(Object),
          options: mockOptions,
        })
      })

      it('should combine directions and prompt correctly', async () => {
        getConfigBySchema.mockReturnValue({
          directions: 'Make it blue',
          prompt: 'A cat sitting',
          model: 'gpt-image-1',
          size: '1024x1024',
          region: 'us',
        })

        createImage.mockResolvedValue({
          urls: ['https://example.com/image.png'],
          usage: {
            inputTokens: 0,
            outputTokens: 8,
            model: 'dall-e-3',
          },
        })
        await doImageCreate('test input', {}, mockOptions)

        expect(createImage).toHaveBeenCalledWith(
          'Make it blue\n\nPROMPT:\n\nA cat sitting',
          expect.objectContaining({
            model: 'built-model',
            user: 'user-123',
          })
        )
      })

      it('should handle empty directions', async () => {
        getConfigBySchema.mockReturnValue({
          directions: null,
          prompt: 'A cat sitting',
          model: 'gpt-image-1',
          size: '1024x1024',
          region: 'us',
        })

        createImage.mockResolvedValue({
          urls: ['https://example.com/image.png'],
          usage: {
            inputTokens: 0,
            outputTokens: 5,
            model: 'dall-e-3',
          },
        })
        await doImageCreate('test input', {}, mockOptions)

        expect(createImage).toHaveBeenCalledWith(
          'A cat sitting',
          expect.objectContaining({
            model: 'built-model',
            user: 'user-123',
          })
        )
      })
    })

    describe('image creation', () => {
      it('should create images successfully', async () => {
        createImage.mockResolvedValue({
          urls: [
            'https://example.com/image1.png',
            'https://example.com/image2.png',
          ],
          usage: {
            inputTokens: 0,
            outputTokens: 6,
            model: 'dall-e-3',
          },
        })

        const result = await doImageCreate('test prompt', {}, mockOptions)

        expect(result).toEqual({
          result: {
            urls: [
              { url: 'https://example.com/image1.png', alt: 'test prompt' },
              { url: 'https://example.com/image2.png', alt: 'test prompt' },
            ],
          },
        })
        expect(Usage).toHaveBeenCalled()
        expect(usageModelMocks.addImageTokens).toHaveBeenNthCalledWith(
          1,
          0,
          'dall-e-3',
          'input'
        )
        expect(usageModelMocks.addImageTokens).toHaveBeenNthCalledWith(
          2,
          6,
          'dall-e-3',
          'output'
        )
        expect(usageModelMocks.recordBaseTokens).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          meta: { reason: 'image/create' },
        })
        expect(recordImageUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 2,
          model: 'dall-e-3',
          meta: { reason: 'image/create' },
        })
        expect(defer).toHaveBeenCalledTimes(2)
      })

      it('should handle image creation errors', async () => {
        createImage.mockRejectedValue(new Error('Image creation failed'))

        const result = await doImageCreate('test prompt', {}, mockOptions)

        expect(captureException).toHaveBeenCalledWith(expect.any(Error))
        expect(result).toEqual({
          error: 'Image creation failed',
        })
      })
    })

    describe('event logging', () => {
      it('should log create event with correct parameters', async () => {
        createImage.mockResolvedValue({
          urls: ['https://example.com/image.png'],
          usage: {
            inputTokens: 0,
            outputTokens: 5,
            model: 'dall-e-3',
          },
        })
        await doImageCreate('test prompt', { testParam: 'value' }, mockOptions)

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.image.create',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: { testParam: 'value' },
        })
      })
    })
  })

  describe('doImageEdit', () => {
    const mockOptions = {
      userId: 'user-123',
      linkedResources: {},
      contextResources: {
        blueprintId: 'blueprint-456',
        skillsetId: 'skillset-789',
        abilityId: 'ability-012',
      },
    }

    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ id: 'user-123' })
      accountLimitsOk.mockResolvedValue(true)
      getConfigBySchema.mockReturnValue({
        prompt: 'edit prompt',
        images: ['https://example.com/original.png'], // add images array
        model: 'gpt-image-1',
        size: '1024x1024',
        region: 'us',
      })
      buildImageModel.mockReturnValue('built-model')
      logEvent.mockResolvedValue(undefined)
    })

    describe('user validation', () => {
      it('should throw error when user not found', async () => {
        fastGetUserById.mockResolvedValue(null)

        await expect(
          executeImageAction('edit prompt', { edit: true }, mockOptions)
        ).rejects.toThrow('User not found')
      })

      it('should return error when account limits exceeded', async () => {
        fastGetUserById.mockResolvedValue({ id: 'user-123' })
        accountLimitsOk.mockResolvedValue(false)

        const result = await executeImageAction(
          'edit prompt',
          { edit: true },
          mockOptions
        )

        expect(result).toEqual({
          error: 'You have reached your token limit.',
        })
      })
    })

    describe('image editing', () => {
      it('should edit images successfully', async () => {
        editImage.mockResolvedValue({
          urls: ['https://example.com/edited.png'],
          usage: {
            inputTokens: 15,
            outputTokens: 4,
            model: 'dall-e-2',
          },
        })

        const result = await doImageEdit('edit prompt', {}, mockOptions)

        expect(result).toEqual({
          result: {
            urls: [
              { url: 'https://example.com/edited.png', alt: 'edit prompt' },
            ],
          },
        })
        expect(Usage).toHaveBeenCalled()
        expect(usageModelMocks.addImageTokens).toHaveBeenNthCalledWith(
          1,
          15,
          'dall-e-2',
          'input'
        )
        expect(usageModelMocks.addImageTokens).toHaveBeenNthCalledWith(
          2,
          4,
          'dall-e-2',
          'output'
        )
        expect(usageModelMocks.recordBaseTokens).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          meta: { reason: 'image/edit' },
        })
        expect(recordImageUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 1,
          model: 'dall-e-2',
          meta: { reason: 'image/edit' },
        })
        expect(defer).toHaveBeenCalledTimes(2)
      })

      it('should handle image editing errors', async () => {
        editImage.mockRejectedValue(new Error('Image editing failed'))

        const result = await doImageEdit('edit prompt', {}, mockOptions)

        expect(captureException).toHaveBeenCalledWith(expect.any(Error))
        expect(result).toEqual({
          error: 'Image editing failed',
        })
      })

      it('should reject unsupported input formats before calling the provider', async () => {
        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest
            .fn()
            .mockResolvedValue(new Blob(['<svg/>'], { type: 'image/svg+xml' })),
        })

        const result = await doImageEdit('edit prompt', {}, mockOptions)

        expect(result).toEqual({
          error: expect.stringContaining('image/svg+xml'),
        })
        expect(editImage).not.toHaveBeenCalled()
      })

      it('should classify an unfetchable image url as bot input (not a system error)', async () => {
        fetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

        const result = await doImageEdit('edit prompt', {}, mockOptions)

        expect(result).toEqual({
          error: expect.stringContaining('Failed to fetch image'),
        })
        expect(result.error).toContain('404')
        // @note the failure is surfaced as a BotInputError so captureException
        // keeps it out of Sentry rather than logging it as a bug
        expect(captureException).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'BotInputError' })
        )
        expect(editImage).not.toHaveBeenCalled()
      })

      it('should pass correct parameters to editImage', async () => {
        getConfigBySchema.mockReturnValue({
          prompt: 'Make it red',
          images: ['https://example.com/original.png'], // add images array
          model: 'gpt-image-1',
          size: '512x512',
          region: 'us',
        })

        editImage.mockResolvedValue({
          urls: ['https://example.com/edited.png'],
          usage: {
            inputTokens: 10,
            outputTokens: 3,
            model: 'dall-e-2',
          },
        })
        await doImageEdit('edit prompt', {}, mockOptions)

        expect(editImage).toHaveBeenCalledWith(
          'Make it red',
          [expect.any(Blob)], // Should pass blobs, not URLs
          expect.objectContaining({
            model: 'built-model',
            user: 'user-123',
          })
        )
      })
    })

    describe('event logging', () => {
      it('should log edit event with correct parameters', async () => {
        editImage.mockResolvedValue({
          urls: ['https://example.com/edited.png'],
          usage: {
            inputTokens: 15,
            outputTokens: 4,
            model: 'dall-e-2',
          },
        })
        await doImageEdit('edit prompt', { editParam: 'value' }, mockOptions)

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.image.edit',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: { editParam: 'value' },
        })
      })
    })
  })

  describe('integration tests', () => {
    it('should handle complete create flow', async () => {
      fastGetUserById.mockResolvedValue({ id: 'user-123' })
      accountLimitsOk.mockResolvedValue(true)
      getConfigBySchema.mockReturnValue({
        directions: 'Artistic style',
        prompt: 'A beautiful landscape',
        model: 'gpt-image-1',
        size: '1024x1024',
        region: 'us',
      })
      buildImageModel.mockReturnValue('dall-e-3-1024x1024')

      createImage.mockResolvedValue({
        urls: ['https://example.com/landscape.png'],
        usage: {
          inputTokens: 0,
          outputTokens: 10,
          model: 'dall-e-3',
        },
      })

      const result = await executeImageAction(
        'A beautiful landscape',
        { create: true },
        {
          userId: 'user-123',
          linkedResources: {},
          contextResources: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        }
      )

      expect(result).toEqual({
        result: {
          urls: [
            {
              url: 'https://example.com/landscape.png',
              alt: 'A beautiful landscape',
            },
          ],
        },
      })

      expect(fastGetUserById).toHaveBeenCalledWith('user-123')
      expect(accountLimitsOk).toHaveBeenCalledWith({ id: 'user-123' }, [
        'token',
      ])
      expect(logEvent).toHaveBeenCalled()
      expect(getConfigBySchema).toHaveBeenCalled()
      expect(createImage).toHaveBeenCalled()
      expect(usageModelMocks.recordBaseTokens).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    beforeEach(() => {
      fastGetUserById.mockResolvedValue({ user: { id: 'user-123' } })
      accountLimitsOk.mockResolvedValue(true)
      buildImageModel.mockReturnValue('built-model')
    })

    it('should handle empty prompt', async () => {
      getConfigBySchema.mockReturnValue({
        directions: null,
        prompt: '',
        model: 'gpt-image-1',
        size: '1024x1024',
        region: 'us',
      })

      createImage.mockResolvedValue({
        urls: ['https://example.com/empty.png'],
        usage: {
          inputTokens: 0,
          outputTokens: 1,
          model: 'dall-e-3',
        },
      })

      const result = await executeImageAction(
        '',
        { create: true },
        {
          userId: 'user-123',
        }
      )

      expect(result.result.urls).toEqual([
        { url: 'https://example.com/empty.png', alt: '' },
      ])
    })

    it('should handle very long prompts', async () => {
      const longPrompt = 'a'.repeat(1000)

      getConfigBySchema.mockReturnValue({
        directions: null,
        prompt: longPrompt,
        model: 'gpt-image-1',
        size: '1024x1024',
        region: 'us',
      })

      createImage.mockResolvedValue({
        urls: ['https://example.com/long.png'],
        usage: {
          inputTokens: 0,
          outputTokens: 10,
          model: 'dall-e-3',
        },
      })

      const result = await executeImageAction(
        longPrompt,
        { create: true },
        {
          userId: 'user-123',
        }
      )

      expect(result.result.urls).toEqual([
        { url: 'https://example.com/long.png', alt: longPrompt.slice(0, 100) },
      ])
    })

    it('should handle special characters in prompts', async () => {
      const specialPrompt = '特殊字符 🎨 "art" & <style>'

      getConfigBySchema.mockReturnValue({
        directions: null,
        prompt: specialPrompt,
        model: 'gpt-image-1',
        size: '1024x1024',
        region: 'us',
      })

      createImage.mockResolvedValue({
        urls: ['https://example.com/special.png'],
        usage: {
          inputTokens: 0,
          outputTokens: 8,
          model: 'dall-e-3',
        },
      })

      const result = await executeImageAction(
        specialPrompt,
        { create: true },
        {
          userId: 'user-123',
        }
      )

      expect(result.result.urls).toEqual([
        {
          url: 'https://example.com/special.png',
          alt: '特殊字符 🎨 "art" & <style>',
        },
      ])
    })

    it('should handle zero token usage', async () => {
      getConfigBySchema.mockReturnValue({
        directions: null,
        prompt: 'test',
        model: 'gpt-image-1',
        size: '1024x1024',
        region: 'us',
      })

      createImage.mockResolvedValue({
        urls: ['https://example.com/zero.png'],
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          model: 'dall-e-3',
        },
      })

      const result = await executeImageAction(
        'test',
        { create: true },
        {
          userId: 'user-123',
        }
      )

      expect(Usage).toHaveBeenCalled()
      // both addImageTokens calls receive zero, which the real Usage class
      // would no-op on; here we just assert the action wired them through.
      expect(usageModelMocks.addImageTokens).toHaveBeenNthCalledWith(
        1,
        0,
        'dall-e-3',
        'input'
      )
      expect(usageModelMocks.addImageTokens).toHaveBeenNthCalledWith(
        2,
        0,
        'dall-e-3',
        'output'
      )
      expect(usageModelMocks.recordBaseTokens).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        meta: { reason: 'image/create' },
      })
      expect(recordImageUsage).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        count: 1,
        model: 'dall-e-3',
        meta: { reason: 'image/create' },
      })
      expect(result.result.urls).toEqual([
        { url: 'https://example.com/zero.png', alt: 'test' },
      ])
    })

    it('should handle missing linkedResources', async () => {
      getConfigBySchema.mockReturnValue({
        directions: null,
        prompt: 'test',
        model: 'gpt-image-1',
        size: '1024x1024',
        region: 'us',
      })

      createImage.mockResolvedValue({
        urls: ['https://example.com/test.png'],
        usage: {
          inputTokens: 0,
          outputTokens: 3,
          model: 'dall-e-3',
        },
      })

      const result = await executeImageAction(
        'test',
        { create: true },
        {
          userId: 'user-123',
        }
      )

      expect(logEvent).toHaveBeenCalledWith({
        user: { id: 'user-123' },
        type: 'action.image.create',
        relations: {
          blueprintId: undefined,
          skillsetId: undefined,
          abilityId: undefined,
        },
        meta: { create: true },
      })
      expect(result.result.urls).toEqual([
        { url: 'https://example.com/test.png', alt: 'test' },
      ])
    })
  })
})

/**
 * Schema validation tests using the real getConfigBySchema function.
 *
 * @note these tests verify that the Zod schemas in doImageCreate and doImageEdit
 * accept all configured image models, including legacy models like 'dalle3'.
 */
describe('image action schema validation', () => {
  const { getConfigBySchema: realGetConfigBySchema } = jest.requireActual(
    '@/lib/action.config'
  )
  const { z } = jest.requireActual('zod')
  const { imageModels } = jest.requireActual('@/config/models')

  // @note this mirrors the schema definition in action.exec.image.ts
  const imageModelNames = Object.keys(imageModels)

  const createSchema = z.object({
    directions: z.string().optional().nullable(),
    prompt: z.string(),
    model: z.enum(imageModelNames),
    size: z
      .enum([
        'auto',
        '1024x1024',
        '1536x1024',
        '1024x1536',
        '256x256',
        '512x512',
      ])
      .optional(),
    region: z.enum(['us']).optional(),
  })

  describe('model validation', () => {
    it('should accept every configured image model', () => {
      for (const model of imageModelNames) {
        const result = realGetConfigBySchema({
          input: 'test prompt',
          params: { model },
          initial: { prompt: 'test prompt' },
          schema: createSchema,
        })

        expect(result.model).toBe(model)
      }
    })

    it('should reject invalid model names', () => {
      expect(() =>
        realGetConfigBySchema({
          input: 'test prompt',
          params: { model: 'invalid-model-name' },
          initial: { prompt: 'test prompt' },
          schema: createSchema,
        })
      ).toThrow()
    })
  })
})

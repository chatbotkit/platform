import { defaultLanguageModel } from '@/config/models'

import { executeViewAction } from '@/lib/action.exec.view'
import defer from '@/lib/defer'
import fetch from '@/lib/fetch'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { createAnnotationResponse } from '@/lib/model.provider.openai'
import { recordLanguageTokenUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'

jest.mock('@/config/models', () => ({
  ...jest.requireActual('@/config/models'),
  defaultLanguageModel:
    'custom/name=test-view/provider=openai/credentials=sk-test',
}))

jest.mock('@/lib/limit.core', () => ({
  accountLimitsOk: jest.fn(),
}))

jest.mock('@/lib/log', () => ({
  logEvent: jest.fn(),
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createAnnotationResponse: jest.fn(),
}))

jest.mock('@/lib/usage.record', () => ({
  recordLanguageTokenUsage: jest.fn(),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/defer', () => jest.fn().mockImplementation((fn) => fn))

jest.mock('@/lib/fetch', () => jest.fn())

describe('action.exec.view', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('executeViewAction', () => {
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
      logEvent.mockResolvedValue(undefined)
    })

    describe('user validation', () => {
      it('should throw error when user not found', async () => {
        fastGetUserById.mockResolvedValue(null)

        await expect(
          executeViewAction('https://example.com/image.png', {}, mockOptions)
        ).rejects.toThrow('User not found')
      })

      it('should return error when account limits exceeded', async () => {
        accountLimitsOk.mockResolvedValue(false)

        const result = await executeViewAction(
          'https://example.com/image.png',
          {},
          mockOptions
        )

        expect(result).toEqual({
          error: 'You have reached your token limit.',
        })
      })
    })

    describe('URL processing', () => {
      it('should process single image URL', async () => {
        const imageUrl = 'https://example.com/image.png'
        const mockBlob = new Blob(['fake image data'], { type: 'image/png' })
        const mockResponse = {
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        }

        fetch.mockResolvedValueOnce(mockResponse)

        createAnnotationResponse.mockResolvedValueOnce({
          text: 'This is a test image description',
          usage: {
            totalTokens: 150,
          },
        })

        const result = await executeViewAction(imageUrl, {}, mockOptions)

        expect(result).toEqual({
          result: ['This is a test image description'],
        })

        expect(fetch).toHaveBeenCalledWith(imageUrl, undefined)
        expect(createAnnotationResponse).toHaveBeenCalledWith({
          image: mockBlob,
          instructions: undefined,
          model: defaultLanguageModel,
          user: 'user-123',
        })
        expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: expect.any(Number),
          model: 'base',
          meta: {
            reason: 'action/view',
            lineItems: expect.arrayContaining([
              expect.objectContaining({
                tokens: 150,
                model: 'custom',
                type: 'default',
                debit: expect.any(Number),
                ratio: expect.any(Number),
              }),
            ]),
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })

      it('should process multiple image URLs', async () => {
        const input =
          'https://example.com/image1.png and https://example.com/image2.jpg'
        const mockBlob1 = new Blob(['fake image data 1'], { type: 'image/png' })
        const mockBlob2 = new Blob(['fake image data 2'], {
          type: 'image/jpeg',
        })

        fetch
          .mockResolvedValueOnce({
            ok: true,
            blob: jest.fn().mockResolvedValue(mockBlob1),
          })
          .mockResolvedValueOnce({
            ok: true,
            blob: jest.fn().mockResolvedValue(mockBlob2),
          })

        createAnnotationResponse
          .mockResolvedValueOnce({
            text: 'Description of first image',
            usage: { totalTokens: 100 },
          })
          .mockResolvedValueOnce({
            text: 'Description of second image',
            usage: { totalTokens: 120 },
          })

        const result = await executeViewAction(input, {}, mockOptions)

        expect(result).toEqual({
          result: [
            'Description of first image',
            'and',
            'Description of second image',
          ],
        })

        expect(fetch).toHaveBeenCalledTimes(2)
        expect(createAnnotationResponse).toHaveBeenCalledTimes(2)
        expect(recordLanguageTokenUsage).toHaveBeenCalledTimes(2)
      })

      it('should handle mixed text and URLs', async () => {
        const input =
          'Look at this image: https://example.com/image.png and tell me what you see.'
        const mockBlob = new Blob(['fake image data'], { type: 'image/png' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createAnnotationResponse.mockResolvedValueOnce({
          text: 'A beautiful landscape',
          usage: { totalTokens: 80 },
        })

        const result = await executeViewAction(input, {}, mockOptions)

        expect(result).toEqual({
          result: [
            'Look at this image:',
            'A beautiful landscape',
            'and tell me what you see.',
          ],
        })

        expect(fetch).toHaveBeenCalledWith(
          'https://example.com/image.png',
          undefined
        )
      })

      it('should preserve non-URL text parts', async () => {
        const input = 'This is just text with no URLs.'

        const result = await executeViewAction(input, {}, mockOptions)

        expect(result).toEqual({
          result: ['This is just text with no URLs.'],
        })

        expect(fetch).not.toHaveBeenCalled()
        expect(createAnnotationResponse).not.toHaveBeenCalled()
      })

      it('should handle empty input', async () => {
        const result = await executeViewAction('', {}, mockOptions)

        expect(result).toEqual({
          result: [],
        })

        expect(fetch).not.toHaveBeenCalled()
        expect(createAnnotationResponse).not.toHaveBeenCalled()
      })
    })

    describe('parameter handling', () => {
      it('should pass instructions parameter', async () => {
        const imageUrl = 'https://example.com/image.png'
        const params = { instructions: 'Describe the colors in this image' }

        const mockBlob = new Blob(['fake image data'], { type: 'image/png' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createAnnotationResponse.mockResolvedValueOnce({
          text: 'The image contains red, blue, and green colors',
          usage: { totalTokens: 120 },
        })

        await executeViewAction(imageUrl, params, mockOptions)

        expect(createAnnotationResponse).toHaveBeenCalledWith({
          image: mockBlob,
          instructions: 'Describe the colors in this image',
          model: defaultLanguageModel,
          user: 'user-123',
        })
      })

      it('should handle instruction parameter (singular)', async () => {
        const imageUrl = 'https://example.com/image.png'
        const params = { instruction: 'Count the objects' }

        const mockBlob = new Blob(['fake image data'], { type: 'image/png' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createAnnotationResponse.mockResolvedValueOnce({
          text: 'There are 3 objects in the image',
          usage: { totalTokens: 90 },
        })

        await executeViewAction(imageUrl, params, mockOptions)

        expect(createAnnotationResponse).toHaveBeenCalledWith({
          image: mockBlob,
          instructions: 'Count the objects',
          model: defaultLanguageModel,
          user: 'user-123',
        })
      })

      it('should prioritize instructions over other parameters', async () => {
        const imageUrl = 'https://example.com/image.png'
        const params = {
          instructions: 'Primary instruction',
          instruction: 'Secondary instruction',
          directions: 'Tertiary direction',
          direction: 'Quaternary direction',
        }

        const mockBlob = new Blob(['fake image data'], { type: 'image/png' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createAnnotationResponse.mockResolvedValueOnce({
          text: 'Following primary instruction',
          usage: { totalTokens: 100 },
        })

        await executeViewAction(imageUrl, params, mockOptions)

        expect(createAnnotationResponse).toHaveBeenCalledWith({
          image: mockBlob,
          instructions: 'Primary instruction',
          model: defaultLanguageModel,
          user: 'user-123',
        })
      })
    })

    describe('error handling', () => {
      it('should handle fetch errors gracefully', async () => {
        const imageUrl = 'https://example.com/broken-image.png'

        fetch.mockRejectedValueOnce(new Error('Network error'))

        const result = await executeViewAction(imageUrl, {}, mockOptions)

        expect(result).toEqual({
          result: [], // URL part is skipped due to error
        })

        expect(fetch).toHaveBeenCalledWith(imageUrl, undefined)
        expect(createAnnotationResponse).not.toHaveBeenCalled()
      })

      it('should handle blob conversion errors', async () => {
        const imageUrl = 'https://example.com/image.png'

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest
            .fn()
            .mockRejectedValue(new Error('Blob conversion failed')),
        })

        const result = await executeViewAction(imageUrl, {}, mockOptions)

        expect(result).toEqual({
          result: [], // URL part is skipped due to error
        })

        expect(createAnnotationResponse).not.toHaveBeenCalled()
      })

      it('should handle non-ok response status', async () => {
        const imageUrl = 'https://example.com/404-image.png'

        fetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        })

        const result = await executeViewAction(imageUrl, {}, mockOptions)

        expect(result).toEqual({
          result: [], // URL part is skipped due to non-ok status
        })

        expect(createAnnotationResponse).not.toHaveBeenCalled()
      })

      it('should continue processing other URLs when one fails', async () => {
        const input =
          'https://example.com/broken.png and https://example.com/working.png'

        fetch
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({
            ok: true,
            blob: jest
              .fn()
              .mockResolvedValue(
                new Blob(['working image'], { type: 'image/png' })
              ),
          })

        createAnnotationResponse.mockResolvedValueOnce({
          text: 'Working image description',
          usage: { totalTokens: 80 },
        })

        const result = await executeViewAction(input, {}, mockOptions)

        expect(result).toEqual({
          result: ['and', 'Working image description'],
        })

        expect(fetch).toHaveBeenCalledTimes(2)
        expect(createAnnotationResponse).toHaveBeenCalledTimes(1)
      })
    })

    describe('event logging', () => {
      it('should log view event with correct parameters', async () => {
        const params = { testParam: 'value' }

        await executeViewAction('Just text', params, mockOptions)

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.view',
          relations: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
          meta: params,
        })
      })

      it('should handle missing linkedResources gracefully', async () => {
        const optionsWithoutResources = { userId: 'user-123' }
        const params = { testParam: 'value' }

        await executeViewAction('Just text', params, optionsWithoutResources)

        expect(logEvent).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          type: 'action.view',
          relations: {
            blueprintId: undefined,
            skillsetId: undefined,
            abilityId: undefined,
          },
          meta: params,
        })
      })
    })

    describe('defer usage', () => {
      it('should defer token usage recording', async () => {
        const imageUrl = 'https://example.com/image.png'

        const mockBlob = new Blob(['fake image data'], { type: 'image/png' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createAnnotationResponse.mockResolvedValueOnce({
          text: 'Image description',
          usage: { totalTokens: 200 },
        })

        await executeViewAction(imageUrl, {}, mockOptions)

        expect(defer).toHaveBeenCalled()
        expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: expect.any(Number),
          model: 'base',
          meta: {
            reason: 'action/view',
            lineItems: expect.arrayContaining([
              expect.objectContaining({
                tokens: 200,
                model: 'custom',
                type: 'default',
                debit: expect.any(Number),
                ratio: expect.any(Number),
              }),
            ]),
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })
    })

    describe('integration tests', () => {
      it('should handle complete view flow', async () => {
        const mockBlob = new Blob(['image data'], { type: 'image/png' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createAnnotationResponse.mockResolvedValueOnce({
          text: 'A detailed image analysis',
          usage: { totalTokens: 150 },
        })

        const result = await executeViewAction(
          'Analyze this image: https://example.com/test.png',
          { instructions: 'Be detailed' },
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
          result: ['Analyze this image:', 'A detailed image analysis'],
        })

        expect(fastGetUserById).toHaveBeenCalledWith('user-123')
        expect(accountLimitsOk).toHaveBeenCalledWith({ id: 'user-123' }, [
          'token',
        ])
        expect(logEvent).toHaveBeenCalled()
        expect(fetch).toHaveBeenCalledWith(
          'https://example.com/test.png',
          undefined
        )
        expect(createAnnotationResponse).toHaveBeenCalledWith({
          image: mockBlob,
          instructions: 'Be detailed',
          model: defaultLanguageModel,
          user: 'user-123',
        })
        expect(defer).toHaveBeenCalled()
        expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: expect.any(Number),
          model: 'base',
          meta: {
            reason: 'action/view',
            lineItems: expect.arrayContaining([
              expect.objectContaining({
                tokens: 150,
                model: 'custom',
                type: 'default',
                debit: expect.any(Number),
                ratio: expect.any(Number),
              }),
            ]),
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
      })
    })

    describe('edge cases', () => {
      it('should handle zero token usage', async () => {
        const imageUrl = 'https://example.com/image.png'

        const mockBlob = new Blob(['no tokens'], { type: 'image/png' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createAnnotationResponse.mockResolvedValueOnce({
          text: 'No token description',
          usage: { totalTokens: 0 },
        })

        const result = await executeViewAction(imageUrl, {}, mockOptions)

        expect(recordLanguageTokenUsage).toHaveBeenCalledWith({
          user: { id: 'user-123' },
          count: 0,
          model: 'base',
          meta: {
            reason: 'action/view',
            lineItems: [], // Empty array when tokens are 0
          },
          references: {
            blueprintId: 'blueprint-456',
            skillsetId: 'skillset-789',
            abilityId: 'ability-012',
          },
        })
        expect(result.result).toEqual(['No token description'])
      })

      it('should handle URLs with query parameters', async () => {
        const imageUrl =
          'https://example.com/image.png?width=500&height=300&format=png'

        const mockBlob = new Blob(['query image'], { type: 'image/png' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createAnnotationResponse.mockResolvedValueOnce({
          text: 'Parameterized image description',
          usage: { totalTokens: 110 },
        })

        const result = await executeViewAction(imageUrl, {}, mockOptions)

        expect(result).toEqual({
          result: ['Parameterized image description'],
        })

        expect(fetch).toHaveBeenCalledWith(imageUrl, undefined)
      })

      it('should handle special characters in non-URL text', async () => {
        const input =
          '特殊字符 🖼️ "image" & <view> this: https://example.com/image.png'

        const mockBlob = new Blob(['special chars'], { type: 'image/png' })

        fetch.mockResolvedValueOnce({
          ok: true,
          blob: jest.fn().mockResolvedValue(mockBlob),
        })

        createAnnotationResponse.mockResolvedValueOnce({
          text: 'Special characters image',
          usage: { totalTokens: 75 },
        })

        const result = await executeViewAction(input, {}, mockOptions)

        expect(result).toEqual({
          result: [
            '特殊字符 🖼️ "image" & <view> this:',
            'Special characters image',
          ],
        })
      })
    })
  })
})

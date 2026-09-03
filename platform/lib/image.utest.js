/* eslint-disable @typescript-eslint/no-require-imports */
import {
  createImage,
  editImage,
  proxyImageURL,
  retrieveImage,
  storeImageURL,
} from './image'

jest.mock('@/lib/storage', () => ({
  getObject: jest.fn(),
  putObject: jest.fn(),
}))

jest.mock('@/lib/model.provider.openai', () => ({
  createImage: jest.fn(),
  editImage: jest.fn(),
}))

jest.mock('@/lib/model.provider.openrouter', () => ({
  createImage: jest.fn(),
  editImage: jest.fn(),
}))

jest.mock('@/lib/model.utils', () => ({
  parseAndRevealImageModel: jest.fn(),
}))

jest.mock('@/lib/host', () => ({
  getExternalHostURL: jest.fn(() => 'https://example.com'),
}))

jest.mock('@/lib/fetch', () => {
  const fetch = jest.fn()

  return Object.assign(fetch, {
    default: fetch,
    fetch,
    withRetry: jest.requireActual('@/lib/fetch').withRetry,
    withTimeout: jest.requireActual('@/lib/fetch').withTimeout,
    withBodyTimeout: jest.requireActual('@/lib/fetch').withBodyTimeout,
  })
})

jest.mock('uuid', () => ({
  v1: jest.fn(() => 'test-uuid-123'),
}))

beforeEach(() => {
  require('@/lib/storage').putObject.mockResolvedValue(undefined)
})

describe('storeImageURL', () => {
  let putObject
  let fetch

  beforeEach(() => {
    jest.clearAllMocks()

    putObject = require('@/lib/storage').putObject
    fetch = require('@/lib/fetch')
  })

  it('should download and upload an external image to the image bucket', async () => {
    const url = 'https://example.com/image.png'
    const body = new Uint8Array([1, 2, 3])

    fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(body.buffer),
      headers: {
        get: jest.fn(() => 'image/png'),
      },
    })

    const imageId = await storeImageURL(url)

    expect(imageId).toBe('test-uuid-123')
    expect(fetch).toHaveBeenCalledWith(url, undefined)
    expect(putObject).toHaveBeenCalledWith(
      'image',
      'test-uuid-123/original',
      body,
      { contentType: 'image/png' }
    )
  })

  it('should store data URLs without fetching them', async () => {
    const dataUrl = 'data:image/png;base64,AQID'

    await storeImageURL(dataUrl)

    expect(fetch).not.toHaveBeenCalled()
    expect(putObject).toHaveBeenCalledWith(
      'image',
      'test-uuid-123/original',
      new Uint8Array([1, 2, 3]),
      { contentType: 'image/png' }
    )
  })

  it('should generate unique IDs for each stored image', async () => {
    const uuid = require('uuid')

    uuid.v1.mockReturnValueOnce('id-1').mockReturnValueOnce('id-2')

    fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([1]).buffer),
      headers: {
        get: jest.fn(() => 'image/png'),
      },
    })

    const id1 = await storeImageURL('https://example.com/img1.png')
    const id2 = await storeImageURL('https://example.com/img2.png')

    expect(id1).toBe('id-1')
    expect(id2).toBe('id-2')
  })

  it('should handle storage errors', async () => {
    fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([1]).buffer),
      headers: {
        get: jest.fn(() => 'image/png'),
      },
    })
    putObject.mockRejectedValue(new Error('S3 upload failed'))

    await expect(
      storeImageURL('https://example.com/image.png')
    ).rejects.toThrow('S3 upload failed')
  })
})

describe('retrieveImage', () => {
  let getObject

  beforeEach(() => {
    jest.clearAllMocks()
    getObject = require('@/lib/storage').getObject
  })

  it('returns null when the object has no body', async () => {
    getObject.mockResolvedValue({ body: undefined, contentType: 'image/png' })

    expect(await retrieveImage('test-uuid-123')).toBeNull()
  })

  it('returns null rather than throwing when the object is missing', async () => {
    getObject.mockRejectedValue(new Error('NoSuchKey'))

    expect(await retrieveImage('missing')).toBeNull()
  })

  it('should retrieve image bytes from the image bucket', async () => {
    const imageId = 'test-uuid-123'
    const expectedData = new Uint8Array([1, 2, 3])

    getObject.mockResolvedValue({
      body: { arrayBuffer: jest.fn().mockResolvedValue(expectedData.buffer) },
      contentType: 'image/png',
    })

    const image = await retrieveImage(imageId)

    expect(image).toEqual({
      data: expectedData,
      type: 'image/png',
    })
    expect(getObject).toHaveBeenCalledWith(
      'image',
      'test-uuid-123/original'
    )
  })

  it('should return null for non-existent images', async () => {
    getObject.mockRejectedValue(new Error('Not found'))

    const image = await retrieveImage('non-existent-id')

    expect(image).toBeNull()
  })
})

describe('proxyImageURL', () => {
  let fetch

  beforeEach(() => {
    jest.clearAllMocks()
    fetch = require('@/lib/fetch')
    fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([1]).buffer),
      headers: {
        get: jest.fn(() => 'image/png'),
      },
    })
  })

  it('should create proxy URL for image', async () => {
    const proxyUrl = await proxyImageURL('https://external.com/image.png')

    expect(proxyUrl).toBe(
      'https://example.com/api/v1/image/test-uuid-123/download'
    )
  })

  it('should upload the image before creating the proxy URL', async () => {
    const putObject = require('@/lib/storage').putObject

    await proxyImageURL('https://external.com/original.png')

    expect(putObject).toHaveBeenCalledWith(
      'image',
      'test-uuid-123/original',
      new Uint8Array([1]),
      { contentType: 'image/png' }
    )
  })
})

describe('createImage', () => {
  let parseAndRevealImageModel
  let createOpenAIImage
  let fetch

  beforeEach(() => {
    jest.clearAllMocks()
    parseAndRevealImageModel =
      require('@/lib/model.utils').parseAndRevealImageModel
    createOpenAIImage = require('@/lib/model.provider.openai').createImage
    fetch = require('@/lib/fetch')

    fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([1]).buffer),
      headers: {
        get: jest.fn(() => 'image/png'),
      },
    })
  })

  it('should create image using default gpt-image-1 model', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai', providerModel: 'gpt-image-1' },
    })

    createOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/generated.png'],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    const result = await createImage('A beautiful sunset')

    expect(result.urls).toHaveLength(1)
    expect(result.urls[0]).toContain('/api/v1/image/')
    expect(result.usage.model).toBe('gpt-image-1')
  })

  it('should return platform model name in usage, not providerModel', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gemini-2.5-flash-image',
      config: {
        provider: 'openrouter',
        providerModel: 'google/gemini-2.5-flash-image',
      },
    })

    const createOpenRouterImageFn =
      require('@/lib/model.provider.openrouter').createImage

    createOpenRouterImageFn.mockResolvedValue({
      urls: ['data:image/png;base64,abc'],
      usage: {
        model: 'google/gemini-2.5-flash-image',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    const result = await createImage('A test', {
      model: 'gemini-2.5-flash-image',
    })

    // @note usage.model must be the platform name so downstream consumers
    // like imageModelToUseType can parse it - providerModel contains '/' which
    // breaks structstr.parse()
    expect(result.usage.model).toBe('gemini-2.5-flash-image')
  })

  it('should create image using dalle3 model', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'dalle3',
      config: { provider: 'openai', providerModel: 'dall-e-3', quality: 'hd' },
    })

    createOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/dalle3.png'],
      usage: {
        model: 'dall-e-3',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    const result = await createImage('Modern art', { model: 'dalle3' })

    expect(createOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'dall-e-3',
        prompt: 'Modern art',
        quality: 'hd',
      })
    )
    expect(result.usage.model).toBe('dalle3')
  })

  it('should create image using gemini-2.5-flash-image model via OpenRouter', async () => {
    const createOpenRouterImage =
      require('@/lib/model.provider.openrouter').createImage

    parseAndRevealImageModel.mockReturnValue({
      name: 'gemini-2.5-flash-image',
      config: {
        provider: 'openrouter',
        providerModel: 'google/gemini-2.5-flash-image',
      },
    })

    createOpenRouterImage.mockResolvedValue({
      urls: ['data:image/png;base64,iVBORw0KGgo...'],
      usage: {
        model: 'google/gemini-2.5-flash-image',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    const result = await createImage('A futuristic city', {
      model: 'gemini-2.5-flash-image',
    })

    expect(createOpenRouterImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'google/gemini-2.5-flash-image',
        prompt: 'A futuristic city',
      })
    )
    expect(result.usage.model).toBe('gemini-2.5-flash-image')
    expect(result.urls).toHaveLength(1)
    expect(result.urls[0]).toContain('/api/v1/image/')
  })

  it('should truncate prompt to 1000 characters', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    createOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/img.png'],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    const longPrompt = 'A'.repeat(1500)

    await createImage(longPrompt)

    expect(createOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'A'.repeat(1000),
      })
    )
  })

  it('should pass user parameter to image creation', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    createOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/img.png'],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    await createImage('Test prompt', { user: 'user-123' })

    expect(createOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'user-123',
      })
    )
  })

  it('should pass abort signal to image creation provider', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    createOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/img.png'],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    const signal = new AbortController().signal

    await createImage('Test prompt', { signal })

    expect(createOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        signal,
      })
    )
  })

  it('should proxy all returned URLs', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    const uuid = require('uuid')

    uuid.v1
      .mockReturnValueOnce('id-1')
      .mockReturnValueOnce('id-2')
      .mockReturnValueOnce('id-3')

    createOpenAIImage.mockResolvedValue({
      urls: [
        'https://openai.com/img1.png',
        'https://openai.com/img2.png',
        'https://openai.com/img3.png',
      ],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    const result = await createImage('Multiple images')

    expect(result.urls).toHaveLength(3)
    expect(result.urls[0]).toContain('id-1')
    expect(result.urls[1]).toContain('id-2')
    expect(result.urls[2]).toContain('id-3')
  })

  it('should throw error for unrecognized model', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'unknown-model',
      config: { provider: 'unknown' },
    })

    await expect(
      createImage('Test prompt', { model: 'unknown-model' })
    ).rejects.toThrow("Didn't expect to get here: unknown")
  })
})

describe('createImage with proxyToModel', () => {
  let parseAndRevealImageModel
  let createOpenAIImage
  let fetch

  beforeEach(() => {
    jest.clearAllMocks()
    parseAndRevealImageModel =
      require('@/lib/model.utils').parseAndRevealImageModel
    createOpenAIImage = require('@/lib/model.provider.openai').createImage
    fetch = require('@/lib/fetch')

    fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([1]).buffer),
      headers: {
        get: jest.fn(() => 'image/png'),
      },
    })
  })

  it('should use the resolved model name after proxyToModel resolution', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gemini-3.1-flash-image-preview',
      config: {
        provider: 'openrouter',
        providerModel: 'google/gemini-3.1-flash-image-preview',
      },
    })

    const createOpenRouterImage =
      require('@/lib/model.provider.openrouter').createImage

    createOpenRouterImage.mockResolvedValue({
      urls: ['https://openrouter.ai/img.png'],
      usage: {
        model: 'google/gemini-3.1-flash-image-preview',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    const result = await createImage('A sunset', {
      model: 'gemini-3.1-flash-image',
    })

    expect(createOpenRouterImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'google/gemini-3.1-flash-image-preview',
      })
    )
    expect(result.usage.model).toBe('gemini-3.1-flash-image-preview')
  })

  it('should route to the correct provider after proxyToModel resolution', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1.5',
      config: { provider: 'openai', providerModel: 'gpt-image-1.5' },
    })

    createOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/img.png'],
      usage: {
        model: 'gpt-image-1.5',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    await createImage('Test', { model: 'some-alias' })

    expect(createOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-image-1.5',
        provider: 'openai',
      })
    )
  })
  it('should prefer providerModel over name when passing model to provider', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'dalle3',
      config: { provider: 'openai', providerModel: 'dall-e-3' },
    })

    createOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/img.png'],
      usage: {
        model: 'dall-e-3',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    await createImage('Test', { model: 'dalle3' })

    expect(createOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'dall-e-3',
      })
    )
  })

  it('should fall back to name when providerModel is not set', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    createOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/img.png'],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 0,
        outputTokens: 0,
      },
    })

    await createImage('Test', { model: 'gpt-image-1' })

    expect(createOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-image-1',
      })
    )
  })
})

describe('editImage', () => {
  let parseAndRevealImageModel
  let editOpenAIImage
  let fetch

  beforeEach(() => {
    jest.clearAllMocks()
    parseAndRevealImageModel =
      require('@/lib/model.utils').parseAndRevealImageModel
    editOpenAIImage = require('@/lib/model.provider.openai').editImage
    fetch = require('@/lib/fetch')

    fetch.mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([1]).buffer),
      headers: {
        get: jest.fn(() => 'image/png'),
      },
    })
  })

  it('should edit image using gpt-image-1 model', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    editOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/edited.png'],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 100,
        outputTokens: 0,
      },
    })

    const images = [new Blob(['image data'])]
    const result = await editImage('Add sunglasses', images)

    expect(editOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-image-1',
        prompt: 'Add sunglasses',
        images,
      })
    )
    expect(result.urls).toHaveLength(1)
  })

  it('should pass mask parameter to edit function', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    editOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/edited.png'],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 100,
        outputTokens: 0,
      },
    })

    const images = [new Blob(['image'])]
    const mask = new Blob(['mask'])

    await editImage('Edit prompt', images, { mask })

    expect(editOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        mask,
      })
    )
  })

  it('should pass abort signal to image edit provider', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    editOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/edited.png'],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 100,
        outputTokens: 0,
      },
    })

    const images = [new Blob(['image'])]
    const signal = new AbortController().signal

    await editImage('Edit prompt', images, { signal })

    expect(editOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        signal,
      })
    )
  })

  it('should truncate prompt to 1000 characters', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    editOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/edited.png'],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 100,
        outputTokens: 0,
      },
    })

    const longPrompt = 'B'.repeat(1500)
    const images = [new Blob(['image'])]

    await editImage(longPrompt, images)

    expect(editOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'B'.repeat(1000),
      })
    )
  })

  it('should pass user parameter', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    editOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/edited.png'],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 100,
        outputTokens: 0,
      },
    })

    const images = [new Blob(['image'])]

    await editImage('Edit prompt', images, { user: 'user-456' })

    expect(editOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'user-456',
      })
    )
  })

  it('should proxy edited image URLs', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    editOpenAIImage.mockResolvedValue({
      urls: ['https://openai.com/edited.png'],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 100,
        outputTokens: 0,
      },
    })

    const images = [new Blob(['image'])]
    const result = await editImage('Edit', images)

    expect(result.urls[0]).toContain('/api/v1/image/')
  })

  it('should throw error for unrecognized model', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'dalle2',
      config: { provider: 'unknown' },
    })

    const images = [new Blob(['image'])]

    await expect(
      editImage('Edit prompt', images, { model: 'dalle2' })
    ).rejects.toThrow("Didn't expect to get here: unknown")
  })

  it('should handle multiple images', async () => {
    parseAndRevealImageModel.mockReturnValue({
      name: 'gpt-image-1',
      config: { provider: 'openai' },
    })

    editOpenAIImage.mockResolvedValue({
      urls: [
        'https://openai.com/edited1.png',
        'https://openai.com/edited2.png',
      ],
      usage: {
        model: 'gpt-image-1',
        inputTokens: 200,
        outputTokens: 0,
      },
    })

    const images = [new Blob(['image1']), new Blob(['image2'])]

    const result = await editImage('Edit both', images)

    expect(result.urls).toHaveLength(2)
    expect(editOpenAIImage).toHaveBeenCalledWith(
      expect.objectContaining({
        images,
      })
    )
  })

  it('should edit image using openrouter provider', async () => {
    const editOpenRouterImage =
      require('@/lib/model.provider.openrouter').editImage

    parseAndRevealImageModel.mockReturnValue({
      name: 'gemini-2.5-flash-image',
      config: {
        provider: 'openrouter',
        providerModel: 'google/gemini-2.5-flash-image',
      },
    })

    editOpenRouterImage.mockResolvedValue({
      urls: ['https://openrouter.ai/edited.png'],
      usage: {
        model: 'google/gemini-2.5-flash-image',
        inputTokens: 100,
        outputTokens: 0,
      },
    })

    const images = [new Blob(['image'])]
    const result = await editImage('Add hat', images, {
      model: 'gemini-2.5-flash-image',
    })

    expect(editOpenRouterImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'google/gemini-2.5-flash-image',
        prompt: 'Add hat',
        images,
      })
    )
    expect(result.urls).toHaveLength(1)
  })
})

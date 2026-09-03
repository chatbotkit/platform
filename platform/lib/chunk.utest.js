import { chunkFile, chunkText, chunkUrl } from '@/lib/chunk'

jest.mock('@/lib/dsd', () => ({
  chunkText: jest.fn(async (options) => ({
    items: options.separators
      ? options.text.split(options.separators[0]).map((text) => ({
          text: text.trim(),
          meta: {},
        }))
      : [{ text: options.text, meta: {} }],
    request: options,
  })),
  chunkUrl: jest.fn(async (options) => ({
    items: [{ text: options.url, meta: {} }],
    request: options,
  })),
  chunkFile: jest.fn(async (blob, options) => ({
    items: [{ text: await blob.text(), meta: {} }],
    request: options,
  })),
}))

jest.mock('@/lib/egress.fetch', () => ({
  __esModule: true,
  default: jest.fn(async () => ({
    ok: true,
    headers: {
      get: jest.fn(() => 'application/pdf'),
    },
  })),
}))

describe('chunkText', () => {
  it('should chunk text successfully with valid parameters', async () => {
    const options = { text: 'example text', type: 'text/plain' }

    const result = await chunkText(options)

    expect(result).toHaveProperty('items')
    expect(result.items).toHaveLength(1)
  })

  it('should chunk text by using separators', async () => {
    const options = {
      text: ['test001', '---', 'test002', '---', 'test003'].join('\n'),
      type: 'text/plain',
      separators: ['---'],
      size: 5,
      overlap: 1,
      defaults: false,
    }

    const result = await chunkText(options)

    expect(result).toHaveProperty('items')
    expect(result.items).toHaveLength(3)
  })
})

describe('chunkUrl', () => {
  it('should fetch and chunk text from a URL successfully', async () => {
    const options = {
      // url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      url: 'https://httpbin.dev/pdf',
    }

    const result = await chunkUrl(options)

    expect(result).toHaveProperty('items')
    expect(result.items).toHaveLength(1)
  })
})

describe('chunkFile', () => {
  it('should upload a text/plain file and chunk its content', async () => {
    const blob = new Blob(['example text'], { type: 'text/plain' })

    const options = {}

    const result = await chunkFile(blob, options)

    expect(result).toHaveProperty('items')
    expect(result.items).toHaveLength(1)
  })

  it('should upload a text/markdown and chunk its content', async () => {
    const blob = new Blob(['example text'], { type: 'text/markdown' })

    const options = {}

    const result = await chunkFile(blob, options)

    expect(result).toHaveProperty('items')
    expect(result.items).toHaveLength(1)
  })

  it('should chunk files of type application/json', async () => {
    const blob = new Blob(['{"key": "value", "id": 1}'], {
      type: 'application/json',
    })

    const options = {}

    const result = await chunkFile(blob, options)

    expect(result).toHaveProperty('items')
    expect(result.items).toHaveLength(1)
    expect(result.items).toEqual([
      {
        text: 'key: value\nid: 1',
        meta: {
          id: 1,
        },
      },
    ])
  })

  it('should chunk files of type application/json that are json arrays', async () => {
    const blob = new Blob(['[{"key": "value", "id": 1}]'], {
      type: 'application/json',
    })

    const options = {}

    const result = await chunkFile(blob, options)

    expect(result).toHaveProperty('items')
    expect(result.items).toHaveLength(1)
    expect(result.items).toEqual([
      {
        text: 'key: value\nid: 1',
        meta: {
          id: 1,
        },
      },
    ])
  })
})

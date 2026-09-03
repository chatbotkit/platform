import { extractReferences } from '@/lib/extract.references'

describe('extractReferences', () => {
  it('should gracefully handle null input', () => {
    const input = null

    const expected = []

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should gracefully handle undefined input', () => {
    const input = undefined

    const expected = []

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should return an empty array when input is empty', () => {
    const input = {}

    const expected = []

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should extract a single url', () => {
    const input = {
      url: 'https://example.com',
    }

    const expected = [
      {
        url: 'https://example.com',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should extract multiple urls', () => {
    const input = {
      url1: 'https://example.com/1',
      url2: 'https://example.com/2',
    }

    const expected = [
      {
        url: 'https://example.com/1',
      },
      {
        url: 'https://example.com/2',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should extract url from an array of objects', () => {
    const input = {
      urls: [
        { url: 'https://example.com/1' },
        { url: 'https://example.com/2' },
      ],
    }

    const expected = [
      {
        url: 'https://example.com/1',
      },
      {
        url: 'https://example.com/2',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should extract urls with descriptions', () => {
    const input = {
      items: [
        { url: 'https://example.com/1', description: 'First URL' },
        { url: 'https://example.com/2', description: 'Second URL' },
      ],
    }

    const expected = [
      {
        url: 'https://example.com/1',
        description: 'First URL',
      },
      {
        url: 'https://example.com/2',
        description: 'Second URL',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should handle nested objects', () => {
    const input = {
      data: {
        references: [
          { url: 'https://example.com/1', name: 'First' },
          { url: 'https://example.com/2', name: 'Second' },
        ],
      },
    }

    const expected = [
      {
        url: 'https://example.com/1',
        name: 'First',
      },
      {
        url: 'https://example.com/2',
        name: 'Second',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should return an empty array when no urls are found', () => {
    const input = {
      text: 'This is some text without any URLs.',
    }

    const expected = []

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should handle mixed input with some urls and some text', () => {
    const input = {
      url1: 'https://example.com/1',
      text: 'This is some text.',
      url2: 'https://example.com/2',
    }

    const expected = [
      {
        url: 'https://example.com/1',
      },
      {
        url: 'https://example.com/2',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should handle input with no URLs but other properties', () => {
    const input = {
      title: 'Sample Title',
      description: 'This is a sample description.',
    }

    const expected = []

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should handle input with URLs in different formats', () => {
    const input = {
      links: [
        { href: 'https://example.com/1', text: 'Link 1' },
        { href: 'https://example.com/2', text: 'Link 2' },
      ],
    }

    const expected = [
      {
        url: 'https://example.com/1',
        description: 'Link 1',
      },
      {
        url: 'https://example.com/2',
        description: 'Link 2',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should handle input with various levels of nesting', () => {
    const input = {
      level1: {
        level2: {
          urls: [
            { url: 'https://example.com/1' },
            { url: 'https://example.com/2' },
          ],
        },
      },
      level3: [
        [{ url: 'https://example.com/3' }, { url: 'https://example.com/4' }],
      ],
    }

    const expected = [
      {
        url: 'https://example.com/1',
      },
      {
        url: 'https://example.com/2',
      },
      {
        url: 'https://example.com/3',
      },
      {
        url: 'https://example.com/4',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should handle array as input', () => {
    const input = [
      { url: 'https://example.com/1' },
      { url: 'https://example.com/2' },
    ]

    const expected = [
      {
        url: 'https://example.com/1',
      },
      {
        url: 'https://example.com/2',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should use link instead of url if available', () => {
    const input = {
      link1: 'https://example.com/1',
      link2: 'https://example.com/2',
    }

    const expected = [
      {
        url: 'https://example.com/1',
      },
      {
        url: 'https://example.com/2',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should work', () => {
    const input = [
      {
        link: 'https://www.sec.gov/Archives/edgar/data/1041061/000104106121000012/yum-20201231.htm',
        title: 'yum-20201231',
        description: 'Our relationship with Yum China is governed primarily',
      },
    ]

    const expected = [
      {
        url: 'https://www.sec.gov/Archives/edgar/data/1041061/000104106121000012/yum-20201231.htm',
        name: 'yum-20201231',
        description: 'Our relationship with Yum China is governed primarily',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should return unique references based on url', () => {
    const input = [
      { url: 'https://example.com/1', name: 'First' },
      { url: 'https://example.com/1', name: 'First Duplicate' },
      { url: 'https://example.com/2', name: 'Second' },
    ]

    const expected = [
      {
        url: 'https://example.com/1',
        name: 'First',
      },
      {
        url: 'https://example.com/2',
        name: 'Second',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should return unique references with higher priority based on score', () => {
    const input = [
      { url: 'https://example.com/1', name: 'First' },
      {
        url: 'https://example.com/1',
        name: 'First Duplicate',
        description: 'Duplicate',
      },
      { url: 'https://example.com/2', name: 'Second', score: 3 },
    ]

    const expected = [
      {
        url: 'https://example.com/1',
        name: 'First Duplicate',
        description: 'Duplicate',
      },
      {
        url: 'https://example.com/2',
        name: 'Second',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should ignore properties that start with _', () => {
    const input = {
      _privateUrl: 'https://example.com/private',
      publicUrl: 'https://example.com/public',
    }

    const expected = [
      {
        url: 'https://example.com/public',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should ignore references where the parent key starts with _', () => {
    const input = {
      _private: {
        url: 'https://example.com/private',
      },
      public: {
        url: 'https://example.com/public',
      },
    }

    const expected = [
      {
        url: 'https://example.com/public',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })

  it('should not ignore references where the parent key does not start with _ but contain _', () => {
    const input = {
      private_data: {
        url: 'https://example.com/private',
      },
      public_data: {
        url: 'https://example.com/public',
      },
    }

    const expected = [
      {
        url: 'https://example.com/private',
      },
      {
        url: 'https://example.com/public',
      },
    ]

    expect(extractReferences(input)).toEqual(expected)
  })
})

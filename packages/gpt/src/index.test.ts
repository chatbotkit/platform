import {
  ELLIPSIS,
  SEP,
  adjoinTokens,
  batchTokens,
  connectText,
  countFrequencies,
  getBytePairEncodingFrequencies,
  getBytePairEncodings,
  getTextTokens,
  separateText,
  slice,
  split,
  splitTextBlocks,
  tokenizeTextBlocks,
  trimTextBlockL,
  trimTextBlockR,
} from './index'

function toa<T>(it: Iterable<T>): T[] {
  const array = []

  for (const i of it) {
    array.push(i)
  }

  return array
}

describe('getBytePairEncodings', () => {
  it('returns correct tokens', () => {
    expect(getBytePairEncodings('abc xyz')).toEqual([13997, 41611])
    expect(getBytePairEncodings('abc xyz').length).toEqual(
      getTextTokens('abc xyz').length
    )
  })

  it('handles special tokens without throwing', () => {
    // @note these special tokens previously caused "Disallowed special token found" errors
    expect(() => getBytePairEncodings('<|im_end|>')).not.toThrow()
    expect(() => getBytePairEncodings('<|im_start|>')).not.toThrow()
    expect(() => getBytePairEncodings('<|endoftext|>')).not.toThrow()
    expect(() => getBytePairEncodings('Hello <|im_end|> world')).not.toThrow()
  })

  it('returns tokens for text containing special tokens', () => {
    const tokens = getBytePairEncodings('<|im_end|>')

    expect(Array.isArray(tokens)).toBe(true)
    expect(tokens.length).toBeGreaterThan(0)
  })
})

describe('getBytePairEncodingFrequencies', () => {
  it('returns the correct frequencies', () => {
    expect(getBytePairEncodingFrequencies('abc xyz')).toEqual({
      13997: 1,
      41611: 1,
    })
    expect(getBytePairEncodingFrequencies('test')).toEqual({ 1985: 1 })
    expect(getBytePairEncodingFrequencies('train train train')).toEqual({
      10613: 1,
      5542: 2,
    })
  })
})

describe('getTextTokens', () => {
  it('returns correct tokens', async () => {
    expect(getTextTokens('abc xyz')).toEqual(['abc', ' xyz'])
    expect(getTextTokens('abc xyz').length).toEqual(
      getBytePairEncodings('abc xyz').length
    )
  })

  it('handles special tokens without throwing', () => {
    // @note these special tokens previously caused "Disallowed special token found" errors
    expect(() => getTextTokens('<|im_end|>')).not.toThrow()
    expect(() => getTextTokens('<|im_start|>')).not.toThrow()
    expect(() => getTextTokens('<|endoftext|>')).not.toThrow()
    expect(() => getTextTokens('Hello <|im_end|> world')).not.toThrow()
  })

  it('returns tokens for text containing special tokens', () => {
    const tokens = getTextTokens('<|im_end|>')

    expect(Array.isArray(tokens)).toBe(true)
    expect(tokens.length).toBeGreaterThan(0)
  })
})

describe('adjoinTokens', () => {
  it('must concat tokens basic cases', () => {
    expect(adjoinTokens([], [], [], 123, 123)).toEqual([])
    expect(adjoinTokens([], ['a'], [], 123, 123)).toEqual(['a'])
    expect(adjoinTokens(['l'], ['a'], [], 123, 123)).toEqual(['l', 'a'])
    expect(adjoinTokens(['l'], ['a'], ['r'], 123, 123)).toEqual(['l', 'a', 'r'])
  })

  it('must concat tokens left side trim cases', () => {
    expect(adjoinTokens(['a', 'b', 'c', 'd', 'e'], ['-'], [], 123, 3)).toEqual([
      ELLIPSIS,
      'd',
      'e',
      '-',
    ])
    expect(
      adjoinTokens(['a', 'b', 'c', 'd', 'e'], ['-'], [], 123, 3, '')
    ).toEqual(['c', 'd', 'e', '-'])
  })

  it('must concat tokens right side trim cases', () => {
    expect(adjoinTokens([], ['-'], ['v', 'w', 'x', 'y', 'z'], 123, 3)).toEqual([
      '-',
      'v',
      'w',
      ELLIPSIS,
    ])
    expect(
      adjoinTokens([], ['-'], ['v', 'w', 'x', 'y', 'z'], 123, 3, '')
    ).toEqual(['-', 'v', 'w', 'x'])
  })

  it('must concat tokens equal site cases', () => {
    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        123,
        3
      )
    ).toEqual([ELLIPSIS, 'd', 'e', '-', 'v', 'w', ELLIPSIS])
    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        123,
        3,
        ''
      )
    ).toEqual(['c', 'd', 'e', '-', 'v', 'w', 'x'])
  })

  it('must concat tokens odd cases', () => {
    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        1,
        3
      )
    ).toEqual(['-'])
    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        1,
        3,
        ''
      )
    ).toEqual(['-'])

    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        2,
        3
      )
    ).toEqual(['-'])
    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        2,
        3,
        ''
      )
    ).toEqual(['-'])

    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        3,
        3
      )
    ).toEqual(['e', '-', 'v'])
    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        3,
        3,
        ''
      )
    ).toEqual(['e', '-', 'v'])

    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        4,
        3
      )
    ).toEqual(['e', '-', 'v'])
    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        4,
        3,
        ''
      )
    ).toEqual(['e', '-', 'v'])

    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        5,
        3
      )
    ).toEqual([ELLIPSIS, 'e', '-', 'v', ELLIPSIS])
    expect(
      adjoinTokens(
        ['a', 'b', 'c', 'd', 'e'],
        ['-'],
        ['v', 'w', 'x', 'y', 'z'],
        5,
        3,
        ''
      )
    ).toEqual(['d', 'e', '-', 'v', 'w'])
  })
})

describe('separateText', () => {
  it('must correctly separate the text', () => {
    expect(
      connectText(
        separateText(
          'Hello.\nThis is a long text.\n\nSome parts of it should be on sep lines.',
          ['\n\n']
        ),
        '<-|->'
      )
    ).toEqual(
      'Hello.\nThis is a long text.<-|->Some parts of it should be on sep lines.'
    )

    expect(
      connectText(
        separateText(
          'Hello.\nThis is a long text.\n\nSome parts of it should be on sep lines.\n\nAnd more lines.',
          ['\n\n']
        ),
        '<-|->'
      )
    ).toEqual(
      'Hello.\nThis is a long text.<-|->Some parts of it should be on sep lines.<-|->And more lines.'
    )

    expect(
      connectText(
        separateText(
          'Hello.\nThis is a long text.\n\n\n\nSome parts of it should be on sep lines.',
          ['\n\n']
        ),
        '<-|->'
      )
    ).toEqual(
      'Hello.\nThis is a long text.<-|->Some parts of it should be on sep lines.'
    )
  })
})

describe('tokenizeTextBlocks', () => {
  it('must correctly tokenize text blocks', () => {
    expect(toa(tokenizeTextBlocks(['a']))).toEqual(['a'])
    expect(toa(tokenizeTextBlocks(['a', 'b']))).toEqual(['a', SEP, 'b'])
    expect(toa(tokenizeTextBlocks(['hello world', 'hello world']))).toEqual([
      'hello',
      ' world',
      SEP,
      'hello',
      ' world',
    ])
  })
})

describe('batchTokens', () => {
  it('must correctly batch tokens', () => {
    expect(toa(batchTokens(['a', 'b', 'c', 'd', 'e'], 1))).toEqual([
      ['a', 'b', ELLIPSIS],
      [ELLIPSIS, 'c', ELLIPSIS],
      [ELLIPSIS, 'd', ELLIPSIS],
      [ELLIPSIS, 'e'],
    ])
    expect(toa(batchTokens(['a', 'b', 'c', 'd', 'e'], 2))).toEqual([
      ['a', 'b', ELLIPSIS],
      [ELLIPSIS, 'c', ELLIPSIS],
      [ELLIPSIS, 'd', ELLIPSIS],
      [ELLIPSIS, 'e'],
    ])
    expect(toa(batchTokens(['a', 'b', 'c', 'd', 'e'], 3))).toEqual([
      ['a', 'b', ELLIPSIS],
      [ELLIPSIS, 'c', ELLIPSIS],
      [ELLIPSIS, 'd', ELLIPSIS],
      [ELLIPSIS, 'e'],
    ])
    expect(toa(batchTokens(['a', 'b', 'c', 'd', 'e'], 4))).toEqual([
      ['a', 'b', 'c', ELLIPSIS],
      [ELLIPSIS, 'd', 'e'],
    ])
    expect(toa(batchTokens(['a', 'b', 'c', 'd', 'e'], 10))).toEqual([
      ['a', 'b', 'c', 'd', 'e'],
    ])
  })
})

describe('trimTextBlockL', () => {
  it('must trim l', () => {
    expect(trimTextBlockL('')).toEqual('')
    expect(trimTextBlockL('.')).toEqual('.')
    expect(trimTextBlockL('..')).toEqual('..')
    expect(trimTextBlockL('...')).toEqual('...')
    expect(trimTextBlockL('....')).toEqual('...')
    expect(trimTextBlockL('.....')).toEqual('....')
  })
})

describe('trimTextBlockR', () => {
  it('must trim r', () => {
    expect(trimTextBlockR('')).toEqual('')
    expect(trimTextBlockR('.')).toEqual('.')
    expect(trimTextBlockR('..')).toEqual('..')
    expect(trimTextBlockR('...')).toEqual('...')
    expect(trimTextBlockR('....')).toEqual('...')
    expect(trimTextBlockR('.....')).toEqual('....')
  })
})

describe('splitTextBlocks', () => {
  it('must correctly split text blocks', () => {
    expect(
      toa(
        splitTextBlocks(
          'Hello.\nThis is a long text.\n\nSome parts of it should be on sep lines.',
          100,
          5,
          ['\n\n']
        )
      )
    ).toEqual([
      'Hello.\nThis is a long text. Some parts of it...',
      '... long text. Some parts of it should be on sep lines.',
    ])

    expect(
      toa(
        splitTextBlocks(
          'Hello.\nThis is a long text.\n\nSome parts of it should be on sep lines.\n\nAnd more lines.',
          100,
          3,
          ['\n\n']
        )
      )
    ).toEqual([
      'Hello.\nThis is a long text. Some parts...',
      '... Some parts of it should be on sep lines. And more...',
      '... And more lines.',
    ])
  })
})

describe('slice', () => {
  it('must correctly slice the text', () => {
    expect(slice('this is a test', 1)).toEqual(' is a test')
    expect(slice('this is a test', 1, -1)).toEqual(' is a')
  })

  it('correctly slices the text between start and stop tokens', () => {
    expect(slice('this is a test', 1, 3)).toEqual(' is a')
    expect(slice('hello world', 0, -1)).toEqual('hello')
  })

  it('slices to the end if stop token is omitted', () => {
    expect(slice('this is a test', 2)).toEqual(' a test')
  })

  it('handles negative indices correctly', () => {
    expect(slice('this is a test', -3, -1)).toEqual(' is a')
  })

  it('returns an empty string if startToken equals stopToken', () => {
    expect(slice('this is a test', 2, 2)).toEqual('')
  })

  it('handles out of bounds indices gracefully', () => {
    expect(slice('this is a test', 10, 20)).toEqual('')
    expect(slice('this is a test', -20, -10)).toEqual('')
  })

  it('returns an empty string if startToken is greater than stopToken', () => {
    expect(slice('this is a test', 3, 1)).toEqual('')
  })

  it('handles empty input strings', () => {
    expect(slice('', 0, 1)).toEqual('')
  })

  it('returns the entire string if both startToken and stopToken are out of bounds', () => {
    expect(slice('hello world', -100, 100)).toEqual('hello world')
  })
})

describe('split', () => {
  it('returns an empty array for empty input', () => {
    expect(split('', 5)).toEqual([])
  })

  it('returns single word as chunk irrespective of maxTokens or overlapTokens', () => {
    expect(split('hello', 1, 0)).toEqual(['hello'])
    expect(split('hello', 10, 2)).toEqual(['hello'])
  })

  it('returns entire input as a single chunk when maxTokens exceeds number of words', () => {
    expect(split('hello world', 5)).toEqual(['hello world'])
  })

  it('throws error when overlapTokens is equal to maxTokens', () => {
    expect(() => split('hello world', 5, 5)).toThrow(
      'overlapTokens must be less than maxTokens'
    )
  })

  it('throws error when overlapTokens is negative', () => {
    expect(() => split('hello world', 5, -1)).toThrow(
      'overlapTokens must be greater than or equal to 0'
    )
  })

  it('handles fewer tokens than maxTokens without issue', () => {
    expect(split('one two', 5)).toEqual(['one two'])
  })

  it('must correctly split the text', () => {
    expect(split('The quick brown fox jumps over the lazy dog', 3)).toEqual([
      'The quick brown',
      ' fox jumps over',
      ' the lazy dog',
    ])
    expect(split('The quick brown fox jumps over the lazy dog', 3, 1)).toEqual([
      'The quick brown',
      ' brown fox jumps',
      ' jumps over the',
      ' the lazy dog',
    ])
    expect(
      split(
        'The quick brown fox jumps over the lazy dog and feels as if he were in the seventh heaven',
        3,
        1
      )
    ).toEqual([
      'The quick brown',
      ' brown fox jumps',
      ' jumps over the',
      ' the lazy dog',
      ' dog and feels',
      ' feels as if',
      ' if he were',
      ' were in the',
      ' the seventh heaven',
    ])
  })

  it('must correctly spit out single chunk', () => {
    expect(split('The quick brown fox jumps over the lazy dog', 400)).toEqual([
      'The quick brown fox jumps over the lazy dog',
    ])
  })
})

describe('countFrequencies', () => {
  it('returns an empty object if given an empty array', () => {
    expect(countFrequencies([])).toEqual({})
  })

  it('returns the correct frequency counts for a simple array', () => {
    const arr = [1, 2, 2, 3, 3, 3]

    expect(countFrequencies(arr)).toEqual({ 1: 1, 2: 2, 3: 3 })
  })

  it('returns the correct frequency counts for an array with string elements', () => {
    const arr = ['foo', 'bar', 'foo', 'baz', 'baz']

    expect(countFrequencies(arr)).toEqual({ foo: 2, bar: 1, baz: 2 })
  })

  it('returns the correct frequency counts for an array with null and undefined elements', () => {
    const arr = [null, undefined, null, undefined, null, undefined]

    expect(countFrequencies(arr)).toEqual({ null: 3, undefined: 3 })
  })
})

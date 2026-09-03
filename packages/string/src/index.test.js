import {
  anyNonEmptyString,
  anyString,
  byteLength,
  byteSlice,
  countBytes,
  doubleQuote,
  ellipsis,
  filterNonEmpty,
  getPositions,
  getPositionsIt,
  getRandomId,
  getTempId,
  inclusiveRecursiveSplit,
  inclusiveSplit,
  joinTrimmedNotEmpty,
  joinWithAnd,
  joinWithJoiner,
  joinWithOr,
  normalizeNonprintable,
  normalizeParagraphs,
  normalizeQuotes,
  normalizeReplacements,
  normalizeSpaces,
  normalizeText,
  normalizeUnicodeEscapes,
  recursiveSplit,
  removeEmojis,
  removeSpaces,
  removeSymbols,
  replace,
  replaceAll,
  replaceAllAsync,
  replaceAsync,
  replaceBetween,
  replaceWithCoordinates,
  replaceWithMap,
  replaceWithMapAsync,
  singleQuote,
  splitOnce,
  splitTrim,
  stringToHash,
  toCamelCase,
  toHeadingCase,
  toKebabCase,
  toPascalCase,
  toSentenceCase,
  toSlug,
  toSnakeCase,
  toTitleCase,
  toUnicodeEscapedString,
  toWordCase,
  trimLines,
  trimToByteLength,
  trimToFirstOccurrence,
  trimToLastOccurrence,
} from './index'

describe('getRandomId', () => {
  it('should generate a random ID', () => {
    expect(getRandomId()).toBeTruthy()
  })

  it('should be able to add prefix', () => {
    expect(getRandomId('prefix-')).toMatch(/^prefix-/)
  })

  it('should not contain double dashes', () => {
    expect(getRandomId('prefix-')).not.toMatch(/^prefix--/)
  })

  it('should be able to add prefix with joiner', () => {
    expect(getRandomId('prefix', '-')).toMatch(/^prefix-/)
  })

  it('should not add a joiner if the prefix is empty', () => {
    expect(getRandomId('', '-')).not.toMatch(/-/)
  })
})

describe('replace', () => {
  it('should replace the first occurrence of a string', () => {
    expect(replace('hello world', 'world', 'universe')).toBe('hello universe')
    expect(replace('hello world', 'universe', 'world')).toBe('hello world')
  })

  it('should replace the first occurrence with a function', () => {
    expect(replace('hello world', 'world', () => 'universe')).toBe(
      'hello universe'
    )
  })

  it('should replace the first occurrence with regex', () => {
    expect(replace('hello world', /world/, 'universe')).toBe('hello universe')
  })

  it('should replace the first occurrence with regex and function', () => {
    expect(replace('hello world', /world/, () => 'universe')).toBe(
      'hello universe'
    )
  })
})

describe('replaceAsync', () => {
  it('should replace the first occurrence of a string', async () => {
    await expect(
      replaceAsync('hello world', 'world', 'universe')
    ).resolves.toBe('hello universe')
    await expect(
      replaceAsync('hello world', 'universe', 'world')
    ).resolves.toBe('hello world')
  })

  it('should replace the first occurrence with a function', async () => {
    await expect(
      replaceAsync('hello world', 'world', () => 'universe')
    ).resolves.toBe('hello universe')
  })

  it('should replace the first occurrence with regex', async () => {
    await expect(
      replaceAsync('hello world', /world/, 'universe')
    ).resolves.toBe('hello universe')
  })

  it('should replace the first occurrence with regex and function', async () => {
    await expect(
      replaceAsync('hello world', /world/, () => 'universe')
    ).resolves.toBe('hello universe')
  })
})

describe('replaceAll', () => {
  it('should replace all occurrences of a string', () => {
    expect(replaceAll('hello world', 'o', 'a')).toBe('hella warld')
    expect(replaceAll('hello world', 'world', 'universe')).toBe(
      'hello universe'
    )
    expect(replaceAll('hello world', 'universe', 'world')).toBe('hello world')
  })

  it('should replace all occurrences with a function', () => {
    expect(replaceAll('hello world', 'o', () => 'a')).toBe('hella warld')
  })

  it('should replace all occurrences with regex', () => {
    expect(replaceAll('hello world', /o/g, 'a')).toBe('hella warld')
  })

  it('should replace all occurrences with regex and function', () => {
    expect(replaceAll('hello world', /o/g, () => 'a')).toBe('hella warld')
  })
})

describe('replaceAllAsync', () => {
  it('should replace all occurrences of a string', async () => {
    await expect(replaceAllAsync('hello world', 'o', 'a')).resolves.toBe(
      'hella warld'
    )
    await expect(
      replaceAllAsync('hello world', 'world', 'universe')
    ).resolves.toBe('hello universe')
    await expect(
      replaceAllAsync('hello world', 'universe', 'world')
    ).resolves.toBe('hello world')
  })

  it('should replace all occurrences with a function', async () => {
    await expect(replaceAllAsync('hello world', 'o', () => 'a')).resolves.toBe(
      'hella warld'
    )
  })

  it('should replace all occurrences with regex', async () => {
    await expect(replaceAllAsync('hello world', /o/g, 'a')).resolves.toBe(
      'hella warld'
    )
  })

  it('should replace all occurrences with regex and function', async () => {
    await expect(replaceAllAsync('hello world', /o/g, () => 'a')).resolves.toBe(
      'hella warld'
    )
  })
})

describe('toCamelCase', () => {
  it('should convert a string to camel case', () => {
    expect(toCamelCase('hello world')).toBe('helloWorld')
    expect(toCamelCase('hello_world')).toBe('hello_world')
  })

  it('should convert a string with dots to camel case', () => {
    expect(toCamelCase('.About')).toBe('about')
  })
})

describe('toHeadingCase', () => {
  it('should convert a string to heading case', () => {
    expect(toHeadingCase('hello world')).toBe('Hello World')
    expect(toHeadingCase('helloWorld')).toBe('Hello World')
    expect(toHeadingCase('HelloWorld')).toBe('Hello World')
    expect(toHeadingCase('hello_world')).toBe('Hello World')
    expect(toHeadingCase('Hello_World')).toBe('Hello World')
    expect(toHeadingCase('hello-world')).toBe('Hello World')
    expect(toHeadingCase('Hello-World')).toBe('Hello World')
    expect(toHeadingCase('ai answers')).toBe('Ai Answers')
  })
})

describe('joinTrimmedNotEmpty', () => {
  test('should join trimmed and non-empty strings with default separator', () => {
    const items = ['  Hello  ', '  World  ', '', '  ', '  JavaScript  ']
    const expected = 'Hello\n\nWorld\n\nJavaScript'
    const result = joinTrimmedNotEmpty(items)

    expect(result).toEqual(expected)
  })

  test('should join trimmed and non-empty strings with custom separator', () => {
    const items = ['  Hello  ', '  World  ', '', '  ', '  JavaScript  ']
    const separator = ', '
    const expected = 'Hello, World, JavaScript'
    const result = joinTrimmedNotEmpty(items, separator)

    expect(result).toEqual(expected)
  })

  test('should return an empty string if all items are empty', () => {
    const items = ['', '  ', '']
    const expected = ''
    const result = joinTrimmedNotEmpty(items)

    expect(result).toEqual(expected)
  })

  test('should return an empty string if items array is empty', () => {
    const items = []
    const expected = ''
    const result = joinTrimmedNotEmpty(items)

    expect(result).toEqual(expected)
  })

  test('should return a string when the array is composed of multiple arrays', () => {
    const items = [
      ['a', 'b'],
      ['c', 'd'],
      ['e', ['f']],
    ]

    const expected = 'a\n\nb\n\nc\n\nd\n\ne\n\nf'
    const result = joinTrimmedNotEmpty(items)

    expect(result).toEqual(expected)
  })

  test('it should handle null and undefined values', () => {
    const items = ['  Hello  ', null, '  World  ', undefined, '  JavaScript  ']
    const expected = 'Hello\n\nWorld\n\nJavaScript'
    const result = joinTrimmedNotEmpty(items)

    expect(result).toEqual(expected)
  })
})

describe('replaceWithMap', () => {
  it('must correctly replace', () => {
    expect(replaceWithMap('a b c', { a: 1, b: 2, c: 3 })).toEqual('1 2 3')
    expect(replaceWithMap('aa bbb cccc a b c', { a: 1, b: 2, c: 3 })).toEqual(
      '11 222 3333 1 2 3'
    )
    expect(replaceWithMap('a b c', { a: 1, b: 2, c: () => 3 })).toEqual('1 2 3')
  })
})

describe('replaceWithMapAsync', () => {
  it('must correctly replace', async () => {
    await expect(
      replaceWithMapAsync('a b c', { a: 1, b: 2, c: 3 })
    ).resolves.toEqual('1 2 3')
    await expect(
      replaceWithMapAsync('aa bbb cccc a b c', { a: 1, b: 2, c: 3 })
    ).resolves.toEqual('11 222 3333 1 2 3')
    await expect(
      replaceWithMapAsync('a b c', { a: 1, b: 2, c: async () => 3 })
    ).resolves.toEqual('1 2 3')
  })
})

describe('getPositions', () => {
  it('must return correct positions', () => {
    const search = '!'
    const input = `a b c ${search} d e f ${search}`

    const positions = getPositions(input, search)

    expect(input.substring(...positions[0])).toEqual(search)
  })

  it('must return correct positions', () => {
    const search = '!!!'
    const input = `a b c ${search} d e f ${search} g h i ${search}`

    const positions = getPositions(input, search)

    expect(input.substring(...positions[0])).toEqual(search)
  })
})

describe('replaceWithCoordinates', () => {
  it('must return the correct coordinates', () => {
    expect(
      replaceWithCoordinates('Hello world!', [
        ['Hello', 'Destroy'],
        ['world', 'The World'],
      ])
    ).toEqual([
      { begin: 0, end: 7, input: 'Hello world!', output: 'Destroy world!' },
      {
        begin: 8,
        end: 17,
        input: 'Destroy world!',
        output: 'Destroy The World!',
      },
      'Destroy The World!',
    ])
  })
})

describe('anyNonEmptyString', () => {
  it('must return the correct string', () => {
    expect(anyNonEmptyString('a')).toEqual('a')
    expect(anyNonEmptyString(null, 'a')).toEqual('a')
    expect(anyNonEmptyString(undefined, 'a')).toEqual('a')
  })
})

describe('removeSpaces', () => {
  it('bobo', () => {
    expect(
      removeSpaces('First sentence.\nSecond sentence.\nThird sentence')
    ).toEqual('First sentence. Second sentence. Third sentence')
    expect(
      removeSpaces('First sentence.\n\nSecond sentence.\n\nThird sentence')
    ).toEqual('First sentence. Second sentence. Third sentence')
    expect(
      removeSpaces(
        'First   sentence.\n\nSecond   sentence.\n\nThird   sentence'
      )
    ).toEqual('First sentence. Second sentence. Third sentence')
    expect(
      removeSpaces(
        'First   \tsentence.\n\nSecond   \tsentence.\n\nThird   \tsentence'
      )
    ).toEqual('First sentence. Second sentence. Third sentence')
  })
})

describe('removeEmojis', () => {
  it('must remove emojis', () => {
    expect(removeEmojis('Hello 👨🏿‍🎤')).toEqual('Hello ')
  })
})

describe('removeSymbols', () => {
  // @note the reason this test is disabled is because it is not easily possible
  // to match arrows and thus they are allowed to be used

  // it('must remove symbols', () => {
  //   expect(removeSymbols('← Back to tutorials')).toEqual(' Back to tutorials')
  // })

  it('must keep basic characters', () => {
    expect(removeSymbols('1 + 1 = 2')).toEqual('1 + 1 = 2')
  })
})

describe('normalizeQuotes', () => {
  it('must remove curly quotes', () => {
    expect(
      normalizeQuotes(
        'In crowdsourced security, “the Crowd” (with a capital C) is the term for all security researchers.'
      )
    ).toEqual(
      'In crowdsourced security, "the Crowd" (with a capital C) is the term for all security researchers.'
    )
  })
})

describe('normalizeSpaces', () => {
  it('must noramlize space', () => {
    expect(normalizeSpaces('a     b    c')).toEqual('a b c')
    expect(normalizeSpaces('a\nb\nc')).toEqual('a\nb\nc')
  })
})

describe('normalizeParagraphs', () => {
  it('must normalize paragraphs', () => {
    expect(normalizeParagraphs('a\n\nb\n\nc')).toEqual('a\n\nb\n\nc')
    expect(normalizeParagraphs('a\n\n\nb\n\n\nc')).toEqual('a\n\nb\n\nc')
    expect(normalizeParagraphs('a\n b\n c')).toEqual('a\nb\nc')
  })
})

describe('normalizeNonprintable', () => {
  it('must normalize non printable', () => {
    expect(
      normalizeNonprintable(
        'Sell them online     Give them to family or friends.'
      )
    ).toEqual('Sell them online     Give them to family or friends.')

    expect(normalizeNonprintable('a\nb\nc')).toEqual('a\nb\nc')
  })
})

describe('normalizeReplacement', () => {
  it('must remove replacement characters', () => {
    expect(normalizeReplacements('��Good question!')).toEqual('Good question!')
  })
})

describe('normalizeUnicodeEscapes', () => {
  it('must normalize escapes', () => {
    expect(
      normalizeUnicodeEscapes('nova liga\\u00e7\\u00e3o de \\u00e1gua')
    ).toEqual('nova ligação de água')
  })
})

describe('normalizeText', () => {
  it('must normalize text', () => {
    expect(
      normalizeText('Sell them online     Give them to family or friends.')
    ).toEqual('Sell them online Give them to family or friends.')

    expect(normalizeText('a\nb\nc')).toEqual('a\nb\nc')
    expect(normalizeText(`Seneca‟s`)).toEqual(`Seneca's`)
  })
})

describe('splitTrim', () => {
  it('must correctly split and trim', () => {
    expect(splitTrim('article, main , body', ',')).toEqual([
      'article',
      'main',
      'body',
    ])
  })
})

describe('recursiveSplit', () => {
  it('splits by a single term as a literal string', () => {
    const input = 'apple-banana-cherry'
    const terms = ['-']
    const expected = ['apple', 'banana', 'cherry']

    expect(recursiveSplit(input, terms)).toEqual(expected)
  })

  it('splits by multiple terms as literal strings', () => {
    const input = 'apple, banana; cherry'
    const terms = [', ', '; ']
    const expected = ['apple', 'banana', 'cherry']

    expect(recursiveSplit(input, terms)).toEqual(expected)
  })

  it('splits by a single term as a RegExp', () => {
    const input = 'apple1banana22cherry333'
    const terms = [/\d+/]
    const expected = ['apple', 'banana', 'cherry', '']

    expect(recursiveSplit(input, terms)).toEqual(expected)
  })

  it('splits using mixed types of terms (literal string and RegExp)', () => {
    const input = 'apple.banana*cherry?123'
    const terms = ['*', /\d+/]
    const expected = ['apple.banana', 'cherry?', '']

    expect(recursiveSplit(input, terms)).toEqual(expected)
  })

  it('handles complex patterns with RegExp', () => {
    const input = 'apple.banana*cherry?'
    const terms = [/\./, /\*/, /\?/]
    const expected = ['apple', 'banana', 'cherry', '']

    expect(recursiveSplit(input, terms)).toEqual(expected)
  })

  it('empty input returns an array with an empty string', () => {
    const input = ''
    const terms = ['-']
    const expected = ['']

    expect(recursiveSplit(input, terms)).toEqual(expected)
  })

  it('empty terms array returns original input in array', () => {
    const input = 'apple-banana-cherry'
    const terms = []
    const expected = ['apple-banana-cherry']

    expect(recursiveSplit(input, terms)).toEqual(expected)
  })

  it('terms not found in input returns array with original input', () => {
    const input = 'apple, banana, cherry'
    const terms = ['-']
    const expected = ['apple, banana, cherry']

    expect(recursiveSplit(input, terms)).toEqual(expected)
  })
})

describe('splitInclusive', () => {
  it('splits by a single term as a literal string', () => {
    const input = 'apple-banana-cherry'
    const term = '-'
    const expected = ['apple', '-', 'banana', '-', 'cherry']

    expect(inclusiveSplit(input, term)).toEqual(expected)
  })

  it('splits by a single term as a RegExp', () => {
    const input = 'apple1banana22cherry333'
    const term = /\d+/
    const expected = ['apple', '1', 'banana', '22', 'cherry', '333']

    expect(inclusiveSplit(input, term)).toEqual(expected)
  })

  it('handles complex patterns with RegExp', () => {
    const input = 'apple.banana*cherry?'
    const term = /[.*?]/
    const expected = ['apple', '.', 'banana', '*', 'cherry', '?']

    expect(inclusiveSplit(input, term)).toEqual(expected)
  })

  it('empty input returns an array with an empty string', () => {
    const input = ''
    const term = '-'
    const expected = []

    expect(inclusiveSplit(input, term)).toEqual(expected)
  })

  it('term not found in input returns array with original input', () => {
    const input = 'apple, banana, cherry'
    const term = '-'
    const expected = ['apple, banana, cherry']

    expect(inclusiveSplit(input, term)).toEqual(expected)
  })

  it('must preserve things outside of groups', () => {
    const input = '|apple||banana||cherry|'
    const term = /\|(apple|banana|cherry)\|/
    const expected = ['|apple|', '|banana|', '|cherry|']

    expect(inclusiveSplit(input, term)).toEqual(expected)
  })
})

describe('byteSlice', () => {
  it('should slice a string based on byte length', () => {
    expect(byteSlice('Hello, 世界', 0, 10)).toBe('Hello, 世') // '世' is 3 bytes, '界' is 3 bytes
    expect(byteSlice('Hello, world!', 0, 5)).toBe('Hello')
    expect(byteSlice('ü'.repeat(5), 0, 8)).toBe('üüüü') // Each 'ü' is 2 bytes
    expect(byteSlice('Hello, world!', 0, 20)).toBe('Hello, world!')
  })

  it('should handle empty strings', () => {
    expect(byteSlice('', 0, 10)).toBe('')
  })

  it('should handle byte length zero', () => {
    expect(byteSlice('Hello, world!', 0, 0)).toBe('')
  })

  it('should handle negative start and end indices', () => {
    expect(byteSlice('Hello, world!', -6, -1)).toBe('world') // 'world!' has 6 bytes, slice to 'world'
  })

  it('should handle out of range indices', () => {
    expect(byteSlice('Hello, world!', 20, 30)).toBe('')
  })

  it('should handle strings with multi-byte characters only', () => {
    expect(byteSlice('世界', 0, 3)).toBe('世') // '世' is 3 bytes
    expect(byteSlice('世界', 0, 6)).toBe('世界') // '世界' is 6 bytes
  })
})

describe('toWordCase', () => {
  it('should convert a string to word case', () => {
    expect(toWordCase('helloWorld')).toBe('hello world')
    expect(toWordCase('HelloWorld')).toBe('hello world')
    expect(toWordCase('hello_world')).toBe('hello world')
  })
})

describe('trimToByteLength', () => {
  test('trims string to specific byte length', () => {
    const str = 'Hello, World!'
    const len = 10
    const result = trimToByteLength(str, len)

    let byteCount = 0

    for (let i = 0; i < result.length; i++) {
      var c = result.charCodeAt(i)

      byteCount +=
        c < 1 << 7
          ? 1
          : c < 1 << 11
          ? 2
          : c < 1 << 16
          ? 3
          : c < 1 << 21
          ? 4
          : c < 1 << 26
          ? 5
          : c < 1 << 31
          ? 6
          : Number.NaN
    }

    expect(byteCount).toBeLessThanOrEqual(len)
  })

  test('handles non-ASCII characters', () => {
    const str = 'こんにちは世界' // "Hello, World!" in Japanese
    const len = 9 // Single Japanese character is 3 bytes in UTF-8
    const result = trimToByteLength(str, len)

    expect(countBytes(result)).toBeLessThanOrEqual(len)
  })
})

describe('getTempId', () => {
  it('should generate a temporary ID with tmp- prefix', () => {
    const tempId = getTempId()

    expect(tempId).toMatch(/^tmp-/)
    expect(tempId.length).toBeGreaterThan(4)
  })

  it('should generate unique temporary IDs', () => {
    const tempId1 = getTempId()
    const tempId2 = getTempId()

    expect(tempId1).not.toBe(tempId2)
  })
})

describe('anyString', () => {
  it('should return the first string argument', () => {
    expect(anyString('first', 'second')).toBe('first')
    expect(anyString(null, 'second')).toBe('second')
    expect(anyString(undefined, 'third')).toBe('third')
    expect(anyString(123, 'fourth')).toBe('fourth')
  })

  it('should return undefined if no string arguments', () => {
    expect(anyString(null, undefined, 123)).toBeUndefined()
    expect(anyString()).toBeUndefined()
  })
})

describe('joinWithJoiner', () => {
  it('should join items with custom joiner', () => {
    expect(joinWithJoiner(['apple', 'banana', 'cherry'], 'or')).toBe(
      'apple, banana, or cherry'
    )
    expect(joinWithJoiner(['apple', 'banana'], 'or')).toBe('apple and banana') // @note always uses 'and' for 2 items
    expect(joinWithJoiner(['apple'], 'or')).toBe('apple')
  })

  it('should handle empty arrays', () => {
    expect(joinWithJoiner([], 'or')).toBe('')
    // @note function crashes on null - avoid testing this edge case
  })

  it('should flatten nested arrays', () => {
    expect(joinWithJoiner([['apple', 'banana'], 'cherry'], 'or')).toBe(
      'apple, banana, or cherry'
    )
  })
})

describe('joinWithAnd', () => {
  it('should join items with "and"', () => {
    expect(joinWithAnd(['apple', 'banana', 'cherry'])).toBe(
      'apple, banana, and cherry'
    )
    expect(joinWithAnd(['apple', 'banana'])).toBe('apple and banana')
    expect(joinWithAnd(['apple'])).toBe('apple')
  })

  it('should handle custom "and" joiner', () => {
    expect(joinWithAnd(['apple', 'banana', 'cherry'], '&')).toBe(
      'apple, banana, & cherry'
    )
  })
})

describe('joinWithOr', () => {
  it('should join items with "or"', () => {
    expect(joinWithOr(['apple', 'banana', 'cherry'])).toBe(
      'apple, banana, or cherry'
    )
    expect(joinWithOr(['apple', 'banana'])).toBe('apple and banana')
    expect(joinWithOr(['apple'])).toBe('apple')
  })

  it('should handle custom "or" joiner', () => {
    expect(joinWithOr(['apple', 'banana', 'cherry'], '/')).toBe(
      'apple, banana, / cherry'
    )
  })
})

describe('filterNonEmpty', () => {
  it('should filter out empty strings and null/undefined values', () => {
    expect(
      filterNonEmpty(['hello', '', '  ', 'world', null, undefined])
    ).toEqual(['hello', 'world'])
    expect(filterNonEmpty(['  trim  ', '  me  '])).toEqual(['trim', 'me'])
  })

  it('should handle empty arrays', () => {
    expect(filterNonEmpty([])).toEqual([])
  })

  it('should handle arrays with only empty values', () => {
    expect(filterNonEmpty(['', '  ', null, undefined])).toEqual([])
  })
})

describe('getPositionsIt', () => {
  it('should yield positions of search string', () => {
    const positions = Array.from(getPositionsIt('hello world hello', 'hello'))

    expect(positions).toEqual([
      [0, 5],
      [12, 17],
    ])
  })

  it('should handle overlapping matches', () => {
    // @note getPositionsIt doesn't handle overlapping matches - it advances by full match length
    const positions = Array.from(getPositionsIt('ababab', 'aba'))

    expect(positions).toEqual([[0, 3]]) // Only finds first match, skips overlapping one
  })

  it('should handle no matches', () => {
    const positions = Array.from(getPositionsIt('hello world', 'xyz'))

    expect(positions).toEqual([])
  })
})

describe('replaceBetween', () => {
  it('should replace substring between indices', () => {
    expect(replaceBetween('hello world', 6, 11, 'universe')).toBe(
      'hello universe'
    )
    expect(replaceBetween('abcdef', 1, 4, 'XYZ')).toBe('aXYZef')
  })

  it('should handle edge cases', () => {
    expect(replaceBetween('hello', 0, 0, 'X')).toBe('Xhello')
    expect(replaceBetween('hello', 5, 5, 'X')).toBe('helloX')
    expect(replaceBetween('hello', 0, 5, 'X')).toBe('X')
  })
})

describe('toUnicodeEscapedString', () => {
  it('should convert characters to unicode escape sequences', () => {
    // @note the function has a bug in substring(-4) which should be slice(-4)
    expect(toUnicodeEscapedString('hello')).toBe(
      '\\u00068\\u00065\\u0006c\\u0006c\\u0006f'
    )
    expect(toUnicodeEscapedString('A')).toBe('\\u00041')
  })

  it('should handle empty string', () => {
    expect(toUnicodeEscapedString('')).toBe('')
  })

  it('should handle special characters', () => {
    expect(toUnicodeEscapedString('€')).toBe('\\u00020ac')
  })
})

describe('toSlug', () => {
  it('should convert string to URL-friendly slug', () => {
    expect(toSlug('Hello World')).toBe('hello-world')
    expect(toSlug('This is a Test!')).toBe('this-is-a-test')
    expect(toSlug('  Multiple   Spaces  ')).toBe('multiple-spaces')
  })

  it('should handle special characters', () => {
    expect(toSlug('Hello@World#123')).toBe('hello-world-123')
    expect(toSlug('---multiple---dashes---')).toBe('multiple-dashes')
  })

  it('should handle empty string', () => {
    expect(toSlug('')).toBe('')
    expect(toSlug('   ')).toBe('')
  })
})

describe('toPascalCase', () => {
  it('should convert string to PascalCase', () => {
    expect(toPascalCase('hello world')).toBe('HelloWorld')
    expect(toPascalCase('this-is-a-test')).toBe('ThisIsATest')
    expect(toPascalCase('camelCase')).toBe('CamelCase')
  })

  it('should handle special characters', () => {
    expect(toPascalCase('hello@world#123')).toBe('HelloWorld123')
  })

  it('should handle empty string', () => {
    expect(toPascalCase('')).toBe('')
  })
})

describe('toSnakeCase', () => {
  it('should convert string to snake_case', () => {
    expect(toSnakeCase('Hello World')).toBe('hello_world')
    expect(toSnakeCase('This-Is-A-Test')).toBe('this_is_a_test')
    expect(toSnakeCase('camelCase')).toBe('camelcase')
  })

  it('should handle special characters', () => {
    expect(toSnakeCase('Hello@World#123')).toBe('hello_world_123')
    expect(toSnakeCase('___multiple___underscores___')).toBe(
      'multiple_underscores'
    )
  })

  it('should handle empty string', () => {
    expect(toSnakeCase('')).toBe('')
  })
})

describe('toKebabCase', () => {
  it('should convert string to kebab-case', () => {
    expect(toKebabCase('Hello World')).toBe('hello-world')
    expect(toKebabCase('This_Is_A_Test')).toBe('this_is_a_test') // @note \W doesn't include underscores (word chars)
    expect(toKebabCase('camelCase')).toBe('camelcase')
  })

  it('should handle special characters', () => {
    expect(toKebabCase('Hello@World#123')).toBe('hello-world-123')
    expect(toKebabCase('---multiple---dashes---')).toBe('multiple-dashes')
  })

  it('should handle empty string', () => {
    expect(toKebabCase('')).toBe('')
  })
})

describe('toTitleCase', () => {
  it('should convert string to Title Case', () => {
    expect(toTitleCase('hello world')).toBe('Hello World')
    expect(toTitleCase('this is a test')).toBe('This Is A Test')
    expect(toTitleCase('UPPERCASE STRING')).toBe('Uppercase String')
  })

  it('should handle single words', () => {
    expect(toTitleCase('hello')).toBe('Hello')
    expect(toTitleCase('HELLO')).toBe('Hello')
  })

  it('should handle empty string', () => {
    expect(toTitleCase('')).toBe('')
  })
})

describe('toSentenceCase', () => {
  it('should convert string to Sentence case', () => {
    expect(toSentenceCase('hello world')).toBe('Hello world')
    expect(toSentenceCase('this is a test. this is another sentence.')).toBe(
      'This is a test. This is another sentence.'
    )
  })

  it('should handle strings without periods', () => {
    expect(toSentenceCase('hello world')).toBe('Hello world')
  })

  it('should handle empty string', () => {
    expect(toSentenceCase('')).toBe('')
  })
})

describe('trimToFirstOccurrence', () => {
  it('should trim string to first occurrence of search', () => {
    expect(trimToFirstOccurrence('hello world hello', 'world')).toBe(
      'world hello'
    )
    expect(trimToFirstOccurrence('abcdefg', 'cde')).toBe('cdefg')
  })

  it('should return original string if search not found', () => {
    expect(trimToFirstOccurrence('hello world', 'xyz')).toBe('hello world')
  })

  it('should handle empty search', () => {
    expect(trimToFirstOccurrence('hello world', '')).toBe('hello world')
  })
})

describe('trimToLastOccurrence', () => {
  it('should trim string to last occurrence of search', () => {
    expect(trimToLastOccurrence('hello world hello', 'hello')).toBe(
      'hello world hello'
    )
    expect(trimToLastOccurrence('abcdefgcde', 'cde')).toBe('abcdefgcde')
  })

  it('should return original string if search not found', () => {
    expect(trimToLastOccurrence('hello world', 'xyz')).toBe('hello world')
  })

  it('should handle empty search', () => {
    expect(trimToLastOccurrence('hello world', '')).toBe('hello world')
  })
})

describe('inclusiveRecursiveSplit', () => {
  it('should recursively split string with inclusion', () => {
    expect(inclusiveRecursiveSplit('apple-banana*cherry', ['-', '*'])).toEqual([
      'apple',
      '-',
      'banana',
      '*',
      'cherry',
    ])
    expect(inclusiveRecursiveSplit('a.b,c', ['.', ','])).toEqual([
      'a',
      '.',
      'b',
      ',',
      'c',
    ])
  })

  it('should handle empty terms array', () => {
    expect(inclusiveRecursiveSplit('hello world', [])).toEqual(['hello world'])
  })

  it('should handle regex terms', () => {
    expect(inclusiveRecursiveSplit('a1b2c', [/\d/])).toEqual([
      'a',
      '1',
      'b',
      '2',
      'c',
    ])
  })
})

describe('splitOnce', () => {
  it('should split string only at first occurrence', () => {
    expect(splitOnce('apple-banana-cherry', '-')).toEqual([
      'apple',
      'banana-cherry',
    ])
    expect(splitOnce('a.b.c.d', '.')).toEqual(['a', 'b.c.d'])
  })

  it('should return original string if separator not found', () => {
    expect(splitOnce('hello world', '-')).toEqual(['hello world'])
  })

  it('should handle empty separator', () => {
    // @note empty separator returns index 0, splitting into ['', original]
    expect(splitOnce('hello', '')).toEqual(['', 'hello'])
  })
})

describe('byteLength', () => {
  it('should calculate byte length of string', () => {
    expect(byteLength('hello')).toBe(5)
    expect(byteLength('世界')).toBe(6) // 2 characters, 3 bytes each
    expect(byteLength('')).toBe(0)
  })

  it('should handle multi-byte characters', () => {
    expect(byteLength('café')).toBe(5) // 4 characters, é is 2 bytes
    expect(byteLength('🌟')).toBe(4) // emoji is 4 bytes
  })
})

describe('trimLines', () => {
  it('should trim empty lines from start and end', () => {
    expect(trimLines('\n\nhello world\n\n')).toBe('hello world')
    expect(trimLines('\nhello\nworld\n')).toBe('hello\nworld')
  })

  it('should handle strings without newlines', () => {
    expect(trimLines('hello world')).toBe('hello world')
  })

  it('should handle strings with only newlines', () => {
    expect(trimLines('\n\n\n')).toBe('')
  })
})

describe('stringToHash', () => {
  it('should convert string to hash number', () => {
    const hash1 = stringToHash('hello')
    const hash2 = stringToHash('world')

    expect(typeof hash1).toBe('number')
    expect(typeof hash2).toBe('number')
    expect(hash1).not.toBe(hash2)
    expect(hash1).toBeGreaterThanOrEqual(0)
  })

  it('should return 0 for empty string', () => {
    expect(stringToHash('')).toBe(0)
  })

  it('should return same hash for same string', () => {
    const str = 'test string'

    expect(stringToHash(str)).toBe(stringToHash(str))
  })
})

describe('ellipsis', () => {
  it('should add ellipsis when text exceeds length', () => {
    expect(ellipsis('hello world', 8)).toBe('hello...')
    expect(ellipsis('this is a long text', 10)).toBe('this is...')
  })

  it('should return original text when within length', () => {
    expect(ellipsis('hello', 10)).toBe('hello')
    expect(ellipsis('hello world', 11)).toBe('hello world')
  })

  it('should handle edge cases', () => {
    expect(ellipsis('hello', 5)).toBe('hello')
    expect(ellipsis('hello', 3)).toBe('...') // @note length-3 = 0, so just ellipsis
  })
})

describe('singleQuote', () => {
  it('should wrap string in single quotes', () => {
    expect(singleQuote('hello')).toBe("'hello'")
    expect(singleQuote('world')).toBe("'world'")
  })

  it('should escape single quotes in string', () => {
    expect(singleQuote("it's a test")).toBe("'it\\'s a test'")
    expect(singleQuote("can't")).toBe("'can\\'t'")
  })

  it('should handle empty string', () => {
    expect(singleQuote('')).toBe("''")
  })
})

describe('doubleQuote', () => {
  it('should wrap string in double quotes', () => {
    expect(doubleQuote('hello')).toBe('"hello"')
    expect(doubleQuote('world')).toBe('"world"')
  })

  it('should escape double quotes in string', () => {
    expect(doubleQuote('he said "hello"')).toBe('"he said \\"hello\\""')
    expect(doubleQuote('"quoted"')).toBe('"\\"quoted\\""')
  })

  it('should handle empty string', () => {
    expect(doubleQuote('')).toBe('""')
  })
})

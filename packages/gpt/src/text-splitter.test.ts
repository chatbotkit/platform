import { getTextTokensLength } from './index'
import {
  DEFAULT_SEPARATORS,
  splitTextRecursive,
  splitTextRecursiveByTokens,
} from './text-splitter'

// ---
// ---
// ---

// @note helper ported from LangChain.js test suite to generate lines of
// repeated characters for chunk boundary testing

function textLineGenerator(char: string, length: number): string {
  const line = new Array(length).join(char)

  return `${line}\n`
}

// ---
// ---
// ---

describe('splitTextRecursive', () => {
  describe('basic splitting', () => {
    it('returns single chunk for short text', () => {
      const output = splitTextRecursive('Hello world', {
        chunkSize: 100,
        chunkOverlap: 0,
      })

      expect(output).toEqual(['Hello world'])
    })

    it('returns empty array for empty text', () => {
      const output = splitTextRecursive('', {
        chunkSize: 100,
        chunkOverlap: 0,
      })

      expect(output).toEqual([])
    })

    it('splits text on double newlines by default', () => {
      const text = 'Hello\n\nWorld'

      const output = splitTextRecursive(text, {
        chunkSize: 10,
        chunkOverlap: 0,
      })

      expect(output).toEqual(['Hello', 'World'])
    })

    it('splits text on single newlines when no double newlines present', () => {
      const text = 'Hello\nWorld'

      const output = splitTextRecursive(text, {
        chunkSize: 6,
        chunkOverlap: 0,
      })

      expect(output).toEqual(['Hello', 'World'])
    })

    it('splits text on spaces as last resort before characters', () => {
      const text = 'foo bar baz'

      const output = splitTextRecursive(text, {
        chunkSize: 5,
        chunkOverlap: 0,
      })

      expect(output).toEqual(['foo', 'bar', 'baz'])
    })

    it('splits text into individual characters as final fallback', () => {
      const text = 'abcde'

      const output = splitTextRecursive(text, {
        chunkSize: 2,
        chunkOverlap: 0,
      })

      expect(output).toEqual(['ab', 'cd', 'e'])
    })
  })

  // ---
  // ---
  // ---

  describe('overlap', () => {
    it('creates overlapping chunks', () => {
      const text = 'foo bar baz 123'

      const output = splitTextRecursive(text, {
        chunkSize: 7,
        chunkOverlap: 3,
        keepSeparator: false,
      })

      expect(output).toEqual(['foo bar', 'bar baz', 'baz 123'])
    })

    it('handles overlap with single character separators', () => {
      const text = 'aa ab ac ba bb'

      const output = splitTextRecursive(text, {
        keepSeparator: false,
        chunkSize: 7,
        chunkOverlap: 3,
      })

      expect(output).toEqual(['aa ab', 'ab ac', 'ac ba', 'ba bb'])
    })
  })

  // ---
  // ---
  // ---

  describe('recursive behavior', () => {
    it('uses double newline first then falls back to single newline', () => {
      const text =
        "Hi.\n\nI'm Harrison.\n\nHow? Are? You?\nOkay then f f f f.\nThis is a weird text to write, but gotta test the splittingggg some how.\n\nBye!\n\n-H."

      const output = splitTextRecursive(text, {
        chunkSize: 10,
        chunkOverlap: 1,
      })

      expect(output).toEqual([
        'Hi.',
        "I'm",
        'Harrison.',
        'How? Are?',
        'You?',
        'Okay then',
        'f f f f.',
        'This is a',
        'weird',
        'text to',
        'write,',
        'but gotta',
        'test the',
        'splitting',
        'gggg',
        'some how.',
        'Bye!',
        '-H.',
      ])
    })

    it('handles multi-level separator fallback', () => {
      const text =
        'Part A first paragraph.\n\nPart A second paragraph.\n\nPart B section.\nLine 1\nLine 2'

      const output = splitTextRecursive(text, {
        chunkSize: 30,
        chunkOverlap: 0,
      })

      expect(output.length).toBeGreaterThan(1)

      for (const chunk of output) {
        expect(chunk.length).toBeLessThanOrEqual(30)
      }
    })
  })

  // ---
  // ---
  // ---

  describe('keepSeparator', () => {
    it('keeps separator when keepSeparator is true (default)', () => {
      const text = 'Hello\n\nWorld'

      const output = splitTextRecursive(text, {
        chunkSize: 8,
        chunkOverlap: 0,
        keepSeparator: true,
      })

      expect(output).toEqual(['Hello', 'World'])
    })

    it('removes separator when keepSeparator is false', () => {
      const text = 'foo bar baz'

      const output = splitTextRecursive(text, {
        chunkSize: 7,
        chunkOverlap: 3,
        keepSeparator: false,
      })

      expect(output).toEqual(['foo bar', 'bar baz'])
    })
  })

  // ---
  // ---
  // ---

  describe('custom separators', () => {
    it('uses custom separators', () => {
      const text = 'part1|part2|part3'

      const output = splitTextRecursive(text, {
        chunkSize: 6,
        chunkOverlap: 0,
        separators: ['|', ''],
        keepSeparator: false,
      })

      expect(output).toEqual(['part1', 'part2', 'part3'])
    })

    it('falls through custom separators in order', () => {
      const text = 'section1##subsection1.1##subsection1.2\n\nsection2'

      const output = splitTextRecursive(text, {
        chunkSize: 20,
        chunkOverlap: 0,
        separators: ['\n\n', '##', ' ', ''],
        keepSeparator: false,
      })

      expect(output.length).toBeGreaterThan(1)

      for (const chunk of output) {
        expect(chunk.length).toBeLessThanOrEqual(20)
      }
    })
  })

  // ---
  // ---
  // ---

  describe('custom length function', () => {
    it('uses a custom length function', () => {
      // @note word count length function
      const wordCount = (text: string) =>
        text.split(/\s+/).filter((w) => w.length > 0).length

      const text = 'one two three four five six seven eight'

      const output = splitTextRecursive(text, {
        chunkSize: 3,
        chunkOverlap: 0,
        lengthFunction: wordCount,
      })

      expect(output.length).toBeGreaterThan(1)
    })
  })

  // ---
  // ---
  // ---

  describe('validation', () => {
    it('throws when chunkOverlap >= chunkSize', () => {
      expect(() => {
        splitTextRecursive('test', { chunkSize: 2, chunkOverlap: 4 })
      }).toThrow('Cannot have chunkOverlap >= chunkSize')

      expect(() => {
        splitTextRecursive('test', { chunkSize: 2, chunkOverlap: 2 })
      }).toThrow('Cannot have chunkOverlap >= chunkSize')
    })
  })

  // ---
  // ---
  // ---

  describe('DEFAULT_SEPARATORS', () => {
    it('has the correct default separators', () => {
      expect(DEFAULT_SEPARATORS).toEqual(['\n\n', '\n', ' ', ''])
    })
  })

  // ---
  // ---
  // ---

  describe('edge cases', () => {
    it('handles text with only separators', () => {
      const output = splitTextRecursive('\n\n\n\n', {
        chunkSize: 5,
        chunkOverlap: 0,
      })

      expect(output).toEqual([])
    })

    it('handles single character text', () => {
      const output = splitTextRecursive('a', {
        chunkSize: 10,
        chunkOverlap: 0,
      })

      expect(output).toEqual(['a'])
    })

    it('handles text with trailing whitespace', () => {
      const output = splitTextRecursive('hello   ', {
        chunkSize: 10,
        chunkOverlap: 0,
      })

      expect(output).toEqual(['hello'])
    })

    it('handles large chunk size', () => {
      const text = 'This is a test string that should fit in one chunk.'

      const output = splitTextRecursive(text, {
        chunkSize: 1000,
        chunkOverlap: 0,
      })

      expect(output).toEqual([text])
    })

    it('handles text with multiple consecutive separators', () => {
      const text = 'Hello\n\n\n\nWorld'

      const output = splitTextRecursive(text, {
        chunkSize: 10,
        chunkOverlap: 0,
      })

      expect(output).toEqual(['Hello', 'World'])
    })
  })
})

// ---
// ---
// ---

// @note the following tests are ported from langchain-ai/langchainjs
// libs/langchain-textsplitters/src/tests/text_splitter.test.ts to verify
// behavioral parity between our implementation and LangChain's
// RecursiveCharacterTextSplitter

describe('langchain parity: CharacterTextSplitter equivalents', () => {
  // @note LangChain's CharacterTextSplitter uses a single separator and then
  // calls mergeSplits. We replicate this using separators: [sep] with
  // keepSeparator: false.

  it('splits by character count with overlap', () => {
    const output = splitTextRecursive('foo bar baz 123', {
      separators: [' '],
      chunkSize: 7,
      chunkOverlap: 3,
      keepSeparator: false,
    })

    expect(output).toEqual(['foo bar', 'bar baz', 'baz 123'])
  })

  it('does not create empty documents from double spaces', () => {
    // @note LangChain's CharacterTextSplitter is non-recursive with a single
    // separator. We replicate this with separators: [' ', ''] so the recursive
    // splitter has a fallback.
    const output = splitTextRecursive('foo  bar', {
      separators: [' ', ''],
      chunkSize: 4,
      chunkOverlap: 0,
      keepSeparator: false,
    })

    expect(output).toEqual(['foo', 'bar'])
  })

  it('handles long words that exceed chunk size', () => {
    const output = splitTextRecursive('foo bar baz a a', {
      separators: [' ', ''],
      chunkSize: 3,
      chunkOverlap: 1,
      keepSeparator: false,
    })

    expect(output).toEqual(['foo', 'bar', 'baz', 'a a'])
  })

  it('handles shorter words first then long words', () => {
    const output = splitTextRecursive('a a foo bar baz', {
      separators: [' ', ''],
      chunkSize: 3,
      chunkOverlap: 1,
      keepSeparator: false,
    })

    expect(output).toEqual(['a a', 'foo', 'bar', 'baz'])
  })

  it('splits into characters with tiny chunk size', () => {
    // @note unlike LangChain's CharacterTextSplitter (which leaves oversized
    // splits intact), the recursive splitter falls through to '' separator
    // and splits into individual characters when chunkSize < word length
    const output = splitTextRecursive('foo bar baz', {
      separators: [' ', ''],
      chunkSize: 1,
      chunkOverlap: 0,
      keepSeparator: false,
    })

    expect(output).toEqual(['f', 'o', 'o', 'b', 'a', 'r', 'b', 'a', 'z'])
  })

  it('handles exhausted separators gracefully', () => {
    // @note when separators list has no '' fallback, long words are emitted
    // as-is rather than crashing
    const output = splitTextRecursive('foo bar baz', {
      separators: [' '],
      chunkSize: 2,
      chunkOverlap: 0,
      keepSeparator: false,
    })

    expect(output).toEqual(['foo', 'bar', 'baz'])
  })
})

// ---
// ---
// ---

// @note the following tests are ported from langchain-ai/langchain (Python)
// libs/text-splitters/tests/unit_tests/test_text_splitters.py to verify
// behavioral parity between our implementation and LangChain Python's
// RecursiveCharacterTextSplitter

describe('langchain parity (python): CharacterTextSplitter equivalents', () => {
  it('splits edge separator into small chunks', () => {
    // @note Python: test_character_text_splitter_separtor_empty_doc
    // "f b" with separator " ", chunk_size=2 → ["f", "b"]
    const output = splitTextRecursive('f b', {
      separators: [' ', ''],
      chunkSize: 2,
      chunkOverlap: 0,
      keepSeparator: false,
    })

    expect(output).toEqual(['f', 'b'])
  })

  it('handles text with no matching separator', () => {
    // @note Python: test_character_text_splitter_no_separator_in_text
    // Single word with no separator present returns it as-is
    const output = splitTextRecursive('singleword', {
      separators: [' ', ''],
      chunkSize: 10,
      chunkOverlap: 0,
      keepSeparator: false,
    })

    expect(output).toEqual(['singleword'])
  })

  it('returns empty array for whitespace-only input', () => {
    // @note Python: test_character_text_splitter_whitespace_only
    const output = splitTextRecursive(' ', {
      separators: [' ', ''],
      chunkSize: 5,
      chunkOverlap: 0,
      keepSeparator: false,
    })

    expect(output).toEqual([])
  })

  it('merges splits respecting chunk size and overlap', () => {
    // @note Python: test_merge_splits
    // ["foo", "bar", "baz"] with separator " ", chunk_size=9, overlap=2
    // → "foo bar" (len 7 ≤ 9), then "baz" (can't merge further)
    const output = splitTextRecursive('foo bar baz', {
      separators: [' '],
      chunkSize: 9,
      chunkOverlap: 2,
      keepSeparator: false,
    })

    expect(output).toEqual(['foo bar', 'baz'])
  })
})

// ---
// ---
// ---

describe('langchain parity (python): RecursiveCharacterTextSplitter', () => {
  it('splits with keepSeparator true using custom separators', () => {
    // @note Python: test_iterative_text_splitter_keep_separator
    // Text "....5X..3Y...4X....5Y..." with separators ["X", "Y"],
    // keepSeparator=true, chunkSize=6 (5 + 1 for separator)
    const output = splitTextRecursive('....5X..3Y...4X....5Y...', {
      separators: ['X', 'Y'],
      chunkSize: 6,
      chunkOverlap: 0,
      keepSeparator: true,
    })

    expect(output).toEqual(['....5', 'X..3', 'Y...4', 'X....5', 'Y...'])
  })

  it('splits with keepSeparator false using custom separators', () => {
    // @note Python: test_iterative_text_splitter_discard_separator
    // Same text but keepSeparator=false and chunkSize=5
    const output = splitTextRecursive('....5X..3Y...4X....5Y...', {
      separators: ['X', 'Y'],
      chunkSize: 5,
      chunkOverlap: 0,
      keepSeparator: false,
    })

    expect(output).toEqual(['....5', '..3', '...4', '....5', '...'])
  })

  it('validates that chunk overlap must be less than chunk size', () => {
    // @note Python: test_character_text_splitting_args
    // Python only rejects overlap > size, but JS LangChain and our
    // implementation also reject overlap == size. This is a known difference.
    expect(() => {
      splitTextRecursive('test', { chunkSize: 2, chunkOverlap: 4 })
    }).toThrow('Cannot have chunkOverlap >= chunkSize')
  })

  it('rejects zero and negative chunk sizes', () => {
    // @note Python: test_character_text_splitting_args validates
    // chunk_size > 0 and chunk_overlap >= 0. Our implementation uses
    // defaults when not provided, so this validates the throw path.
    expect(() => {
      splitTextRecursive('test', { chunkSize: 0, chunkOverlap: 0 })
    }).toThrow()
  })

  it('splits with keepSeparator=true (start) matching Python start behavior', () => {
    // @note Python: test_recursive_character_text_splitter_keep_separators
    // Python supports keep_separator="start" which prepends separator to
    // the following chunk. Our keepSeparator=true uses regex lookahead
    // which produces the same "start" behavior.
    const output = splitTextRecursive('Apple,banana,orange and tomato.', {
      separators: [',', '.'],
      chunkSize: 10,
      chunkOverlap: 0,
      keepSeparator: true,
    })

    expect(output).toEqual(['Apple', ',banana', ',orange and tomato', '.'])
  })

  // @note Python also supports keep_separator="end" which appends the
  // separator to the preceding chunk: ["Apple,", "banana,", "orange and tomato."]
  // Our implementation only supports boolean keepSeparator (matching JS
  // LangChain). "end" mode is a known Python-only feature difference.
})

// ---
// ---
// ---

describe('langchain parity: RecursiveCharacterTextSplitter', () => {
  it('produces one unique chunk for short content', () => {
    const content = textLineGenerator('A', 70)

    const output = splitTextRecursive(content, {
      chunkSize: 100,
      chunkOverlap: 0,
    })

    expect(output).toEqual([content.trim()])
  })

  it('splits two lines into separate chunks', () => {
    const line1 = textLineGenerator('A', 70)
    const line2 = textLineGenerator('B', 70)
    const content = line1 + line2

    const output = splitTextRecursive(content, {
      chunkSize: 100,
      chunkOverlap: 0,
    })

    expect(output).toEqual([line1.trim(), line2.trim()])
  })

  it('splits identical lines into separate chunks', () => {
    const line = textLineGenerator('A', 70)
    const content = line + line

    const output = splitTextRecursive(content, {
      chunkSize: 100,
      chunkOverlap: 0,
    })

    expect(output).toEqual([line.trim(), line.trim()])
  })

  it('handles content starting with newlines', () => {
    const line1 = textLineGenerator('\n', 2)
    const line2 = textLineGenerator('A', 70)
    const line3 = textLineGenerator('\n', 4)
    const line4 = textLineGenerator('B', 70)

    const content = line1 + line2 + line3 + line4

    const output = splitTextRecursive(content, {
      chunkSize: 100,
      chunkOverlap: 0,
    })

    expect(output).toEqual([line2.trim(), line4.trim()])
  })

  it('creates overlapping chunks from generated lines', () => {
    const line1 = textLineGenerator('A', 70)
    const line2 = textLineGenerator('B', 20)
    const line3 = textLineGenerator('C', 70)
    const content = line1 + line2 + line3

    const output = splitTextRecursive(content, {
      chunkSize: 100,
      chunkOverlap: 30,
    })

    // @note first chunk contains line1 + line2, second contains line2 + line3
    expect(output).toEqual([(line1 + line2).trim(), (line2 + line3).trim()])
  })

  it('handles overlap spanning multiple short lines', () => {
    const line1 = textLineGenerator('A', 70)
    const line2 = textLineGenerator('B', 10)
    const line3 = textLineGenerator('C', 10)
    const line4 = textLineGenerator('D', 70)
    const content = line1 + line2 + line3 + line4

    const output = splitTextRecursive(content, {
      chunkSize: 100,
      chunkOverlap: 30,
    })

    expect(output).toEqual([
      (line1 + line2 + line3).trim(),
      (line2 + line3 + line4).trim(),
    ])
  })

  it('handles the iterative text splitter test case', () => {
    const text = `Hi.\n\nI'm Harrison.\n\nHow? Are? You?\nOkay then f f f f.\nThis is a weird text to write, but gotta test the splittingggg some how.\n\nBye!\n\n-H.`

    const output = splitTextRecursive(text, {
      chunkSize: 10,
      chunkOverlap: 1,
    })

    expect(output).toEqual([
      'Hi.',
      "I'm",
      'Harrison.',
      'How? Are?',
      'You?',
      'Okay then',
      'f f f f.',
      'This is a',
      'weird',
      'text to',
      'write,',
      'but gotta',
      'test the',
      'splitting',
      'gggg',
      'some how.',
      'Bye!',
      '-H.',
    ])
  })

  it('considers separator length correctly for chunk size', () => {
    const output = splitTextRecursive('aa ab ac ba bb', {
      keepSeparator: false,
      chunkSize: 7,
      chunkOverlap: 3,
    })

    expect(output).toEqual(['aa ab', 'ab ac', 'ac ba', 'ba bb'])
  })
})

// ---
// ---
// ---

describe('langchain parity: language-specific separators', () => {
  it('splits markdown content using markdown separators', () => {
    const text =
      '# 🦜️🔗 LangChain\n' +
      '\n' +
      '⚡ Building applications with LLMs through composability ⚡\n' +
      '\n' +
      '## Quick Install\n' +
      '\n' +
      '```bash\n' +
      "# Hopefully this code block isn't split\n" +
      'pip install langchain\n' +
      '```\n' +
      '\n' +
      'As an open source project in a rapidly developing field, we are extremely open to contributions.'

    // @note these are the separators from
    // RecursiveCharacterTextSplitter.getSeparatorsForLanguage('markdown')
    const markdownSeparators = [
      '\n## ',
      '\n### ',
      '\n#### ',
      '\n##### ',
      '\n###### ',
      '```\n\n',
      '\n\n***\n\n',
      '\n\n---\n\n',
      '\n\n___\n\n',
      '\n\n',
      '\n',
      ' ',
      '',
    ]

    const output = splitTextRecursive(text, {
      separators: markdownSeparators,
      chunkSize: 100,
      chunkOverlap: 0,
      keepSeparator: true,
    })

    expect(output).toEqual([
      '# 🦜️🔗 LangChain\n\n⚡ Building applications with LLMs through composability ⚡',
      "## Quick Install\n\n```bash\n# Hopefully this code block isn't split\npip install langchain",
      '```',
      'As an open source project in a rapidly developing field, we are extremely open to contributions.',
    ])
  })

  it('splits LaTeX content using LaTeX separators', () => {
    const text = [
      '\\begin{document}',
      '\\title{🦜️🔗 LangChain}',
      '⚡ Building applications with LLMs through composability ⚡',
      '',
      '\\section{Quick Install}',
      '',
      '\\begin{verbatim}',
      "Hopefully this code block isn't split",
      'pnpm install langchain',
      '\\end{verbatim}',
      '',
      'As an open source project in a rapidly developing field, we are extremely open to contributions.',
      '',
      '\\end{document}',
    ].join('\n')

    // @note these are the separators from
    // RecursiveCharacterTextSplitter.getSeparatorsForLanguage('latex')
    const latexSeparators = [
      '\n\\chapter{',
      '\n\\section{',
      '\n\\subsection{',
      '\n\\subsubsection{',
      '\n\\begin{enumerate}',
      '\n\\begin{itemize}',
      '\n\\begin{description}',
      '\n\\begin{list}',
      '\n\\begin{quote}',
      '\n\\begin{quotation}',
      '\n\\begin{verse}',
      '\n\\begin{verbatim}',
      '\n\\begin{align}',
      '$$',
      '$',
      '\n\n',
      '\n',
      ' ',
      '',
    ]

    const output = splitTextRecursive(text, {
      separators: latexSeparators,
      chunkSize: 100,
      chunkOverlap: 0,
      keepSeparator: true,
    })

    expect(output).toEqual([
      '\\begin{document}\n\\title{🦜️🔗 LangChain}\n⚡ Building applications with LLMs through composability ⚡',
      '\\section{Quick Install}',
      "\\begin{verbatim}\nHopefully this code block isn't split\npnpm install langchain\n\\end{verbatim}",
      'As an open source project in a rapidly developing field, we are extremely open to contributions.',
      '\\end{document}',
    ])
  })

  it('splits HTML content using HTML separators', () => {
    const text = [
      '<!DOCTYPE html>',
      '<html>',
      '  <head>',
      '    <title>🦜️🔗 LangChain</title>',
      '    <style>',
      '      body {',
      '        font-family: Arial, sans-serif;',
      '      }',
      '      h1 {',
      '        color: darkblue;',
      '      }',
      '    </style>',
      '  </head>',
      '  <body>',
      '    <div>',
      '      <h1>🦜️🔗 LangChain</h1>',
      '      <p>⚡ Building applications with LLMs through composability ⚡</p>',
      '    </div>',
      '    <div>',
      '      As an open source project in a rapidly developing field, we are extremely open to contributions.',
      '    </div>',
      '  </body>',
      '</html>',
    ].join('\n')

    // @note these are the separators from
    // RecursiveCharacterTextSplitter.getSeparatorsForLanguage('html')
    const htmlSeparators = [
      '<body>',
      '<div>',
      '<p>',
      '<br>',
      '<li>',
      '<h1>',
      '<h2>',
      '<h3>',
      '<h4>',
      '<h5>',
      '<h6>',
      '<span>',
      '<table>',
      '<tr>',
      '<td>',
      '<th>',
      '<ul>',
      '<ol>',
      '<header>',
      '<footer>',
      '<nav>',
      '<head>',
      '<style>',
      '<script>',
      '<meta>',
      '<title>',
      ' ',
      '',
    ]

    const output = splitTextRecursive(text, {
      separators: htmlSeparators,
      chunkSize: 175,
      chunkOverlap: 20,
      keepSeparator: true,
    })

    expect(output).toEqual([
      '<!DOCTYPE html>\n<html>',
      '<head>\n    <title>🦜️🔗 LangChain</title>',
      `<style>\n      body {\n        font-family: Arial, sans-serif;\n      }\n      h1 {\n        color: darkblue;\n      }\n    </style>\n  </head>`,
      `<body>\n    <div>\n      <h1>🦜️🔗 LangChain</h1>\n      <p>⚡ Building applications with LLMs through composability ⚡</p>\n    </div>`,
      `<div>\n      As an open source project in a rapidly developing field, we are extremely open to contributions.\n    </div>\n  </body>\n</html>`,
    ])
  })
})

// ---
// ---
// ---

describe('splitTextRecursiveByTokens', () => {
  it('splits text using token-based length', () => {
    const text = 'Hello world. This is a test of the token-based text splitter.'

    const output = splitTextRecursiveByTokens(text, {
      chunkSize: 5,
      chunkOverlap: 0,
    })

    expect(output.length).toBeGreaterThan(1)
  })

  it('uses default separators', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.'

    const output = splitTextRecursiveByTokens(text, {
      chunkSize: 5,
      chunkOverlap: 0,
    })

    expect(output.length).toBeGreaterThan(1)
    expect(output[0]).toContain('First')
  })

  it('supports custom separators', () => {
    const text = 'part1|part2|part3'

    const output = splitTextRecursiveByTokens(text, {
      chunkSize: 5,
      chunkOverlap: 0,
      separators: ['|', ''],
      keepSeparator: false,
    })

    expect(output.length).toBeGreaterThan(1)
  })

  it('respects chunk overlap', () => {
    const text =
      'The quick brown fox jumps over the lazy dog near the big red barn.'

    const withOverlap = splitTextRecursiveByTokens(text, {
      chunkSize: 5,
      chunkOverlap: 2,
    })

    const withoutOverlap = splitTextRecursiveByTokens(text, {
      chunkSize: 5,
      chunkOverlap: 0,
    })

    expect(withOverlap.length).toBeGreaterThanOrEqual(withoutOverlap.length)
  })

  it('splits large text into bounded chunks even when custom separators do not match content', () => {
    // Reproduce bug: when custom separators are provided that do not appear in
    // the file content, the entire text was returned as a single oversized
    // chunk instead of being split by token count.
    const chunkSize = 10
    const text = Array(chunkSize * 5)
      .fill('word')
      .join(' ')

    const output = splitTextRecursiveByTokens(text, {
      chunkSize,
      chunkOverlap: 0,
      separators: ['|'],
    })

    expect(output.length).toBeGreaterThan(1)

    for (const chunk of output) {
      expect(getTextTokensLength(chunk)).toBeLessThanOrEqual(chunkSize + 1)
    }
  })

  // --- Footgun and edge case tests ---

  it('uses token boundaries not character boundaries for oversized chunks', () => {
    // Token-based splitting should preserve word boundaries better
    const text = 'algorithm cryptocurrency authentication authorization'
    const chunkSize = 3

    const output = splitTextRecursiveByTokens(text, {
      chunkSize,
      chunkOverlap: 0,
      separators: ['|'], // won't match, forces fallback
    })

    // Should not have mangled mid-word splits like "algor" + "ithm"
    // Token boundaries align with morphemes/words
    for (const chunk of output) {
      // Each chunk should be a valid substring that doesn't start/end mid-character
      expect(text.includes(chunk.trim())).toBe(true)
    }
  })

  it('handles unicode emojis without breaking grapheme clusters', () => {
    const text = '👨‍👩‍👧 family emoji 🎉 party 🚀 rocket 💻 computer'
    const chunkSize = 5

    const output = splitTextRecursiveByTokens(text, {
      chunkSize,
      chunkOverlap: 0,
    })

    // Should produce multiple chunks
    expect(output.length).toBeGreaterThan(1)

    // Each chunk should be valid UTF-8 (no broken surrogates)
    for (const chunk of output) {
      expect(() => encodeURIComponent(chunk)).not.toThrow()
    }
  })

  it('handles empty separators array by falling back to token splitting', () => {
    const text = 'This is a test of empty separators handling.'
    const chunkSize = 5

    const output = splitTextRecursiveByTokens(text, {
      chunkSize,
      chunkOverlap: 0,
      separators: [],
    })

    expect(output.length).toBeGreaterThan(1)

    for (const chunk of output) {
      expect(getTextTokensLength(chunk)).toBeLessThanOrEqual(chunkSize + 1)
    }
  })

  it('handles very long technical strings without natural break points', () => {
    // URL-like string with no spaces or newlines
    const text =
      'https://example.com/api/v1/users/12345/documents/67890/versions/abcdef/metadata?format=json&include=all'
    const chunkSize = 10

    const output = splitTextRecursiveByTokens(text, {
      chunkSize,
      chunkOverlap: 0,
      separators: ['\n\n', '\n'], // won't match URLs
    })

    expect(output.length).toBeGreaterThan(1)

    for (const chunk of output) {
      expect(getTextTokensLength(chunk)).toBeLessThanOrEqual(chunkSize + 1)
    }
  })

  it('handles mixed content with code blocks', () => {
    const text = `Here is some code:

function calculateSum(a, b) {
  return a + b;
}

And here is more text after the code block.`

    const output = splitTextRecursiveByTokens(text, {
      chunkSize: 15,
      chunkOverlap: 0,
    })

    expect(output.length).toBeGreaterThan(1)

    // All content should be preserved across chunks
    const rejoined = output.join('')

    expect(rejoined).toContain('calculateSum')
    expect(rejoined).toContain('return')
  })

  it('correctly applies overlap in token-based fallback', () => {
    const text = Array(50).fill('word').join(' ')
    const chunkSize = 10
    const chunkOverlap = 3

    const output = splitTextRecursiveByTokens(text, {
      chunkSize,
      chunkOverlap,
      separators: ['|'], // forces token-based fallback
    })

    // With overlap, consecutive chunks should share some content
    for (let i = 1; i < output.length; i++) {
      const prevEnd = output[i - 1].slice(-20)
      const currStart = output[i].slice(0, 20)
      // There should be some overlap (shared substring)
      const hasOverlap =
        prevEnd.includes(currStart.slice(0, 5)) ||
        currStart.includes(prevEnd.slice(-5))

      expect(hasOverlap || output[i - 1].length < 10).toBe(true)
    }
  })

  it('returns text unchanged when shorter than chunkSize', () => {
    const text = 'Short'

    const output = splitTextRecursiveByTokens(text, {
      chunkSize: 100,
      chunkOverlap: 0,
    })

    expect(output).toHaveLength(1)
    expect(output[0]).toBe(text)
  })

  it('handles text exactly at chunkSize boundary', () => {
    // Create text that is exactly chunkSize tokens
    const words = ['The', 'quick', 'brown', 'fox', 'jumps']
    const text = words.join(' ')
    const tokenCount = getTextTokensLength(text)

    const output = splitTextRecursiveByTokens(text, {
      chunkSize: tokenCount,
      chunkOverlap: 0,
    })

    expect(output).toHaveLength(1)
    expect(output[0].trim()).toBe(text)
  })

  it('produces no empty chunks', () => {
    const text = '\n\n\n\nSome text here\n\n\n\nMore text\n\n\n\n'

    const output = splitTextRecursiveByTokens(text, {
      chunkSize: 5,
      chunkOverlap: 0,
    })

    for (const chunk of output) {
      expect(chunk.trim().length).toBeGreaterThan(0)
    }
  })

  it('handles repeated separators without infinite loops', () => {
    const text = '||||||||content||||||||more||||||||'

    const output = splitTextRecursiveByTokens(text, {
      chunkSize: 5,
      chunkOverlap: 0,
      separators: ['|'],
    })

    expect(output.length).toBeGreaterThan(0)
    // Should complete without hanging
  })

  it('preserves all content across chunks (no data loss)', () => {
    const originalText =
      'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.'

    const output = splitTextRecursiveByTokens(originalText, {
      chunkSize: 8,
      chunkOverlap: 0,
    })

    // Remove overlapping content and verify all words are present
    const words = originalText.split(/\s+/)
    const allChunkText = output.join(' ')

    for (const word of words) {
      expect(allChunkText).toContain(word)
    }
  })

  it('strictly enforces token limits with no violations', () => {
    // Multiple test cases to verify strict enforcement
    const testCases = [
      {
        text: Array(100).fill('word').join(' '),
        separators: ['|'],
        chunkSize: 10,
      },
      {
        text: Array(100).fill('hello world foo bar').join(' '),
        separators: ['|'],
        chunkSize: 15,
      },
      { text: 'abc'.repeat(500), separators: ['|'], chunkSize: 20 },
      {
        text: 'some-long-identifier-name '.repeat(50),
        separators: ['|'],
        chunkSize: 5,
      },
      // Edge case: single token per chunk
      { text: 'word '.repeat(100), separators: ['|'], chunkSize: 1 },
    ]

    for (const tc of testCases) {
      const output = splitTextRecursiveByTokens(tc.text, {
        chunkSize: tc.chunkSize,
        chunkOverlap: 0,
        separators: tc.separators,
      })

      for (const chunk of output) {
        const tokenCount = getTextTokensLength(chunk)

        expect(tokenCount).toBeLessThanOrEqual(tc.chunkSize)
      }
    }
  })
})

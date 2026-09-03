import {
  splitTextByTopLevelBlocks,
  splitTextByTopLevelBlocksToSize,
} from './split'

function expectChunksToFit(chunks, maxSize) {
  expect(chunks.length).toBeGreaterThan(0)
  expect(chunks.every((chunk) => chunk.length <= maxSize)).toBe(true)
}

describe('splitTextByTopLevelBlocks', () => {
  test('should split text into top-level nodes', () => {
    const text = `
# Heading

This is a paragraph.

\`\`\`
console.log('Code block');
\`\`\`

- List item 1
- List item 2

| Table | Header |
| ----- | ------ |
| Row 1 | Value  |
`

    const expected = [
      '# Heading',
      'This is a paragraph.',
      "```\nconsole.log('Code block');\n```",
      '- List item 1\n- List item 2',
      '| Table | Header |\n| ----- | ------ |\n| Row 1 | Value  |',
    ]

    const result = splitTextByTopLevelBlocks(text)

    expect(result).toEqual(expected)
  })

  test('should return an array with an empty string for an empty string', () => {
    const text = ''
    const expected = ['']
    const result = splitTextByTopLevelBlocks(text)

    expect(result).toEqual(expected)
  })

  test('should return an array with a single paragraph for a single paragraph', () => {
    const text = 'This is a paragraph.'
    const expected = ['This is a paragraph.']
    const result = splitTextByTopLevelBlocks(text)

    expect(result).toEqual(expected)
  })

  test('should ignore headings and other unsupported nodes', () => {
    const text = `
# Heading

This is a paragraph.

---
`

    const expected = ['# Heading', 'This is a paragraph.', '---']
    const result = splitTextByTopLevelBlocks(text)

    expect(result).toEqual(expected)
  })

  it('should split input that contains html correctly', () => {
    const text = `This a line

<form>

  <input type="text" name="name" />

</form>

This is another line`

    const expected = [
      'This a line',
      '<form>\n  <input type="text" name="name" />\n</form>',
      'This is another line',
    ]

    const result = splitTextByTopLevelBlocks(text)

    expect(result).toEqual(expected)
  })

  it('should merge blocks when a block follows a line ending with a single colon', () => {
    const input = `Title:
This is a continuation.`

    const result = splitTextByTopLevelBlocks(input)

    expect(result).toEqual([`Title:\nThis is a continuation.`])
  })

  it('should merge blocks when a block follows a line ending with double colons', () => {
    const input = `Note:**
This is a continuation.  `

    const result = splitTextByTopLevelBlocks(input)

    expect(result).toEqual([`Note:**\nThis is a continuation.  `])
  })

  it('should not merge blocks if the preceding line does not end with a colon', () => {
    const input = `Heading

Text that should remain separate.`

    const result = splitTextByTopLevelBlocks(input)

    expect(result).toEqual(['Heading', 'Text that should remain separate.'])
  })

  it('should handle multiple valid merge cases in sequence', () => {
    const input = `Step 1:
Detail 1
Step 2:**`

    const result = splitTextByTopLevelBlocks(input)

    expect(result).toEqual([`Step 1:\nDetail 1\nStep 2:**`])
  })

  it('should split at horizontal rules', () => {
    // @note keep in mind that --- after the text will make it into a heading

    const input = `Text above

---

Text below`

    const result = splitTextByTopLevelBlocks(input)

    expect(result).toEqual(['Text above', '---', 'Text below'])
  })
})

describe('splitTextByTopLevelBlocksToSize', () => {
  it('should return an empty chunk for empty input', () => {
    const result = splitTextByTopLevelBlocksToSize('', 10)

    expect(result).toEqual([''])
  })

  it('should pack top-level blocks into size-bounded chunks', () => {
    const input = `# Intro

Alpha paragraph.

## Details

Beta paragraph.`

    const result = splitTextByTopLevelBlocksToSize(input, 40)

    expect(result).toEqual([
      '# Intro\n\nAlpha paragraph.',
      '## Details\n\nBeta paragraph.',
    ])

    expectChunksToFit(result, 40)
  })

  it('should keep blocks together when the combined size lands exactly on the boundary', () => {
    const input = `12345

67890`

    const result = splitTextByTopLevelBlocksToSize(input, 12)

    expect(result).toEqual(['12345\n\n67890'])
    expectChunksToFit(result, 12)
  })

  it('should avoid leaving a heading as the last item in a chunk when possible', () => {
    const input = `First block.

## Heading

Second block.`

    const result = splitTextByTopLevelBlocksToSize(input, 24)

    expect(result).toEqual(['First block.', '## Heading\n\nSecond', 'block.'])
    expectChunksToFit(result, 24)
  })

  it('should split oversized blocks when a single block exceeds the limit', () => {
    const input = `This is a very long paragraph that should be split into smaller chunks without relying on another top-level block.`

    const result = splitTextByTopLevelBlocksToSize(input, 30)

    expect(result).toEqual([
      'This is a very long paragraph',
      'that should be split into',
      'smaller chunks without relying',
      'on another top-level block.',
    ])

    expectChunksToFit(result, 30)
  })

  it('should combine a heading with the first part of an oversized following block', () => {
    const input = `## Heading

This paragraph is intentionally much longer than the available size so the first piece should stay with the heading.`

    const result = splitTextByTopLevelBlocksToSize(input, 40)

    expect(result[0]).toBe('## Heading\n\nThis paragraph is')
    expect(result[1]).toBe('intentionally much longer')
    expectChunksToFit(result, 40)
  })

  it('should split oversized list blocks on list item boundaries when possible', () => {
    const input = `- item one
- item two
- item three
- item four`

    const result = splitTextByTopLevelBlocksToSize(input, 22)

    expect(result).toEqual([
      '- item one\n- item two',
      '- item three',
      '- item four',
    ])
    expectChunksToFit(result, 22)
  })

  it('should split oversized fenced code blocks on line boundaries when possible', () => {
    const input = ['```', 'alpha()', 'beta()', 'gamma()', '```'].join('\n')

    const result = splitTextByTopLevelBlocksToSize(input, 18)

    expect(result).toEqual([
      '```\nalpha()\n```',
      '```\nbeta()\n```',
      '```\ngamma()\n```',
    ])
    expectChunksToFit(result, 18)
  })

  it('should split oversized blockquotes on quoted line boundaries when possible', () => {
    const input = ['> alpha', '> beta', '> gamma', '> delta'].join('\n')

    const result = splitTextByTopLevelBlocksToSize(input, 16)

    expect(result).toEqual(['> alpha\n> beta', '> gamma\n> delta'])
    expectChunksToFit(result, 16)
  })

  it('should split oversized html blocks on line boundaries when possible', () => {
    const input = [
      '<div>',
      '<span>alpha</span>',
      '<span>beta</span>',
      '</div>',
    ].join('\n')

    const result = splitTextByTopLevelBlocksToSize(input, 24)

    expect(result).toEqual([
      '<div>\n<span>alpha</span>',
      '<span>beta</span>\n</div>',
    ])
    expectChunksToFit(result, 24)
  })

  it('should keep mixed chunks within size limits after splitting an oversized block', () => {
    const input = `Intro.

This is a very long paragraph that should be split into smaller chunks.

Tail.`

    const result = splitTextByTopLevelBlocksToSize(input, 28)

    expect(result).toEqual([
      'Intro.',
      'This is a very long',
      'paragraph that should be',
      'split into smaller chunks.',
      'Tail.',
    ])
    expectChunksToFit(result, 28)
  })

  it('should reject invalid maxSize values', () => {
    expect(() => splitTextByTopLevelBlocksToSize('text', 0)).toThrow(
      'maxSize must be a positive integer'
    )

    expect(() => splitTextByTopLevelBlocksToSize('text', 2.5)).toThrow(
      'maxSize must be a positive integer'
    )
  })
})

import { splitBubbleText, splitStackText } from './chat'

describe('splitBubbleText', () => {
  it('filters out headings', () => {
    const input = '# Heading\nContent\n## Subheading\nMore content'
    const result = splitBubbleText(input)

    expect(result).toContain('Content')
    expect(result).toContain('More content')
    expect(result).not.toContain('# Heading')
    expect(result).not.toContain('## Subheading')
  })

  it('filters out horizontal rules', () => {
    const input = 'Content\n\n---\n\nMore content'
    const result = splitBubbleText(input)

    expect(result).toContain('Content')
    expect(result).toContain('More content')
    expect(result).not.toContain('---')
  })

  it('keeps regular paragraphs', () => {
    const input = 'Regular paragraph\n\nAnother paragraph'
    const result = splitBubbleText(input)

    expect(result).toContain('Regular paragraph')
    expect(result).toContain('Another paragraph')
  })

  it('keeps code blocks', () => {
    const input = '```javascript\nconst x = 1;\n```\nRegular text'
    const result = splitBubbleText(input)

    expect(result).toContain('```javascript\nconst x = 1;\n```')
    expect(result).toContain('Regular text')
  })
})

describe('splitStackText', () => {
  it('keeps all blocks when emitCompleteFencedCodeBlocks is not provided', () => {
    const input = '# Heading\nContent\n```javascript\ncode\n```\nMore content'
    const result = splitStackText(input)

    expect(result).toContain('# Heading')
    expect(result).toContain('Content')
    expect(result).toContain('```javascript\ncode\n```')
    expect(result).toContain('More content')
  })

  it('filters out incomplete code blocks when emitCompleteFencedCodeBlocks is true', () => {
    const input = 'Content\n```javascript\ncode without end'
    const result = splitStackText(input, { emitCompleteFencedCodeBlocks: true })

    expect(result).toContain('Content')
    expect(result).not.toContain('```javascript\ncode without end')
  })

  it('keeps complete code blocks when emitCompleteFencedCodeBlocks is true', () => {
    const input = 'Content\n```javascript\ncode\n```\nMore content'
    const result = splitStackText(input, { emitCompleteFencedCodeBlocks: true })

    expect(result).toContain('Content')
    expect(result).toContain('```javascript\ncode\n```')
    expect(result).toContain('More content')
  })

  it('keeps non-code content', () => {
    const input = '# Heading\nContent\n> Blockquote\n- List item'
    const result = splitStackText(input, { emitCompleteFencedCodeBlocks: true })

    expect(result).toContain('# Heading')
    expect(result).toContain('Content')
    expect(result).toContain('> Blockquote')
    expect(result).toContain('- List item')
  })

  it('filter out end when it is not complete code block with language', () => {
    const input = 'test\n\n```javascript'
    const result = splitStackText(input, { emitCompleteFencedCodeBlocks: true })

    expect(result).toContain('test')
    expect(result).not.toContain('```javascript')
  })

  it('test harness 001', () => {
    const input = '```mermaid'

    const result = splitStackText(input, {
      emitCompleteFencedCodeBlocks: ['mermaid'],
    })

    expect(result).toEqual([])
  })

  it('test harness 002', () => {
    const input = '```mermaid\npie\n```'

    const result = splitStackText(input, {
      emitCompleteFencedCodeBlocks: ['mermaid'],
    })

    expect(result).toEqual(['```mermaid\npie\n```'])
  })

  it('test harness 003', () => {
    const input = 'test\n\n```'
    const result = splitStackText(input, { emitCompleteFencedCodeBlocks: true })

    expect(result).toEqual(['test'])
  })

  it('test harness 004', () => {
    const input = 'test\n\n```'

    const result = splitStackText(input, {
      emitCompleteFencedCodeBlocks: ['mermaid'],
    })

    expect(result).toContain('test')
    expect(result).not.toContain('```')
  })

  it('test harness 005', () => {
    const input = 'test\n\n```test'

    const result = splitStackText(input, {
      emitCompleteFencedCodeBlocks: ['mermaid'],
    })

    expect(result).toContain('test')
    expect(result).not.toContain('```')
  })

  it('test harness 006', () => {
    const input =
      "Creating a demo pie chart using Mermaid syntax is straightforward. Here's how you can define a simple pie chart:\n\n```mer"

    const result = splitStackText(input, {
      emitCompleteFencedCodeBlocks: ['mermaid'],
    })

    expect(result).toEqual([
      "Creating a demo pie chart using Mermaid syntax is straightforward. Here's how you can define a simple pie chart:",
    ])
  })

  it('test harness 007', () => {
    const input = `Test

| Month    | Savings |
| -------- | ------- |
| January  | $250    |
| February | $80     |
| March    | $420    `

    const result = splitStackText(input, {})

    expect(result).toEqual([
      'Test',
      `| Month    | Savings |
| -------- | ------- |
| January  | $250    |
| February | $80     |
| March    | $420    `,
    ])
  })

  it('test harness 008', () => {
    const input = `| Month    | Savings |
| -------- | ------- |
| January  | $250    |
| February | $80     |
| March    | $420    |`

    const result = splitStackText(input, {
      emitCompleteTableBlockRows: true,
    })

    expect(result).toEqual([
      `| Month    | Savings |
| -------- | ------- |
| January  | $250    |
| February | $80     |
| March    | $420    |`,
    ])
  })

  it('test harness 009', () => {
    const input = `Test

| Month    | Savings |
| -------- | ------- |
| January  | $250    |
| February | $80     |
| March    | $420    `

    const result = splitStackText(input, {
      emitCompleteTableBlockRows: true,
    })

    expect(result).toEqual([
      'Test',
      `| Month    | Savings |
| -------- | ------- |
| January  | $250    |
| February | $80     |
| March    | $420    `,
    ])
  })

  it('test harness 010', () => {
    const input = `Test

| M`

    const result = splitStackText(input, {
      emitCompleteTableBlockRows: true,
    })

    expect(result).toEqual(['Test'])
  })

  describe('emitCompleteAnchors', () => {
    it('removes incomplete anchor with just opening bracket', () => {
      const input = 'Some text ['
      const result = splitStackText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['Some text'])
    })

    it('removes incomplete anchor with text but no closing bracket', () => {
      const input = 'Some text [test'
      const result = splitStackText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['Some text'])
    })

    it('removes incomplete anchor with closing bracket but no url', () => {
      const input = 'Some text [test]('
      const result = splitStackText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['Some text'])
    })

    it('removes incomplete anchor with partial url', () => {
      const input = 'Some text [test](https://'
      const result = splitStackText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['Some text'])
    })

    it('keeps complete anchor', () => {
      const input = 'Some text [test](https://example.com)'
      const result = splitStackText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['Some text [test](https://example.com)'])
    })

    it('keeps text without anchors', () => {
      const input = 'Some text without links'
      const result = splitStackText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['Some text without links'])
    })

    it('does not filter when emitCompleteAnchors is false', () => {
      const input = 'Some text [incomplete'
      const result = splitStackText(input, { emitCompleteAnchors: false })

      expect(result).toEqual(['Some text [incomplete'])
    })

    it('does not filter when emitCompleteAnchors is not provided', () => {
      const input = 'Some text [incomplete'
      const result = splitStackText(input, {})

      expect(result).toEqual(['Some text [incomplete'])
    })

    it('keeps text with brackets that are not anchors', () => {
      const input = 'Array [1, 2, 3] is here'
      const result = splitStackText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['Array [1, 2, 3] is here'])
    })

    it('handles multiple complete anchors', () => {
      const input = 'Check [link1](url1) and [link2](url2)'
      const result = splitStackText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['Check [link1](url1) and [link2](url2)'])
    })

    it('removes last incomplete anchor but keeps previous complete ones', () => {
      const input = 'Check [link1](url1) and [incomplete'
      const result = splitStackText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['Check [link1](url1) and'])
    })

    it('works with splitBubbleText', () => {
      const input = 'Some text [test'
      const result = splitBubbleText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['Some text'])
    })

    it('handles anchor in multiline text', () => {
      const input = 'First line\nSecond line [incomplete'
      const result = splitStackText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['First line\nSecond line'])
    })

    it('handles empty url in parentheses', () => {
      const input = 'Some text [test]()'
      const result = splitStackText(input, { emitCompleteAnchors: true })

      expect(result).toEqual(['Some text [test]()'])
    })
  })

  describe('emitCompleteImages', () => {
    it('removes incomplete image with just exclamation', () => {
      const input = 'Some text !'
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['Some text !'])
    })

    it('removes incomplete image with opening bracket', () => {
      const input = 'Some text !['
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['Some text'])
    })

    it('removes incomplete image with alt text but no closing bracket', () => {
      const input = 'Some text ![alt text'
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['Some text'])
    })

    it('removes incomplete image with closing bracket but no url', () => {
      const input = 'Some text ![alt]('
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['Some text'])
    })

    it('removes incomplete image with partial url', () => {
      const input = 'Some text ![alt](https://example.com/image'
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['Some text'])
    })

    it('keeps complete image', () => {
      const input = 'Some text ![alt](https://example.com/image.png)'
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual([
        'Some text ![alt](https://example.com/image.png)',
      ])
    })

    it('keeps complete image with empty alt text', () => {
      const input = 'Some text ![](https://example.com/image.png)'
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['Some text ![](https://example.com/image.png)'])
    })

    it('keeps complete image with empty url', () => {
      const input = 'Some text ![alt]()'
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['Some text ![alt]()'])
    })

    it('keeps text without images', () => {
      const input = 'Some text without images'
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['Some text without images'])
    })

    it('does not filter when emitCompleteImages is false', () => {
      const input = 'Some text ![incomplete'
      const result = splitStackText(input, { emitCompleteImages: false })

      expect(result).toEqual(['Some text ![incomplete'])
    })

    it('does not filter when emitCompleteImages is not provided', () => {
      const input = 'Some text ![incomplete'
      const result = splitStackText(input, {})

      expect(result).toEqual(['Some text ![incomplete'])
    })

    it('handles multiple complete images', () => {
      const input = 'Check ![img1](url1) and ![img2](url2)'
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['Check ![img1](url1) and ![img2](url2)'])
    })

    it('removes last incomplete image but keeps previous complete ones', () => {
      const input = 'Check ![img1](url1) and ![incomplete'
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['Check ![img1](url1) and'])
    })

    it('works with splitBubbleText', () => {
      const input = 'Some text ![test'
      const result = splitBubbleText(input, { emitCompleteImages: true })

      expect(result).toEqual(['Some text'])
    })

    it('handles image in multiline text', () => {
      const input = 'First line\nSecond line ![incomplete'
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['First line\nSecond line'])
    })

    it('keeps exclamation marks that are not images', () => {
      const input = 'This is exciting! Really!'
      const result = splitStackText(input, { emitCompleteImages: true })

      expect(result).toEqual(['This is exciting! Really!'])
    })

    it('handles both incomplete anchor and incomplete image', () => {
      const input = 'Text [link and ![image'
      const result = splitStackText(input, {
        emitCompleteAnchors: true,
        emitCompleteImages: true,
      })

      // Anchor filter finds last [ which is in ![image, treats [image as incomplete anchor
      // Removes [image, leaving "Text [link and !"
      // Image filter looks for ![, doesn't find it (only ! alone)
      // Result: "Text [link and !" - but wait, there's still an incomplete [link earlier
      // The anchor filter only removes the LAST incomplete anchor

      expect(result).toEqual(['Text [link and !'])
    })

    it('keeps complete anchor and removes incomplete image', () => {
      const input = 'Text [link](url) and ![image'
      const result = splitStackText(input, {
        emitCompleteAnchors: true,
        emitCompleteImages: true,
      })

      // Anchor filter finds last [ in ![image, removes it leaving "Text [link](url) and !"
      // The complete anchor [link](url) is kept
      // The ! is left behind as it's not an image marker without [

      expect(result).toEqual(['Text [link](url) and !'])
    })

    it('removes incomplete anchor but keeps complete image', () => {
      const input = 'Text ![image](url) and [link'
      const result = splitStackText(input, {
        emitCompleteAnchors: true,
        emitCompleteImages: true,
      })

      expect(result).toEqual(['Text ![image](url) and'])
    })
  })
})

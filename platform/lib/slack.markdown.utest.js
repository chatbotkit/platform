import {
  MAX_SLACK_BLOCKS_PER_MESSAGE,
  SLACK_HEADER_TEXT_LIMIT,
  groupBlocksForSlackMessages,
  markdownToBlockChunks,
  markdownToBlocks,
  stripSlackLinkFormatting,
} from '@/lib/slack.markdown'

describe('stripSlackLinkFormatting', () => {
  it('should strip link with display text', () => {
    expect(stripSlackLinkFormatting('<https://example.com|Example>')).toBe(
      'Example'
    )
  })

  it('should strip link without display text', () => {
    expect(stripSlackLinkFormatting('<https://example.com>')).toBe(
      'https://example.com'
    )
  })

  it('should handle multiple links', () => {
    expect(
      stripSlackLinkFormatting(
        'See <https://a.com|A> and <https://b.com|B> for more'
      )
    ).toBe('See A and B for more')
  })

  it('should return null/undefined as-is', () => {
    expect(stripSlackLinkFormatting(null)).toBe(null)
    expect(stripSlackLinkFormatting(undefined)).toBe(undefined)
  })

  it('should return text without links unchanged', () => {
    expect(stripSlackLinkFormatting('Just plain text')).toBe('Just plain text')
  })
})

describe('markdownToBlocks', () => {
  it('must convert all examples to blocks', async () => {
    await expect(
      markdownToBlocks(
        `
  # Hello, world!

  Hello, **world**! _How_ are you? ~~Not~~ so well! But \`never\` [mind](#).

  \`\`\`
  Hello, world!
  \`\`\`

  > Hello, world!

  - Hello, world!

  1. Hello, world!

  ![alt text](https://example.com/image.png)
  `
      )
    ).resolves.toEqual([
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Hello, world!',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Hello, *world*! _How_ are you? ~Not~ so well! But `never` <#|mind>.',
        },
      },
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_preformatted',
            elements: [
              {
                type: 'text',
                text: 'Hello, world!',
              },
            ],
          },
        ],
      },
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_quote',
            elements: [
              {
                type: 'text',
                text: 'Hello, world!',
              },
            ],
          },
        ],
      },
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  {
                    type: 'text',
                    text: 'Hello, world!',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_list',
            style: 'ordered',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  {
                    type: 'text',
                    text: 'Hello, world!',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'image',
        image_url: 'https://example.com/image.png',
        alt_text: 'alt text',
      },
    ])
  })

  it('must convert simple lists to blocks', async () => {
    const result = await markdownToBlocks(
      `- Item 1
- Item 2 
- Item 3`
    )

    await expect(result).toEqual([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  {
                    type: 'text',
                    text: 'Item 1',
                  },
                ],
              },
              {
                type: 'rich_text_section',
                elements: [
                  {
                    type: 'text',
                    text: 'Item 2',
                  },
                ],
              },
              {
                type: 'rich_text_section',
                elements: [
                  {
                    type: 'text',
                    text: 'Item 3',
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
  })

  it('must render GFM task list items with checkbox glyphs', async () => {
    const result = await markdownToBlocks(
      `- [x] Done thing
- [ ] Todo thing
- Regular item`
    )

    await expect(result).toEqual([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: '☑ ' },
                  { type: 'text', text: 'Done thing' },
                ],
              },
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: '☐ ' },
                  { type: 'text', text: 'Todo thing' },
                ],
              },
              {
                type: 'rich_text_section',
                elements: [{ type: 'text', text: 'Regular item' }],
              },
            ],
          },
        ],
      },
    ])
  })

  it('must preserve inline formatting alongside a task checkbox', async () => {
    const result = await markdownToBlocks(
      `- [x] Ship **the** [thing](https://x.com)`
    )

    await expect(result).toEqual([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: '☑ ' },
                  { type: 'text', text: 'Ship ' },
                  { type: 'text', text: 'the', style: { bold: true } },
                  { type: 'text', text: ' ' },
                  { type: 'link', url: 'https://x.com', text: 'thing' },
                ],
              },
            ],
          },
        ],
      },
    ])
  })

  it('must render checkboxes on nested task list items', async () => {
    const result = await markdownToBlocks(
      `- Parent
  - [x] nested done
  - [ ] nested todo`
    )

    await expect(result).toEqual([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              {
                type: 'rich_text_section',
                elements: [{ type: 'text', text: 'Parent' }],
              },
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: '☑ ' },
                  { type: 'text', text: 'nested done' },
                ],
              },
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: '☐ ' },
                  { type: 'text', text: 'nested todo' },
                ],
              },
            ],
          },
        ],
      },
    ])
  })

  it('must convert list with links to blocks', async () => {
    const result = await markdownToBlocks(
      `- [Item 1](https://example.com/item1)
- [Item 2](https://example.com/item2)
- [Item 3](https://example.com/item3)`
    )

    await expect(result).toEqual([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  {
                    type: 'link',
                    url: 'https://example.com/item1',
                    text: 'Item 1',
                  },
                ],
              },
              {
                type: 'rich_text_section',
                elements: [
                  {
                    type: 'link',
                    url: 'https://example.com/item2',
                    text: 'Item 2',
                  },
                ],
              },
              {
                type: 'rich_text_section',
                elements: [
                  {
                    type: 'link',
                    url: 'https://example.com/item3',
                    text: 'Item 3',
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
  })

  it('must convert list of links with formatting to blocks', async () => {
    // @note Slack link elements in rich_text blocks don't support inline formatting,
    // so bold/italic/strikethrough markers are stripped from link text
    const result = await markdownToBlocks(
      `- [**Item 1**](https://example.com/item1)
- [*Item 2*](https://example.com/item2)
- [~~Item 3~~](https://example.com/item3)`
    )

    await expect(result).toEqual([
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_list',
            style: 'bullet',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  {
                    type: 'link',
                    url: 'https://example.com/item1',
                    text: 'Item 1',
                  },
                ],
              },
              {
                type: 'rich_text_section',
                elements: [
                  {
                    type: 'link',
                    url: 'https://example.com/item2',
                    text: 'Item 2',
                  },
                ],
              },
              {
                type: 'rich_text_section',
                elements: [
                  {
                    type: 'link',
                    url: 'https://example.com/item3',
                    text: 'Item 3',
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
  })

  it('test harness 001', async () => {
    const markdown = `I found a message from Jordan about conference wins:

In #general, @rohan posted on [date from timestamp 1753344000.878859]:

> <!here>
> 
> :tada: Good news to start the day. We've landed Example Energy as a customer! :rocket:
> 
> A few fun facts about this deal:
> 
>  :one: It's our first conference win. Great job sparking the first convo, @sam
>  :two: It's also our first deal of the quarter on the core ExampleCo platform - big thanks to @alex @taylor for turning around the demo same morning! :raised_hands:
> 
> How we'll be helping Example Energy:
>  :zap: Example Energy needs an AI solution to analyse and summarise complex proposals.
>  :bar_chart: Their goal: extract key parameters and generate consistent, non-hallucinating executive summaries.
>  :robot_face: ExampleCo's customisable AI search and agent capabilities fit their use case perfectly.
> 
> We're continuing to land promising pilots. Here's to converting more before quarter-end! :fire:

This message highlights Example Energy as their first conference win, with credit to Sam for initiating the conversation and Alex and Taylor for quickly preparing the demo [1].

[1]: https://example.slack.com/archives/C0123456789/p1753344000878859?thread_ts=1753344000.878859`

    const result = await markdownToBlocks(markdown)

    await expect(result).toEqual([
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'I found a message from Jordan about conference wins:',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'In #general, @rohan posted on [date from timestamp 1753344000.878859]:',
        },
      },
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_quote',
            elements: [
              {
                type: 'text',
                text: ":tada: Good news to start the day. We've landed Example Energy as a customer! :rocket:",
              },
              { type: 'text', text: '\n' },
              {
                type: 'text',
                text: 'A few fun facts about this deal:',
              },
              { type: 'text', text: '\n' },
              {
                type: 'text',
                text: ":one: It's our first conference win. Great job sparking the first convo, @sam\n:two: It's also our first deal of the quarter on the core ExampleCo platform - big thanks to @alex @taylor for turning around the demo same morning! :raised_hands:",
              },
              { type: 'text', text: '\n' },
              {
                type: 'text',
                text: "How we'll be helping Example Energy:\n:zap: Example Energy needs an AI solution to analyse and summarise complex proposals.\n:bar_chart: Their goal: extract key parameters and generate consistent, non-hallucinating executive summaries.\n:robot_face: ExampleCo's customisable AI search and agent capabilities fit their use case perfectly.",
              },
              { type: 'text', text: '\n' },
              {
                type: 'text',
                text: "We're continuing to land promising pilots. Here's to converting more before quarter-end! :fire:",
              },
            ],
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'This message highlights Example Energy as their first conference win, with credit to Sam for initiating the conversation and Alex and Taylor for quickly preparing the demo <https://example.slack.com/archives/C0123456789/p1753344000878859?thread_ts=1753344000.878859|1>.',
        },
      },
      // @note this is the whole point of the test - we should not have any
      // sections with empty text
      // {
      //   type: 'section',
      //   text: {
      //     type: 'mrkdwn',
      //     text: '',
      //   },
      // },
    ])
  })

  it('must handle complex nested lists and bold text correctly', async () => {
    const markdown = `# Example Foods Contract Summary: Key Deliverables and Dates

Based on my search of Google Drive documents, I found the Example Foods contract in the form of a fictional Statement of Work (SOW) for a Virtual Travel Agent implementation project between Example Foods and ExampleCo. Here's a summary of the key deliverables and dates:

## Project Overview
The contract covers the implementation of an AI-powered Virtual Travel Agent designed to automate responses to travel-related queries for Example Foods. The solution uses a centralized repository of travel and expense policy information to guide employees.

## Key Deliverables

1. **AI Travel Agent Implementation**
   - Fully functional AI Travel Agent integrated within the Example AI Platform
   - Trained agent capable of addressing FAQs using curated document sources
   - Documented user guides and prompt libraries
   - Summary of integrated content

2. **Specific Functionality**
   - Enable the agent to address travel policy questions with document-sourced answers
   - Implement prompt suggestions and follow-up question capabilities
   - Incorporate travel advisories
   - Provide structured documentation responses with relevant links
   - Upload and maintain key documents such as T&E policy and travel guides

3. **Scope Limitations**
   - Initial deployment limited to U.S.-based employees

## Key Dates and Timeline

- **Project Start Date**: January 6, 2025
- **Project Completion Date**: January 20, 2025

**Phased Implementation**:
- **Pre-launch**: Stakeholder engagement and scoping
- **Week 1**: Configure prompts, extend agent functionality, and deploy the final artifact within the Example AI platform
- **Week 2**: Document upload and follow-up prompt tuning
- **Week 3**: Handover and go-live

## Financial Terms
- **Fixed Price**: $10,000 for all deliverables described in the fictional SOW
- **Payment Terms**: Payment due upon start of service
- **Invoice Payment**: Within 28 days of issue

## Key Dependencies
- Timely access to travel documents and knowledge assets
- Timely resolution of issues related to the Example AI platform
- Clear feedback on FAQ accuracy and policy coverage

The fictional contract is governed by a Master Service Agreement (MSA) between Example Foods and ExampleCo, though the specific MSA document was not found in the search.`

    const result = await markdownToBlocks(markdown)

    // Check that we have multiple blocks (headers, sections, lists)
    expect(result.length).toBeGreaterThan(5)

    // Check that we have headers
    const headerBlocks = result.filter((block) => block.type === 'header')

    expect(headerBlocks.length).toBeGreaterThan(3)
    expect(headerBlocks[0].text.text).toBe(
      'Example Foods Contract Summary: Key Deliverables and Dates'
    )

    // Check that we have lists with actual content
    const listBlocks = result.filter(
      (block) =>
        block.type === 'rich_text' &&
        block.elements?.[0]?.type === 'rich_text_list'
    )

    expect(listBlocks.length).toBeGreaterThan(2)

    // Check that at least one list has more than just the main headers
    // (indicating nested content is being processed)
    const listWithMultipleItems = listBlocks.find(
      (block) => block.elements[0].elements.length > 3
    )

    expect(listWithMultipleItems).toBeDefined()

    // Check that bold text within list items is preserved using the style property
    // @note rich_text blocks use style: { bold: true } instead of *text* markers
    const hasStyledText = listBlocks.some((block) =>
      block.elements[0].elements.some((item) =>
        item.elements?.some((el) => el.type === 'text' && el.style?.bold)
      )
    )

    expect(hasStyledText).toBe(true)
  })

  // @note regression coverage for bold labels inside numbered Slack lists
  it('should render numbered lists with bold labels correctly for Slack', async () => {
    const markdown = `Here are your latest Gmail messages:

1. **Subject:** Re: Database request failure
   **From:** Sentry
   **Snippet:** PrismaClientKnownRequestError GET /api/v1/conversation/[conver...
   [Read more](https://mail.google.com/mail/u/0/#inbox/19c028bba6b341d1)

2. **Subject:** Your OpenRouter receipt
   **From:** OpenRouter
   **Snippet:** Amount paid $422.00
   [Read more](https://mail.google.com/mail/u/0/#inbox/19c018f9239af433)

If you need more details, feel free to ask!`

    const result = await markdownToBlocks(markdown)

    // Should have intro, list, and outro
    expect(result.length).toBeGreaterThanOrEqual(3)

    // Find the list block
    const listBlock = result.find(
      (block) =>
        block.type === 'rich_text' &&
        block.elements?.[0]?.type === 'rich_text_list'
    )

    expect(listBlock).toBeDefined()

    // Check that the list has ordered style
    expect(listBlock.elements[0].style).toBe('ordered')

    // Check that bold text uses the style property, not *text* markers
    const listElements = listBlock.elements[0].elements

    // At least one element should have bold styling
    const hasBoldStyle = listElements.some((section) =>
      section.elements?.some((el) => el.type === 'text' && el.style?.bold)
    )

    expect(hasBoldStyle).toBe(true)

    // Verify that NO text contains literal asterisk markers (the bug we're fixing)
    const hasAsteriskMarkers = listElements.some((section) =>
      section.elements?.some(
        (el) =>
          el.type === 'text' &&
          el.text?.startsWith('*') &&
          el.text?.endsWith('*')
      )
    )

    expect(hasAsteriskMarkers).toBe(false)

    // Check that links are preserved
    const hasLinks = listElements.some((section) =>
      section.elements?.some((el) => el.type === 'link')
    )

    expect(hasLinks).toBe(true)
  })

  describe('edge cases and bug discovery', () => {
    it('should handle empty input', async () => {
      const result = await markdownToBlocks('')

      expect(result).toEqual([])
    })

    it('should handle null input gracefully', async () => {
      const result = await markdownToBlocks(null)

      expect(result).toEqual([])
    })

    it('should handle undefined input gracefully', async () => {
      const result = await markdownToBlocks(undefined)

      expect(result).toEqual([])
    })

    // Test current behavior for null/undefined (even though it might be a bug)
    it('should return empty array for null input (current behavior)', async () => {
      const result = await markdownToBlocks(null)

      expect(result).toEqual([])
    })

    it('should return empty array for undefined input (current behavior)', async () => {
      const result = await markdownToBlocks(undefined)

      expect(result).toEqual([])
    })

    it('should handle whitespace-only input', async () => {
      const result = await markdownToBlocks('   \n\n   \t  ')

      expect(result).toEqual([])
    })

    it('should handle single character input', async () => {
      const result = await markdownToBlocks('a')

      expect(result).toEqual([
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'a',
          },
        },
      ])
    })

    it('should handle empty heading', async () => {
      const result = await markdownToBlocks('# ')

      // @note empty headings should not create blocks
      expect(result).toEqual([])
    })

    it('should handle heading with only whitespace', async () => {
      const result = await markdownToBlocks('#   \n\n  ')

      expect(result).toEqual([])
    })

    it('should handle empty list', async () => {
      const result = await markdownToBlocks('- ')

      // @note empty list items should not create list blocks
      expect(result).toEqual([])
    })

    it('should handle empty blockquote', async () => {
      const result = await markdownToBlocks('> ')

      expect(result).toEqual([])
    })

    it('should handle empty code block', async () => {
      const result = await markdownToBlocks('```\n```')

      expect(result).toEqual([])
    })

    it('should filter out code blocks with only whitespace', async () => {
      const result = await markdownToBlocks('```\n   \n   \n```')

      expect(result).toEqual([])
    })

    it('should handle deeply nested lists correctly', async () => {
      const markdown = `
- Level 1
  - Level 2
    - Level 3
      - Level 4
        - Level 5
          - Level 6`

      const result = await markdownToBlocks(markdown)

      // Should have a single list block with properly nested structure
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('rich_text')
      expect(result[0].elements[0].type).toBe('rich_text_list')
      // All items should be flattened into the main list
      expect(result[0].elements[0].elements).toHaveLength(6)
    })

    it('should handle malformed markdown gracefully', async () => {
      const malformedInputs = [
        '# ## ### Broken headings',
        '- - - Multiple dashes',
        '[broken link](',
        '**bold without closing',
        '`inline code without closing',
        '![alt text](broken-image-url',
      ]

      for (const input of malformedInputs) {
        const result = await markdownToBlocks(input)

        // Should not throw errors, even with malformed input
        expect(Array.isArray(result)).toBe(true)
      }
    })

    it('should handle special characters and unicode', async () => {
      const unicode = '# 🚀 Test with emojis 🎉 and ñiño characters'
      const result = await markdownToBlocks(unicode)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('header')
      expect(result[0].text.text).toBe(
        '🚀 Test with emojis 🎉 and ñiño characters'
      )
    })

    it('should render very long header text as a bold section (Slack rejects >150-char headers)', async () => {
      const longText = 'a'.repeat(10000)
      const markdown = `# ${longText}`

      const result = await markdownToBlocks(markdown)

      expect(result).toHaveLength(1)
      // @note a 10000-char header block would be rejected with invalid_blocks,
      // so it falls back to a bold section
      expect(result[0].type).toBe('section')
      expect(result[0].text.type).toBe('mrkdwn')
      expect(result[0].text.text).toBe(`*${longText}*`)
    })
  })

  // COMPREHENSIVE ELEMENT TESTING
  describe('Individual Element Types', () => {
    describe('Headers', () => {
      it('should handle different heading levels', async () => {
        const markdown = `# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6`
        const result = await markdownToBlocks(markdown)

        expect(result).toHaveLength(6)
        result.forEach((block, index) => {
          expect(block.type).toBe('header')
          expect(block.text.type).toBe('plain_text')
          expect(block.text.text).toBe(`H${index + 1}`)
        })
      })

      it('should handle headers with formatting', async () => {
        const result = await markdownToBlocks('# **Bold** and *italic* header')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('header')
        expect(result[0].text.text).toBe('Bold and italic header')
      })

      it('should handle headers with special characters', async () => {
        const result = await markdownToBlocks(
          '# Header with [brackets] and (parentheses)'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('header')
        expect(result[0].text.text).toBe(
          'Header with [brackets] and (parentheses)'
        )
      })

      it('should strip link formatting from headers and keep only the link text', async () => {
        // @note Headers with links cause Slack to
        // reject the message with "invalid_blocks" error because:
        // 1. Header blocks use plain_text type which cannot contain angle brackets
        // 2. Links get converted to <url|text> mrkdwn format which is invalid for plain_text
        // Headers should extract just the link text, not the full mrkdwn link format

        const result = await markdownToBlocks(
          '## [How to upgrade Elixir versions at Podium?](https://example.com/page)'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('header')
        expect(result[0].text.type).toBe('plain_text')
        // Should contain only the link text, not the URL or angle brackets
        expect(result[0].text.text).toBe(
          'How to upgrade Elixir versions at Podium?'
        )
        // Should NOT contain mrkdwn link formatting
        expect(result[0].text.text).not.toContain('<')
        expect(result[0].text.text).not.toContain('>')
        expect(result[0].text.text).not.toContain('|')
      })
    })

    describe('Text Formatting', () => {
      it('should handle bold text (current behavior)', async () => {
        const result = await markdownToBlocks('This is **bold** text')

        expect(result).toHaveLength(1)
        expect(result[0].text.text).toBe('This is *bold* text')
      })

      it('should handle italic text (current behavior)', async () => {
        const result = await markdownToBlocks('This is *italic* text')

        expect(result).toHaveLength(1)
        expect(result[0].text.text).toBe('This is _italic_ text')
      })

      it('should handle strikethrough text (current behavior)', async () => {
        const result = await markdownToBlocks('This is ~~strikethrough~~ text')

        expect(result).toHaveLength(1)
        expect(result[0].text.text).toBe('This is ~strikethrough~ text')
      })

      it('should handle inline code (current behavior)', async () => {
        const result = await markdownToBlocks('This is `inline code` text')

        expect(result).toHaveLength(1)
        expect(result[0].text.text).toBe('This is `inline code` text')
      })

      it('should handle nested formatting combinations', async () => {
        const result = await markdownToBlocks(
          'Text with **bold _italic_ combination**'
        )

        // Should handle the nested formatting
        expect(result.length).toBeGreaterThan(0)
        expect(result.some((block) => block.text?.text?.includes('*'))).toBe(
          true
        )
      })
    })

    describe('Links', () => {
      it('should handle simple links', async () => {
        const result = await markdownToBlocks(
          '[Link text](https://example.com)'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('section')
        expect(result[0].text.text).toBe('<https://example.com|Link text>')
      })

      it('should handle links without text', async () => {
        const result = await markdownToBlocks('[](https://example.com)')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('section')
        expect(result[0].text.text).toBe('<https://example.com>')
      })

      it('should handle links with formatting in text (current behavior)', async () => {
        const result = await markdownToBlocks(
          '[**Bold link**](https://example.com)'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('section')
        expect(result[0].text.text).toBe('<https://example.com|*Bold link*>')
      })

      it('should handle multiple links in one paragraph (current behavior)', async () => {
        const result = await markdownToBlocks(
          'Check [Google](https://google.com) and [GitHub](https://github.com)'
        )

        expect(result).toHaveLength(1)
        expect(result[0].text.text).toBe(
          'Check <https://google.com|Google> and <https://github.com|GitHub>'
        )
      })

      it('should escape pipe character in link text', async () => {
        const result = await markdownToBlocks(
          '[Smith | Jones Report](https://example.com/report)'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('section')
        // @note pipe character must be escaped to prevent breaking Slack mrkdwn link syntax
        expect(result[0].text.text).not.toContain('Smith | Jones')
        expect(result[0].text.text).toBe(
          '<https://example.com/report|Smith ǀ Jones Report>'
        )
      })

      it('should escape angle brackets in link text', async () => {
        // @note angle brackets in markdown link text are parsed as HTML by the markdown
        // parser and stripped before reaching our converter. This test documents that
        // our escapeSlackLinkText function handles angle brackets if they somehow
        // appear in the text (e.g., from raw text sources).
        const result = await markdownToBlocks(
          '[Document with arrows](https://example.com/doc)'
        )

        expect(result).toHaveLength(1)
        // The escapeSlackLinkText function is tested separately below
        expect(result[0].text.text).toBe(
          '<https://example.com/doc|Document with arrows>'
        )
      })

      it('escapeSlackLinkText should handle angle brackets directly', async () => {
        const { escapeSlackLinkText } = await import('@/lib/slack.markdown')

        expect(escapeSlackLinkText('<Important> Document')).toBe(
          '‹Important› Document'
        )
        expect(escapeSlackLinkText('A | B | C')).toBe('A ǀ B ǀ C')
        expect(escapeSlackLinkText('Normal text')).toBe('Normal text')
        expect(escapeSlackLinkText(null)).toBe(null)
        expect(escapeSlackLinkText('')).toBe('')
      })

      it('should preserve ampersand in link text', async () => {
        const result = await markdownToBlocks(
          '[Tom & Jerry](https://example.com/show)'
        )

        expect(result).toHaveLength(1)
        // @note ampersand should be preserved as-is in Slack mrkdwn (Slack handles it)
        expect(result[0].text.text).toBe(
          '<https://example.com/show|Tom & Jerry>'
        )
      })

      it('should handle reference-style links', async () => {
        const md = 'Check [this link][1] for info.\n\n[1]: https://example.com'
        const result = await markdownToBlocks(md)

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('section')
        expect(result[0].text.text).toBe(
          'Check <https://example.com|this link> for info.'
        )
      })

      it('should handle multiple reference-style links', async () => {
        const md =
          'See [Google][1] and [GitHub][2].\n\n[1]: https://google.com\n[2]: https://github.com'
        const result = await markdownToBlocks(md)

        expect(result).toHaveLength(1)
        expect(result[0].text.text).toBe(
          'See <https://google.com|Google> and <https://github.com|GitHub>.'
        )
      })
    })

    describe('Images', () => {
      it('should handle images with alt text', async () => {
        const result = await markdownToBlocks(
          '![Alt text](https://example.com/image.png)'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('image')
        expect(result[0].image_url).toBe('https://example.com/image.png')
        expect(result[0].alt_text).toBe('Alt text')
      })

      it('should handle images without alt text', async () => {
        const result = await markdownToBlocks(
          '![](https://example.com/image.png)'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('image')
        expect(result[0].image_url).toBe('https://example.com/image.png')
        expect(result[0].alt_text).toBe('')
      })

      it('should handle images in paragraphs', async () => {
        const result = await markdownToBlocks(
          'Text before ![Image](https://example.com/image.png) text after'
        )

        // Should have text before, image, and text after
        expect(result.length).toBeGreaterThan(2)

        const imageBlock = result.find((block) => block.type === 'image')

        expect(imageBlock).toBeDefined()
        expect(imageBlock.image_url).toBe('https://example.com/image.png')
      })

      it('should handle reference-style images', async () => {
        const result = await markdownToBlocks(
          '![screenshot][img]\n\n[img]: https://example.com/screenshot.png'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('image')
        expect(result[0].image_url).toBe('https://example.com/screenshot.png')
        expect(result[0].alt_text).toBe('screenshot')
      })
    })

    describe('Code Blocks', () => {
      it('should handle basic code blocks', async () => {
        const result = await markdownToBlocks(
          '```\nconst x = 1;\nconsole.log(x);\n```'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')
        expect(result[0].elements[0].type).toBe('rich_text_preformatted')
        expect(result[0].elements[0].elements[0].text).toBe(
          'const x = 1;\nconsole.log(x);'
        )
      })

      it('should handle code blocks with language', async () => {
        const result = await markdownToBlocks(
          '```javascript\nconst x = 1;\n```'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')
        expect(result[0].elements[0].type).toBe('rich_text_preformatted')
        expect(result[0].elements[0].elements[0].text).toBe('const x = 1;')
      })

      it('should handle code blocks with special characters', async () => {
        const result = await markdownToBlocks(
          '```\n<html>\n  <body>Hello & goodbye</body>\n</html>\n```'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')
        expect(result[0].elements[0].elements[0].text).toBe(
          '<html>\n  <body>Hello & goodbye</body>\n</html>'
        )
      })
    })

    describe('Blockquotes', () => {
      it('should handle simple blockquotes', async () => {
        const result = await markdownToBlocks('> This is a quote')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')
        expect(result[0].elements[0].type).toBe('rich_text_quote')
        expect(result[0].elements[0].elements[0].text).toBe('This is a quote')
      })

      it('should handle multi-line blockquotes (current behavior)', async () => {
        const result = await markdownToBlocks('> Line 1\n> Line 2\n> Line 3')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')
        expect(result[0].elements[0].type).toBe('rich_text_quote')
        expect(result[0].elements[0].elements[0].text).toBe(
          'Line 1\nLine 2\nLine 3'
        )
      })

      it('should handle blockquotes with formatting', async () => {
        // @note rich_text_quote uses proper style elements, not mrkdwn strings
        const result = await markdownToBlocks('> This is **bold** in a quote')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')
        expect(result[0].elements[0].type).toBe('rich_text_quote')

        const elements = result[0].elements[0].elements

        // Should have separate text elements with styles, not a single concatenated string
        const boldEl = elements.find((el) => el.style?.bold)

        expect(boldEl).toBeDefined()
        expect(boldEl.text).toBe('bold')

        const plainEl = elements.find((el) => el.text === 'This is ')

        expect(plainEl).toBeDefined()
      })

      it('should render a link inside a blockquote as a proper link element', async () => {
        // @note links inside blockquotes must be converted to rich_text link elements,
        // not mrkdwn <url|text> strings, because rich_text_quote rejects mrkdwn syntax
        const result = await markdownToBlocks(
          '> Check out [our tutorial](https://chatbotkit.com/tutorials/example)'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')

        const quoteSection = result[0].elements[0]

        expect(quoteSection.type).toBe('rich_text_quote')

        // The quote must have at least a text element and a link element
        const elements = quoteSection.elements

        const linkElement = elements.find((el) => el.type === 'link')

        expect(linkElement).toBeDefined()
        expect(linkElement.url).toBe('https://chatbotkit.com/tutorials/example')
        expect(linkElement.text).toBe('our tutorial')

        // Should NOT contain raw mrkdwn link syntax as plain text
        const hasRawMrkdwn = elements.some(
          (el) => el.type === 'text' && el.text?.includes('<https://')
        )

        expect(hasRawMrkdwn).toBe(false)
      })

      it('should render a bare URL inside a blockquote as a proper link element', async () => {
        // @note bare URLs in blockquotes (written as [url](url)) must become link elements
        const result = await markdownToBlocks(
          '> https://chatbotkit.com/tutorials/building-an-agentic-system-with-reddit-and-notion'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')

        const quoteSection = result[0].elements[0]

        expect(quoteSection.type).toBe('rich_text_quote')

        // Should not contain the raw <url|url> mrkdwn string as text
        const hasRawMrkdwn = quoteSection.elements.some(
          (el) => el.type === 'text' && el.text?.includes('<https://')
        )

        expect(hasRawMrkdwn).toBe(false)
      })

      it('should correctly convert the social media post scenario with links in blockquotes', async () => {
        // @note reproduces the bug reported where blockquote links rendered as
        // raw mrkdwn <url|url> strings instead of being stripped or converted properly
        const markdown = `**Twitter/X** (280 char max):
> What if your AI agent could scout Reddit and drop ideas straight into Notion - automatically?
> https://chatbotkit.com/tutorials/building-an-agentic-system-with-reddit-and-notion`

        const result = await markdownToBlocks(markdown)

        expect(result.length).toBeGreaterThan(0)

        const quoteBlock = result.find(
          (block) =>
            block.type === 'rich_text' &&
            block.elements?.[0]?.type === 'rich_text_quote'
        )

        expect(quoteBlock).toBeDefined()

        const quoteElements = quoteBlock.elements[0].elements

        // Must not contain raw mrkdwn link syntax as a text value
        const hasRawMrkdwn = quoteElements.some(
          (el) => el.type === 'text' && el.text?.includes('<https://')
        )

        expect(hasRawMrkdwn).toBe(false)

        // The URL should appear as a proper link element
        const linkElement = quoteElements.find((el) => el.type === 'link')

        expect(linkElement).toBeDefined()
        expect(linkElement.url).toBe(
          'https://chatbotkit.com/tutorials/building-an-agentic-system-with-reddit-and-notion'
        )
      })

      it('should handle mixed text and links inside a blockquote', async () => {
        const result = await markdownToBlocks(
          '> Read [the docs](https://example.com/docs) for more info'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')

        const quoteSection = result[0].elements[0]

        expect(quoteSection.type).toBe('rich_text_quote')

        const elements = quoteSection.elements

        // Should have text elements and a link element
        const textElements = elements.filter((el) => el.type === 'text')
        const linkElement = elements.find((el) => el.type === 'link')

        expect(textElements.length).toBeGreaterThan(0)
        expect(linkElement).toBeDefined()
        expect(linkElement.url).toBe('https://example.com/docs')
        expect(linkElement.text).toBe('the docs')

        // No raw mrkdwn syntax in text elements
        const hasRawMrkdwn = textElements.some((el) =>
          el.text?.includes('<https://')
        )

        expect(hasRawMrkdwn).toBe(false)
      })

      it('should render italic text inside a blockquote as a styled element', async () => {
        const result = await markdownToBlocks('> This is _italic_ in a quote')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')

        const elements = result[0].elements[0].elements
        const italicEl = elements.find((el) => el.style?.italic)

        expect(italicEl).toBeDefined()
        expect(italicEl.text).toBe('italic')
        expect(italicEl.type).toBe('text')
      })

      it('should render strikethrough text inside a blockquote as a styled element', async () => {
        const result = await markdownToBlocks('> This is ~~strike~~ in a quote')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')

        const elements = result[0].elements[0].elements
        const strikeEl = elements.find((el) => el.style?.strike)

        expect(strikeEl).toBeDefined()
        expect(strikeEl.text).toBe('strike')
        expect(strikeEl.type).toBe('text')
      })

      it('should render inline code inside a blockquote as a styled element', async () => {
        const result = await markdownToBlocks('> This is `code` in a quote')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')

        const elements = result[0].elements[0].elements
        const codeEl = elements.find((el) => el.style?.code)

        expect(codeEl).toBeDefined()
        expect(codeEl.text).toBe('code')
        expect(codeEl.type).toBe('text')
      })

      it('should render multiple links inside a single blockquote as separate link elements', async () => {
        const result = await markdownToBlocks(
          '> See [Google](https://google.com) and [GitHub](https://github.com)'
        )

        expect(result).toHaveLength(1)

        const elements = result[0].elements[0].elements

        const linkElements = elements.filter((el) => el.type === 'link')

        expect(linkElements).toHaveLength(2)
        expect(linkElements[0].url).toBe('https://google.com')
        expect(linkElements[0].text).toBe('Google')
        expect(linkElements[1].url).toBe('https://github.com')
        expect(linkElements[1].text).toBe('GitHub')

        // Surrounding text elements should be present
        const textElements = elements.filter((el) => el.type === 'text')

        expect(textElements.some((el) => el.text?.includes('See '))).toBe(true)
        expect(textElements.some((el) => el.text?.includes(' and '))).toBe(true)
      })

      it('should render combined bold and italic inside a blockquote', async () => {
        const result = await markdownToBlocks(
          '> **bold** and _italic_ together in blockquote'
        )

        expect(result).toHaveLength(1)

        const elements = result[0].elements[0].elements

        const boldEl = elements.find((el) => el.style?.bold)
        const italicEl = elements.find((el) => el.style?.italic)

        expect(boldEl).toBeDefined()
        expect(boldEl.text).toBe('bold')
        expect(italicEl).toBeDefined()
        expect(italicEl.text).toBe('italic')
      })

      it('should render horizontal rules as dividers between paragraphs', async () => {
        const result = await markdownToBlocks('Before\n\n---\n\nAfter')

        expect(result).toHaveLength(3)
        expect(result[0].type).toBe('section')
        expect(result[0].text.text).toBe('Before')
        expect(result[1].type).toBe('divider')
        expect(result[2].type).toBe('section')
        expect(result[2].text.text).toBe('After')
      })

      it('should render a heading inside a blockquote as bold text', async () => {
        const result = await markdownToBlocks('> ## Section Title')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')

        const elements = result[0].elements[0].elements
        const boldEl = elements.find((el) => el.style?.bold)

        expect(boldEl).toBeDefined()
        expect(boldEl.text).toBe('Section Title')
      })

      it('should render a list inside a blockquote as dash-prefixed text', async () => {
        const result = await markdownToBlocks('> - item 1\n> - item 2')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')

        const elements = result[0].elements[0].elements

        // Should include dash prefixes and item text
        const allText = elements.map((el) => el.text).join('')

        expect(allText).toContain('- item 1')
        expect(allText).toContain('- item 2')
      })

      it('should render a code block inside a blockquote as code-styled text', async () => {
        const result = await markdownToBlocks('> ```\n> code here\n> ```')

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')

        const elements = result[0].elements[0].elements
        const codeEl = elements.find((el) => el.style?.code)

        expect(codeEl).toBeDefined()
        expect(codeEl.text).toBe('code here')
      })

      it('should preserve hard line breaks inside a blockquote', async () => {
        // @note hard breaks (trailing two spaces) produce a break mdast node
        const result = await markdownToBlocks('> line one  \n> line two')

        expect(result).toHaveLength(1)

        const elements = result[0].elements[0].elements
        const allText = elements.map((el) => el.text).join('')

        expect(allText).toContain('line one')
        expect(allText).toContain('\n')
        expect(allText).toContain('line two')
      })

      it('should handle mixed text and list inside a blockquote', async () => {
        const result = await markdownToBlocks(
          '> text\n>\n> - item 1\n> - item 2'
        )

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')

        const elements = result[0].elements[0].elements
        const allText = elements.map((el) => el.text).join('')

        expect(allText).toContain('text')
        expect(allText).toContain('item 1')
        expect(allText).toContain('item 2')
      })

      it('should drop images inside blockquotes gracefully', async () => {
        // @note images inside blockquotes cannot be represented in rich_text_quote
        // and are dropped; this matches the old behavior
        const result = await markdownToBlocks(
          '> ![alt](https://example.com/img.png)'
        )

        expect(result).toEqual([])
      })

      it('should handle reference-style links inside blockquotes', async () => {
        const md =
          '> Check [this link][1] for info.\n\n[1]: https://example.com'
        const result = await markdownToBlocks(md)

        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('rich_text')

        const quote = result[0].elements[0]

        expect(quote.type).toBe('rich_text_quote')

        const linkEl = quote.elements.find((el) => el.type === 'link')

        expect(linkEl).toBeDefined()
        expect(linkEl.url).toBe('https://example.com')
        expect(linkEl.text).toBe('this link')
      })
    })
  })

  // LIST TESTING
  describe('List Handling', () => {
    it('should handle ordered lists', async () => {
      const result = await markdownToBlocks('1. First\n2. Second\n3. Third')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('rich_text')
      expect(result[0].elements[0].type).toBe('rich_text_list')
      expect(result[0].elements[0].style).toBe('ordered')
      expect(result[0].elements[0].elements).toHaveLength(3)
    })

    it('should handle unordered lists', async () => {
      const result = await markdownToBlocks('- First\n- Second\n- Third')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('rich_text')
      expect(result[0].elements[0].type).toBe('rich_text_list')
      expect(result[0].elements[0].style).toBe('bullet')
      expect(result[0].elements[0].elements).toHaveLength(3)
    })

    it('should handle mixed list types separately', async () => {
      const result = await markdownToBlocks('- Bullet item\n\n1. Ordered item')

      expect(result).toHaveLength(2)
      expect(result[0].elements[0].style).toBe('bullet')
      expect(result[1].elements[0].style).toBe('ordered')
    })

    it('should handle lists with formatting', async () => {
      const result = await markdownToBlocks(
        '- **Bold** item\n- *Italic* item\n- `Code` item'
      )

      expect(result).toHaveLength(1)
      expect(result[0].elements[0].elements).toHaveLength(3)

      // Check that formatting is preserved in list items using the style property
      // @note rich_text blocks use style: { bold: true, italic: true, code: true }
      const items = result[0].elements[0].elements

      // Check for bold style
      expect(
        items.some((item) =>
          item.elements?.some((el) => el.type === 'text' && el.style?.bold)
        )
      ).toBe(true)

      // Check for italic style
      expect(
        items.some((item) =>
          item.elements?.some((el) => el.type === 'text' && el.style?.italic)
        )
      ).toBe(true)

      // Check for code style
      expect(
        items.some((item) =>
          item.elements?.some((el) => el.type === 'text' && el.style?.code)
        )
      ).toBe(true)
    })

    it('should handle lists with links', async () => {
      const result = await markdownToBlocks(
        '- [Google](https://google.com)\n- [GitHub](https://github.com)'
      )

      expect(result).toHaveLength(1)
      expect(result[0].elements[0].elements).toHaveLength(2)

      // Check that links are properly converted in list items
      const items = result[0].elements[0].elements

      expect(items[0].elements?.[0]?.type).toBe('link')
      expect(items[0].elements?.[0]?.url).toBe('https://google.com')
      expect(items[0].elements?.[0]?.text).toBe('Google')
    })

    it('should handle simple nested lists', async () => {
      const markdown = `- Top level 1
  - Nested 1
  - Nested 2
- Top level 2`

      const result = await markdownToBlocks(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('rich_text')
      expect(result[0].elements[0].type).toBe('rich_text_list')
      // All items should be flattened into a single list
      expect(result[0].elements[0].elements.length).toBeGreaterThan(2)
    })

    it('should handle empty list items gracefully', async () => {
      const result = await markdownToBlocks('- Item 1\n-\n- Item 3')

      expect(result).toHaveLength(1)
      // Should only have non-empty items
      expect(result[0].elements[0].elements.length).toBeLessThanOrEqual(2)
    })

    it('should handle a list item containing only an empty link', async () => {
      // @note an empty-text link `[]()` in a list item produces a rich_text_section
      // with an empty elements array - this is the current behavior
      const result = await markdownToBlocks('- [](https://example.com)')

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('rich_text')
      expect(result[0].elements[0].type).toBe('rich_text_list')

      // The section exists but has no child elements because there is no text
      const section = result[0].elements[0].elements[0]

      expect(section.type).toBe('rich_text_section')
      expect(section.elements).toHaveLength(0)
    })

    it('should handle reference-style links in list items', async () => {
      const md =
        '- See [Google][1]\n- See [GitHub][2]\n\n[1]: https://google.com\n[2]: https://github.com'
      const result = await markdownToBlocks(md)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('rich_text')

      const list = result[0].elements[0]

      expect(list.type).toBe('rich_text_list')
      expect(list.elements).toHaveLength(2)

      const firstLink = list.elements[0].elements.find(
        (el) => el.type === 'link'
      )

      expect(firstLink).toBeDefined()
      expect(firstLink.url).toBe('https://google.com')
      expect(firstLink.text).toBe('Google')

      const secondLink = list.elements[1].elements.find(
        (el) => el.type === 'link'
      )

      expect(secondLink).toBeDefined()
      expect(secondLink.url).toBe('https://github.com')
      expect(secondLink.text).toBe('GitHub')
    })
  })

  // COMPLEX COMBINATIONS
  describe('Complex Combinations', () => {
    it('should handle mixed content types', async () => {
      const markdown = `# Header

Some text with **bold** and [link](https://example.com).

\`\`\`
code block
\`\`\`

> Quote with *italic*

- List item 1
- List item 2

![Image](https://example.com/image.png)`

      const result = await markdownToBlocks(markdown)

      // Should have multiple different block types
      expect(result.length).toBeGreaterThan(5)

      const blockTypes = result.map((block) => block.type)

      expect(blockTypes).toContain('header')
      expect(blockTypes).toContain('section')
      expect(blockTypes).toContain('rich_text')
      expect(blockTypes).toContain('image')
    })

    // @todo investigate list merging behavior - adjacent lists should remain separate
    test.skip('should handle adjacent elements of the same type', async () => {
      // @note this test fails because adjacent lists get merged into a single list
      // when they should remain as separate list blocks based on spacing in markdown
      // Expected: 2 separate list blocks
      // Actual: 1 merged list block with all items

      const markdown = `# Header 1
# Header 2

Text paragraph 1.

Text paragraph 2.

- List 1 item 1
- List 1 item 2

- List 2 item 1
- List 2 item 2`

      const result = await markdownToBlocks(markdown)

      // Should have separate blocks for each element
      const headers = result.filter((block) => block.type === 'header')

      expect(headers).toHaveLength(2)

      const lists = result.filter(
        (block) =>
          block.type === 'rich_text' &&
          block.elements?.[0]?.type === 'rich_text_list'
      )

      expect(lists).toHaveLength(2)
    })

    it('should handle text with line breaks', async () => {
      const result = await markdownToBlocks('Line 1\nLine 2\n\nParagraph 2')

      // Should create separate sections for separate paragraphs
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle hard line breaks in paragraphs', async () => {
      const result = await markdownToBlocks('first line\\\nsecond line')

      const allText = result.map((block) => block.text?.text || '').join('')

      expect(allText).toContain('first line')
      expect(allText).toContain('\n')
      expect(allText).toContain('second line')
    })

    it('should handle markdown with no spacing (current behavior)', async () => {
      const result = await markdownToBlocks('#Header\nText\n>Quote\n-List')

      expect(result.length).toBeGreaterThanOrEqual(2)
      // The function processes this but not necessarily with headers - update to match reality
      expect(result.some((block) => block.type === 'rich_text')).toBe(true)
    })
  })

  // PERFORMANCE AND EDGE CASES
  describe('Performance and Edge Cases', () => {
    it('should handle very large documents efficiently', async () => {
      const largeMarkdown = Array.from(
        { length: 100 },
        (_, i) =>
          `## Section ${i}\n\nContent for section ${i} with some **bold** text.\n\n- Item 1\n- Item 2\n`
      ).join('\n')

      const startTime = Date.now()
      const result = await markdownToBlocks(largeMarkdown)
      const endTime = Date.now()

      expect(result.length).toBeGreaterThan(200) // Should have headers, sections, and lists
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle deeply nested quotes', async () => {
      const nestedQuotes = '> > > Deep quote'
      const result = await markdownToBlocks(nestedQuotes)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('rich_text')
      expect(result[0].elements[0].type).toBe('rich_text_quote')
      expect(result[0].elements[0].elements[0].text).toBe('Deep quote')
    })

    it('should handle mixed quote and list content', async () => {
      const markdown = `> This is a quote
> 
> - Item in quote
> - Another item`

      const result = await markdownToBlocks(markdown)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('rich_text')
      expect(result[0].elements[0].type).toBe('rich_text_quote')
    })

    it('should handle multiple consecutive line breaks', async () => {
      const result = await markdownToBlocks('Text 1\n\n\n\n\nText 2')

      // Should create separate paragraphs despite multiple line breaks
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle special Slack markup characters (current behavior)', async () => {
      const markdown = 'Text with @channel and #general mentions <test>'
      const result = await markdownToBlocks(markdown)

      expect(result).toHaveLength(1)
      // Note: The '<test>' part gets stripped due to HTML parsing
      expect(result[0].text.text).toBe(
        'Text with @channel and #general mentions '
      )
    })

    it('should handle URLs without markdown link syntax (current behavior)', async () => {
      const result = await markdownToBlocks(
        'Visit https://example.com for more info'
      )

      expect(result).toHaveLength(1)
      // URLs are automatically converted to link format
      expect(result[0].text.text).toBe(
        'Visit <https://example.com|https://example.com> for more info'
      )
    })

    it('should handle email addresses (current behavior)', async () => {
      const result = await markdownToBlocks('Contact us at test@example.com')

      expect(result).toHaveLength(1)
      // Email addresses are automatically converted to mailto links
      expect(result[0].text.text).toBe(
        'Contact us at <mailto:test@example.com|test@example.com>'
      )
    })

    it('should handle mixed markdown and HTML entities (current behavior)', async () => {
      const result = await markdownToBlocks('Text with &amp; and **bold** text')

      expect(result).toHaveLength(1)

      const textContent = result.map((block) => block.text?.text).join('')

      // HTML entities get decoded by the markdown parser
      expect(textContent).toContain('&')
      expect(textContent).toContain('*bold*')
    })

    it('should handle markdown inside code blocks (should not be processed)', async () => {
      const result = await markdownToBlocks(
        '```\n**this should not be bold**\n```'
      )

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('rich_text')
      expect(result[0].elements[0].elements[0].text).toBe(
        '**this should not be bold**'
      )
    })

    it('should handle tables gracefully (markdown tables)', async () => {
      const table = `| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |`

      const result = await markdownToBlocks(table)

      // Tables should be converted to text (no special table block support)
      expect(result.length).toBeGreaterThan(0)
      expect(
        result.every((block) => ['section', 'rich_text'].includes(block.type))
      ).toBe(true)

      // Header row cells should be bolded
      expect(result[0].type).toBe('section')
      expect(result[0].text?.text).toContain('*Column 1*')
      expect(result[0].text?.text).toContain('*Column 2*')

      // Data row cells should be plain text
      expect(result[1].type).toBe('section')
      expect(result[1].text?.text).toContain('Cell 1')
      expect(result[1].text?.text).toContain('Cell 2')
    })
  })
})

describe('markdownToBlockChunks', () => {
  it('should split markdown before converting each chunk to blocks', async () => {
    const markdown = `First paragraph.

Second paragraph.

Third paragraph.`

    const result = await markdownToBlockChunks(markdown, 20)

    expect(result.map(({ text }) => text)).toEqual([
      'First paragraph.',
      'Second paragraph.',
      'Third paragraph.',
    ])

    expect(result.map(({ blocks }) => blocks)).toEqual([
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'First paragraph.',
          },
        },
      ],
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Second paragraph.',
          },
        },
      ],
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Third paragraph.',
          },
        },
      ],
    ])
  })

  it('must handle thematic breaks', async () => {
    const result = await markdownToBlocks('Before\n\n---\n\nAfter')

    expect(result).toHaveLength(3)
    expect(result[0].type).toBe('section')
    expect(result[0].text.text).toBe('Before')
    expect(result[1].type).toBe('divider')
    expect(result[2].type).toBe('section')
    expect(result[2].text.text).toBe('After')
  })
})

describe('groupBlocksForSlackMessages', () => {
  const section = (text) => ({
    type: 'section',
    text: { type: 'mrkdwn', text },
  })

  it('keeps a small chunk as a single group', () => {
    const chunks = [{ text: 'hello', blocks: [section('a'), section('b')] }]

    const result = groupBlocksForSlackMessages(chunks)

    expect(result).toEqual([
      { text: 'hello', blocks: [section('a'), section('b')] },
    ])
  })

  it('isolates image blocks into their own group', () => {
    const image = { type: 'image', image_url: 'https://x/y.png', alt_text: 'y' }
    const chunks = [{ text: 't', blocks: [section('a'), image, section('b')] }]

    const result = groupBlocksForSlackMessages(chunks)

    expect(result).toEqual([
      { text: 't', blocks: [section('a')] },
      { text: 't', blocks: [image] },
      { text: 't', blocks: [section('b')] },
    ])
  })

  it('splits a group that exceeds the per-message block limit', () => {
    const blocks = Array.from({ length: 51 }, (_, i) => section(`row ${i}`))
    const chunks = [{ text: 't', blocks }]

    const result = groupBlocksForSlackMessages(chunks)

    // @note 51 blocks must become two messages, neither over the limit
    expect(result).toHaveLength(2)
    expect(result[0].blocks).toHaveLength(MAX_SLACK_BLOCKS_PER_MESSAGE)
    expect(result[1].blocks).toHaveLength(1)
    result.forEach(({ blocks }) => {
      expect(blocks.length).toBeLessThanOrEqual(MAX_SLACK_BLOCKS_PER_MESSAGE)
    })
  })

  it('respects a custom maxBlocks value', () => {
    const blocks = Array.from({ length: 5 }, (_, i) => section(`row ${i}`))
    const chunks = [{ text: 't', blocks }]

    const result = groupBlocksForSlackMessages(chunks, 2)

    expect(result.map(({ blocks }) => blocks.length)).toEqual([2, 2, 1])
  })

  it('a compact >50-row table never posts >50 blocks', async () => {
    // @note a markdown table where each row becomes its own section block can
    // exceed Slack's 50-block limit while the source text stays under the
    // character-based chunk size, producing a single oversized chunk.
    const header = '| # | Name |\n| --- | --- |'
    const rows = Array.from(
      { length: 60 },
      (_, i) => `| ${i} | Person ${i} |`
    ).join('\n')

    const chunks = await markdownToBlockChunks(`${header}\n${rows}`)

    // @note guard the test's premise: the table fits in one chunk yet yields
    // more than the per-message block limit
    expect(chunks).toHaveLength(1)
    expect(chunks[0].blocks.length).toBeGreaterThan(
      MAX_SLACK_BLOCKS_PER_MESSAGE
    )

    const groups = groupBlocksForSlackMessages(chunks)

    expect(groups.length).toBeGreaterThan(1)
    groups.forEach(({ blocks }) => {
      expect(blocks.length).toBeLessThanOrEqual(MAX_SLACK_BLOCKS_PER_MESSAGE)
    })
  })
})

describe('invalid_blocks content guards', () => {
  describe('oversized headers', () => {
    it('keeps a header under the limit as a header block', async () => {
      const text = 'A'.repeat(SLACK_HEADER_TEXT_LIMIT)
      const result = await markdownToBlocks(`# ${text}`)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('header')
      expect(result[0].text.type).toBe('plain_text')
      expect(result[0].text.text).toBe(text)
    })

    it('renders an over-limit header as a bold section instead of a header', async () => {
      const text = 'A'.repeat(SLACK_HEADER_TEXT_LIMIT + 1)
      const result = await markdownToBlocks(`# ${text}`)

      expect(result).toHaveLength(1)
      // @note must NOT be a header block - that would exceed Slack's 150-char
      // plain_text limit and be rejected with invalid_blocks
      expect(result[0].type).toBe('section')
      expect(result[0].text.type).toBe('mrkdwn')
      expect(result[0].text.text).toBe(`*${text}*`)
    })
  })

  describe('non-postable image URLs', () => {
    it('drops an image with an empty URL', async () => {
      const result = await markdownToBlocks('![alt]()')

      expect(result.some((block) => block.type === 'image')).toBe(false)
    })

    it('drops an image with a relative URL', async () => {
      const result = await markdownToBlocks('![alt](/local/path.png)')

      expect(result.some((block) => block.type === 'image')).toBe(false)
    })

    it('keeps an image with a valid https URL', async () => {
      const result = await markdownToBlocks(
        '![alt](https://example.com/image.png)'
      )

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('image')
      expect(result[0].image_url).toBe('https://example.com/image.png')
    })
  })
})

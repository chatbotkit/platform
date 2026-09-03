import { splitTextByTopLevelBlocksToSize } from '@/lib/md.split'
import type {
  KnownBlock,
  MrkdwnElement,
  RichTextBlock,
  RichTextLink,
  RichTextList,
  RichTextSection,
  RichTextText,
} from '@/lib/slack.types'

import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

// =============================================================================
// Types
// =============================================================================

/**
 * Internal type for mdast nodes from remark parser.
 */
interface MdastNode {
  type: string
  children?: MdastNode[]
  value?: string
  url?: string
  alt?: string
  ordered?: boolean
  identifier?: string
  label?: string
  title?: string
  // @note set by remark-gfm on task-list items: true for `[x]`, false for
  // `[ ]`, null/undefined for ordinary list items. The `[x]`/`[ ]` marker is
  // stripped from the item text and surfaced here instead.
  checked?: boolean | null
}

/**
 * Internal section block type for markdown conversion. This is a narrower type
 * than Slack's SectionBlock that guarantees text is present with mrkdwn type.
 */
interface MrkdwnSectionBlock {
  type: 'section'
  text: MrkdwnElement
}

/**
 * Internal rich text element types used during conversion. These are compatible
 * with Slack's RichTextText and RichTextLink.
 */
type ConversionRichTextElement = RichTextText | RichTextLink

export interface SlackBlockChunk {
  text: string
  blocks: KnownBlock[]
}

// @note leave headroom because raw markdown can expand when converted to Slack mrkdwn links
export const DEFAULT_SLACK_MARKDOWN_CHUNK_SIZE = 2500

// @note Slack's chat.postMessage / chat.update reject any message with more
// than 50 blocks (`invalid_blocks`). A single markdown table or long list can
// produce one block per row/item and blow past this even when the source text
// is well under DEFAULT_SLACK_MARKDOWN_CHUNK_SIZE, because that limit counts
// characters, not blocks.
export const MAX_SLACK_BLOCKS_PER_MESSAGE = 50

// @note Slack header blocks use plain_text capped at 150 characters; longer
// text is rejected with `invalid_blocks`. Headings over this are rendered as a
// bold section instead so the content survives.
export const SLACK_HEADER_TEXT_LIMIT = 150

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Whether a URL is safe to use as a Slack image block `image_url`. Slack
 * requires a publicly reachable http(s) URL; empty, relative, or non-http URLs
 * are rejected with `invalid_blocks`, so such images are dropped rather than
 * failing the whole message. A valid-but-unreachable (404) URL still passes
 * here and is handled at post time.
 */
export function isPostableSlackImageUrl(url: string | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url)
}

/**
 * Escapes special characters in Slack mrkdwn link text to prevent breaking the
 * link syntax. The pipe character (|) is particularly problematic as it's used
 * as the separator between URL and display text in Slack's <url|text> format.
 *
 * @param text - The text to escape
 * @returns The escaped text safe for use in Slack link syntax
 */
export function escapeSlackLinkText(text: string): string {
  if (!text) {
    return text
  }

  return (
    text
      // @note replace pipe with a visually similar Unicode character (Latin letter pipe)
      .replace(/\|/g, 'ǀ')
      // @note replace angle brackets with visually similar Unicode characters
      .replace(/</g, '‹')
      .replace(/>/g, '›')
  )
}

/**
 * Strips Slack mrkdwn link formatting from text, returning only the display text.
 * Converts "<url|display text>" to "display text" and "<url>" to the URL.
 *
 * @param text - Text that may contain mrkdwn link formatting
 * @returns Plain text with link formatting stripped
 */
export function stripSlackLinkFormatting(text: string): string {
  if (!text) {
    return text
  }

  // @note pattern matches <url|text> and <url> formats
  // For <url|text>, extract just the text part
  // For <url>, keep the URL as plain text
  return text.replace(/<([^>|]+)\|([^>]+)>/g, '$2').replace(/<([^>|]+)>/g, '$1')
}

/**
 * Returns the rich_text element used to render a GFM task-list checkbox, or
 * null for an ordinary (non-task) list item. Slack's rich_text_list has no
 * checkbox style, so the state is represented with a Unicode ballot-box glyph
 * prefixed to the item: ☑ for checked (`[x]`), ☐ for unchecked (`[ ]`).
 *
 * @param checked - The `checked` value from a remark-gfm listItem node
 * @returns A text element to prepend, or null for non-task items
 */
export function taskCheckboxElement(
  checked: boolean | null | undefined
): RichTextText | null {
  if (checked === true) {
    return { type: 'text', text: '☑ ' }
  }

  if (checked === false) {
    return { type: 'text', text: '☐ ' }
  }

  return null
}

/**
 * Prepends a task-list checkbox glyph to the first section of a converted list
 * item when the item is a GFM task item. Non-task items are returned unchanged.
 * The glyph is added to the item's own section (the first one); any sections
 * that follow belong to flattened nested items and keep their own checkboxes.
 *
 * @param sections - The rich_text sections/elements produced for a list item
 * @param checked - The `checked` value from the listItem node
 * @returns The sections with the checkbox prefixed where applicable
 */
export function applyTaskCheckbox(
  sections: (RichTextSection | ConversionRichTextElement)[],
  checked: boolean | null | undefined
): (RichTextSection | ConversionRichTextElement)[] {
  const checkbox = taskCheckboxElement(checked)

  if (!checkbox) {
    return sections
  }

  const [first, ...rest] = sections

  if (first && first.type === 'rich_text_section') {
    return [{ ...first, elements: [checkbox, ...first.elements] }, ...rest]
  }

  // @note empty task item (e.g. "- [ ]") has no section to prefix; emit a
  // section holding just the checkbox so the box still renders
  return [{ type: 'rich_text_section', elements: [checkbox] }, ...sections]
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * This function takes a normal markdown string, parses and returns an array of
 * Slack blocks. Special elements such as images are also supported and will be
 * converted to block accessories.
 *
 * @param markdown - The markdown string to convert
 * @returns An array of Slack blocks
 */
export async function markdownToBlocks(
  markdown: string
): Promise<KnownBlock[]> {
  /**
   * Extracts plain text from an mdast node tree by recursing through all
   * children. Used for contexts like headers where formatting markers should
   * not appear.
   */
  function extractPlainText(node: MdastNode): string {
    if (node.type === 'image') {
      return node.alt ?? ''
    }

    if (node.value != null) {
      return node.value
    }

    return (node.children ?? []).map(extractPlainText).join('')
  }

  // @note collect definition nodes (from reference-style links) so we can
  // resolve linkReference nodes later in any converter
  const definitions = new Map<string, string>()

  function collectDefinitions(node: MdastNode) {
    if (node.type === 'definition' && node.identifier && node.url) {
      definitions.set(node.identifier, node.url)
    }

    ;(node.children ?? []).forEach(collectDefinitions)
  }

  function convertBlocks(tree: MdastNode): KnownBlock[] {
    switch (tree.type) {
      /**
       * For each child of the root, we'll convert them to blocks and then
       * flatten the resulting array.
       */
      case 'root': {
        return tree.children?.flatMap(convertBlocks) ?? []
      }

      /**
       * For each heading, we'll convert the children to blocks and then return
       * a header block with the text.
       */
      case 'heading': {
        // @note extract plain text directly from the AST instead of going
        // through convertBlocks, because headers use plain_text type which
        // cannot contain mrkdwn formatting markers like *, _, ~, or `
        const text = extractPlainText(tree)

        if (!text) {
          return []
        }

        // @note Slack header blocks are plain_text capped at SLACK_HEADER_TEXT_LIMIT
        // chars; longer text triggers invalid_blocks. Fall back to a bold section
        // so the content is preserved rather than dropped or truncated.
        if (text.length > SLACK_HEADER_TEXT_LIMIT) {
          return [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${text}*`,
              },
            },
          ]
        }

        return [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text,
            },
          },
        ]
      }

      /**
       * For each paragraph, we'll convert the children to blocks and then
       * return a section block with the text. Special elements such as images
       * will be converted to block accessories.
       */
      case 'paragraph': {
        const blocks: KnownBlock[] = []

        ;(tree.children ?? []).flatMap(convertBlocks).forEach((block) => {
          switch (block.type) {
            case 'image': {
              blocks.push(block)

              break
            }

            default: {
              const text = (block as MrkdwnSectionBlock).text?.text

              if (text) {
                const lastBlock = blocks[blocks.length - 1]

                if (lastBlock?.type === 'section') {
                  ;(lastBlock as MrkdwnSectionBlock).text.text += text
                } else {
                  blocks.push({
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: text,
                    },
                  })
                }
              }
            }
          }
        })

        return blocks
      }

      /**
       * For each blockquote, we'll convert the children to rich_text elements
       * and return a rich_text_quote block. Links are preserved as proper link
       * elements rather than mrkdwn strings, because rich_text_quote does not
       * support mrkdwn syntax.
       */
      case 'blockquote': {
        const convertQuoteNode = (
          node: MdastNode
        ): ConversionRichTextElement[] => {
          switch (node.type) {
            case 'paragraph': {
              const children = (node.children ?? []).flatMap(convertQuoteNode)

              // @note append a newline after each paragraph within a blockquote
              // to preserve line breaks between paragraphs
              return children.length
                ? [...children, { type: 'text', text: '\n' }]
                : []
            }

            case 'blockquote': {
              return (node.children ?? []).flatMap(convertQuoteNode)
            }

            case 'heading': {
              // @note headings inside blockquotes are flattened to bold text
              // since rich_text_quote does not support header elements
              const text = (node.children ?? [])
                .flatMap(convertQuoteNode)
                .map((el) => el.text ?? '')
                .join('')

              return text
                ? [
                    { type: 'text', text, style: { bold: true } },
                    { type: 'text', text: '\n' },
                  ]
                : []
            }

            case 'list': {
              return (node.children ?? []).flatMap(convertQuoteNode)
            }

            case 'listItem': {
              // @note list items are flattened to text with a bullet/dash prefix
              // since rich_text_quote does not support nested lists
              const children = (node.children ?? []).flatMap(convertQuoteNode)

              return children.length
                ? [{ type: 'text', text: '- ' }, ...children]
                : []
            }

            case 'code': {
              // @note fenced code blocks inside blockquotes are rendered as
              // plain text with code styling since rich_text_quote cannot
              // contain rich_text_preformatted elements
              return node.value
                ? [
                    { type: 'text', text: node.value, style: { code: true } },
                    { type: 'text', text: '\n' },
                  ]
                : []
            }

            case 'break': {
              return [{ type: 'text', text: '\n' }]
            }

            case 'link': {
              const text = (node.children ?? [])
                .flatMap(convertQuoteNode)
                .map((el) => el.text ?? '')
                .join('')

              return [
                {
                  type: 'link',
                  url: node.url ?? '',
                  text: text || (node.url ?? ''),
                },
              ]
            }

            case 'linkReference': {
              const text = (node.children ?? [])
                .flatMap(convertQuoteNode)
                .map((el) => el.text ?? '')
                .join('')

              const url = definitions.get(node.identifier ?? '')

              if (url) {
                return [
                  {
                    type: 'link',
                    url,
                    text: text || url,
                  },
                ]
              }

              return text ? [{ type: 'text', text }] : []
            }

            case 'strong': {
              const text = (node.children ?? [])
                .flatMap(convertQuoteNode)
                .map((el) => el.text ?? '')
                .join('')

              return text ? [{ type: 'text', text, style: { bold: true } }] : []
            }

            case 'emphasis': {
              const text = (node.children ?? [])
                .flatMap(convertQuoteNode)
                .map((el) => el.text ?? '')
                .join('')

              return text
                ? [{ type: 'text', text, style: { italic: true } }]
                : []
            }

            case 'delete': {
              const text = (node.children ?? [])
                .flatMap(convertQuoteNode)
                .map((el) => el.text ?? '')
                .join('')

              return text
                ? [{ type: 'text', text, style: { strike: true } }]
                : []
            }

            case 'inlineCode': {
              return node.value
                ? [{ type: 'text', text: node.value, style: { code: true } }]
                : []
            }

            case 'text': {
              return node.value ? [{ type: 'text', text: node.value }] : []
            }

            default: {
              return []
            }
          }
        }

        const elements = (tree.children ?? [])
          .flatMap(convertQuoteNode)
          // @note trim trailing newline appended after last paragraph
          .filter(
            (el, i, arr) =>
              !(i === arr.length - 1 && el.type === 'text' && el.text === '\n')
          )

        return elements.length
          ? [
              {
                type: 'rich_text',
                elements: [
                  {
                    type: 'rich_text_quote',
                    elements,
                  },
                ],
              },
            ]
          : []
      }

      /**
       * For each list, we'll convert the children to blocks and then return a
       * list block with the elements.
       */
      case 'list': {
        const elements = (tree.children ?? [])
          .flatMap(convertBlocks)
          .filter(
            (block) =>
              (block as RichTextBlock).elements?.[0]?.elements?.[0] ||
              (block as RichTextBlock).elements?.[0]
          )

        // Flatten nested lists into the parent list
        const flattenedElements: RichTextSection[] = []

        for (const element of elements) {
          const richTextBlock = element as RichTextBlock

          if (
            element.type === 'rich_text' &&
            richTextBlock.elements?.[0]?.type === 'rich_text_list'
          ) {
            // This is a nested list, flatten its elements into the parent
            flattenedElements.push(
              ...((richTextBlock.elements[0] as RichTextList).elements ?? [])
            )
          } else if (richTextBlock.elements?.[0]?.elements?.[0]) {
            // This is a regular list item
            flattenedElements.push(
              richTextBlock.elements[0].elements[0] as RichTextSection
            )
          }
        }

        return flattenedElements.length
          ? [
              {
                type: 'rich_text',
                elements: [
                  {
                    type: 'rich_text_list',
                    style: tree.ordered ? 'ordered' : 'bullet',
                    elements: flattenedElements,
                  },
                ],
              },
            ]
          : []
      }

      /**
       * For each list item, we'll convert the children to blocks and then
       * return a list block with the elements.
       */
      case 'listItem': {
        /**
         * @note we need to use a custom function to convert the blocks because
         * only a subset of block types are supported within a list item
         */
        const convertSimpleBlocks = (
          tree: MdastNode
        ): (RichTextSection | ConversionRichTextElement)[] => {
          switch (tree.type) {
            case 'paragraph': {
              return [
                {
                  type: 'rich_text_section',
                  elements: (tree.children ?? []).flatMap(
                    convertSimpleBlocks
                  ) as ConversionRichTextElement[],
                },
              ]
            }

            case 'list': {
              // For nested lists, we need to flatten them into the parent list
              // rather than creating a new rich_text block
              return (tree.children ?? []).flatMap(convertSimpleBlocks)
            }

            case 'listItem': {
              // For nested list items, extract the content directly
              return applyTaskCheckbox(
                (tree.children ?? []).flatMap(convertSimpleBlocks),
                tree.checked
              )
            }

            case 'link': {
              const text = (tree.children ?? [])
                .flatMap(convertSimpleBlocks)
                .map(
                  (element) =>
                    (element as ConversionRichTextElement).text || element
                )
                .filter((text): text is string => !!text)
                .join('')

              return text
                ? [
                    {
                      type: 'link',
                      url: tree.url ?? '',
                      text: text,
                    },
                  ]
                : []
            }

            case 'linkReference': {
              const text = (tree.children ?? [])
                .flatMap(convertSimpleBlocks)
                .map(
                  (element) =>
                    (element as ConversionRichTextElement).text || element
                )
                .filter((text): text is string => !!text)
                .join('')

              const url = definitions.get(tree.identifier ?? '')

              if (url && text) {
                return [
                  {
                    type: 'link',
                    url,
                    text,
                  },
                ]
              }

              return text
                ? [
                    {
                      type: 'text',
                      text,
                    },
                  ]
                : []
            }

            case 'strong': {
              // @note rich_text blocks require the style property for bold,
              // not mrkdwn-style *text* which is only for section blocks

              const text = (tree.children ?? [])
                .flatMap(convertSimpleBlocks)
                .map(
                  (element) =>
                    (element as ConversionRichTextElement).text || element
                )
                .filter((text): text is string => !!text)
                .join('')

              return text
                ? [
                    {
                      type: 'text',
                      text,
                      style: { bold: true },
                    },
                  ]
                : []
            }

            case 'emphasis': {
              // @note rich_text blocks require the style property for italic,
              // not mrkdwn-style _text_ which is only for section blocks

              const text = (tree.children ?? [])
                .flatMap(convertSimpleBlocks)
                .map(
                  (element) =>
                    (element as ConversionRichTextElement).text || element
                )
                .filter((text): text is string => !!text)
                .join('')

              return text
                ? [
                    {
                      type: 'text',
                      text,
                      style: { italic: true },
                    },
                  ]
                : []
            }

            case 'delete': {
              // @note rich_text blocks require the style property for strikethrough,
              // not mrkdwn-style ~text~ which is only for section blocks

              const text = (tree.children ?? [])
                .flatMap(convertSimpleBlocks)
                .map(
                  (element) =>
                    (element as ConversionRichTextElement).text || element
                )
                .filter((text): text is string => !!text)
                .join('')

              return text
                ? [
                    {
                      type: 'text',
                      text,
                      style: { strike: true },
                    },
                  ]
                : []
            }

            case 'inlineCode': {
              // @note rich_text blocks require the style property for code,
              // not mrkdwn-style `text` which is only for section blocks

              const text = tree.value

              return text
                ? [
                    {
                      type: 'text',
                      text,
                      style: { code: true },
                    },
                  ]
                : []
            }

            case 'text': {
              const text = tree.value

              return text
                ? [
                    {
                      type: 'text',
                      text: text,
                    },
                  ]
                : []
            }

            case 'break': {
              return [{ type: 'text', text: '\n' }]
            }

            default: {
              return []
            }
          }
        }

        return [
          {
            type: 'rich_text',
            elements: [
              {
                type: 'rich_text_list',
                style: 'bullet',
                elements: applyTaskCheckbox(
                  (tree.children ?? []).flatMap(convertSimpleBlocks),
                  tree.checked
                ) as RichTextSection[],
              },
            ],
          },
        ]
      }

      /**
       * For each image, we'll add it to the attachments array and return an
       * empty section block. This will be used to attach the image to the
       * previous paragraph.
       */
      case 'image': {
        // @note drop images without a postable http(s) URL; an empty or
        // relative image_url is rejected by Slack with invalid_blocks
        if (!isPostableSlackImageUrl(tree.url)) {
          return []
        }

        return [
          {
            type: 'image',
            image_url: tree.url ?? '',
            alt_text: tree.alt ?? '',
          },
        ]
      }

      /**
       * For reference-style images, resolve the URL from collected
       * definitions and return an image block.
       */
      case 'imageReference': {
        const url = definitions.get(tree.identifier ?? '')

        if (isPostableSlackImageUrl(url)) {
          return [
            {
              type: 'image',
              image_url: url ?? '',
              alt_text: tree.alt ?? '',
            },
          ]
        }

        return []
      }

      /**
       * For each strong text, we'll convert the children to blocks and then
       * return a section block with the text in bold.
       */
      case 'strong': {
        const text = (tree.children ?? [])
          .flatMap(convertBlocks)
          .map((block) => (block as MrkdwnSectionBlock).text?.text)
          .filter((text): text is string => !!text)
          .join('')

        return text
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${text}*`,
                },
              },
            ]
          : []
      }

      /**
       * For each emphasis text, we'll convert the children to blocks and then
       * return a section block with the text in italic.
       */
      case 'emphasis': {
        const text = (tree.children ?? [])
          .flatMap(convertBlocks)
          .map((block) => (block as MrkdwnSectionBlock).text?.text)
          .filter((text): text is string => !!text)
          .join('')

        return text
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `_${text}_`,
                },
              },
            ]
          : []
      }

      /**
       * For each delete text, we'll convert the children to blocks and then
       * return a section block with the text in strikethrough.
       */
      case 'delete': {
        const text = (tree.children ?? [])
          .flatMap(convertBlocks)
          .map((block) => (block as MrkdwnSectionBlock).text?.text)
          .filter((text): text is string => !!text)
          .join('')

        return text
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `~${text}~`,
                },
              },
            ]
          : []
      }

      /**
       * For reference-style links, resolve the URL from collected definitions
       * and produce a link. Falls back to display text if the definition is
       * missing.
       */
      case 'linkReference': {
        const text = (tree.children ?? [])
          .flatMap(convertBlocks)
          .map((block) => (block as MrkdwnSectionBlock).text?.text)
          .filter((text): text is string => !!text)
          .join('')

        const url = definitions.get(tree.identifier ?? '')

        if (url) {
          const escapedText = escapeSlackLinkText(text)

          return [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: escapedText ? `<${url}|${escapedText}>` : `<${url}>`,
              },
            },
          ]
        }

        return text
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text,
                },
              },
            ]
          : []
      }

      /**
       * Definition nodes are metadata for reference-style links and do not
       * produce any visible output.
       */
      case 'definition': {
        return []
      }

      /**
       * For each link, we'll convert the children to blocks and then return a
       * section block with the text in a link.
       */
      case 'link': {
        const text = (tree.children ?? [])
          .flatMap(convertBlocks)
          .map((block) => (block as MrkdwnSectionBlock).text?.text)
          .filter((text): text is string => !!text)
          .join('')

        // @note escape special characters in link text to prevent breaking
        // Slack mrkdwn

        const escapedText = escapeSlackLinkText(text)

        return [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: escapedText
                ? `<${tree.url}|${escapedText}>`
                : `<${tree.url}>`,
            },
          },
        ]
      }

      /**
       * For each code, we'll return a rich text block with the code.
       */
      case 'code': {
        const text = tree.value

        // @todo handle special codeblocks like references, audio, etc.

        // @note filter out code blocks that contain only whitespace as slack doesn't allow empty text blocks
        return text && text.trim()
          ? [
              {
                type: 'rich_text',
                elements: [
                  {
                    type: 'rich_text_preformatted',
                    elements: [
                      {
                        type: 'text',
                        text,
                      },
                    ],
                  },
                ],
              },
            ]
          : []
      }

      /**
       * For each inline code, we'll return a section block with the code.
       */
      case 'inlineCode': {
        const text = tree.value

        return text
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `\`${text}\``,
                },
              },
            ]
          : []
      }

      /**
       * For each text, we'll simply return the value.
       */
      case 'text': {
        const text = tree.value

        return text
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `${text}`,
                },
              },
            ]
          : []
      }

      /**
       * For hard line breaks, return a newline text element.
       */
      case 'break': {
        return [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '\n',
            },
          },
        ]
      }

      case 'thematicBreak': {
        return [
          {
            type: 'divider',
          },
        ]
      }

      /**
       * For each table, convert rows to section blocks. The first row is
       * treated as the header and its cells are bolded. Subsequent rows have
       * cells joined with ' | '.
       */
      case 'table': {
        const rows = tree.children ?? []
        const blocks: KnownBlock[] = []

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const cells = (row.children ?? [])
            .map((cell) => extractPlainText(cell))
            .filter(Boolean)

          if (cells.length > 0) {
            const isHeader = i === 0
            const text = isHeader
              ? cells.map((c) => `*${c}*`).join(' | ')
              : cells.join(' | ')

            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text,
              },
            })
          }
        }

        return blocks
      }

      /**
       * By default, we'll return an empty section block.
       */
      default: {
        return []
      }
    }
  }

  const tree = (await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(markdown)) as MdastNode

  collectDefinitions(tree)

  return convertBlocks(tree)
}

export async function markdownToBlockChunks(
  markdown: string,
  maxSize = DEFAULT_SLACK_MARKDOWN_CHUNK_SIZE
): Promise<SlackBlockChunk[]> {
  const textChunks = splitTextByTopLevelBlocksToSize(markdown, maxSize)

  return Promise.all(
    textChunks.map(async (text) => ({
      text,
      blocks: await markdownToBlocks(text),
    }))
  )
}

/**
 * Splits message chunks into Slack-postable block groups, where each group is
 * intended to be delivered as a single Slack message.
 *
 * Two constraints are enforced:
 *
 * 1. Image blocks are isolated into their own group. A single image can fail
 *    independently (e.g. a 404 URL causes `invalid_blocks`), so posting it
 *    separately prevents it from taking down the surrounding text.
 *
 * 2. No group exceeds `maxBlocks` blocks. Slack rejects any message with more
 *    than 50 blocks, and a compact markdown table/list can produce more than
 *    that from a single text chunk.
 *
 * @param chunks - The chunks produced by {@link markdownToBlockChunks}
 * @param maxBlocks - The maximum number of blocks allowed per group
 * @returns The block groups, each safe to post as one Slack message
 */
export function groupBlocksForSlackMessages(
  chunks: SlackBlockChunk[],
  maxBlocks = MAX_SLACK_BLOCKS_PER_MESSAGE
): SlackBlockChunk[] {
  const blockGroups: SlackBlockChunk[] = []

  for (const { text, blocks } of chunks) {
    let pending: KnownBlock[] | null = null

    const flush = () => {
      if (pending && pending.length) {
        blockGroups.push({ text, blocks: pending })
      }

      pending = null
    }

    for (const block of blocks) {
      if (block.type === 'image') {
        flush()

        blockGroups.push({ text, blocks: [block] })

        continue
      }

      if (!pending) {
        pending = []
      }

      pending.push(block)

      // @note flush as soon as we hit the limit so the next block starts a
      // fresh group rather than overflowing the current one
      if (pending.length >= maxBlocks) {
        flush()
      }
    }

    flush()
  }

  return blockGroups
}

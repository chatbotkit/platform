// @ts-check
import { splitTextByTopLevelBlockTypes } from './split'

/**
 * Filter the text based on the emitCompleteFencedCodeBlocks option.
 *
 * @param {string} text
 * @param {{
 *  emitCompleteFencedCodeBlocks?: boolean|string[]
 * }} options
 * @returns {boolean} true if the block should be kept
 */
function keepCodeBlock(text, options) {
  const { emitCompleteFencedCodeBlocks } = options

  // if emitCompleteFencedCodeBlocks is not provided, keep the block

  if (!emitCompleteFencedCodeBlocks) {
    return true
  }

  // make the text nice to work with

  const niceText = text.trim()

  // if it is not a fenced code block, keep it

  if (!niceText.startsWith('```')) {
    return true
  }

  // if it is complete then keep it too

  if (niceText.length > 3 && niceText.endsWith('```')) {
    return true
  }

  // if it is not complete fenced code block...

  if (!niceText.endsWith('```')) {
    const language = niceText.substring(3).trim()

    const hasLines = niceText.split('\n').length > 1

    if (language && hasLines) {
      if (Array.isArray(emitCompleteFencedCodeBlocks)) {
        return !emitCompleteFencedCodeBlocks.some((lang) =>
          language.startsWith(lang)
        )
      }
    }
  }

  // by default, skip the block

  return false
}

/**
 * Filter the text based on the emitCompleteTableBlockRows option.
 *
 * @param {string} text
 * @param {{
 *  emitCompleteTableBlocks?: boolean
 * }} options
 * @returns {boolean} true if the block should be kept
 */
function keepTableBlock(text, options) {
  text
  options

  return true // @todo implement this
}

/**
 * Filters the text based on options.
 *
 * @param {string} text
 * @param {{
 *   type: string,
 *   emitCompleteFencedCodeBlocks?: boolean|string[],
 *   emitCompleteTableBlocks?: boolean
 * }} options
 * @returns {boolean} true if the block should be kept
 */
function keepBlock(text, options) {
  const { type, emitCompleteFencedCodeBlocks, emitCompleteTableBlocks } =
    options

  switch (true) {
    case type == 'code': {
      return keepCodeBlock(text, {
        emitCompleteFencedCodeBlocks,
      })
    }

    case type == 'table': {
      return keepTableBlock(text, {
        emitCompleteTableBlocks,
      })
    }

    default: {
      return true
    }
  }
}

/**
 * Filter the text based on the emitCompleteTableBlockRows option.
 *
 * @param {string} text
 * @param {{
 *   emitCompleteTableBlockRows?: boolean
 * }} options
 * @returns {string}
 */
function mapTableBlock(text, options) {
  const { emitCompleteTableBlockRows } = options

  // if emitCompleteTableBlockRows is not provided, keep the block

  if (!emitCompleteTableBlockRows) {
    return text
  }

  // make the text nice to work with

  const niceText = text.trim()

  // make lines to work with

  const lines = niceText.split('\n')

  // if there are no 3 lines, then return empty block

  if (lines.length < 3) {
    return ''
  }

  // return the text

  return text
}

/**
 * Remove incomplete markdown anchors from text.
 *
 * @param {string} text
 * @param {{
 *   emitCompleteAnchors?: boolean
 * }} options
 * @returns {string}
 */
function mapAnchors(text, options) {
  const { emitCompleteAnchors } = options

  // if emitCompleteAnchors is not provided, return text as is

  if (!emitCompleteAnchors) {
    return text
  }

  // check for incomplete anchors at the end of the text
  // incomplete patterns: `[`, `[text`, `[text](`, `[text](https://`

  const trimmed = text.trimEnd()

  // find the last opening bracket that might start an anchor

  const lastOpenBracket = trimmed.lastIndexOf('[')

  if (lastOpenBracket === -1) {
    return text
  }

  // extract potential anchor from last [ to end

  const potentialAnchor = trimmed.substring(lastOpenBracket)

  // check if it's a complete anchor: [text](url)
  // a complete anchor must have:
  // 1. Opening [
  // 2. Text content
  // 3. Closing ]
  // 4. Opening (
  // 5. URL content (can be empty)
  // 6. Closing )

  const completeAnchorPattern = /^\[[^\]]+\]\([^)]*\)$/

  if (completeAnchorPattern.test(potentialAnchor)) {
    // it's complete, return as is

    return text
  }

  // check if there's a ] after the last [

  const closingBracket = potentialAnchor.indexOf(']')

  if (closingBracket === -1) {
    // incomplete: `[` or `[text`

    return trimmed.substring(0, lastOpenBracket).trimEnd()
  }

  // check if there's a ( after the ]

  const openParen = potentialAnchor.indexOf('(', closingBracket)

  if (openParen === -1) {
    // incomplete: might be just text with brackets, not an anchor
    // check if it looks like an anchor attempt (no space before ])

    if (closingBracket === potentialAnchor.length - 1) {
      // ends with ], might be attempting to create link

      return text
    }

    return text
  }

  // check if there's a ) after the (

  const closeParen = potentialAnchor.indexOf(')', openParen)

  if (closeParen === -1) {
    // incomplete: `[text](` or `[text](https://`

    return trimmed.substring(0, lastOpenBracket).trimEnd()
  }

  // if we reach here, the anchor appears complete

  return text
}

/**
 * Remove incomplete markdown images from text.
 *
 * @param {string} text
 * @param {{
 *   emitCompleteImages?: boolean
 * }} options
 * @returns {string}
 */
function mapImages(text, options) {
  const { emitCompleteImages } = options

  // if emitCompleteImages is not provided, return text as is

  if (!emitCompleteImages) {
    return text
  }

  // check for incomplete images at the end of the text
  // incomplete patterns: `!`, `![`, `![alt`, `![alt](`, `![alt](https://`

  const trimmed = text.trimEnd()

  // find the last exclamation mark that might start an image
  // we need to check if it's followed by [

  let lastImageStart = -1

  for (let i = trimmed.length - 1; i >= 0; i--) {
    if (trimmed[i] === '!') {
      // check if next character is [
      if (i + 1 < trimmed.length && trimmed[i + 1] === '[') {
        lastImageStart = i

        break
      }
    }
  }

  if (lastImageStart === -1) {
    return text
  }

  // extract potential image from last ![ to end

  const potentialImage = trimmed.substring(lastImageStart)

  // check if it's a complete image: ![alt](url)
  // a complete image must have:
  // 1. Opening !
  // 2. Opening [
  // 3. Alt text content (can be empty)
  // 4. Closing ]
  // 5. Opening (
  // 6. URL content (can be empty)
  // 7. Closing )

  const completeImagePattern = /^!\[[^\]]*\]\([^)]*\)$/

  if (completeImagePattern.test(potentialImage)) {
    // it's complete, return as is

    return text
  }

  // check if there's a ] after the ![

  const closingBracket = potentialImage.indexOf(']')

  if (closingBracket === -1) {
    // incomplete: `!`, `![`, or `![alt`

    return trimmed.substring(0, lastImageStart).trimEnd()
  }

  // check if there's a ( after the ]

  const openParen = potentialImage.indexOf('(', closingBracket)

  if (openParen === -1) {
    // incomplete: ends with ]( expected but not found

    return trimmed.substring(0, lastImageStart).trimEnd()
  }

  // check if there's a ) after the (

  const closeParen = potentialImage.indexOf(')', openParen)

  if (closeParen === -1) {
    // incomplete: `![alt](` or `![alt](https://`

    return trimmed.substring(0, lastImageStart).trimEnd()
  }

  // if we reach here, the image appears complete

  return text
}

/**
 * Map text block.
 *
 * @param {string} text
 * @param {{
 *   type: string,
 *   emitCompleteTableBlockRows?: boolean,
 *   emitCompleteAnchors?: boolean,
 *   emitCompleteImages?: boolean
 * }} options
 * @returns {string} the text block
 */
function mapBlock(text, options) {
  const {
    type,
    emitCompleteTableBlockRows,
    emitCompleteAnchors,
    emitCompleteImages,
  } = options

  let result = text

  switch (true) {
    case type === 'table' || (type === 'paragraph' && text.startsWith('|')): {
      result = mapTableBlock(result, {
        emitCompleteTableBlockRows,
      })

      break
    }

    default: {
      break
    }
  }

  // apply anchor filtering to all text types

  result = mapAnchors(result, {
    emitCompleteAnchors,
  })

  // apply image filtering to all text types

  result = mapImages(result, {
    emitCompleteImages,
  })

  return result
}

export interface SplitTextOptions {
  emitCompleteFencedCodeBlocks?: boolean | string[]
  emitCompleteTableBlocks?: boolean
  emitCompleteTableBlockRows?: boolean
  emitCompleteAnchors?: boolean
  emitCompleteImages?: boolean
}

/**
 * Splits the text into smaller parts by splitting it at the top-level nodes.
 */
export function splitBubbleText(
  text: string,
  options: SplitTextOptions
): string[] {
  const {
    emitCompleteFencedCodeBlocks,
    emitCompleteTableBlocks,
    emitCompleteTableBlockRows,
    emitCompleteAnchors,
    emitCompleteImages,
  } = options || {}

  const blocks = splitTextByTopLevelBlockTypes(text)
    .filter(({ block, type }, index, array) => {
      // skip markdown headings because they do not make sense for bubble messages.

      if (block.startsWith('#')) {
        return false
      }

      // skip horizontal rules because they do not make sense for bubble messages.

      if (block.startsWith('---')) {
        return false
      }

      const isLastBlock = index === array.length - 1

      if (isLastBlock) {
        return keepBlock(block, {
          type,
          emitCompleteFencedCodeBlocks,
          emitCompleteTableBlocks,
        })
      } else {
        return true
      }
    })
    .map(({ block, type }, index, array) => {
      const isLastBlock = index === array.length - 1

      if (isLastBlock) {
        return mapBlock(block, {
          type,
          emitCompleteTableBlockRows,
          emitCompleteAnchors,
          emitCompleteImages,
        })
      } else {
        return block
      }
    })
    .filter(Boolean)

  return blocks
}

/**
 * Splits the text into smaller parts by splitting it at the top-level nodes.
 */
export function splitStackText(
  text: string,
  options: SplitTextOptions
): string[] {
  const {
    emitCompleteFencedCodeBlocks,
    emitCompleteTableBlocks,
    emitCompleteTableBlockRows,
    emitCompleteAnchors,
    emitCompleteImages,
  } = options || {}

  const blocks = splitTextByTopLevelBlockTypes(text)
    .filter(({ block, type }, index, array) => {
      const isLastBlock = index === array.length - 1

      if (isLastBlock) {
        return keepBlock(block, {
          type,
          emitCompleteFencedCodeBlocks,
          emitCompleteTableBlocks,
        })
      } else {
        return true
      }
    })
    .map(({ block, type }, index, array) => {
      const isLastBlock = index === array.length - 1

      if (isLastBlock) {
        return mapBlock(block, {
          type,
          emitCompleteTableBlockRows,
          emitCompleteAnchors,
          emitCompleteImages,
        })
      } else {
        return block
      }
    })
    .filter(Boolean)

  return blocks
}

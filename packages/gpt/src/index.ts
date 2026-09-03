import { ok as assert } from 'assert'
import { decodeGenerator, encode } from 'gpt-tokenizer'

// should be cl100k_base

// ---
// ---
// ---

export const SEP = null
export const ELLIPSIS = '...'

type Model = string

// ---
// ---
// ---

export function countFrequencies<T>(arr: T[]): Record<string, number> {
  const frequency: Record<string, number> = {}

  for (const elem of arr) {
    const key = `${elem}`

    if (typeof frequency[key] === 'undefined') {
      frequency[key] = 1
    } else {
      frequency[key]++
    }
  }

  return frequency
}

export function getBytePairEncodings(
  text: string,
  _model: Model = 'gpt-4'
): number[] {
  // @todo deal with the model

  // @note allow all special tokens to prevent crashes when user input contains tokens like <|im_end|>
  const result = encode(text, { allowedSpecial: 'all' })

  return result
}

export function getBytePairEncodingFrequencies(
  text: string,
  model: Model = 'gpt-4'
): Record<string, number> {
  const result = countFrequencies(getBytePairEncodings(text, model))

  return result
}

export function getTextTokens(text: string, _model: Model = 'gpt-4'): string[] {
  // @todo deal with the model

  const tokens: string[] = []

  // @note allow all special tokens to prevent crashes when user input contains tokens like <|im_end|>
  for (const token of decodeGenerator(
    encode(text, { allowedSpecial: 'all' })
  )) {
    tokens.push(token)
  }

  return tokens
}

export function getTextTokensLength(
  text: string,
  model: Model = 'gpt-4'
): number {
  const result = getBytePairEncodings(text, model)

  return result.length
}

// ---
// ---
// ---

/**
 * @deprecated
 */
export function adjoinTokens(
  prevTokens: string[],
  tokens: string[],
  nextTokens: string[],
  maxTokens: number,
  overlapTokens: number,
  ellipsis: string = ELLIPSIS
): string[] {
  // @note This function is not designed to accurately slice the tokens hence we
  // use whichever is the maximum tokens size. Why is this? Well, where should
  // we cut from? It is not clearly defined, thus we do not do it. The maxTokens
  // should be always greater than or equal to tokens.length.

  maxTokens = Math.max(tokens.length, maxTokens)

  if (maxTokens === tokens.length) {
    return tokens
  }

  // @note The overlapTokens cannot be negative thus we always peg it to zero to
  // avoid any future problems.

  overlapTokens = Math.max(0, overlapTokens)

  if (overlapTokens == 0) {
    return tokens
  }

  // @note Here we calculate how to trim the prev and next tokens. We need to
  // carefully consider if we should trim both side or one side only.

  let trimByL
  let trimByR

  switch (true) {
    case !!prevTokens.length && !!nextTokens.length:
      trimByL = trimByR = Math.floor((maxTokens - tokens.length) / 2)

      break

    case !!prevTokens.length && !nextTokens.length:
      trimByL = maxTokens - tokens.length
      trimByR = 0

      break

    case !prevTokens.length && !!nextTokens.length:
      trimByL = 0
      trimByR = maxTokens - tokens.length

      break

    default:
      trimByL = 0
      trimByR = 0

      break
  }

  // @note Bot the left and right trim cannot exceed overlapTokens or the tokens
  // length. We take whatever value is the lowest. The assumption is that with
  // all of the previous steps in order we cannot get negative values or zero.

  trimByL = Math.min(trimByL, overlapTokens, prevTokens.length)
  trimByR = Math.min(trimByR, overlapTokens, nextTokens.length)

  // @note Calculate the trim and the ellipsis on the left side. Not only the
  // trim value must be positive but also less than prevTokens length.

  if (trimByL && trimByL <= prevTokens.length) {
    let ellipsisL

    if (ellipsis && trimByL > 1 && prevTokens.length > trimByL) {
      ellipsisL = ellipsis
    }

    prevTokens = prevTokens.slice(-trimByL)

    if (ellipsisL) {
      prevTokens[0] = ellipsis
    }
  } else {
    prevTokens = []
  }

  // @note Calculate the trim and the ellipsis on the right side. Not only the
  // trim value must be positive but also less than nextTokens length.

  if (trimByR && trimByR <= nextTokens.length) {
    let ellipsisR

    if (ellipsis && trimByR > 1 && nextTokens.length > trimByR) {
      ellipsisR = ellipsis
    }

    nextTokens = nextTokens.slice(0, trimByR)

    if (ellipsisR) {
      nextTokens[nextTokens.length - 1] = ellipsis
    }
  } else {
    nextTokens = []
  }

  // @note Build the final list tokens.

  return [...prevTokens, ...tokens, ...nextTokens]
}

// ---
// ---
// ---

/**
 * Recursively split a text into text blocks.
 *
 * @deprecated
 */
export function* separateText(
  text: string,
  separators: string[] = []
): Generator<string> {
  separators = separators.slice(0)

  const sep = separators.shift()

  if (!sep) {
    yield text

    return
  }

  const sections = text.split(sep)

  do {
    const section = sections.shift()

    if (section) {
      yield* separateText(section, separators)
    }
  } while (sections.length)
}

/**
 * Connect text blocks into contingent text.
 *
 * @deprecated
 */
export function connectText(
  iterator: Iterable<string>,
  connector: string = '\n\n'
): string {
  const tokens: string[] = []

  for (const text of iterator) {
    tokens.push(text)
  }

  return tokens.join(connector)
}

/**
 * Split text blocks into a vector of tokens. SEP is a special tokens that
 * indicates start of a block.
 *
 * @deprecated
 */
export function* tokenizeTextBlocks(
  blocks: Iterable<string>
): Generator<string | typeof SEP> {
  let isFirst = true

  for (const block of blocks) {
    if (isFirst) {
      isFirst = false
    } else {
      yield SEP
    }

    yield* getTextTokens(block)
  }
}

/**
 * Yield batches of maxTokens for vector of tokens.
 *
 * @deprecated
 */
export function* batchTokens(
  tokens: Iterable<string | typeof SEP>,
  maxTokens: number,
  ellipsis: string = ELLIPSIS
): Generator<string[]> {
  maxTokens = Math.max(maxTokens, ellipsis ? 3 : 1)

  let batch: string[] = []

  for (const token of tokens) {
    if (token === SEP) {
      if (batch.length) {
        batch.push(' ')

        yield batch

        batch = []
      }
    } else {
      batch.push(token)

      if (batch.length === maxTokens) {
        let last

        if (ellipsis) {
          last = batch.pop()

          batch.push(ellipsis)
        }

        yield batch

        batch = []

        if (ellipsis) {
          batch.push(ellipsis)
        }

        if (last) {
          batch.push(last)
        }
      }
    }
  }

  if (batch.length) {
    yield batch
  }
}

// ---
// ---
// ---

/**
 * @deprecated
 */
export function trimTextBlockL(
  block: string,
  ellipsis: string = ELLIPSIS
): string {
  if (
    ellipsis &&
    block !== ellipsis &&
    block[0] === ellipsis[0] &&
    block.slice(1, ellipsis.length + 1) === ellipsis
  ) {
    block = block.slice(1)
  }

  return block
}

/**
 * @deprecated
 */
export function trimTextBlockR(
  block: string,
  ellipsis: string = ELLIPSIS
): string {
  if (
    ellipsis &&
    block !== ellipsis &&
    block[block.length - 1] === ellipsis[ellipsis.length - 1] &&
    block.slice(-ellipsis.length - 1, -1) === ellipsis
  ) {
    block = block.slice(0, -1)
  }

  return block
}

/**
 * @deprecated
 */
export function trimTextBlock(
  block: string,
  ellipsis: string = ELLIPSIS
): string {
  return trimTextBlockL(trimTextBlockR(block, ellipsis), ellipsis)
}

/**
 * @deprecated use split instead
 */
export function* splitTextBlocks(
  text: string,
  maxTokens: number,
  overlapTokens: number,
  separators: string[] = [],
  ellipsis: string = ELLIPSIS
): Generator<string> {
  let prevBatch: string[] = []

  const itr = batchTokens(
    tokenizeTextBlocks(separateText(text, separators)),
    maxTokens,
    ellipsis
  )

  for (const thisBatch of itr) {
    if (prevBatch.length) {
      const block = adjoinTokens(
        [],
        prevBatch,
        thisBatch,
        maxTokens,
        overlapTokens,
        ellipsis
      ).join('')

      yield trimTextBlock(block)
    }

    prevBatch = adjoinTokens(
      prevBatch,
      thisBatch,
      [],
      maxTokens,
      overlapTokens,
      ellipsis
    )
  }

  if (prevBatch.length) {
    const block = prevBatch.join('')

    yield trimTextBlock(block)
  }
}

// ---
// ---
// ---

/**
 * Slices the given string from start to stop token. This function has the same
 * behavior as the Array.slice method but for text tokens.
 */
export function slice(
  input: string,
  startToken: number,
  stopToken: number = Infinity,
  options: {
    toTextTokens: (input: string) => string[]
  } = { toTextTokens: getTextTokens }
): string {
  const { toTextTokens } = options

  const tokens = toTextTokens(input)

  const sliced = tokens.slice(startToken, stopToken)

  const result = sliced.join('')

  return result
}

/**
 * Splits the text of maxToken sizes with overlap tokens.
 */
export function split(
  input: string,
  maxTokens: number,
  overlapTokens: number = 0,
  options: {
    toTextTokens: (input: string) => string[]
  } = { toTextTokens: getTextTokens }
): string[] {
  assert(overlapTokens >= 0, 'overlapTokens must be greater than or equal to 0')
  assert(overlapTokens < maxTokens, 'overlapTokens must be less than maxTokens')

  const { toTextTokens } = options

  const chunks: string[] = []

  const tokens = toTextTokens(input)

  const stepSize = maxTokens - overlapTokens

  for (let i = 0; i < tokens.length; i += stepSize) {
    const chunk = tokens.slice(i, i + maxTokens).join('')

    if (chunks.length === 0 || !chunks[chunks.length - 1]?.endsWith(chunk)) {
      chunks.push(chunk)
    }
  }

  return chunks
}

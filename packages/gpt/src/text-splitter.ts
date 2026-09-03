import { getTextTokensLength, split } from './index'

// ---
// ---
// ---

export const DEFAULT_SEPARATORS = ['\n\n', '\n', ' ', '']

// ---
// ---
// ---

/**
 * @param {string[]} docs
 * @param {string} separator
 * @returns {string | null}
 */
function joinDocs(docs: string[], separator: string): string | null {
  const text = docs.join(separator).trim()

  return text === '' ? null : text
}

// ---
// ---
// ---

/**
 * Split on a separator, optionally keeping the separator in the results.
 *
 * @param {string} text
 * @param {string} separator
 * @param {boolean} keepSeparator
 * @returns {string[]}
 */
function splitOnSeparator(
  text: string,
  separator: string,
  keepSeparator: boolean
): string[] {
  let splits: string[]

  if (separator) {
    if (keepSeparator) {
      const regexEscapedSeparator = separator.replace(
        /[/\-\\^$*+?.()|[\]{}]/g,
        '\\$&'
      )

      splits = text.split(new RegExp(`(?=${regexEscapedSeparator})`))
    } else {
      splits = text.split(separator)
    }
  } else {
    splits = text.split('')
  }

  return splits.filter((s) => s !== '')
}

// ---
// ---
// ---

/**
 * Merge splits into chunks respecting size and overlap constraints.
 *
 * @param {string[]} splits
 * @param {string} separator
 * @param {number} chunkSize
 * @param {number} chunkOverlap
 * @param {(text: string) => number} lengthFunction
 * @returns {string[]}
 */
function mergeSplits(
  splits: string[],
  separator: string,
  chunkSize: number,
  chunkOverlap: number,
  lengthFunction: (text: string) => number
): string[] {
  const docs: string[] = []
  const currentDoc: string[] = []
  let total = 0

  for (const d of splits) {
    const _len = lengthFunction(d)

    if (total + _len + currentDoc.length * separator.length > chunkSize) {
      if (currentDoc.length > 0) {
        const doc = joinDocs(currentDoc, separator)

        if (doc !== null) {
          docs.push(doc)
        }

        // @note keep on popping if we have a larger chunk than the overlap or
        // if we still have chunks and the length is too long
        while (
          total > chunkOverlap ||
          (total + _len + currentDoc.length * separator.length > chunkSize &&
            total > 0)
        ) {
          total -= lengthFunction(currentDoc[0])
          currentDoc.shift()
        }
      }
    }

    currentDoc.push(d)
    total += _len
  }

  const doc = joinDocs(currentDoc, separator)

  if (doc !== null) {
    docs.push(doc)
  }

  return docs
}

// ---
// ---
// ---

export interface RecursiveCharacterTextSplitterOptions {
  chunkSize?: number
  chunkOverlap?: number
  separators?: string[]
  keepSeparator?: boolean
  lengthFunction?: (text: string) => number
}

// ---
// ---
// ---

/**
 * Recursively split text using a list of separators in order. Port of
 * LangChain's RecursiveCharacterTextSplitter.
 *
 * @param {string} text
 * @param {string[]} separators
 * @param {number} chunkSize
 * @param {number} chunkOverlap
 * @param {boolean} keepSeparator
 * @param {(text: string) => number} lengthFunction
 * @returns {string[]}
 */
function recursiveSplitText(
  text: string,
  separators: string[],
  chunkSize: number,
  chunkOverlap: number,
  keepSeparator: boolean,
  lengthFunction: (text: string) => number
): string[] {
  const finalChunks: string[] = []

  // @note guard against empty separators array (e.g. when called with a
  // user-provided list that has been fully exhausted during recursion)
  if (separators.length === 0) {
    finalChunks.push(text)

    return finalChunks
  }

  // @note find the appropriate separator to use
  let separator: string = separators[separators.length - 1]
  let newSeparators: string[] | undefined

  for (let i = 0; i < separators.length; i += 1) {
    const s = separators[i]

    if (s === '') {
      separator = s

      break
    }

    if (text.includes(s)) {
      separator = s
      newSeparators = separators.slice(i + 1)

      break
    }
  }

  const splits = splitOnSeparator(text, separator, keepSeparator)

  let goodSplits: string[] = []
  const _separator = keepSeparator ? '' : separator

  for (const s of splits) {
    if (lengthFunction(s) < chunkSize) {
      goodSplits.push(s)
    } else {
      if (goodSplits.length) {
        const mergedText = mergeSplits(
          goodSplits,
          _separator,
          chunkSize,
          chunkOverlap,
          lengthFunction
        )

        finalChunks.push(...mergedText)
        goodSplits = []
      }

      if (!newSeparators) {
        finalChunks.push(s)
      } else {
        const otherInfo = recursiveSplitText(
          s,
          newSeparators,
          chunkSize,
          chunkOverlap,
          keepSeparator,
          lengthFunction
        )

        finalChunks.push(...otherInfo)
      }
    }
  }

  if (goodSplits.length) {
    const mergedText = mergeSplits(
      goodSplits,
      _separator,
      chunkSize,
      chunkOverlap,
      lengthFunction
    )

    finalChunks.push(...mergedText)
  }

  return finalChunks
}

// ---
// ---
// ---

/**
 * Split text recursively using character separators. This is a port of
 * LangChain's RecursiveCharacterTextSplitter.
 *
 * When no separators are provided, defaults to ["\n\n", "\n", " ", ""].
 * Length is measured in characters by default.
 *
 * @param {string} text
 * @param {RecursiveCharacterTextSplitterOptions} [options]
 * @returns {string[]}
 * @throws {Error} If chunkOverlap is greater than or equal to chunkSize
 */
export function splitTextRecursive(
  text: string,
  options?: RecursiveCharacterTextSplitterOptions
): string[] {
  const chunkSize = options?.chunkSize ?? 1000
  const chunkOverlap = options?.chunkOverlap ?? 200
  const separators = options?.separators ?? DEFAULT_SEPARATORS
  const keepSeparator = options?.keepSeparator ?? true
  const lengthFunction = options?.lengthFunction ?? ((t: string) => t.length)

  if (chunkSize <= 0) {
    throw new Error('chunkSize must be > 0')
  }

  if (chunkOverlap < 0) {
    throw new Error('chunkOverlap must be >= 0')
  }

  if (chunkOverlap >= chunkSize) {
    throw new Error('Cannot have chunkOverlap >= chunkSize')
  }

  return recursiveSplitText(
    text,
    separators,
    chunkSize,
    chunkOverlap,
    keepSeparator,
    lengthFunction
  )
}

// ---
// ---
// ---

/**
 * Split text recursively using character separators with token-based length
 * measurement. This mirrors LangChain's
 * RecursiveCharacterTextSplitter.from_tiktoken_encoder behavior which is what
 * the original Python service used.
 *
 * @param {string} text
 * @param {Omit<RecursiveCharacterTextSplitterOptions, 'lengthFunction'>} [options]
 * @returns {string[]}
 */
export function splitTextRecursiveByTokens(
  text: string,
  options?: Omit<RecursiveCharacterTextSplitterOptions, 'lengthFunction'>
): string[] {
  const chunkSize = options?.chunkSize ?? 1000
  const chunkOverlap = options?.chunkOverlap ?? 200
  const separators = options?.separators ?? DEFAULT_SEPARATORS

  const lengthFunction = (t: string) => getTextTokensLength(t)

  // @note first pass: split by separators to find natural break points
  const initialChunks = splitTextRecursive(text, {
    ...options,
    separators,
    lengthFunction,
  })

  // @note second pass: any chunk still exceeding chunkSize gets split by token
  // boundaries, which is semantically better than character-level splitting
  const finalChunks: string[] = []

  for (const chunk of initialChunks) {
    if (lengthFunction(chunk) <= chunkSize) {
      finalChunks.push(chunk)
    } else {
      // split() uses token boundaries, not character boundaries
      const subChunks = split(chunk, chunkSize, chunkOverlap)

      finalChunks.push(...subChunks)
    }
  }

  return finalChunks
}

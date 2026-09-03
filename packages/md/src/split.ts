import type { Root, RootContent } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

interface Block {
  block: string
  type: RootContent['type']
}

interface SizedBlock extends Block {
  sealed?: boolean
}

const DEFAULT_BLOCK_JOINER = '\n\n'

function splitOversizedText(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) {
    return [text]
  }

  const chunks: string[] = []

  let remaining = text

  while (remaining.length > maxSize) {
    let splitIndex = remaining.lastIndexOf('\n\n', maxSize)
    let separatorLength = 2

    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf('\n', maxSize)
      separatorLength = 1
    }

    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf(' ', maxSize)
      separatorLength = 1
    }

    if (splitIndex <= 0) {
      splitIndex = maxSize
      separatorLength = 0
    }

    chunks.push(remaining.slice(0, splitIndex))
    remaining = remaining.slice(splitIndex + separatorLength)
  }

  if (remaining.length > 0) {
    chunks.push(remaining)
  }

  return chunks
}

function packLinesToSize(lines: string[], maxSize: number): string[] {
  const chunks: string[] = []
  let currentChunk = ''

  for (const line of lines) {
    if (!currentChunk) {
      currentChunk = line

      continue
    }

    const candidateChunk = `${currentChunk}\n${line}`

    if (candidateChunk.length <= maxSize) {
      currentChunk = candidateChunk
    } else {
      chunks.push(currentChunk)

      currentChunk = line
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks
}

function splitOversizedCodeBlock(block: string, maxSize: number): string[] {
  const lines = block.split('\n')

  if (lines.length < 2) {
    return splitOversizedText(block, maxSize)
  }

  const openingFence = lines[0]
  const closingFence = lines[lines.length - 1]
  const contentLines = lines.slice(1, -1)
  const overhead = openingFence.length + closingFence.length + 2

  if (overhead >= maxSize) {
    return splitOversizedText(block, maxSize)
  }

  const lineChunks = packLinesToSize(contentLines, maxSize - overhead)

  return lineChunks.length > 0
    ? lineChunks.map((chunk) => `${openingFence}\n${chunk}\n${closingFence}`)
    : [block]
}

function splitOversizedLineBlock(block: string, maxSize: number): string[] {
  const lines = block.split('\n')

  if (lines.length <= 1) {
    return splitOversizedText(block, maxSize)
  }

  return packLinesToSize(lines, maxSize).flatMap((chunk) =>
    chunk.length <= maxSize ? [chunk] : splitOversizedText(chunk, maxSize)
  )
}

function splitOversizedBlock(block: Block, maxSize: number): string[] {
  switch (block.type) {
    case 'code': {
      return splitOversizedCodeBlock(block.block, maxSize)
    }

    case 'list':
    case 'blockquote':
    case 'html':
    case 'table': {
      return splitOversizedLineBlock(block.block, maxSize)
    }

    default: {
      return splitOversizedText(block.block, maxSize)
    }
  }
}

function preprocessBlocksForSize(
  blocks: Block[],
  maxSize: number
): SizedBlock[] {
  const sizedBlocks: SizedBlock[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    if (block.type === 'heading' && i + 1 < blocks.length) {
      const nextBlock = blocks[i + 1]
      const availableSize =
        maxSize - block.block.length - DEFAULT_BLOCK_JOINER.length

      if (availableSize > 0) {
        const nextParts = splitOversizedBlock(nextBlock, availableSize)

        if (nextParts.length > 0) {
          sizedBlocks.push({
            type: nextBlock.type,
            block: `${block.block}${DEFAULT_BLOCK_JOINER}${nextParts[0]}`,
            sealed: true,
          })

          sizedBlocks.push(
            ...nextParts.slice(1).map((part) => ({
              type: nextBlock.type,
              block: part,
              sealed: true,
            }))
          )

          i += 1

          continue
        }
      }
    }

    sizedBlocks.push(
      ...splitOversizedBlock(block, maxSize).map((part, _index, parts) => ({
        type: block.type,
        block: part,
        sealed: parts.length > 1,
      }))
    )
  }

  return sizedBlocks
}

export function splitTextByTopLevelBlockTypes(input: string): Block[] {
  const processor = unified().use(remarkParse).use(remarkGfm)

  // parse the input string

  // @todo use better types for Block

  let topLevelBlocks: Block[] = (processor.parse(input) as Root).children
    .map((node: RootContent) => {
      if (!node.position) {
        return undefined
      }

      const { start, end } = node.position

      const startIdx = start.offset
      const endIdx = end.offset

      return { block: input.slice(startIdx, endIdx), type: node.type }
    })
    .filter((item): item is Block => item !== undefined)

  // merge consecutive html nodes

  topLevelBlocks = topLevelBlocks.reduce((acc: Block[], { block, type }) => {
    const lastBlock = acc[acc.length - 1]

    if (lastBlock && type === 'html' && lastBlock.type === 'html') {
      lastBlock.block += '\n' + block
    } else {
      acc.push({ block, type })
    }

    return acc
  }, [])

  // merge lines that are preceded with a line that end with : or :**

  topLevelBlocks = topLevelBlocks.reduce((acc: Block[], { block, type }) => {
    if (acc.length > 0) {
      const lastBlock = acc[acc.length - 1].block.trim()

      const lastLineEndsWithColon = /(:\*\*?|:\ *?\*\*?)$/

      if (lastLineEndsWithColon.test(lastBlock)) {
        acc[acc.length - 1].block += '\n' + block

        return acc
      }
    }

    acc.push({ block, type })

    return acc
  }, [])

  // @todo add additional block processing logic here if needed (filtering, transformation, validation)

  return topLevelBlocks.length
    ? topLevelBlocks
    : [{ block: input, type: 'text' }]
}

export function splitTextByTopLevelBlocks(input: string): string[] {
  return splitTextByTopLevelBlockTypes(input).map(({ block }) => block)
}

export function splitTextByTopLevelBlocksToSize(
  input: string,
  maxSize: number
): string[] {
  if (!Number.isInteger(maxSize) || maxSize <= 0) {
    throw new Error('maxSize must be a positive integer')
  }

  const blocks = preprocessBlocksForSize(
    splitTextByTopLevelBlockTypes(input),
    maxSize
  )

  const chunks: string[] = []

  let currentChunk = ''
  let currentChunkSealed = false

  for (const { block, sealed } of blocks) {
    if (!currentChunk) {
      currentChunk = block
      currentChunkSealed = !!sealed

      continue
    }

    if (currentChunkSealed || sealed) {
      chunks.push(currentChunk)

      currentChunk = block
      currentChunkSealed = !!sealed

      continue
    }

    const candidateChunk = `${currentChunk}${DEFAULT_BLOCK_JOINER}${block}`

    if (candidateChunk.length <= maxSize) {
      currentChunk = candidateChunk
    } else {
      chunks.push(currentChunk)

      currentChunk = block
      currentChunkSealed = !!sealed
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks.length > 0 ? chunks : ['']
}

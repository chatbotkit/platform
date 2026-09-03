// @ts-check
import {
  getTextTokens,
  getTextTokensLength,
  split,
  splitTextBlocks,
} from '@chatbotkit-dev/gpt'

import { toa } from '@/lib/it'
import { normalizeMarkup } from '@/lib/markup'
import {
  normalizeText,
  removeEmojis,
  removeSpaces,
  removeSymbols,
} from '@/lib/string'

import '@/polyfills/client'

// @note polyfills are required but are not added to the bundle
// @todo find how to add the polyfills to web workers with next.config.js

async function handleGetTextTokens({ text }) {
  if (!text) {
    return // @todo surface this error
  }

  const tokens = getTextTokens(text)

  return { tokens }
}

async function handleGetTextTokensLength({ text }) {
  if (!text) {
    return // @todo surface this error
  }

  const length = getTextTokensLength(text)

  return { length }
}

async function handleSplitTextBlocks({ text, maxTokens, overlapTokens = 50 }) {
  if (!text) {
    return // @todo surface this error
  }

  text = normalizeText(normalizeMarkup(removeEmojis(removeSymbols(text))))
  text = removeSpaces(text)

  const blocks = toa(splitTextBlocks(text, maxTokens, overlapTokens))
    .map((f) => f.trim())
    .filter((f) => f)

  return { blocks }
}

async function handleSplit({ text, maxTokens, overlapTokens = 50 }) {
  if (!text) {
    return // @todo surface this error
  }

  text = normalizeText(removeEmojis(removeSymbols(text)))

  const chunks = split(text, maxTokens, overlapTokens)
    .map((f) => f.trim())
    .filter((f) => f)

  return { chunks }
}

self.onmessage = async function ({ data: { action, params } }) {
  const fn = {
    getTextTokens: handleGetTextTokens,
    getTextTokensLength: handleGetTextTokensLength,

    splitTextBlocks: handleSplitTextBlocks,

    split: handleSplit,
  }[action]

  const result = await fn(params)

  self.postMessage({ action, result })
}

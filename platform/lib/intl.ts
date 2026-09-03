import { ONE_DAY_IN_SECONDS } from '@chatbotkit-dev/time'

import { clearCache, rollingCache } from '@/lib/cache'
import debug from '@/lib/debug'
import { batch } from '@/lib/it'
import { createChatCompletionStream } from '@/lib/model.provider.openai'
import { joinWithAnd } from '@/lib/string'
import { createHmacHexDigest } from '@/lib/webcrypto'

export type StringMap = Record<string, string | undefined | null>
export type LanguageMap = Record<
  string,
  Record<string, string | undefined | null>
>

export interface TranslationMapOptions {
  /** Unique identifier for cache key generation */
  unique?: string
  /** User ID for tracking API usage */
  userId?: string
  /** Cache expiration time in seconds */
  expiresInSeconds?: number
}

export interface FastTranslationMapOptions extends TranslationMapOptions {
  /** Number of languages to process in parallel batches */
  batchSize?: number
}

/**
 * Retrieves a translation map by automatic language translation.
 *
 * @param languages - Array of language codes to translate to
 * @param stringMap - Object containing strings to translate
 * @param options - Configuration options
 * @returns Translation map keyed by language code
 */
export async function getTranslationMap(
  languages: string[],
  stringMap: StringMap,
  options?: TranslationMapOptions
): Promise<LanguageMap> {
  const { userId } = options || {}

  if (!languages.length) {
    throw new Error('No languages')
  }

  let completion = ''

  for await (const item of createChatCompletionStream({
    model: 'gpt-4o',

    messages: [
      {
        role: 'system',
        content:
          'I am a JSON text translator. I can translate JSON object values to any language.',
      },
      {
        role: 'user',
        content: `Translate the following JSON to ${joinWithAnd(
          languages
        )}:\n\n${JSON.stringify(stringMap)} only!

Preserve all markdown syntax!
Preserve links and URLs.
Preserve link fragment identifiers such as #button, #frame and others.
Preserve img alt text that is button or frame because those have special meaning.
Preserve all placeholders such as {placeholder}, {{placeholder}}, \${placeholder} and \${{placeholder}}!

Use the following syntax:
{
  "ISO language code such as en, en-US, fr, fr-FR, es, es-ES, etc.": translated object...,
  "ISO language code such as en, en-US, fr, fr-FR, es, es-ES, etc.": translated object...,
  "ISO language code such as en, en-US, fr, fr-FR, es, es-ES, etc.": translated object...,
  ...
}

For example:
{
  "en": {
    "hello": "Hello",
    "world": "World"
  },
  "fr": {
    "hello": "Bonjour",
    "world": "Monde"
  },
  "...": {
    "hello": ...,
    "world": ...
  },
  ...
}

Remember that the final result must be an object with ${languages.length} keys.

Failure to follow these instructions will result in an error and you will have to start over.
`,
      },
    ],

    responseFormat: { type: 'json_object' },

    user: userId,
  })) {
    completion += item.completion || ''
  }

  // @todo record token usage

  if (!completion) {
    throw new Error('No completion')
  }

  let map = JSON.parse(completion) as LanguageMap

  // We are doing some additional validation here to ensure that we get the
  // expected result.

  // 1. Ensure we have the correct number of languages.
  map = Object.fromEntries(Object.entries(map).slice(0, languages.length))

  // 2. Ensure we have the correct number of strings.
  for (const [language, translations] of Object.entries(map)) {
    map[language] = Object.fromEntries(
      Object.entries(translations).slice(0, Object.keys(stringMap).length)
    )
  }

  return map
}

/**
 * Builds a key for a translation map cache.
 *
 * @param languages - Array of language codes
 * @param stringMap - Object containing strings to translate
 * @param options - Configuration options
 * @returns Cache key string
 */
export async function createFastTranslationMapKey(
  languages: string[],
  stringMap: StringMap,
  options?: Pick<TranslationMapOptions, 'unique'>
): Promise<string> {
  const { unique = 'default' } = options || {}

  if (!languages.length) {
    throw new Error('No languages')
  }

  const parts: string[] = []

  if (unique) {
    parts.push(unique)
  }

  parts.push(
    languages
      .slice(0)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.toLowerCase())
      .sort()
      .join(',')
  )

  parts.push(JSON.stringify(stringMap))

  const hash = await createHmacHexDigest('sha256', parts.join(':'), '')

  debug(`hash`, { hash, parts })

  const key = `fast-translation-map:${hash}`

  debug(`key`, { key })

  return key
}

/**
 * Retrieves a translation map from a cache or a remote source. The cache is
 * persisted for a day by default and it rolls over every time it is accessed.
 *
 * @param languages - Array of language codes to translate to
 * @param stringMap - Object containing strings to translate
 * @param options - Configuration options
 * @returns Translation map keyed by language code
 */
export async function getFastTranslationMap(
  languages: string[],
  stringMap: StringMap,
  options?: FastTranslationMapOptions
): Promise<LanguageMap> {
  const {
    userId,

    unique = 'default',

    expiresInSeconds = ONE_DAY_IN_SECONDS,

    batchSize = 2,
  } = options || {}

  if (!languages.length) {
    throw new Error('No languages')
  }

  const key = await createFastTranslationMapKey(languages, stringMap, {
    unique,
  })

  return await rollingCache(
    key,

    expiresInSeconds,

    async () => {
      const map = Object.fromEntries(
        (
          await Promise.all(
            Array.from(batch(languages, batchSize)).map(
              async (languageBatch) => {
                return Object.entries(
                  await getTranslationMap(languageBatch, stringMap, { userId })
                )
              }
            )
          )
        ).flat(1)
      )

      return map
    }
  )
}

/**
 * Removes previous translations from the cache.
 *
 * @param languages - Array of language codes
 * @param stringMap - Object containing strings to translate
 * @param options - Configuration options
 */
export async function clearFastTranslationMap(
  languages: string[],
  stringMap: StringMap,
  options?: Pick<TranslationMapOptions, 'unique'>
): Promise<void> {
  const { unique = 'default' } = options || {}

  if (!languages.length) {
    throw new Error('No languages')
  }

  const key = await createFastTranslationMapKey(languages, stringMap, {
    unique,
  })

  await clearCache(key)
}

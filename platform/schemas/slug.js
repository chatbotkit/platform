// @ts-check
import schema from '@/lib/joi.schema'
import { toSlug } from '@/lib/string'

export const forbiddenWords = [
  'cbk',
  'chatbotkit',

  'category',
  'categories',
  'topic',
  'topics',

  'widget',
  'widgets',

  'embed',
  'embeds',

  'portal',
  'portals',

  'auth',
  'oauth',
  'oauth2',

  'security',

  'mcp',

  // @todo add more
]

export const optionalSlug = schema
  .string()
  .allow(null, '')
  .min(5)
  .max(128)
  .external(async function (slug) {
    slug = toSlug(slug || '')

    if (!slug) {
      return null
    }

    if (forbiddenWords.some((word) => slug.includes(word))) {
      throw new Error('Slug contains forbidden words')
    }

    return slug
  })

export default schema
  .string()
  .min(5)
  .max(128)
  .required()
  .external(async function (slug) {
    slug = toSlug(slug || '')

    if (!slug) {
      throw new Error('Slug cannot be empty')
    }

    if (forbiddenWords.some((word) => slug.includes(word))) {
      throw new Error('Slug contains forbidden words')
    }

    return slug
  })

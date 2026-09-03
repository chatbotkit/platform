// @ts-check
import { getExampleBySlug } from '@/lib/example.fetch'
import schema from '@/lib/joi.schema'
import { buildTheme, parseTheme } from '@/lib/theme'

export default schema.alternatives().try(
  schema
    .string()
    .allow(null, '')
    .custom((value) => {
      if (value) {
        if (value.startsWith('@examples/')) {
          const theme = getExampleBySlug(
            value.slice('@examples/'.length)
          )?.theme

          if (theme) {
            value = buildTheme(theme.name, theme.config)
          }
        } else {
          parseTheme(value)
        }
      }

      return value
    }, 'theme'),
  schema
    .object()
    .allow(null)
    .custom((value) => {
      if (value) {
        value = buildTheme(value.name, value.config)
      }

      return value
    }, 'theme')
)

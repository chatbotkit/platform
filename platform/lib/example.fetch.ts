import { merge } from '@/lib/object'
import { toSlug } from '@/lib/string'
import { parseTheme } from '@/lib/theme'

import examples, { type Example } from '@/examples'

import pluralize from 'pluralize'

interface FixedTheme {
  name: string
  config: object
}

interface FixedWidget {
  intro?: string
  initial?: string

  math?: boolean

  theme?: FixedTheme
}

interface FixedExample extends Omit<Example, 'widget' | 'theme'> {
  slug: string

  theme?: FixedTheme
  widget?: FixedWidget
}

interface NextExample {
  slug: string

  title: string
  description?: string

  icon?: string

  hub?: { type: string; ref: string }
}

export function fixExample(example: Example): FixedExample {
  const widget: FixedWidget | undefined = example.widget
    ? { ...example.widget }
    : undefined

  let theme: FixedTheme | undefined

  if (typeof example.theme === 'string') {
    if (example.theme === 'default') {
      theme = getExampleBySlug('ai-answers')?.theme
    } else if (example.theme.startsWith('@')) {
      const { name, config } = parseTheme(example.theme.slice(1))
      const baseTheme = getExampleBySlug(name)?.theme

      theme = {
        name: baseTheme?.name || name,
        config: merge(baseTheme?.config || {}, config),
      }
    } else {
      const { name, config } = parseTheme(example.theme)

      theme = { name, config }
    }
  } else {
    theme = example.theme
  }

  if (widget) {
    widget.intro ??= example.intro
    widget.initial ??= example.initial
    widget.theme = theme
  }

  return {
    ...example,

    theme,

    widget,

    slug: example.slug ?? toSlug(example.title),
  }
}

export function getExamples(): FixedExample[] {
  return examples.slice().map(fixExample)
}

export function getSortedExamples(): FixedExample[] {
  return examples
    .slice()
    .sort((a, b) => {
      const dateA =
        a.date?.getTime?.() ?? (a.date ? new Date(a.date).getTime() : 0)
      const dateB =
        b.date?.getTime?.() ?? (b.date ? new Date(b.date).getTime() : 0)

      return dateB - dateA
    })
    .map(fixExample)
}

export function getFeaturedThemeExamples(): FixedExample[] {
  return getSortedExamples()
    .filter(({ theme }) => !!theme)
    .filter(({ featured }) => featured)
}

export function getFeaturedBlueprintExamples(): FixedExample[] {
  return getSortedExamples()
    .filter(({ blueprint }) => !!blueprint)
    .filter(({ featured }) => featured)
}

export function getExampleBySlug(slug: string): FixedExample | undefined {
  const example = examples.find(
    (example) => slug === example.slug || slug === toSlug(example.title)
  )

  if (!example) {
    return
  }

  return fixExample(example)
}

// @note hub examples are pointers to a published hub page (e.g. a blueprint)
// rather than a self-contained, hosted example. their card links straight to
// the hub page - which already provides clone and visit - and /examples/[slug]
// redirects there. getExampleHref keeps the card link and the redirect in sync.

export function getExampleHref(example: {
  slug: string
  hub?: { type: string; ref: string }
}): string {
  if (example.hub) {
    return `/hub/${example.hub.type}s/${example.hub.ref}`
  }

  return `/examples/${example.slug}`
}

export function getNextExamples(slug: string, count = 3): NextExample[] {
  const allExamples = getSortedExamples().filter(({ hidden }) => !hidden)

  const nextExamples = [...allExamples, ...allExamples]
    .slice(allExamples.findIndex((example) => example.slug === slug) + 1)
    .slice(0, count)
    .map(fixExample)
    .map(({ slug, title, description, icon, hub }) => {
      return {
        slug,
        title,
        description,
        icon,
        hub,
      }
    })

  return nextExamples
}

export function findExamplesByKeywords(keywords: string[]): FixedExample[] {
  return examples
    .filter((example) =>
      example.keywords.some((keyword) => {
        const keywordLower = keyword.toLowerCase()

        return keywords.some((kw) => {
          const searchTerm = pluralize(kw.toLowerCase(), 1)

          if (searchTerm.length <= 3) {
            return false
          }

          const wordBoundaryPattern = new RegExp(
            `\\b${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
          )

          return (
            wordBoundaryPattern.test(keywordLower) ||
            keywordLower.includes(searchTerm)
          )
        })
      })
    )
    .map(fixExample)
}

export function getTotalExamples(): number {
  return examples.length
}

export function getExamplesWithThemes(): Example[] {
  return examples.filter(({ hidden }) => !hidden).filter(({ theme }) => !!theme)
}

export function getExamplesWithExportedThemes(): Example[] {
  return getExamplesWithThemes().filter(({ exported }) => !!exported)
}

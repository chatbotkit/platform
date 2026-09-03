/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// @note the catalogue is swapped per test by mutating this array in place - the
// page holds the same reference through its default import
const mockExamples = []

jest.mock('@/examples', () => ({ __esModule: true, default: mockExamples }))

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    dataset: { findFirst: jest.fn() },
    skillset: { findFirst: jest.fn() },
  },
}))

jest.mock('@/prisma/enums', () => ({
  DatasetVisibility: { public: 'public' },
  SkillsetVisibility: { public: 'public' },
}))

jest.mock('@/data/abilities/visible', () => ({ __esModule: true, default: [] }))

jest.mock('@/lib/struct', () => ({ makeJsonSafe: (value) => value }))
jest.mock('@/lib/string', () => ({ toSlug: (value) => value }))
jest.mock('@/lib/template', () => ({
  getTemplate: jest.fn(),
  isTemplateName: () => false,
}))

jest.mock('@/layouts/Wizard', () => ({
  __esModule: true,
  default: () => null,
  Heading: () => null,
  NavigationButtons: () => null,
}))

jest.mock('@/components/DynamicIcon', () => () => null)
jest.mock('@/components/List', () => ({
  __esModule: true,
  default: () => null,
  ListItem: () => null,
}))

// @note required lazily (after the mock consts above are initialized) so the
// `@/examples` factory can safely read `mockExamples`
let getServerSideProps

beforeEach(() => {
  getServerSideProps = require('@/pages/new/example').getServerSideProps
})

function setExamples(...examples) {
  mockExamples.length = 0
  mockExamples.push(...examples)
}

function hubExample(overrides = {}) {
  return {
    slug: 'coder',
    icon: 'lucide/code',
    title: 'Agentic Coder',
    description: 'An autonomous coding agent.',
    hub: { type: 'blueprint', ref: 'coder' },
    ...overrides,
  }
}

function plainExample() {
  return {
    slug: 'concierge',
    title: 'Concierge',
    description: 'An AI support assistant.',
    backstory: 'You are a concierge.',
    model: 'gpt-4',
  }
}

describe('/new/example', () => {
  it('hands a hub example over to the hub template', async () => {
    // @note a hub example carries no resources - only a pointer to a published
    // hub page - so the wizard has to switch to the template that clones those
    setExamples(hubExample())

    const result = await getServerSideProps({ query: { example: 'coder' } })

    expect(result.redirect).toEqual({
      destination: '/new?template=hub&blueprintId=coder',
      permanent: false,
    })
  })

  it('names the handoff parameter after the hub type', async () => {
    // @note the hub step reads the ref from a param named for the resource type
    // (blueprintId, botId, widgetId...), the same way the hub pages link into
    // the wizard - so the type drives the name rather than a hardcoded one
    setExamples(hubExample({ hub: { type: 'widget', ref: 'landing' } }))

    const result = await getServerSideProps({ query: { example: 'coder' } })

    expect(result.redirect.destination).toBe(
      '/new?template=hub&widgetId=landing'
    )
  })

  it('carries the rest of the wizard query across the handoff', async () => {
    setExamples(hubExample())

    const result = await getServerSideProps({
      query: {
        example: 'coder',
        template: 'example',
        from: 'onboarding',
        projectScope: 'true',
      },
    })

    const { searchParams } = new URL(
      result.redirect.destination,
      'https://chatbotkit.local'
    )

    expect(searchParams.get('from')).toBe('onboarding')
    expect(searchParams.get('projectScope')).toBe('true')

    // @note the wizard is now running the hub template against the hub ref -
    // the example slug and the old template would only confuse the next step
    expect(searchParams.get('template')).toBe('hub')
    expect(searchParams.get('blueprintId')).toBe('coder')
    expect(searchParams.get('example')).toBe(null)
  })

  it('keeps a regular example on the confirm step', async () => {
    setExamples(plainExample())

    const result = await getServerSideProps({ query: { example: 'concierge' } })

    expect(result.redirect).toBeUndefined()
    expect(result.props.example.slug).toBe('concierge')
  })

  it('404s an example that does not exist', async () => {
    setExamples(plainExample())

    const result = await getServerSideProps({ query: { example: 'nope' } })

    expect(result.notFound).toBe(true)
  })
})

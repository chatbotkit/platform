import {
  CommandPaletteHint,
  buildMenu,
  buildQuickAccessItems,
} from '@/layouts/Dashboard'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('CommandPaletteHint', () => {
  let originalMatchMedia
  let viewportWidth

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    viewportWidth = 1024

    window.matchMedia = jest.fn((query) => {
      const minWidthMatch = query.match(/min-width:\s*(\d+)px/)
      const minWidth = minWidthMatch ? Number(minWidthMatch[1]) : 0

      return {
        matches: viewportWidth >= minWidth,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }
    })
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('does not render on screens narrower than the dashboard breakpoint', () => {
    viewportWidth = 767

    render(<CommandPaletteHint />)

    expect(
      screen.queryByText(/to open command palette/i)
    ).not.toBeInTheDocument()
  })

  it('renders on desktop-width screens', () => {
    render(<CommandPaletteHint />)

    expect(screen.getByText(/to open command palette/i)).toBeInTheDocument()
  })
})

describe('buildMenu', () => {
  const allItems = (items) =>
    (items ?? []).flatMap((item) => [item, ...allItems(item.items)])

  const allTitles = (sections) =>
    sections.flatMap((section) =>
      allItems(section.items).map((item) => item.title)
    )

  it('focuses the builder experience on the agent building journey', () => {
    const sections = buildMenu({ builder: true, partner: null })

    const topLevelTitles = allTitles(
      sections.filter((section) => section.key !== 'advanced')
    )

    expect(topLevelTitles).toEqual(
      expect.arrayContaining([
        'Overview',
        'Bots',
        'Datasets',
        'Skillsets',
        'Contacts',
        'Conversations',
        'Integrations',
        'Analytics',
      ])
    )

    // Platform primitives - Ratings among them - are demoted out of the top
    // level...
    expect(topLevelTitles).not.toContain('Files')
    expect(topLevelTitles).not.toContain('Tokens')
    expect(topLevelTitles).not.toContain('Tasks')
    expect(topLevelTitles).not.toContain('Blueprints')
    expect(topLevelTitles).not.toContain('Ratings')

    // ...into Advanced, which is a door rather than a section - following it
    // replaces the menu, so the builder rail cannot grow by opening it
    const advanced = sections.find((section) => section.key === 'advanced')

    expect(advanced.drilldown).toBe(true)
  })

  it('gives every top-level item an icon and no nested item one', () => {
    for (const builder of [true, false]) {
      const sections = buildMenu({ builder, partner: null })

      // Items in untitled sections are top-level and carry icons; everything
      // nested inside a titled section - group captions included - does not.
      for (const section of sections) {
        for (const item of allItems(section.items)) {
          if (section.title) {
            expect(item.icon).toBe(undefined)
          } else {
            expect(item.icon).toBeTruthy()
          }
        }
      }
    }
  })

  it('never lists Applications - apps live in the profile dropdown', () => {
    for (const builder of [true, false]) {
      expect(allTitles(buildMenu({ builder, partner: null }))).not.toContain(
        'Applications'
      )
    }
  })

  it('keeps the full menu for the platform experience', () => {
    const sections = buildMenu({ builder: false, partner: null })

    expect(allTitles(sections)).toEqual(
      expect.arrayContaining([
        'Overview',
        'Blueprints',
        'Datasets',
        'Skillsets',
        'Tokens',
        'Playground',
        'Support',
      ])
    )
    expect(sections.find((section) => section.key === 'advanced')).toBe(
      undefined
    )
  })

  it('leads the platform experience with what you build', () => {
    const sections = buildMenu({ builder: false, partner: null })

    const keys = sections.map((section) => section.key)

    expect(keys.slice(0, 4)).toEqual([
      'main',
      'projects',
      'resources',
      'integrations',
    ])

    // resources absorbs the slack so everything below it - integrations
    // included - sticks to the bottom of the sidebar
    expect(sections.find((section) => section.className === 'flex-1').key).toBe(
      'resources'
    )
  })

  it('puts the platform interactions behind a door above compliance', () => {
    const sections = buildMenu({ builder: false, partner: null })

    const keys = sections.map((section) => section.key)

    const interactionsSection = sections.find(
      (section) => section.key === 'interactions'
    )

    expect(interactionsSection.title).toBe('Interactions')
    expect(interactionsSection.drilldown).toBe(true)

    const interactionItems = interactionsSection.items[0].items

    // Ratings is a platform-only interaction - the builder menu drops it
    expect(interactionItems.map((item) => item.title)).toEqual([
      'Contacts',
      'Tasks',
      'Conversations',
      'Memories',
      'Ratings',
    ])

    expect(keys.indexOf('interactions')).toBe(keys.indexOf('compliance') - 1)

    // the interactions no longer sit at the top level of the platform menu
    expect(interactionItems.every((item) => !item.icon)).toBe(true)
  })

  it('preserves whitelabel gating in both menus', () => {
    for (const builder of [true, false]) {
      const titles = allTitles(
        buildMenu({ builder, partner: { whitelabel: true } })
      )

      expect(titles).not.toContain('Support')
    }
  })
})

describe('buildMenu drilldowns', () => {
  it('lays the demoted builder items out in full behind Advanced', () => {
    const advanced = buildMenu({ builder: true, partner: null }).find(
      (section) => section.key === 'advanced'
    )

    // the groups carry the platform section titles, so a demoted item sits
    // under the same heading in both experiences
    expect(advanced.items.map((group) => group.title)).toEqual([
      'Resources',
      'Interactions',
      'Compliance',
      'Observability',
      'Developer',
    ])

    for (const group of advanced.items) {
      expect(group.items.length).toBeGreaterThan(0)

      // a drilldown owns the whole sidebar, so nothing behind it has to be
      // folded away - NestedAccordion draws these as captions, not as doors
      expect(group.expanded).toBe(true)
      expect(group.collapsible).toBe(false)
    }

    const developer = advanced.items.find(
      (group) => group.title === 'Developer'
    )

    // the developer tools arrive whole, and identically under whitelabel -
    // nothing in the group speaks for a deployment other than this one
    expect(developer.items.map((item) => item.title)).toEqual([
      'Tokens',
      'Webhooks',
      'Playground',
    ])
  })

  it('gives every drilldown something to open', () => {
    for (const builder of [true, false]) {
      const drilldowns = buildMenu({ builder, partner: null }).filter(
        (section) => section.drilldown
      )

      expect(drilldowns.length).toBeGreaterThan(0)

      // a drilldown with nothing behind it is a door onto nothing
      for (const drilldown of drilldowns) {
        expect(drilldown.items.length).toBeGreaterThan(0)
      }
    }
  })

  it('leaves the platform experience nothing to unfold in place', () => {
    const sections = buildMenu({ builder: false, partner: null })

    // everything secondary is a door - only what you build stays open, and
    // Resources is the one list that still unfolds where it stands
    const unfolding = sections
      .filter((section) => section.title && !section.drilldown)
      .map((section) => section.key)

    expect(unfolding).toEqual(['resources'])
  })

  it('drills down into Organization and Help in both experiences', () => {
    for (const builder of [true, false]) {
      const sections = buildMenu({ builder, partner: null })

      for (const key of ['organization', 'help']) {
        const section = sections.find((section) => section.key === key)

        expect(section.drilldown).toBe(true)

        // what it holds arrives as one section rather than a link apiece - the
        // menu rules a line between its sections, and a stack of divided rows
        // is not what a list of links should look like
        expect(section.items).toHaveLength(1)
        expect(section.items[0].expanded).toBe(true)
        expect(section.items[0].collapsible).toBe(false)
        expect(section.items[0].items.length).toBeGreaterThan(0)
      }
    }
  })

  it('keeps Advanced out of the platform experience, which needs no door', () => {
    const keys = buildMenu({ builder: false, partner: null })
      .filter((section) => section.drilldown)
      .map((section) => section.key)

    expect(keys).not.toContain('advanced')
  })
})

describe('buildQuickAccessItems', () => {
  const labels = (items) => items.map((item) => item.label)

  it('keeps Blueprints out of the builder command palette', () => {
    expect(
      labels(buildQuickAccessItems({ builder: true, partner: null }))
    ).not.toContain('Blueprints')
  })

  it('keeps Blueprints in the platform command palette', () => {
    expect(
      labels(buildQuickAccessItems({ builder: false, partner: null }))
    ).toContain('Blueprints')
  })
})

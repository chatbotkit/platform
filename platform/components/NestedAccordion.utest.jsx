import NestedAccordion, {
  NestedAccordionMenu,
  resolveDrilldownPath,
} from './NestedAccordion'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

let currentPath = '/overview'

jest.mock('@/hooks/useRouter', () => {
  return jest.fn(() => ({
    asPath: currentPath,
    compareHref: (href, { exact = true } = {}) =>
      exact
        ? href === currentPath
        : currentPath === href || currentPath.startsWith(`${href}/`),
  }))
})

jest.mock('@/components/Link', () => {
  return function MockLink({ className, href, target, children }) {
    return (
      <a className={className} href={href} target={target}>
        {children}
      </a>
    )
  }
})

jest.mock('@/components/DynamicIcon', () => {
  return function MockDynamicIcon() {
    return <span />
  }
})

jest.mock('@/components/PopButton', () => {
  return function MockPopButton({ children }) {
    return <div>{children}</div>
  }
})

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => children,
  motion: {
    div: ({ children, className }) => (
      <div className={className}>{children}</div>
    ),
  },
}))

// a section holding a group holding an item - Webhooks is a grandchild here
const nested = {
  title: 'Advanced',
  icon: '@lucide/wrench',
  items: [
    {
      title: 'Developer',
      items: [{ title: 'Webhooks', href: '/webhooks' }],
      expanded: true,
      collapsible: false,
    },
  ],
  expanded: false,
  collapsible: true,
}

// @note an accordion renders its items whether or not it is open - it collapses
// them by clamping the height of the list - so this is what "open" means here
const isOpen = (list) => !list.className.includes('max-h-0')

const renderNested = () => {
  const { container } = render(<NestedAccordion {...nested} />)

  return container.querySelector('.nested-accordion-items')
}

// what Advanced holds - the menu it becomes once you follow it
const advancedGroups = [
  {
    key: 'developer',
    title: 'Developer',
    items: [{ title: 'Webhooks', href: '/webhooks' }],
    expanded: true,
    collapsible: false,
  },
]

// a menu of two sections, the second of which is a door
const sections = [
  { key: 'main', items: [{ title: 'Overview', href: '/overview' }] },
  {
    key: 'advanced',
    title: 'Advanced',
    drilldown: true,
    items: advancedGroups,
  },
]

// the same door, but as an item nested inside a section rather than a section
const nestedSections = [
  {
    key: 'main',
    title: 'Main',
    expanded: true,
    items: [
      { title: 'Overview', href: '/overview' },
      { title: 'Advanced', drilldown: true, items: advancedGroups },
    ],
  },
]

// a door behind a door - Deeper is only reachable once Advanced is open
const deepSections = [
  { key: 'main', items: [{ title: 'Overview', href: '/overview' }] },
  {
    key: 'advanced',
    title: 'Advanced',
    drilldown: true,
    items: [
      ...advancedGroups,
      {
        key: 'deeper',
        title: 'Deeper',
        drilldown: true,
        items: [
          {
            key: 'audit',
            title: 'Audit',
            items: [{ title: 'Events', href: '/events' }],
            expanded: true,
            collapsible: false,
          },
        ],
      },
    ],
  },
]

describe('NestedAccordion', () => {
  afterEach(() => {
    currentPath = '/overview'
  })

  it('stays closed when the current location is outside it', () => {
    expect(isOpen(renderNested())).toBe(false)
  })

  it('opens for a nested item, not just a direct child', () => {
    // a section that only looked at its direct children would stay shut here
    // and hide the page you are on
    currentPath = '/webhooks'

    expect(isOpen(renderNested())).toBe(true)
  })

  it('renders a group that cannot be closed as a caption', () => {
    renderNested()

    // a caption is a folder with no door - no chevron to open or close it
    expect(
      screen
        .getByText('Developer')
        .closest('.nested-accordion')
        .querySelector('.nested-accordion-title svg')
    ).toBe(null)
  })

  it('hands a drilldown click over once, not once per nested handler', () => {
    const onClick = jest.fn()

    render(
      <NestedAccordion
        title="Advanced"
        icon="@lucide/wrench"
        drilldown={true}
        onClick={onClick}
      />
    )

    // the chevron points the way in rather than turning to open items below
    expect(
      screen
        .getByText('Advanced')
        .closest('.nested-accordion-title')
        .querySelector('svg')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('Advanced'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('NestedAccordionMenu', () => {
  afterEach(() => {
    currentPath = '/overview'
  })

  it('shows the sections until a drilldown is followed', () => {
    render(<NestedAccordionMenu sections={sections} />)

    expect(screen.getByText('Overview')).toBeInTheDocument()

    // a drilldown does not unfold its items below it - they are a menu, not a
    // list, and no part of them shows until it is followed
    expect(screen.queryByText('Webhooks')).not.toBeInTheDocument()
    expect(screen.queryByText('Developer')).not.toBeInTheDocument()
  })

  it('hands the whole menu over to the drilldown, and takes it back', () => {
    render(<NestedAccordionMenu sections={sections} />)

    fireEvent.click(screen.getByText('Advanced'))

    // it replaces the menu rather than opening inside it, so the sections it
    // drilled away from are gone
    expect(screen.getByText('Webhooks')).toBeInTheDocument()
    expect(screen.queryByText('Overview')).not.toBeInTheDocument()

    // the drilldown titles itself, and that title is the way back
    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.queryByText('Webhooks')).not.toBeInTheDocument()
  })

  it('lands in the drilldown that holds the current page', () => {
    // deep linking to a page the root menu does not list must not leave you
    // staring at a menu the page is missing from
    currentPath = '/webhooks'

    render(<NestedAccordionMenu sections={sections} />)

    expect(screen.getByText('Webhooks')).toBeInTheDocument()
    expect(screen.queryByText('Overview')).not.toBeInTheDocument()
  })

  it('lets you back out of the drilldown while still on one of its pages', () => {
    currentPath = '/webhooks'

    render(<NestedAccordionMenu sections={sections} />)

    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('renders a plain menu when nothing drills down', () => {
    render(<NestedAccordionMenu sections={[sections[0]]} />)

    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('drills down from an item nested in a section, not just from a section', () => {
    render(<NestedAccordionMenu sections={nestedSections} />)

    // the item carries the same chevron a section would
    expect(
      screen
        .getByText('Advanced')
        .closest('.nested-accordion-title')
        .querySelector('svg')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('Advanced'))

    expect(screen.getByText('Webhooks')).toBeInTheDocument()
    expect(screen.queryByText('Overview')).not.toBeInTheDocument()
  })

  it('backs out of a drilldown reached through another one level at a time', () => {
    render(<NestedAccordionMenu sections={deepSections} />)

    fireEvent.click(screen.getByText('Advanced'))
    fireEvent.click(screen.getByText('Deeper'))

    expect(screen.getByText('Events')).toBeInTheDocument()

    // back lands on Advanced, the menu that led here - not all the way home
    fireEvent.click(screen.getByText('Deeper'))

    expect(screen.getByText('Webhooks')).toBeInTheDocument()
    expect(screen.queryByText('Events')).not.toBeInTheDocument()
    expect(screen.queryByText('Overview')).not.toBeInTheDocument()
  })

  it('lands in the deepest drilldown holding the page, not the first', () => {
    currentPath = '/events'

    render(<NestedAccordionMenu sections={deepSections} />)

    // Advanced holds /events too, by way of Deeper - but Deeper is where the
    // page actually lives, and is the menu it must open
    expect(screen.getByText('Events')).toBeInTheDocument()
    expect(screen.queryByText('Webhooks')).not.toBeInTheDocument()
  })
})

describe('resolveDrilldownPath', () => {
  // stands in for the router - a prefix match, as the sidebar does it
  const at = (pathname) => (href) =>
    pathname === href || pathname.startsWith(`${href}/`)

  it('finds the drilldown holding the current page', () => {
    expect(resolveDrilldownPath(sections, at('/webhooks'))).toEqual([
      'advanced',
    ])
  })

  it('holds it open across the sub routes of its pages', () => {
    expect(resolveDrilldownPath(sections, at('/webhooks/123'))).toEqual([
      'advanced',
    ])
  })

  it('reports the whole way down to a drilldown behind a drilldown', () => {
    expect(resolveDrilldownPath(deepSections, at('/events'))).toEqual([
      'advanced',
      'deeper',
    ])
  })

  it('stays at the root for a page no drilldown holds', () => {
    expect(resolveDrilldownPath(sections, at('/bots'))).toBe(null)
  })

  it('stays at the root when nothing drills down at all', () => {
    expect(resolveDrilldownPath([sections[0]], at('/webhooks'))).toBe(null)
  })

  it('finds a page nested below the top level of a drilldown', () => {
    const deep = [
      {
        key: 'advanced',
        title: 'Advanced',
        drilldown: true,
        items: [
          {
            key: 'developer',
            title: 'Developer',
            items: [
              {
                title: 'Hooks',
                items: [{ title: 'Webhooks', href: '/webhooks' }],
              },
            ],
          },
        ],
      },
    ]

    expect(resolveDrilldownPath(deep, at('/webhooks'))).toEqual(['advanced'])
  })
})

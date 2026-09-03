import useRouter from '@/hooks/useRouter'

import Page, {
  EXAMPLE_SEARCH_DEBOUNCE,
  ExampleSearch,
} from '@/pages/new/examples'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/lib/struct', () => ({ makeJsonSafe: jest.fn((value) => value) }))

jest.mock('@/layouts/Wizard', () => ({
  __esModule: true,
  default: () => null,
  Heading: () => null,
  NavigationButtons: ({ disabled, onForward }) => (
    <button type="button" disabled={disabled} onClick={onForward}>
      Next step
    </button>
  ),
}))

jest.mock('@/components/DynamicIcon', () => {
  return function DynamicIcon() {
    return <div data-testid="dynamic-icon" />
  }
})
jest.mock('@/components/Link', () => {
  return function Link({ children, ...props }) {
    return <a {...props}>{children}</a>
  }
})

jest.mock('@/hooks/useRouter', () => jest.fn())

const mockUseBuilderExperience = jest.fn(() => false)

jest.mock('@/hooks/useBuilderExperience', () => ({
  __esModule: true,
  default: () => mockUseBuilderExperience(),
}))

jest.mock('@/examples', () => ({ __esModule: true, default: [] }))

const EXAMPLES = [
  {
    slug: 'concierge',
    icon: null,
    title: 'Concierge',
    description: 'AI support assistant.',
    keywords: ['support'],
    featured: false,
    builder: true,
  },
  {
    slug: 'sales-agent',
    icon: null,
    title: 'Sales Agent',
    description: 'Qualifies leads and books meetings.',
    keywords: ['sales'],
    featured: true,
    builder: true,
  },
  {
    slug: 'tutor',
    icon: null,
    title: 'Math Tutor',
    description: 'Teaches algebra step by step.',
    keywords: ['education'],
    featured: true,
    builder: false,
  },
]

function type(value) {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value } })
}

// @note fuzzy search debounces the query internally - advance past it to settle
async function settle() {
  await act(async () => {
    jest.advanceTimersByTime(EXAMPLE_SEARCH_DEBOUNCE)
  })
}

describe('ExampleSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers()

    mockUseBuilderExperience.mockReturnValue(false)
  })

  afterEach(() => {
    jest.useRealTimers()

    jest.clearAllMocks()
  })

  it('suggests the builder-tagged examples while the search is empty', () => {
    render(<ExampleSearch examples={EXAMPLES} onSelect={jest.fn()} />)

    expect(screen.getByText('Featured examples')).toBeInTheDocument()
    expect(screen.getByText('Concierge')).toBeInTheDocument()
    expect(screen.getByText('Sales Agent')).toBeInTheDocument()
    // @note Math Tutor is featured but not builder-tagged, so it is not suggested
    expect(screen.queryByText('Math Tutor')).not.toBeInTheDocument()
  })

  it('suggests the builder examples in the builder experience', () => {
    mockUseBuilderExperience.mockReturnValue(true)

    render(<ExampleSearch examples={EXAMPLES} onSelect={jest.fn()} />)

    expect(screen.getByText('Suggested solutions')).toBeInTheDocument()
    expect(screen.getByText('Concierge')).toBeInTheDocument()
    expect(screen.getByText('Sales Agent')).toBeInTheDocument()
    expect(screen.queryByText('Math Tutor')).not.toBeInTheDocument()
  })

  it('searches beyond the builder suggestions in the builder experience', async () => {
    mockUseBuilderExperience.mockReturnValue(true)

    render(<ExampleSearch examples={EXAMPLES} onSelect={jest.fn()} />)

    type('tutor')

    await settle()

    expect(screen.getByText('Math Tutor')).toBeInTheDocument()
  })

  it('fuzzy-filters examples by the search query', async () => {
    render(<ExampleSearch examples={EXAMPLES} onSelect={jest.fn()} />)

    type('sales')

    await settle()

    expect(screen.getByText('Sales Agent')).toBeInTheDocument()
    expect(screen.queryByText('Math Tutor')).not.toBeInTheDocument()
  })

  it('matches on keywords, not just titles', async () => {
    render(<ExampleSearch examples={EXAMPLES} onSelect={jest.fn()} />)

    // @note "support" is only in the Concierge keywords/description
    type('support')

    await settle()

    expect(screen.getByText('Concierge')).toBeInTheDocument()
    expect(screen.queryByText('Math Tutor')).not.toBeInTheDocument()
  })

  it('marks the selected example as pressed', () => {
    render(
      <ExampleSearch
        examples={EXAMPLES}
        selectedSlug="sales-agent"
        onSelect={jest.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Sales Agent/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    // @note Concierge is a builder suggestion shown alongside the selected one
    expect(screen.getByRole('button', { name: /Concierge/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('invokes onSelect with the chosen example', async () => {
    const onSelect = jest.fn()

    render(<ExampleSearch examples={EXAMPLES} onSelect={onSelect} />)

    type('concierge')

    await settle()

    fireEvent.click(screen.getByRole('button', { name: /Concierge/ }))

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'concierge' })
    )
  })

  it('shows an empty state when nothing matches', async () => {
    render(<ExampleSearch examples={EXAMPLES} onSelect={jest.fn()} />)

    type('zzzzzz')

    await settle()

    expect(
      screen.getByText('No matching examples. Try different keywords.')
    ).toBeInTheDocument()
  })

  it('restores the suggestions when the search is cleared', async () => {
    render(<ExampleSearch examples={EXAMPLES} onSelect={jest.fn()} />)

    type('sales')

    await settle()

    expect(screen.queryByText('Featured examples')).not.toBeInTheDocument()

    type('')

    await settle()

    expect(screen.getByText('Featured examples')).toBeInTheDocument()
    // @note Concierge is a builder suggestion but not a 'sales' match, so its
    // return proves the suggestions were restored
    expect(screen.getByText('Concierge')).toBeInTheDocument()
  })
})

describe('Page', () => {
  let replaceMock

  beforeEach(() => {
    jest.useFakeTimers()

    replaceMock = jest.fn()

    useRouter.mockReturnValue({
      query: { projectScope: 'true' },
      replace: replaceMock,
    })
  })

  afterEach(() => {
    jest.useRealTimers()

    jest.clearAllMocks()
  })

  it('keeps the forward button disabled until an example is selected', () => {
    render(<Page examples={EXAMPLES} />)

    expect(screen.getByRole('button', { name: 'Next step' })).toBeDisabled()
  })

  it('enables the forward button and carries the selected slug into the confirm step', () => {
    render(<Page examples={EXAMPLES} />)

    fireEvent.click(screen.getByRole('button', { name: /Sales Agent/ }))

    const forward = screen.getByRole('button', { name: 'Next step' })

    expect(forward).toBeEnabled()

    fireEvent.click(forward)

    // @note preserves unrelated query params (projectScope) and drops the
    // template routing params
    expect(replaceMock).toHaveBeenCalledWith({
      pathname: '/new/example',
      query: {
        projectScope: 'true',
        example: 'sales-agent',
      },
    })
  })

  // @note the reported jitter: selecting a card must not reset or re-run the
  // search - the query and its results stay put
  it('preserves the search query and results when an example is selected', async () => {
    render(<Page examples={EXAMPLES} />)

    type('sales')

    await settle()

    expect(screen.getByText('Sales Agent')).toBeInTheDocument()
    expect(screen.queryByText('Math Tutor')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Sales Agent/ }))

    // @note flush any stray timers - nothing should re-fire or reset
    await act(async () => {
      jest.advanceTimersByTime(EXAMPLE_SEARCH_DEBOUNCE * 3)
    })

    expect(screen.getByRole('searchbox')).toHaveValue('sales')
    expect(screen.getByText('Sales Agent')).toBeInTheDocument()
    expect(screen.queryByText('Math Tutor')).not.toBeInTheDocument()
  })
})

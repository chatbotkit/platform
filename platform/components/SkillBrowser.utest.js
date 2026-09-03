import SkillBrowser, { useSkillBrowser } from './SkillBrowser'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockFetch = jest.fn()

jest.mock('@/hooks/useFetch', () => () => ({
  fetch: mockFetch,
}))

// Pass through without delay so tests don't need fake timers
jest.mock('@/hooks/useDebounce', () => (value) => value)

const mockOpenPopup = jest.fn()
const mockClosePopup = jest.fn()

jest.mock('@/hooks/usePopup', () => () => ({
  popup: null,
  openPopup: mockOpenPopup,
  closePopup: mockClosePopup,
}))

jest.mock('@/lib/toast', () => ({
  __esModule: true,
  default: {
    loading: jest.fn(() => 'toast-id'),
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const mockSkills = [
  {
    id: 'unit-testing',
    name: 'Unit Testing',
    description: 'Run focused platform tests',
    tags: ['testing', 'platform'],
  },
  {
    id: 'learnings',
    name: 'Learnings',
    description: 'Work with the learnings folder',
    tags: ['learnings', 'knowledge'],
  },
  {
    id: 'sentry-issues',
    name: 'Sentry Issues',
    description: 'Fetch and analyze Sentry issues',
    tags: ['sentry', 'debugging'],
  },
]

describe('SkillBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockResolvedValue({ data: { items: mockSkills }, error: null })
  })

  it('renders search input and prompt on initial empty state', () => {
    render(<SkillBrowser onDetail={jest.fn()} />)

    expect(screen.getByPlaceholderText('Search skills...')).toBeInTheDocument()
    expect(screen.getByText('Type to search the catalogue')).toBeInTheDocument()
  })

  it('renders loading spinner while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    render(<SkillBrowser onDetail={jest.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'content' },
    })

    expect(
      screen.queryByText('Type to search the catalogue')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Search Content')).not.toBeInTheDocument()
  })

  it('renders skills after searching', async () => {
    render(<SkillBrowser onDetail={jest.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'content' },
    })

    await waitFor(() => {
      expect(screen.getByText('Unit Testing')).toBeInTheDocument()
    })

    expect(screen.getByText('Learnings')).toBeInTheDocument()
    expect(screen.getByText('Sentry Issues')).toBeInTheDocument()
  })

  it('renders error state', async () => {
    mockFetch.mockResolvedValue({ data: null, error: 'Network error' })

    render(<SkillBrowser onDetail={jest.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'content' },
    })

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('renders generic error for non-string errors', async () => {
    mockFetch.mockResolvedValue({ data: null, error: { message: 'bad' } })

    render(<SkillBrowser onDetail={jest.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'content' },
    })

    await waitFor(() => {
      expect(screen.getByText('Failed to load skills')).toBeInTheDocument()
    })
  })

  it('renders empty state when no skills returned', async () => {
    mockFetch.mockResolvedValue({ data: { items: [] }, error: null })

    render(<SkillBrowser onDetail={jest.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'xyz' },
    })

    await waitFor(() => {
      expect(screen.getByText('No skills found.')).toBeInTheDocument()
    })
  })

  it('sends the search query to the API', async () => {
    render(<SkillBrowser onDetail={jest.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'sentry' },
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auxiliary/skillset/ability/clawhub/handler',
        expect.objectContaining({
          data: { q: 'sentry' },
          headers: { 'x-chatbotkit-handler-name': 'listSkills' },
        })
      )
    })
  })

  it('re-fetches with updated query when search term changes', async () => {
    mockFetch
      .mockResolvedValueOnce({ data: { items: [mockSkills[0]] }, error: null })
      .mockResolvedValueOnce({ data: { items: [mockSkills[2]] }, error: null })

    render(<SkillBrowser onDetail={jest.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'search' },
    })

    await waitFor(() => {
      expect(screen.getByText('Unit Testing')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'sentry' },
    })

    await waitFor(() => {
      expect(screen.getByText('Sentry Issues')).toBeInTheDocument()
      expect(screen.queryByText('Unit Testing')).not.toBeInTheDocument()
    })
  })

  it('calls onDetail when a skill is clicked', async () => {
    const onDetail = jest.fn()

    render(<SkillBrowser onDetail={onDetail} />)

    fireEvent.change(screen.getByPlaceholderText('Search skills...'), {
      target: { value: 'content' },
    })

    await waitFor(() => {
      expect(screen.getByText('Unit Testing')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Unit Testing'))

    expect(onDetail).toHaveBeenCalledTimes(1)
    expect(onDetail).toHaveBeenCalledWith(mockSkills[0])
  })
})

describe('useSkillBrowser', () => {
  function TestComponent() {
    const { popup, openSkillBrowser } = useSkillBrowser()

    return (
      <div>
        {popup}
        <button type="button" onClick={() => openSkillBrowser()}>
          Open
        </button>
      </div>
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('opens the popup when openSkillBrowser is called', () => {
    render(<TestComponent />)

    fireEvent.click(screen.getByText('Open'))

    expect(mockOpenPopup).toHaveBeenCalledTimes(1)
    expect(mockOpenPopup).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        title: 'Browse Skills',
        noActions: true,
      })
    )
  })
})

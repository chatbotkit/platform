import DatasetImportJobFinishURLs from './DatasetImportJobFinishURLs'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'

const mockFetch = jest.fn()

function createJsonlBody(items) {
  return (async function* () {
    const encoder = new TextEncoder()

    for (const item of items) {
      yield encoder.encode(`${JSON.stringify(item)}\n`)
    }
  })()
}

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: () => ({
    loading: false,
    fetch: mockFetch,
  }),
}))

jest.mock('@/lib/url', () => ({
  pathquery: (value) => value,
}))

jest.mock(
  '@/components/Link',
  () =>
    function Link({ href, children, ...props }) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      )
    }
)

describe('DatasetImportJobFinishURLs', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      error: null,
      data: createJsonlBody([
        {
          type: 'item',
          data: {
            meta: {
              urls: ['https://example.com/a', 'https://example.com/b'],
            },
          },
        },
      ]),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render URLs from finish event meta.urls', async () => {
    render(<DatasetImportJobFinishURLs maxUrls={1} />)

    expect(
      await screen.findByRole('link', { name: 'https://example.com/a' })
    ).toBeInTheDocument()
    expect(await screen.findByText('See all 2 URLs')).toBeInTheDocument()
  })

  it('should truncate long urls while preserving action button visibility', async () => {
    const longUrl = 'https://example.com/' + 'very-long-path/'.repeat(20)

    mockFetch.mockResolvedValueOnce({
      error: null,
      data: createJsonlBody([
        {
          type: 'item',
          data: {
            meta: {
              urls: [longUrl],
            },
          },
        },
      ]),
    })

    render(
      <DatasetImportJobFinishURLs
        actions={{
          'Exclude URL': {
            type: 'danger',
            action: jest.fn(),
          },
        }}
      />
    )

    const urlLink = await screen.findByRole('link', { name: longUrl })
    const excludeButton = await screen.findByRole('button', {
      name: 'Exclude URL',
    })

    expect(urlLink).toHaveClass('min-w-0')
    expect(urlLink).toHaveClass('truncate')
    expect(excludeButton).toHaveClass('shrink-0')
  })

  it('should filter urls by search input', async () => {
    jest.useFakeTimers()

    render(<DatasetImportJobFinishURLs />)

    expect(
      await screen.findByRole('link', { name: 'https://example.com/a' })
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('link', { name: 'https://example.com/b' })
    ).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Filter URLs'), {
      target: { value: '/b' },
    })

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(
      screen.queryByRole('link', { name: 'https://example.com/a' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'https://example.com/b' })
    ).toBeInTheDocument()

    jest.useRealTimers()
  })
})

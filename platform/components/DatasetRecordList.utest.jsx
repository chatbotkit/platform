import DatasetRecordList from './DatasetRecordList'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

const fetchMock = jest.fn()
const openPopupMock = jest.fn()

let capturedProps = {}

jest.mock('@/components/ResourceList', () => {
  return function MockResourceList(props) {
    capturedProps = props

    return <div data-testid="resource-list">resource-list</div>
  }
})

jest.mock('@/components/AutoTextarea', () => {
  return function MockAutoTextarea({ value, onChange, placeholder }) {
    return (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    )
  }
})

jest.mock('@/hooks/useDebounce', () => {
  return jest.fn((value) => value)
})

jest.mock('@/hooks/useFetch', () => {
  return jest.fn(() => ({
    fetch: fetchMock,
  }))
})

jest.mock('@/hooks/usePopup', () => {
  return jest.fn(() => ({
    popup: null,
    openPopup: openPopupMock,
  }))
})

describe('DatasetRecordList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedProps = {}

    fetchMock.mockImplementation((url) => {
      if (url === '/api/v1/dataset/dataset-1/search') {
        return {
          error: null,
          data: {
            records: [{ id: 'search-1', text: 'search result' }],
          },
        }
      }

      return {
        error: null,
        data: {
          items: [{ id: 'record-2', text: 'record value' }],
          cursor: 'next-cursor',
        },
      }
    })
  })

  it('passes expected defaults to ResourceList', () => {
    render(
      <DatasetRecordList
        datasetId="dataset-1"
        defaultItems={[{ id: 'record-1', text: 'hello' }]}
        defaultCursor="cursor-1"
        defaultTotalCount={12}
      />
    )

    expect(screen.getByTestId('resource-list')).toBeInTheDocument()

    expect(capturedProps.kind).toBe('record')
    expect(capturedProps.exportRoute).toBe('/api/v1/dataset/dataset-1/record/export')
    expect(capturedProps.deleteRoute).toBe('/api/v1/dataset/dataset-1/record/[id]/delete')
    expect(capturedProps.instanceRoute).toBe('/datasets/dataset-1/records/[id]')
    expect(capturedProps.link).toBeUndefined()
    expect(capturedProps.title).toBeUndefined()
    expect(capturedProps.trailingActions).toBeTruthy()
    expect(capturedProps.trailingActions.props.href).toBe('/datasets/dataset-1/records/new')
    expect(capturedProps.trailingActions.props.children).toBe('Create record')
    expect(capturedProps.defaultCursor).toBe('cursor-1')
    expect(capturedProps.defaultTotalCount).toBe(12)
    expect(capturedProps.loadMore).toBe(true)
    expect(typeof capturedProps.listRoute).toBe('function')
    expect(typeof capturedProps.extraButtons).toBe('object')
    expect(typeof capturedProps.extraTags).toBe('function')
  })

  it('switches to search mode and calls dataset search route', async () => {
    render(<DatasetRecordList datasetId="dataset-1" />)

    const searchInput = screen.getByPlaceholderText(
      'Ask a specific question in natural language to filter the records'
    )

    fireEvent.change(searchInput, { target: { value: 'hello world' } })

    expect(capturedProps.loadMore).toBe(false)

    const result = await capturedProps.listRoute({
      take: 10,
      order: 'desc',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/dataset/dataset-1/search', {
      data: {
        search: 'hello world',
      },
    })

    expect(result).toEqual([{ id: 'search-1', text: 'search result' }])
  })
})

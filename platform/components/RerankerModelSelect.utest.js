/* eslint-disable @typescript-eslint/no-require-imports */
import usePopup from '@/hooks/usePopup'

import RerankerModelSelect, {
  compareVisibleRerankModels,
  getRerankModelSortPriority,
} from './RerankerModelSelect'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('react-icons/io', () => ({
  IoIosOptions: function IoIosOptions(props) {
    return <button type="button" {...props} />
  },
}))

jest.mock('@/config/models', () => ({
  defaultRerankModel: 'base-rerank-model',
  rerankModels: {
    'base-rerank-model': {
      description: 'Base',
      region: 'us',
      availableRegions: ['us'],
      features: [],
      tags: [],
    },
  },
  visibleRerankModels: {
    'base-rerank-model': {
      description: 'Base',
      pricing: { tokenRatio: 0 },
      provider: 'vercel',
      family: 'rerank',
      addedDate: '2024-01-01',
      features: [],
      tags: [],
    },
    'featured-rerank-model': {
      description: 'Featured',
      provider: 'vercel',
      family: 'rerank',
      addedDate: '2025-02-01',
      featured: true,
      features: [],
      tags: [],
    },
    'older-featured-rerank-model': {
      description: 'Older featured',
      provider: 'vercel',
      family: 'rerank',
      addedDate: '2025-01-01',
      featured: true,
      features: [],
      tags: [],
    },
    'newer-rerank-model': {
      description: 'Newer',
      provider: 'vercel',
      family: 'rerank',
      addedDate: '2026-03-01',
      features: [],
      tags: [],
    },
  },
}))

jest.mock('@/lib/helpers', () => ({
  either: (value, fallback) => value ?? fallback,
}))

jest.mock('@/lib/model.utils', () => ({
  buildRerankModel: jest.fn((name) => name),
  parseRerankModel: jest.fn((value) => ({ name: value, config: {} })),
}))

jest.mock('@/lib/toast', () => ({
  error: jest.fn(),
}))

jest.mock('@/components/List', () => {
  function List({ children }) {
    return <div>{children}</div>
  }

  List.Item = function ListItem({ title, children, onClick, selected }) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-selected={selected}
        data-testid={`reranker-model-${title}`}
      >
        <span>{title}</span>
        {children}
      </button>
    )
  }

  return List
})

jest.mock('@/hooks/useControlledState', () => {
  const React = require('react')

  return function useControlledState(defaultValue, value, setValue) {
    const [internalValue, setInternalValue] = React.useState(defaultValue)

    if (typeof value !== 'undefined' && typeof setValue === 'function') {
      return [value, setValue]
    }

    return [internalValue, setInternalValue]
  }
})

jest.mock('@/hooks/useDebounce', () => (value) => value)

const openPopupMock = jest.fn()

jest.mock('@/hooks/useAvailableModels', () => ({
  __esModule: true,
  default: jest.fn(() => null),
  useAvailableDefaultModel: jest.fn(() => null),
}))

const useAvailableModels = jest.requireMock(
  '@/hooks/useAvailableModels'
).default

jest.mock('@/hooks/usePopup', () =>
  jest.fn(() => ({
    popup: null,
    openPopup: openPopupMock,
    closePopup: jest.fn(),
  }))
)

describe('RerankerModelSelect', () => {
  beforeEach(() => {
    openPopupMock.mockClear()
    usePopup.mockClear()
    useAvailableModels.mockReturnValue(null)
  })

  it('opens selection popup with the expected dialog width', () => {
    render(
      <RerankerModelSelect
        name="reranker"
        defaultValue="base-rerank-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('base-rerank-model')[1])

    expect(openPopupMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dialogClassName: 'sm:max-w-4xl' })
    )
  })

  it('lays out the credit tag tooltip wrapper without inline baseline spacing', () => {
    render(
      <RerankerModelSelect
        name="reranker"
        defaultValue="base-rerank-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('base-rerank-model')[1])
    render(openPopupMock.mock.calls[0][0])

    expect(screen.getByText('free').parentElement).toHaveClass('inline-flex')
  })
  it('limits the popup to the runtime-available models', () => {
    useAvailableModels.mockReturnValue(['base-rerank-model'])

    render(
      <RerankerModelSelect
        name="model"
        defaultValue="base-rerank-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('base-rerank-model')[1])
    render(openPopupMock.mock.calls[0][0])

    expect(useAvailableModels).toHaveBeenCalledWith('rerank')
    expect(screen.getByTestId('reranker-model-base-rerank-model')).toBeInTheDocument()
    expect(screen.queryByTestId('reranker-model-featured-rerank-model')).not.toBeInTheDocument()
  })

  it('falls back to the full catalogue while availability is unknown', () => {
    render(
      <RerankerModelSelect
        name="model"
        defaultValue="base-rerank-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('base-rerank-model')[1])
    render(openPopupMock.mock.calls[0][0])

    expect(screen.getByTestId('reranker-model-base-rerank-model')).toBeInTheDocument()
    expect(screen.getByTestId('reranker-model-featured-rerank-model')).toBeInTheDocument()
  })
})

describe('RerankerModelSelect sort helpers', () => {
  it('assigns priority as default first, featured second, others third', () => {
    expect(getRerankModelSortPriority('base-rerank-model', {})).toBe(0)
    expect(
      getRerankModelSortPriority('featured-rerank-model', { featured: true })
    ).toBe(1)
    expect(getRerankModelSortPriority('newer-rerank-model', {})).toBe(2)
  })

  it('sorts default first, then featured by date desc, then remaining by date desc', () => {
    expect(
      [
        ['newer-rerank-model', { addedDate: '2026-03-01' }],
        [
          'older-featured-rerank-model',
          {
            addedDate: '2025-01-01',
            featured: true,
          },
        ],
        [
          'featured-rerank-model',
          {
            addedDate: '2025-02-01',
            featured: true,
          },
        ],
        ['base-rerank-model', { addedDate: '2024-01-01' }],
      ].sort(compareVisibleRerankModels)
    ).toEqual([
      ['base-rerank-model', { addedDate: '2024-01-01' }],
      ['featured-rerank-model', { addedDate: '2025-02-01', featured: true }],
      [
        'older-featured-rerank-model',
        { addedDate: '2025-01-01', featured: true },
      ],
      ['newer-rerank-model', { addedDate: '2026-03-01' }],
    ])
  })
})

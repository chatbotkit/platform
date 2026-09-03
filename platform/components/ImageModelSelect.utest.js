/* eslint-disable @typescript-eslint/no-require-imports */
import usePopup from '@/hooks/usePopup'

import ImageModelSelect, {
  compareVisibleImageModels,
  getImageModelSortPriority,
} from './ImageModelSelect'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('react-icons/io', () => ({
  IoIosOptions: function IoIosOptions(props) {
    return <button type="button" {...props} />
  },
}))

jest.mock('@/config/models', () => ({
  defaultImageModel: 'test-image-model',
  imageModels: {
    'test-image-model': {
      description: 'Test image model',
      region: 'us',
      availableRegions: ['us'],
      features: [],
      tags: [],
    },
  },
  visibleImageModels: {
    'test-image-model': {
      description: 'Test image model',
      pricing: { tokenRatio: 0 },
      provider: 'openai',
      family: 'test',
      addedDate: '2024-01-01',
      features: [],
      tags: [],
    },
    'featured-image-model': {
      description: 'Featured image model',
      provider: 'openai',
      family: 'test',
      addedDate: '2025-02-01',
      featured: true,
      features: [],
      tags: [],
    },
    'older-featured-image-model': {
      description: 'Older featured image model',
      provider: 'openai',
      family: 'test',
      addedDate: '2025-01-01',
      featured: true,
      features: [],
      tags: [],
    },
    'newer-image-model': {
      description: 'Newer image model',
      provider: 'openai',
      family: 'test',
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
  buildImageModel: jest.fn((name) => name),
  parseImageModel: jest.fn((value) => ({ name: value, config: {} })),
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
        data-testid={`image-model-${title}`}
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

describe('ImageModelSelect', () => {
  beforeEach(() => {
    openPopupMock.mockClear()
    usePopup.mockClear()
    useAvailableModels.mockReturnValue(null)
  })

  it('uses the same narrower popup dialog width as the language model selector', () => {
    render(
      <ImageModelSelect
        name="imageModel"
        defaultValue="test-image-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('test-image-model')[1])

    expect(openPopupMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dialogClassName: 'sm:max-w-4xl' })
    )
  })

  it('lays out the credit tag tooltip wrapper without inline baseline spacing', () => {
    render(
      <ImageModelSelect
        name="imageModel"
        defaultValue="test-image-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('test-image-model')[1])
    render(openPopupMock.mock.calls[0][0])

    expect(screen.getByText('free').parentElement).toHaveClass('inline-flex')
  })
  it('limits the popup to the runtime-available models', () => {
    useAvailableModels.mockReturnValue(['test-image-model'])

    render(
      <ImageModelSelect
        name="model"
        defaultValue="test-image-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('test-image-model')[1])
    render(openPopupMock.mock.calls[0][0])

    expect(useAvailableModels).toHaveBeenCalledWith('image')
    expect(screen.getByTestId('image-model-test-image-model')).toBeInTheDocument()
    expect(screen.queryByTestId('image-model-featured-image-model')).not.toBeInTheDocument()
  })

  it('falls back to the full catalogue while availability is unknown', () => {
    render(
      <ImageModelSelect
        name="model"
        defaultValue="test-image-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('test-image-model')[1])
    render(openPopupMock.mock.calls[0][0])

    expect(screen.getByTestId('image-model-test-image-model')).toBeInTheDocument()
    expect(screen.getByTestId('image-model-featured-image-model')).toBeInTheDocument()
  })
})

describe('ImageModelSelect sort helpers', () => {
  it('assigns sort priority buckets with the default image model first, then featured models, then the rest', () => {
    expect(getImageModelSortPriority('test-image-model', {})).toBe(0)
    expect(
      getImageModelSortPriority('featured-image-model', { featured: true })
    ).toBe(1)
    expect(getImageModelSortPriority('newer-image-model', {})).toBe(2)
  })

  it('sorts image models with the default first, then featured models, then the remaining models by newest date', () => {
    expect(
      [
        ['newer-image-model', { addedDate: '2026-03-01' }],
        [
          'older-featured-image-model',
          {
            addedDate: '2025-01-01',
            featured: true,
          },
        ],
        [
          'featured-image-model',
          {
            addedDate: '2025-02-01',
            featured: true,
          },
        ],
        ['test-image-model', { addedDate: '2024-01-01' }],
      ].sort(compareVisibleImageModels)
    ).toEqual([
      ['test-image-model', { addedDate: '2024-01-01' }],
      ['featured-image-model', { addedDate: '2025-02-01', featured: true }],
      [
        'older-featured-image-model',
        { addedDate: '2025-01-01', featured: true },
      ],
      ['newer-image-model', { addedDate: '2026-03-01' }],
    ])
  })
})

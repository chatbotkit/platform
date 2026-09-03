/* eslint-disable @typescript-eslint/no-require-imports */
import usePopup from '@/hooks/usePopup'

import VideoModelSelect, {
  compareVisibleVideoModels,
  getVideoModelSortPriority,
} from './VideoModelSelect'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('react-icons/io', () => ({
  IoIosOptions: function IoIosOptions(props) {
    return <button type="button" {...props} />
  },
}))

jest.mock('@/config/models', () => ({
  defaultVideoModel: 'base-video-model',
  videoModels: {
    'base-video-model': {
      description: 'Base',
      region: 'us',
      availableRegions: ['us'],
      features: [],
      tags: [],
    },
  },
  visibleVideoModels: {
    'base-video-model': {
      description: 'Base',
      pricing: { tokenRatio: 0 },
      provider: 'openai',
      family: 'test',
      addedDate: '2024-01-01',
      features: [],
      tags: [],
    },
    'featured-video-model': {
      description: 'Featured',
      provider: 'openai',
      family: 'test',
      addedDate: '2025-02-01',
      featured: true,
      features: [],
      tags: [],
    },
    'older-featured-video-model': {
      description: 'Older featured',
      provider: 'openai',
      family: 'test',
      addedDate: '2025-01-01',
      featured: true,
      features: [],
      tags: [],
    },
    'newer-video-model': {
      description: 'Newer',
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
  buildVideoModel: jest.fn((name) => name),
  parseVideoModel: jest.fn((value) => ({ name: value, config: {} })),
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
        data-testid={`video-model-${title}`}
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

describe('VideoModelSelect', () => {
  beforeEach(() => {
    openPopupMock.mockClear()
    usePopup.mockClear()
    useAvailableModels.mockReturnValue(null)
  })

  it('opens selection popup with the expected dialog width', () => {
    render(
      <VideoModelSelect
        name="videoModel"
        defaultValue="base-video-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('base-video-model')[1])

    expect(openPopupMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dialogClassName: 'sm:max-w-4xl' })
    )
  })

  it('lays out the credit tag tooltip wrapper without inline baseline spacing', () => {
    render(
      <VideoModelSelect
        name="videoModel"
        defaultValue="base-video-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('base-video-model')[1])
    render(openPopupMock.mock.calls[0][0])

    expect(screen.getByText('free').parentElement).toHaveClass('inline-flex')
  })
  it('limits the popup to the runtime-available models', () => {
    useAvailableModels.mockReturnValue(['base-video-model'])

    render(
      <VideoModelSelect
        name="model"
        defaultValue="base-video-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('base-video-model')[1])
    render(openPopupMock.mock.calls[0][0])

    expect(useAvailableModels).toHaveBeenCalledWith('video')
    expect(screen.getByTestId('video-model-base-video-model')).toBeInTheDocument()
    expect(screen.queryByTestId('video-model-featured-video-model')).not.toBeInTheDocument()
  })

  it('falls back to the full catalogue while availability is unknown', () => {
    render(
      <VideoModelSelect
        name="model"
        defaultValue="base-video-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('base-video-model')[1])
    render(openPopupMock.mock.calls[0][0])

    expect(screen.getByTestId('video-model-base-video-model')).toBeInTheDocument()
    expect(screen.getByTestId('video-model-featured-video-model')).toBeInTheDocument()
  })
})

describe('VideoModelSelect sort helpers', () => {
  it('assigns priority as default first, featured second, others third', () => {
    expect(getVideoModelSortPriority('base-video-model', {})).toBe(0)
    expect(
      getVideoModelSortPriority('featured-video-model', { featured: true })
    ).toBe(1)
    expect(getVideoModelSortPriority('newer-video-model', {})).toBe(2)
  })

  it('sorts default first, then featured by date desc, then remaining by date desc', () => {
    expect(
      [
        ['newer-video-model', { addedDate: '2026-03-01' }],
        [
          'older-featured-video-model',
          {
            addedDate: '2025-01-01',
            featured: true,
          },
        ],
        [
          'featured-video-model',
          {
            addedDate: '2025-02-01',
            featured: true,
          },
        ],
        ['base-video-model', { addedDate: '2024-01-01' }],
      ].sort(compareVisibleVideoModels)
    ).toEqual([
      ['base-video-model', { addedDate: '2024-01-01' }],
      ['featured-video-model', { addedDate: '2025-02-01', featured: true }],
      [
        'older-featured-video-model',
        { addedDate: '2025-01-01', featured: true },
      ],
      ['newer-video-model', { addedDate: '2026-03-01' }],
    ])
  })
})

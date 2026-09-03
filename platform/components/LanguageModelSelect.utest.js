/* eslint-disable @typescript-eslint/no-require-imports */
import usePopup from '@/hooks/usePopup'

import LanguageModelSelect, {
  compareVisibleLanguageModels,
  getLanguageModelSortPriority,
} from './LanguageModelSelect'

import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

const openPopupMock = jest.fn()
const closePopupMock = jest.fn()

jest.mock('react-icons/io', () => ({
  IoIosOptions: function IoIosOptions(props) {
    return <button type="button" {...props} />
  },
}))

jest.mock('@/config/models', () => ({
  defaultLanguageModel: 'free-model',
  languageModels: {
    custom: {
      description: 'Custom model',
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'free-model': {
      description: 'Free model',
      pricing: { tokenRatio: 0 },
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      thresholdStrategy: 'truncate',
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'low-model': {
      description: 'Low model',
      pricing: { tokenRatio: 0.05 },
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'medium-model': {
      description: 'Medium model',
      pricing: { tokenRatio: 0.2 },
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'high-model': {
      description: 'High model',
      pricing: { tokenRatio: 1.0 },
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'threshold-medium-model': {
      description: 'Threshold medium model',
      pricing: { tokenRatio: 0.8333 },
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'sonnet-model': {
      description: 'Sonnet model',
      pricing: { tokenRatio: 0.8333 },
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'very-high-model': {
      description: 'Very high model',
      pricing: { tokenRatio: 2.0 },
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'compact-default-model': {
      description: 'Compact default model',
      pricing: { tokenRatio: 0.3 },
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      thresholdStrategy: 'compact',
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'boundary-low': {
      description: 'Boundary low',
      pricing: { tokenRatio: 0.1 },
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'boundary-medium': {
      description: 'Boundary medium',
      pricing: { tokenRatio: 1.0 },
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'boundary-high': {
      description: 'Boundary high',
      pricing: { tokenRatio: 1.5 },
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
    'missing-pricing-model': {
      description: 'Missing pricing',
      maxTokens: 1000,
      temperature: 0,
      interactionMaxMessages: 4,
      frequencyPenalty: 0,
      presencePenalty: 0,
      region: 'us',
      availableRegions: ['us'],
    },
  },
  visibleLanguageModels: {
    custom: {
      description: 'Custom model',
      provider: 'openai',
      family: 'custom',
      maxTokens: 1000,
      features: [],
      tags: [],
    },
    'free-model': {
      description: 'Free model',
      pricing: { tokenRatio: 0 },
      provider: 'openrouter',
      family: 'test',
      maxTokens: 1000,
      addedDate: '2024-01-01',
      features: [],
      tags: [],
    },
    'low-model': {
      description: 'Low model',
      pricing: { tokenRatio: 0.05 },
      provider: 'openai',
      family: 'test',
      maxTokens: 1000,
      addedDate: '2026-03-01',
      features: [],
      tags: [],
    },
    'medium-model': {
      description: 'Medium model',
      pricing: { tokenRatio: 0.2 },
      provider: 'openai',
      family: 'test',
      maxTokens: 1000,
      addedDate: '2025-01-01',
      featured: true,
      features: [],
      tags: [],
    },
    'high-model': {
      description: 'High model',
      pricing: { tokenRatio: 1.0 },
      provider: 'openai',
      family: 'test',
      maxTokens: 1000,
      addedDate: '2025-02-01',
      featured: true,
      features: [],
      tags: [],
    },
    'threshold-medium-model': {
      description: 'Threshold medium model',
      pricing: { tokenRatio: 0.8333 },
      provider: 'openai',
      family: 'test',
      maxTokens: 1000,
      features: [],
      tags: [],
    },
    'sonnet-model': {
      description: 'Sonnet model',
      pricing: { tokenRatio: 0.8333 },
      provider: 'openrouter',
      family: 'sonnet',
      maxTokens: 1000,
      features: [],
      tags: [],
    },
    'very-high-model': {
      description: 'Very high model',
      pricing: { tokenRatio: 2.0 },
      provider: 'openai',
      family: 'test',
      maxTokens: 1000,
      features: [],
      tags: [],
    },
    'boundary-low': {
      description: 'Boundary low',
      pricing: { tokenRatio: 0.1 },
      provider: 'openai',
      family: 'test',
      maxTokens: 1000,
      features: [],
      tags: [],
    },
    'boundary-medium': {
      description: 'Boundary medium',
      pricing: { tokenRatio: 1.0 },
      provider: 'openai',
      family: 'test',
      maxTokens: 1000,
      features: [],
      tags: [],
    },
    'boundary-high': {
      description: 'Boundary high',
      pricing: { tokenRatio: 1.5 },
      provider: 'openai',
      family: 'test',
      maxTokens: 1000,
      features: [],
      tags: [],
    },
    'missing-pricing-model': {
      description: 'Missing pricing',
      provider: 'openai',
      family: 'test',
      maxTokens: 1000,
      features: [],
      tags: [],
    },
  },
}))

jest.mock('@/lib/helpers', () => ({
  either: (value, fallback) => value ?? fallback,
}))

jest.mock('@/lib/model.utils', () => ({
  buildLanguageModel: jest.fn((name, config = {}) => {
    if (
      name === 'custom' &&
      (!config.name || !config.provider || !config.credentials)
    ) {
      throw new Error('model.config.name is required')
    }

    return name
  }),
  modelSupportsAudioInput: jest.fn(() => false),
  modelSupportsFileInput: jest.fn(() => false),
  modelSupportsImageInput: jest.fn(() => false),
  modelSupportsInterpreter: jest.fn(() => false),
  modelSupportsReasoningEffort: jest.fn(() => false),
  modelSupportsRealtime: jest.fn(() => false),
  modelSupportsVideoInput: jest.fn(() => false),
  parseLanguageModel: jest.fn((value) => ({ name: value, config: {} })),
}))

const toast = require('@/lib/toast')

jest.mock('@/lib/toast', () => ({
  error: jest.fn(),
}))

jest.mock(
  '@/components/Expando',
  () =>
    function Expando({ children }) {
      return <div>{children}</div>
    }
)

jest.mock('@/components/List', () => {
  function List({ children }) {
    return <div>{children}</div>
  }

  List.Item = function ListItem({ title, onClick, selected, children }) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-selected={selected}
        data-testid={`model-${title}`}
      >
        <span>{title}</span>
        {children}
      </button>
    )
  }

  return List
})

jest.mock(
  '@/components/RevealToken',
  () =>
    function RevealToken() {
      return <input />
    }
)

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
    closePopup: closePopupMock,
  }))
)

jest.mock(
  './Toggle',
  () =>
    function Toggle() {
      return <input type="checkbox" />
    }
)

describe('LanguageModelSelect', () => {
  beforeEach(() => {
    openPopupMock.mockClear()
    closePopupMock.mockClear()
    usePopup.mockClear()
    toast.error.mockClear()
    useAvailableModels.mockReturnValue(null)
  })

  function openSelector(props = {}) {
    render(
      <LanguageModelSelect
        name="model"
        defaultValue="free-model"
        className="default-input"
        {...props}
      />
    )

    fireEvent.click(
      screen
        .getAllByDisplayValue('free-model')
        .find((element) => !element.classList.contains('hidden'))
    )

    expect(openPopupMock).toHaveBeenCalledTimes(1)

    return render(openPopupMock.mock.calls[0][0])
  }

  it('renders credit consumption tags for each pricing tier in the selection popup', () => {
    openSelector({
      allowedModels: [
        'free-model',
        'low-model',
        'medium-model',
        'threshold-medium-model',
        'high-model',
        'sonnet-model',
        'very-high-model',
      ],
    })

    expect(
      within(screen.getByTestId('model-free-model')).getByText('free')
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('model-low-model')).getByText('low credit')
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('model-medium-model')).getByText(
        'medium credit'
      )
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('model-threshold-medium-model')).getByText(
        'medium credit'
      )
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('model-high-model')).getByText('high credit')
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('model-sonnet-model')).getByText(
        'medium credit'
      )
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('model-very-high-model')).getByText(
        'very high credit'
      )
    ).toBeInTheDocument()
  })

  it('lays out the credit tag tooltip wrapper without inline baseline spacing', () => {
    openSelector({ allowedModels: ['free-model'] })

    const creditTag = within(
      screen.getByTestId('model-free-model')
    ).getByText('free')

    expect(creditTag.parentElement).toHaveClass('inline-flex')
  })

  it('uses the next higher tier at each threshold boundary and omits tags without pricing', () => {
    openSelector({
      allowedModels: [
        'boundary-low',
        'boundary-medium',
        'boundary-high',
        'missing-pricing-model',
      ],
    })

    expect(
      within(screen.getByTestId('model-boundary-low')).getByText(
        'medium credit'
      )
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('model-boundary-medium')).getByText(
        'high credit'
      )
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('model-boundary-high')).getByText(
        'very high credit'
      )
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('model-missing-pricing-model')).queryByText(
        /credit|free/
      )
    ).not.toBeInTheDocument()
  })

  it('uses a wider popup dialog for the model selector', () => {
    render(
      <LanguageModelSelect
        name="model"
        defaultValue="free-model"
        className="default-input"
      />
    )

    fireEvent.click(screen.getAllByDisplayValue('free-model')[1])

    expect(openPopupMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dialogClassName: 'sm:max-w-4xl' })
    )
  })

  it('opens the model configuration popup immediately when custom is selected', () => {
    render(<LanguageModelSelect name="model" className="default-input" />)

    fireEvent.click(
      screen
        .getAllByDisplayValue('free-model')
        .find((element) => !element.classList.contains('hidden'))
    )

    expect(openPopupMock).toHaveBeenCalledTimes(1)

    render(openPopupMock.mock.calls[0][0])

    fireEvent.click(screen.getByTestId('model-custom'))

    expect(toast.error).not.toHaveBeenCalled()
    expect(openPopupMock).toHaveBeenCalledTimes(2)
    expect(openPopupMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({ title: 'Model Configuration' })
    )
  })

  it('shows threshold strategy in model configuration advanced options', () => {
    render(
      <LanguageModelSelect
        name="model"
        defaultValue="free-model"
        className="default-input"
      />
    )

    const optionsButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent === '')

    expect(optionsButton).toBeDefined()

    fireEvent.click(optionsButton)

    expect(openPopupMock).toHaveBeenCalledTimes(1)

    render(openPopupMock.mock.calls[0][0])

    expect(screen.getByLabelText('Threshold Strategy')).toHaveValue('truncate')
  })

  it('shows the resolved threshold strategy in helper text', () => {
    render(
      <LanguageModelSelect
        name="model"
        defaultValue="compact-default-model"
        className="default-input"
      />
    )

    const optionsButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent === '')

    expect(optionsButton).toBeDefined()

    fireEvent.click(optionsButton)

    expect(openPopupMock).toHaveBeenCalledTimes(1)

    render(openPopupMock.mock.calls[0][0])

    expect(screen.getByLabelText('Threshold Strategy')).toHaveValue('compact')
    expect(
      screen.getByText(/Choose how conversation history is reduced/i)
    ).toHaveTextContent('compact')
  })

  it('limits the popup to the runtime-available models', () => {
    useAvailableModels.mockReturnValue(['free-model'])

    openSelector()

    expect(useAvailableModels).toHaveBeenCalledWith('language')
    expect(screen.getByTestId('model-free-model')).toBeInTheDocument()
    expect(screen.queryByTestId('model-low-model')).not.toBeInTheDocument()
  })

  it('falls back to the full catalogue while availability is unknown', () => {
    openSelector()

    expect(screen.getByTestId('model-free-model')).toBeInTheDocument()
    expect(screen.getByTestId('model-low-model')).toBeInTheDocument()
  })

  // @note regression for the designer bug where selecting `custom` only lived
  // in local state, so deselecting/reselecting the bot node silently reverted
  // to the previous model. Controlled harness mimics GenericConfigurator ->
  // useInputState -> LanguageModelSelect, where node data is the source of
  // truth that survives remounts.
  describe('custom model selection (designer regression)', () => {
    function renderControlled(initialValue) {
      const nodeData = { model: initialValue }

      // mimic the real useControlledState Object.is dedupe: same-value echoes
      // (mount-time build -> setValue) are no-ops in production
      const setValue = jest.fn((next) => {
        if (Object.is(next, nodeData.model)) {
          return
        }

        nodeData.model = next
      })

      const view = render(
        <LanguageModelSelect
          name="model"
          value={nodeData.model}
          setValue={setValue}
          className="default-input"
        />
      )

      return { view, nodeData, setValue }
    }

    function openModelList(displayValue) {
      fireEvent.click(
        screen
          .getAllByDisplayValue(displayValue)
          .find((element) => !element.classList.contains('hidden'))
      )

      render(openPopupMock.mock.calls[0][0])
    }

    it('commits a custom model once its configuration is committed', async () => {
      const { nodeData } = renderControlled('sonnet-model')

      openModelList('sonnet-model')

      fireEvent.click(screen.getByTestId('model-custom'))

      expect(openPopupMock.mock.calls[1][1]).toEqual(
        expect.objectContaining({ title: 'Model Configuration' })
      )

      await act(async () => {
        await openPopupMock.mock.calls[1][1].actions.Commit.fn({
          name: 'my-model',
          provider: 'openai',
          credentials: 'sk-test',
        })
      })

      expect(nodeData.model).toBe('custom')
      expect(closePopupMock).toHaveBeenCalled()
    })

    it('keeps the previous model when the configuration popup is dismissed', () => {
      const { nodeData, setValue } = renderControlled('sonnet-model')

      openModelList('sonnet-model')

      fireEvent.click(screen.getByTestId('model-custom'))

      // nothing committed: node data unchanged, display still the old model
      expect(setValue).not.toHaveBeenCalledWith(
        expect.stringContaining('custom')
      )
      expect(nodeData.model).toBe('sonnet-model')
      expect(screen.queryByDisplayValue('custom')).not.toBeInTheDocument()
    })

    it('rejects an incomplete custom configuration and keeps the popup open', async () => {
      const { nodeData } = renderControlled('sonnet-model')

      openModelList('sonnet-model')

      fireEvent.click(screen.getByTestId('model-custom'))

      await act(async () => {
        await openPopupMock.mock.calls[1][1].actions.Commit.fn({
          name: 'my-model',
        })
      })

      expect(toast.error).toHaveBeenCalled()
      expect(closePopupMock).not.toHaveBeenCalled()
      expect(nodeData.model).toBe('sonnet-model')
    })
  })
})

describe('LanguageModelSelect sort helpers', () => {
  it('assigns sort priority buckets with the default model first, then featured models, then the rest', () => {
    expect(getLanguageModelSortPriority('free-model', {})).toBe(0)
    expect(getLanguageModelSortPriority('high-model', { featured: true })).toBe(
      1
    )
    expect(getLanguageModelSortPriority('low-model', {})).toBe(2)
  })

  it('sorts models with the default first, then featured models, then the remaining models by newest date', () => {
    expect(
      [
        ['low-model', { addedDate: '2026-03-01' }],
        ['medium-model', { addedDate: '2025-01-01', featured: true }],
        ['high-model', { addedDate: '2025-02-01', featured: true }],
        ['free-model', { addedDate: '2024-01-01' }],
      ].sort(compareVisibleLanguageModels)
    ).toEqual([
      ['free-model', { addedDate: '2024-01-01' }],
      ['high-model', { addedDate: '2025-02-01', featured: true }],
      ['medium-model', { addedDate: '2025-01-01', featured: true }],
      ['low-model', { addedDate: '2026-03-01' }],
    ])
  })
})

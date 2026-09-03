import { TAG_RESULT } from '@/lib/conversation.tag'

import SkillsetAbilityTester from './SkillsetAbilityTester'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockFetch = jest.fn()
const mockJsonl = jest.fn()
const toastError = jest.fn()

jest.mock('@/lib/fetch', () => ({
  jsonl: (...args) => mockJsonl(...args),
}))

jest.mock('@/lib/toast', () => ({
  __esModule: true,
  default: {
    error: (...args) => toastError(...args),
  },
}))

jest.mock('@/hooks/useFetch', () => ({
  __esModule: true,
  default: () => ({
    loading: false,
    fetch: mockFetch,
  }),
}))

jest.mock('@/components/CodeBlock', () => {
  return function CodeBlock({ children, language, lang, className }) {
    return (
      <div
        data-testid="code-block"
        data-class-name={className}
        data-language={language || lang || 'text'}
      >
        <pre>{children}</pre>
      </div>
    )
  }
})

jest.mock('@/components/ObjectView', () => {
  return function ObjectView({ object, className }) {
    return (
      <div data-testid="object-view" data-class-name={className}>
        {JSON.stringify(object)}
      </div>
    )
  }
})

jest.mock('@/components/SimpleTabs', () => {
  const { useState } = jest.requireActual('react')

  return function SimpleTabs({ tabs, className }) {
    const entries = Object.entries(tabs)
    const defaultTab =
      entries.find(([, tab]) => tab?.default)?.[0] || entries[0]?.[0]
    const [activeTab, setActiveTab] = useState(defaultTab)

    return (
      <div data-testid="simple-tabs" data-class-name={className}>
        <div>
          {entries.map(([label]) => {
            return (
              <button
                key={label}
                type="button"
                onClick={() => setActiveTab(label)}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div>
          {tabs[activeTab]?.content ||
            tabs[activeTab]?.children ||
            tabs[activeTab]}
        </div>
      </div>
    )
  }
})

jest.mock('@/components/AdvancedAutoTextarea', () => {
  return function AdvancedAutoTextarea({
    children,
    value,
    onChange,
    ...props
  }) {
    return (
      <div>
        <textarea value={value} onChange={onChange} {...props} />
        {children}
      </div>
    )
  }
})

jest.mock('@/components/SendInstructions', () => {
  return function SendInstructions() {
    return <div data-testid="send-instructions" />
  }
})

describe('SkillsetAbilityTester', () => {
  const props = {
    skillset: {
      id: 'skillset-1',
      ability: {
        id: 'skillset-ability-1',
      },
    },
    ability: {
      id: 'ability-1',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render result and debug in separate tabs for structured responses', async () => {
    mockFetch.mockResolvedValue({ error: null, data: 'stream-body' })
    mockJsonl.mockImplementation(async function* () {
      yield {
        type: TAG_RESULT,
        data: {
          result: {
            data: [{ id: 'object-1', api_slug: 'workspaces' }],
          },
          debug: {
            request: {
              method: 'GET',
            },
            response: {
              status: 200,
            },
          },
          messages: [{ text: 'execution log line' }],
        },
      }
    })

    render(<SkillsetAbilityTester {...props} />)

    fireEvent.change(screen.getByPlaceholderText('Enter your input'), {
      target: { value: '{"hello":"world"}' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }))

    await waitFor(() => {
      expect(screen.getByText('Data')).toBeInTheDocument()
    })

    expect(screen.getByText('Debug')).toBeInTheDocument()
    expect(screen.getByText('Messages')).toBeInTheDocument()
    expect(screen.getByTestId('object-view')).toHaveTextContent(
      '"api_slug":"workspaces"'
    )

    fireEvent.click(screen.getByText('Debug'))

    await waitFor(() => {
      expect(screen.getByTestId('object-view')).toHaveTextContent(
        '"status":200'
      )
    })

    fireEvent.click(screen.getByText('Messages'))

    await waitFor(() => {
      expect(screen.getByTestId('code-block')).toHaveTextContent(
        'execution log line'
      )
    })
  })

  it('should keep plain text results in the result tab', async () => {
    mockFetch.mockResolvedValue({ error: null, data: 'stream-body' })
    mockJsonl.mockImplementation(async function* () {
      yield {
        type: TAG_RESULT,
        data: {
          result: 'Plain text response',
          debug: {
            request: {
              method: 'POST',
            },
          },
          messages: [],
        },
      }
    })

    render(<SkillsetAbilityTester {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Execute' }))

    await waitFor(() => {
      expect(screen.getByText('Data')).toBeInTheDocument()
    })

    expect(screen.getByTestId('code-block')).toHaveTextContent(
      'Plain text response'
    )
  })

  it('should unpack nested result envelopes that include debug metadata', async () => {
    mockFetch.mockResolvedValue({ error: null, data: 'stream-body' })
    mockJsonl.mockImplementation(async function* () {
      yield {
        type: TAG_RESULT,
        data: {
          result: {
            result: {
              data: [{ id: 'object-1', api_slug: 'companies' }],
            },
            debug: {
              request: {
                method: 'GET',
                url: 'https://api.attio.com/v2/objects',
              },
              response: {
                status: 200,
              },
            },
          },
          messages: [],
        },
      }
    })

    render(<SkillsetAbilityTester {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Execute' }))

    await waitFor(() => {
      expect(screen.getByText('Data')).toBeInTheDocument()
    })

    expect(screen.getByText('Debug')).toBeInTheDocument()
    expect(screen.getByTestId('object-view')).toHaveTextContent(
      '"api_slug":"companies"'
    )
    expect(screen.getByTestId('object-view')).not.toHaveTextContent(
      'api.attio.com'
    )

    fireEvent.click(screen.getByText('Debug'))

    await waitFor(() => {
      expect(screen.getByTestId('object-view')).toHaveTextContent(
        'api.attio.com/v2/objects'
      )
    })
  })
})

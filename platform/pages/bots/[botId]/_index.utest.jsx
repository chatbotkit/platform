import { Form } from './index'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockFetch = jest.fn()
const mockPush = jest.fn()
let mockScope = null
let mockFormData = {}

jest.mock('@/config/bots', () => ({
  defaultBackstory: 'Default backstory',
}))

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/prisma/enums', () => ({
  BotVisibility: {
    private: 'Private',
    protected: 'Protected',
    public: 'Public',
  },
}))

jest.mock('@/lib/form', () => ({
  formToData: jest.fn(() => mockFormData),
}))
jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/lib/solution', () => ({ withBotResources: jest.fn(() => ({})) }))
jest.mock('@/lib/struct', () => ({ makeJsonSafe: jest.fn((value) => value) }))

jest.mock(
  '@/layouts/Dashboard',
  () =>
    function Dashboard({ children }) {
      return <div>{children}</div>
    }
)

jest.mock(
  '@/components/BackstoryInput',
  () =>
    function BackstoryInput(props) {
      return <textarea {...props} />
    }
)
jest.mock(
  '@/components/BotBlockStatus',
  () =>
    function BotBlockStatus() {
      return null
    }
)
jest.mock(
  '@/components/BotInsights',
  () =>
    function BotInsights() {
      return null
    }
)
jest.mock(
  '@/components/CodeAction',
  () =>
    function CodeAction() {
      return null
    }
)

const mockConfirm = jest.fn()
const mockConfirmDelete = jest.fn()

jest.mock('@/components/Confirm', () => ({
  useConfirm: () => mockConfirm,
  useConfirmDelete: () => mockConfirmDelete,
}))

jest.mock(
  '@/components/ConversationManager',
  () =>
    function ConversationManager() {
      return null
    }
)
jest.mock(
  '@/components/DatasetSelect',
  () =>
    function DatasetSelect(props) {
      return <select {...props} />
    }
)
jest.mock(
  '@/components/EventLog',
  () =>
    function EventLog() {
      return null
    }
)
jest.mock(
  '@/components/Expando',
  () =>
    function Expando({ children }) {
      return <div>{children}</div>
    }
)
jest.mock(
  '@/components/FAQ',
  () =>
    function FAQ() {
      return null
    }
)
jest.mock(
  '@/components/GeneralBasicOptions',
  () =>
    function GeneralBasicOptions() {
      return <div data-testid="general-basic-options" />
    }
)
jest.mock(
  '@/components/Headline',
  () =>
    function Headline({ children }) {
      return <div>{children}</div>
    }
)
jest.mock(
  '@/components/HubOptions',
  () =>
    function HubOptions() {
      return null
    }
)
jest.mock(
  '@/components/LanguageModelSelect',
  () =>
    function LanguageModelSelect(props) {
      return <select {...props} />
    }
)
jest.mock(
  '@/components/Link',
  () =>
    function Link({ children, href, ...props }) {
      return (
        <a href={href} {...props}>
          {children}
        </a>
      )
    }
)
jest.mock(
  '@/components/MemoryList',
  () =>
    function MemoryList() {
      return null
    }
)
jest.mock(
  '@/components/MetaInput',
  () =>
    function MetaInput() {
      return null
    }
)
jest.mock(
  '@/components/PageSections',
  () =>
    function PageSections({ children }) {
      return <div>{children}</div>
    }
)
jest.mock(
  '@/components/SkillsetSelect',
  () =>
    function SkillsetSelect(props) {
      return <select {...props} />
    }
)
jest.mock(
  '@/components/ThisSolution',
  () =>
    function ThisSolution() {
      return null
    }
)
jest.mock(
  '@/components/Toggle',
  () =>
    function Toggle(props) {
      return <input type="checkbox" {...props} />
    }
)
jest.mock('@/components/WebhookSetupSection', () => ({
  Multi: function WebhookSetupSectionMulti() {
    return null
  },
}))

jest.mock('@/hooks/useExternalAPIURL', () => jest.fn(() => (path) => path))
jest.mock('@/hooks/useFetch', () =>
  jest.fn(() => ({
    code: null,
    fetch: mockFetch,
  }))
)
jest.mock('@/hooks/useProjectScope', () =>
  jest.fn(() => ({
    scope: mockScope,
  }))
)
jest.mock('@/hooks/useRouter', () =>
  jest.fn(() => ({
    push: mockPush,
  }))
)

jest.mock('@/content/faqs/platform-bot-instance.yaml', () => ({}))
jest.mock('@/components/IntegrationList', () => {
  return function IntegrationList() {
    return null
  }
})

function buildBot(overrides = {}) {
  return {
    name: null,
    description: null,
    backstory: 'Backstory',
    model: null,
    datasetId: null,
    skillsetId: null,
    alias: null,
    privacy: false,
    moderation: false,
    visibility: 'private',
    meta: null,
    ...overrides,
  }
}

describe('Bot Form', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockScope = null
    mockFormData = { name: 'Scoped Bot' }
    mockFetch.mockResolvedValue({ error: null, data: { id: 'bot_123' } })
  })

  it('adds the active project scope when creating a bot', async () => {
    mockScope = { id: 'blueprint_123', name: 'Project' }

    render(<Form bot={buildBot()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/bot/create', {
        data: {
          name: 'Scoped Bot',
          blueprintId: 'blueprint_123',
        },
        successMessage: 'Bot created.',
      })
    })

    expect(mockPush).toHaveBeenCalledWith('/bots/bot_123')
  })

  it('keeps an explicit blueprintId when one is already present', async () => {
    mockScope = { id: 'blueprint_scope', name: 'Project' }
    mockFormData = { name: 'Explicit Bot', blueprintId: 'blueprint_explicit' }

    render(<Form bot={buildBot()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/bot/create',
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'blueprint_explicit',
          }),
        })
      )
    })
  })
})

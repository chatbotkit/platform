import { Form } from './index'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/config/execution', () => ({
  DEFAULT_LIMITS: {
    maxIterations: 100,
    maxTime: 3600000,
  },
  PLATFORM_LIMITS: {
    minIterations: 1,
    maxIterations: 100,
    minTime: 900000,
    maxTime: 86400000,
  },
}))

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/lib/form', () => ({ formToData: jest.fn(() => ({})) }))
jest.mock('@/lib/session.get', () => ({ getSoftSession: jest.fn() }))
jest.mock('@/lib/struct', () => ({ makeJsonSafe: jest.fn((value) => value) }))
jest.mock('@/lib/toast', () => ({
  loading: jest.fn(() => 'toast-id'),
  error: jest.fn(),
}))

jest.mock(
  '@/layouts/Dashboard',
  () =>
    function Dashboard({ children }) {
      return <div>{children}</div>
    }
)

jest.mock(
  '@/components/BotSelect',
  () =>
    function BotSelect(props) {
      return <select {...props} />
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
  '@/components/ContactSelect',
  () =>
    function ContactSelect(props) {
      return <select {...props} />
    }
)
jest.mock(
  '@/components/ConversationList',
  () =>
    function ConversationList() {
      return null
    }
)
jest.mock(
  '@/components/DurationSelect',
  () =>
    function DurationSelect(props) {
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
  '@/components/MetaInput',
  () =>
    function MetaInput() {
      return <div data-testid="meta-input" />
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
  '@/components/ScheduleSelect',
  () =>
    function ScheduleSelect(props) {
      return <select {...props} />
    }
)
jest.mock(
  '@/components/TaskExecutionList',
  () =>
    function TaskExecutionList() {
      return null
    }
)
jest.mock(
  '@/components/ThisSolution',
  () =>
    function ThisSolution() {
      return null
    }
)

jest.mock('@/hooks/useFetch', () =>
  jest.fn(() => ({
    code: null,
    fetch: jest.fn(),
  }))
)
jest.mock('@/hooks/useRouter', () => jest.fn(() => ({ push: jest.fn() })))

jest.mock('@/content/faqs/platform-task-instance.yaml', () => ({}))

function buildTask(overrides = {}) {
  return {
    id: 'task_123',
    name: 'Test Task',
    description: 'Description',
    status: 'idle',
    contactId: null,
    botId: null,
    schedule: null,
    sessionDuration: null,
    maxIterations: null,
    maxTime: null,
    meta: {},
    ...overrides,
  }
}

describe('Task Form', () => {
  it('disables Cancel Task when the task is not running', () => {
    render(<Form task={buildTask({ status: 'idle' })} />)

    expect(screen.getByRole('button', { name: 'Cancel Task' })).toBeDisabled()
  })

  it('enables Cancel Task when the task is running', () => {
    render(<Form task={buildTask({ status: 'running' })} />)

    expect(screen.getByRole('button', { name: 'Cancel Task' })).toBeEnabled()
  })
})

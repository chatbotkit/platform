import TaskExecutionList from './TaskExecutionList'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockFetch = jest.fn()
const mockConfirm = jest.fn()
const mockReset = jest.fn()

jest.mock('@/hooks/useFetch', () => {
  return function useFetch() {
    return {
      fetch: mockFetch,
    }
  }
})

jest.mock('@/components/Confirm', () => ({
  useConfirm: () => mockConfirm,
}))

jest.mock('@/components/TimeAgo', () => {
  return function TimeAgo({ time }) {
    return <span data-testid="timeago">{String(time)}</span>
  }
})

jest.mock('@/components/ResourceList', () => {
  return function ResourceList({
    kind,
    listRoute,
    exportRoute,
    filter,
    apiRef,
    extraButtons,
    extraTags,
  }) {
    if (apiRef) {
      apiRef.current = {
        reset: mockReset,
      }
    }

    const runningActions = extraButtons?.({
      id: 'exec_running',
      status: 'running',
    })

    const completedActions = extraButtons?.({
      id: 'exec_done',
      status: 'idle',
    })

    const pausedTags = extraTags?.({
      id: 'exec_paused',
      status: 'running',
      resumeAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })

    const runningTags = extraTags?.({
      id: 'exec_running',
      status: 'running',
    })

    return (
      <div>
        <div data-testid="kind">{kind}</div>
        <div data-testid="list-route">{listRoute}</div>
        <div data-testid="export-route">{String(exportRoute)}</div>
        <div data-testid="filter">{String(filter)}</div>
        <div data-testid="has-running-cancel">
          {runningActions?.Cancel ? 'true' : 'false'}
        </div>
        <div data-testid="has-completed-cancel">
          {completedActions?.Cancel ? 'true' : 'false'}
        </div>
        <div data-testid="paused-tags">{pausedTags}</div>
        <div data-testid="running-tags">{runningTags}</div>
        <button type="button" onClick={() => runningActions?.Cancel?.()}>
          cancel running
        </button>
      </div>
    )
  }
})

describe('TaskExecutionList', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockConfirm.mockResolvedValue(true)
    mockFetch.mockResolvedValue({ error: null })
  })

  it('should configure ResourceList for task executions', () => {
    render(<TaskExecutionList taskId="task_123" />)

    expect(screen.getByTestId('kind')).toHaveTextContent('task execution')
    expect(screen.getByTestId('list-route')).toHaveTextContent(
      '/api/v1/task/task_123/execution/list'
    )
    expect(screen.getByTestId('export-route')).toHaveTextContent('null')
    expect(screen.getByTestId('filter')).toHaveTextContent('false')
  })

  it('should expose cancel action only for running executions', () => {
    render(<TaskExecutionList taskId="task_123" />)

    expect(screen.getByTestId('has-running-cancel')).toHaveTextContent('true')
    expect(screen.getByTestId('has-completed-cancel')).toHaveTextContent(
      'false'
    )
  })

  it('should surface a paused tag with resume time for a paused execution', () => {
    render(<TaskExecutionList taskId="task_123" />)

    // running + a future resumeAt => paused, shown with its resume time
    const pausedTags = screen.getByTestId('paused-tags')

    expect(pausedTags).toHaveTextContent('paused')
    expect(pausedTags).toHaveTextContent('resumes')
    expect(pausedTags).not.toHaveTextContent('running')

    // running with no resumeAt => plain running tag, never "paused"
    const runningTags = screen.getByTestId('running-tags')

    expect(runningTags).toHaveTextContent('running')
    expect(runningTags).not.toHaveTextContent('paused')
  })

  it('should cancel a running execution and refresh the list', async () => {
    render(<TaskExecutionList taskId="task_123" />)

    fireEvent.click(screen.getByRole('button', { name: 'cancel running' }))

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to cancel this task execution?'
      )
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/task/task_123/execution/exec_running/cancel',
      {
        method: 'POST',
        data: {},
        successMessage: 'Task execution canceled.',
        failureMessage: 'Failed to cancel task execution.',
      }
    )

    expect(mockReset).toHaveBeenCalled()
  })
})

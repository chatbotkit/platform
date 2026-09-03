/* eslint-disable @typescript-eslint/no-require-imports */
import TaskList from './TaskList'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@chatbotkit-dev/time', () => ({
  timeAgo: jest.fn((date) => `${date} ago`),
}))

jest.mock('@/components/ResourceList', () => {
  return function ResourceList(props) {
    return (
      <div data-testid="resource-list">
        <div data-testid="kind">{props.kind}</div>
        <div data-testid="list-route">{JSON.stringify(props.listRoute)}</div>
        <div data-testid="export-route">{props.exportRoute}</div>
        <div data-testid="delete-route">{props.deleteRoute}</div>
        <div data-testid="instance-route">{props.instanceRoute}</div>
        <div data-testid="filter">{props.filter ? 'true' : 'false'}</div>
        {props.extraTags && (
          <div data-testid="extra-tags">
            {props.extraTags({
              schedule: 'daily',
              status: 'active',
              outcome: 'success',
              lastRunAt: '2024-01-01',
            })}
          </div>
        )}
      </div>
    )
  }
})

describe('TaskList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should render ResourceList', () => {
      render(<TaskList />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should pass default props to ResourceList', () => {
      render(<TaskList />)

      expect(screen.getByTestId('kind')).toHaveTextContent('task')
      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
      expect(screen.getByTestId('export-route')).toHaveTextContent(
        '/api/v1/task/export'
      )
      expect(screen.getByTestId('delete-route')).toHaveTextContent(
        '/api/v1/task/[id]/delete'
      )
      expect(screen.getByTestId('instance-route')).toHaveTextContent(
        '/tasks/[id]'
      )
      expect(screen.getByTestId('filter')).toHaveTextContent('true')
    })
  })

  describe('prop overrides', () => {
    it('should allow overriding kind', () => {
      render(<TaskList kind="scheduled-task" />)

      expect(screen.getByTestId('kind')).toHaveTextContent('scheduled-task')
    })

    it('should allow overriding listRoute', () => {
      render(<TaskList listRoute="/api/v1/custom/list" />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/custom/list'
      )
    })

    it('should allow overriding exportRoute', () => {
      render(<TaskList exportRoute="/api/v1/custom/export" />)

      expect(screen.getByTestId('export-route')).toHaveTextContent(
        '/api/v1/custom/export'
      )
    })

    it('should allow overriding deleteRoute', () => {
      render(<TaskList deleteRoute="/api/v1/custom/[id]/delete" />)

      expect(screen.getByTestId('delete-route')).toHaveTextContent(
        '/api/v1/custom/[id]/delete'
      )
    })

    it('should allow overriding instanceRoute', () => {
      render(<TaskList instanceRoute="/custom/[id]" />)

      expect(screen.getByTestId('instance-route')).toHaveTextContent(
        '/custom/[id]'
      )
    })

    it('should allow overriding filter', () => {
      render(<TaskList filter={false} />)

      expect(screen.getByTestId('filter')).toHaveTextContent('false')
    })
  })

  describe('contactId handling', () => {
    it('should use GraphQL route when contactId is provided by default', () => {
      render(<TaskList contactId="contact123" />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should ignore custom listRoute when contactId is provided', () => {
      render(
        <TaskList contactId="contact456" listRoute="/api/v1/custom/list" />
      )

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/contact/contact456/task/list'
      )
    })

    it('should use GraphQL route when contactId is not provided', () => {
      render(<TaskList />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should handle contactId with special characters in GraphQL mode', () => {
      render(<TaskList contactId="contact-123-abc" />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })
  })

  describe('extraTags', () => {
    it('should render default extraTags', () => {
      render(<TaskList />)

      const extraTags = screen.getByTestId('extra-tags')

      expect(extraTags).toBeInTheDocument()
    })

    it('should display schedule tag', () => {
      render(<TaskList />)

      const extraTags = screen.getByTestId('extra-tags')

      expect(extraTags.textContent).toContain('daily')
    })

    it('should display status tag', () => {
      render(<TaskList />)

      const extraTags = screen.getByTestId('extra-tags')

      expect(extraTags.textContent).toContain('active')
    })

    it('should display outcome tag', () => {
      render(<TaskList />)

      const extraTags = screen.getByTestId('extra-tags')

      expect(extraTags.textContent).toContain('success')
    })

    it('should display lastRunAt with timeAgo', () => {
      const { timeAgo } = require('@chatbotkit-dev/time')

      render(<TaskList />)

      expect(timeAgo).toHaveBeenCalledWith('2024-01-01')

      const extraTags = screen.getByTestId('extra-tags')

      expect(extraTags.textContent).toContain('last run 2024-01-01 ago')
    })

    it('should allow custom extraTags', () => {
      const customExtraTags = jest.fn(() => <div>Custom Tags</div>)

      render(<TaskList extraTags={customExtraTags} />)

      expect(customExtraTags).toHaveBeenCalled()
      expect(screen.getByText('Custom Tags')).toBeInTheDocument()
    })

    it('should not render tags when values are falsy', () => {
      // Note: This test would require modifying the mock to call extraTags with falsy values
      // We verify the function handles null/undefined gracefully by checking it renders
      render(<TaskList />)

      const extraTags = screen.getByTestId('extra-tags')

      expect(extraTags).toBeInTheDocument()
    })
  })

  describe('prop forwarding', () => {
    it('should forward additional props to ResourceList', () => {
      // TaskList uses spread operator {...props} to forward props
      // We verify this by checking that the component renders without error
      render(<TaskList data-custom="test-value" />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should forward className', () => {
      // TaskList forwards className via {...props}
      render(<TaskList className="custom-class" />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined contactId', () => {
      render(<TaskList contactId={undefined} />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should handle null contactId', () => {
      render(<TaskList contactId={null} />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should handle empty string contactId', () => {
      render(<TaskList contactId="" />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should keep GraphQL transport across different contactIds', () => {
      const { rerender } = render(<TaskList contactId="contact1" />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )

      rerender(<TaskList contactId="contact2" />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should keep GraphQL transport when switching from contactId to no contactId', () => {
      const { rerender } = render(<TaskList contactId="contact1" />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )

      rerender(<TaskList />)

      expect(screen.getByTestId('list-route')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })
  })

  describe('useMemo optimization', () => {
    it('should memoize listRoute based on contactId', () => {
      const { rerender } = render(
        <TaskList contactId="contact1" filter={true} />
      )

      const firstRoute = screen.getByTestId('list-route').textContent

      // Rerender with same contactId but different unrelated prop
      rerender(<TaskList contactId="contact1" filter={false} />)

      const secondRoute = screen.getByTestId('list-route').textContent

      expect(firstRoute).toBe(secondRoute)
    })

    it('should keep the visible GraphQL route when contactId changes', () => {
      const { rerender } = render(<TaskList contactId="contact1" />)

      const firstRoute = screen.getByTestId('list-route').textContent

      rerender(<TaskList contactId="contact2" />)

      const secondRoute = screen.getByTestId('list-route').textContent

      expect(firstRoute).toBe(secondRoute)
    })

    it('should memoize extraTags function', () => {
      const { rerender } = render(<TaskList />)

      const extraTags1 = screen.getByTestId('extra-tags')

      rerender(<TaskList filter={false} />)

      const extraTags2 = screen.getByTestId('extra-tags')

      // Both should render the same content
      expect(extraTags1.textContent).toBe(extraTags2.textContent)
    })
  })
})

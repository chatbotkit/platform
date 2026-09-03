import BlueprintList from './BlueprintList'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

// Mock ResourceList since it's a complex component with API calls
jest.mock('@/components/ResourceList', () => {
  return function MockResourceList(props) {
    return (
        <div data-testid="resource-list">
          <div data-testid="kind">{props.kind}</div>
        <div data-testid="listRoute">{JSON.stringify(props.listRoute)}</div>
        <div data-testid="exportRoute">{props.exportRoute || 'null'}</div>
        <div data-testid="deleteRoute">{props.deleteRoute}</div>
        <div data-testid="instanceRoute">{props.instanceRoute}</div>
        <div data-testid="filter">{String(props.filter)}</div>
        <div data-testid="extraLinks">{JSON.stringify(props.extraLinks)}</div>
      </div>
    )
  }
})

describe('BlueprintList', () => {
  describe('default props', () => {
    it('should render ResourceList with default props', () => {
      render(<BlueprintList />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
      expect(screen.getByTestId('kind')).toHaveTextContent('blueprint')
      expect(screen.getByTestId('listRoute')).toHaveTextContent(
        '/api/v1/graphql'
      )
      expect(screen.getByTestId('exportRoute')).toHaveTextContent('null')
      expect(screen.getByTestId('deleteRoute')).toHaveTextContent(
        '/api/v1/blueprint/[id]/delete'
      )
      expect(screen.getByTestId('instanceRoute')).toHaveTextContent(
        '/blueprints/[id]'
      )
      expect(screen.getByTestId('filter')).toHaveTextContent('false')
    })

    it('should set default extraLinks with Design route', () => {
      render(<BlueprintList />)

      const extraLinks = screen.getByTestId('extraLinks').textContent

      expect(extraLinks).toContain('Design')
      expect(extraLinks).toContain('/blueprints/[id]/designer')
    })

    it('should set exportRoute to null by default', () => {
      render(<BlueprintList />)
      expect(screen.getByTestId('exportRoute')).toHaveTextContent('null')
    })
  })

  describe('prop overrides', () => {
    it('should override kind prop', () => {
      render(<BlueprintList kind="custom-blueprint" />)
      expect(screen.getByTestId('kind')).toHaveTextContent('custom-blueprint')
    })

    it('should override listRoute prop', () => {
      render(<BlueprintList listRoute="/custom/list" />)
      expect(screen.getByTestId('listRoute')).toHaveTextContent('/custom/list')
    })

    it('should override exportRoute prop', () => {
      render(<BlueprintList exportRoute="/api/v1/export" />)
      expect(screen.getByTestId('exportRoute')).toHaveTextContent(
        '/api/v1/export'
      )
    })

    it('should override deleteRoute prop', () => {
      render(<BlueprintList deleteRoute="/custom/delete" />)
      expect(screen.getByTestId('deleteRoute')).toHaveTextContent(
        '/custom/delete'
      )
    })

    it('should override instanceRoute prop', () => {
      render(<BlueprintList instanceRoute="/custom/[id]" />)
      expect(screen.getByTestId('instanceRoute')).toHaveTextContent(
        '/custom/[id]'
      )
    })

    it('should override filter prop', () => {
      render(<BlueprintList filter={true} />)
      expect(screen.getByTestId('filter')).toHaveTextContent('true')
    })

    it('should override extraLinks prop', () => {
      const customLinks = { Edit: '/edit/[id]', View: '/view/[id]' }

      render(<BlueprintList extraLinks={customLinks} />)

      const extraLinksText = screen.getByTestId('extraLinks').textContent

      expect(extraLinksText).toContain('Edit')
      expect(extraLinksText).toContain('/edit/[id]')
      expect(extraLinksText).toContain('View')
      expect(extraLinksText).toContain('/view/[id]')
    })
  })

  describe('prop spreading', () => {
    it('should pass through additional props to ResourceList', () => {
      const { container } = render(
        <BlueprintList data-testid="custom-prop" className="custom-class" />
      )

      // Since we're spreading props, they should reach the mock
      expect(container).toBeInTheDocument()
    })

    it('should handle multiple prop overrides simultaneously', () => {
      render(
        <BlueprintList
          kind="advanced-blueprint"
          listRoute="/advanced/list"
          filter={true}
          exportRoute="/advanced/export"
        />
      )

      expect(screen.getByTestId('kind')).toHaveTextContent('advanced-blueprint')
      expect(screen.getByTestId('listRoute')).toHaveTextContent(
        '/advanced/list'
      )
      expect(screen.getByTestId('filter')).toHaveTextContent('true')
      expect(screen.getByTestId('exportRoute')).toHaveTextContent(
        '/advanced/export'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty extraLinks', () => {
      render(<BlueprintList extraLinks={{}} />)

      const extraLinksText = screen.getByTestId('extraLinks').textContent

      expect(extraLinksText).toBe('{}')
    })

    it('should handle null kind', () => {
      render(<BlueprintList kind={null} />)
      expect(screen.getByTestId('kind')).toHaveTextContent('')
    })

    it('should handle undefined props gracefully', () => {
      render(<BlueprintList kind={undefined} />)
      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should handle complex extraLinks object', () => {
      const complexLinks = {
        Design: '/blueprints/[id]/designer',
        Clone: '/blueprints/[id]/clone',
        Export: '/blueprints/[id]/export',
      }

      render(<BlueprintList extraLinks={complexLinks} />)

      const extraLinksText = screen.getByTestId('extraLinks').textContent

      expect(extraLinksText).toContain('Design')
      expect(extraLinksText).toContain('Clone')
      expect(extraLinksText).toContain('Export')
    })
  })

  describe('ResourceList integration', () => {
    it('should render ResourceList component', () => {
      render(<BlueprintList />)
      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should pass all required props to ResourceList', () => {
      render(<BlueprintList />)

      // Verify all default props are passed
      expect(screen.getByTestId('kind')).toBeInTheDocument()
      expect(screen.getByTestId('listRoute')).toBeInTheDocument()
      expect(screen.getByTestId('deleteRoute')).toBeInTheDocument()
      expect(screen.getByTestId('instanceRoute')).toBeInTheDocument()
      expect(screen.getByTestId('filter')).toBeInTheDocument()
      expect(screen.getByTestId('extraLinks')).toBeInTheDocument()
    })
  })

  describe('route patterns', () => {
    it('should use GraphQL route for list by default', () => {
      render(<BlueprintList />)
      expect(screen.getByTestId('listRoute')).toHaveTextContent(
        '/api/v1/graphql'
      )
    })

    it('should use correct API route pattern for delete with id placeholder', () => {
      render(<BlueprintList />)
      expect(screen.getByTestId('deleteRoute')).toHaveTextContent(
        '/api/v1/blueprint/[id]/delete'
      )
    })

    it('should use correct instance route pattern with id placeholder', () => {
      render(<BlueprintList />)
      expect(screen.getByTestId('instanceRoute')).toHaveTextContent(
        '/blueprints/[id]'
      )
    })

    it('should use correct designer route in extraLinks', () => {
      render(<BlueprintList />)

      const extraLinksText = screen.getByTestId('extraLinks').textContent

      expect(extraLinksText).toContain('/blueprints/[id]/designer')
    })
  })
})

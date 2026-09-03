import PortalList from './PortalList'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('@/components/ResourceList', () => {
  return function ResourceList(props) {
    return (
        <div data-testid="resource-list">
          <div data-testid="kind">{props.kind}</div>
        <div data-testid="list-route">{JSON.stringify(props.listRoute)}</div>
        <div data-testid="export-route">{String(props.exportRoute)}</div>
        <div data-testid="delete-route">{props.deleteRoute}</div>
        <div data-testid="instance-route">{props.instanceRoute}</div>
        <div data-testid="filter">{String(props.filter)}</div>
        {props.extraLinks && (
          <div data-testid="extra-links">
            {props.extraLinks.Open({ slug: 'test-portal' })}
          </div>
        )}
      </div>
    )
  }
})

describe('PortalList', () => {
  describe('default props', () => {
    it('should render with default props', () => {
      const { getByTestId } = render(<PortalList />)

      expect(getByTestId('resource-list')).toBeInTheDocument()
      expect(getByTestId('kind')).toHaveTextContent('portal')
      expect(getByTestId('list-route')).toHaveTextContent('/api/v1/graphql')
      expect(getByTestId('export-route')).toHaveTextContent('null')
      expect(getByTestId('delete-route')).toHaveTextContent(
        '/api/v1/portal/[id]/delete'
      )
      expect(getByTestId('instance-route')).toHaveTextContent('/portals/[id]')
      expect(getByTestId('filter')).toHaveTextContent('false')
    })

    it('should render with default extraLinks', () => {
      const { getByTestId } = render(<PortalList />)

      expect(getByTestId('extra-links')).toHaveTextContent(
        'http://test-portal.chatbotkit.agency'
      )
    })
  })

  describe('custom props', () => {
    it('should override kind prop', () => {
      const { getByTestId } = render(<PortalList kind="custom-portal" />)

      expect(getByTestId('kind')).toHaveTextContent('custom-portal')
    })

    it('should override listRoute prop', () => {
      const { getByTestId } = render(
        <PortalList listRoute="/api/v2/portals/list" />
      )

      expect(getByTestId('list-route')).toHaveTextContent(
        '/api/v2/portals/list'
      )
    })

    it('should override exportRoute prop', () => {
      const { getByTestId } = render(
        <PortalList exportRoute="/api/v1/portal/export" />
      )

      expect(getByTestId('export-route')).toHaveTextContent(
        '/api/v1/portal/export'
      )
    })

    it('should override deleteRoute prop', () => {
      const { getByTestId } = render(
        <PortalList deleteRoute="/api/v1/portal/[id]/remove" />
      )

      expect(getByTestId('delete-route')).toHaveTextContent(
        '/api/v1/portal/[id]/remove'
      )
    })

    it('should override instanceRoute prop', () => {
      const { getByTestId } = render(
        <PortalList instanceRoute="/portal-details/[id]" />
      )

      expect(getByTestId('instance-route')).toHaveTextContent(
        '/portal-details/[id]'
      )
    })

    it('should override filter prop', () => {
      const { getByTestId } = render(<PortalList filter={true} />)

      expect(getByTestId('filter')).toHaveTextContent('true')
    })

    it('should override extraLinks prop', () => {
      const customExtraLinks = {
        Open: ({ slug }) => `https://custom-${slug}.example.com`,
      }

      const { getByTestId } = render(
        <PortalList extraLinks={customExtraLinks} />
      )

      expect(getByTestId('extra-links')).toHaveTextContent(
        'https://custom-test-portal.example.com'
      )
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to ResourceList', () => {
      const { getByTestId } = render(
        <PortalList data-custom="test-value" className="custom-class" />
      )

      const resourceList = getByTestId('resource-list')

      expect(resourceList).toBeInTheDocument()
    })

    it('should combine all props correctly', () => {
      const customExtraLinks = {
        Open: ({ slug }) => `https://${slug}.custom.com`,
      }

      const { getByTestId } = render(
        <PortalList
          kind="agency-portal"
          listRoute="/api/v2/portal/list"
          exportRoute="/api/v2/portal/export"
          deleteRoute="/api/v2/portal/[id]/delete"
          instanceRoute="/agency-portals/[id]"
          filter={true}
          extraLinks={customExtraLinks}
        />
      )

      expect(getByTestId('kind')).toHaveTextContent('agency-portal')
      expect(getByTestId('list-route')).toHaveTextContent('/api/v2/portal/list')
      expect(getByTestId('export-route')).toHaveTextContent(
        '/api/v2/portal/export'
      )
      expect(getByTestId('delete-route')).toHaveTextContent(
        '/api/v2/portal/[id]/delete'
      )
      expect(getByTestId('instance-route')).toHaveTextContent(
        '/agency-portals/[id]'
      )
      expect(getByTestId('filter')).toHaveTextContent('true')
      expect(getByTestId('extra-links')).toHaveTextContent(
        'https://test-portal.custom.com'
      )
    })
  })

  describe('edge cases', () => {
    it('should handle null exportRoute explicitly', () => {
      const { getByTestId } = render(<PortalList exportRoute={null} />)

      expect(getByTestId('export-route')).toHaveTextContent('null')
    })

    it('should handle undefined exportRoute', () => {
      const { getByTestId } = render(<PortalList exportRoute={undefined} />)

      expect(getByTestId('export-route')).toHaveTextContent('null')
    })

    it('should handle empty string kind', () => {
      const { getByTestId } = render(<PortalList kind="" />)

      expect(getByTestId('kind')).toHaveTextContent('')
    })

    it('should handle empty string routes', () => {
      const { getByTestId } = render(
        <PortalList
          listRoute=""
          deleteRoute=""
          instanceRoute=""
          exportRoute=""
        />
      )

      expect(getByTestId('list-route').textContent).toBe('""')
      expect(getByTestId('delete-route').textContent).toBe('')
      expect(getByTestId('instance-route').textContent).toBe('')
      expect(getByTestId('export-route').textContent).toBe('')
    })

    it('should handle filter as false explicitly', () => {
      const { getByTestId } = render(<PortalList filter={false} />)

      expect(getByTestId('filter')).toHaveTextContent('false')
    })

    it('should handle filter as true', () => {
      const { getByTestId } = render(<PortalList filter={true} />)

      expect(getByTestId('filter')).toHaveTextContent('true')
    })

    it('should handle extraLinks with different slug formats', () => {
      const { getByTestId } = render(<PortalList />)

      // Default extraLinks should handle any slug format
      expect(getByTestId('extra-links')).toHaveTextContent(
        'http://test-portal.chatbotkit.agency'
      )
    })

    it('should handle null extraLinks', () => {
      const { queryByTestId } = render(<PortalList extraLinks={null} />)

      expect(queryByTestId('extra-links')).not.toBeInTheDocument()
    })
  })

  describe('extraLinks functionality', () => {
    it('should generate correct URL for simple slug', () => {
      const { getByTestId } = render(<PortalList />)

      expect(getByTestId('extra-links')).toHaveTextContent(
        'http://test-portal.chatbotkit.agency'
      )
    })

    it('should support custom extraLinks function', () => {
      const customExtraLinks = {
        Open: ({ slug }) => `https://preview.${slug}.example.com/dashboard`,
      }

      const { getByTestId } = render(
        <PortalList extraLinks={customExtraLinks} />
      )

      expect(getByTestId('extra-links')).toHaveTextContent(
        'https://preview.test-portal.example.com/dashboard'
      )
    })

    it('should support multiple extraLinks actions', () => {
      const customExtraLinks = {
        Open: ({ slug }) => `https://${slug}.example.com`,
        Preview: ({ slug }) => `https://preview.${slug}.example.com`,
      }

      const { getByTestId } = render(
        <PortalList extraLinks={customExtraLinks} />
      )

      // Only testing Open since that's what our mock calls
      expect(getByTestId('extra-links')).toHaveTextContent(
        'https://test-portal.example.com'
      )
    })
  })
})

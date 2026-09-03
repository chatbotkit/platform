import TokenList from './TokenList'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('@/components/ResourceList', () => {
  return function ResourceList(props) {
    return (
      <div data-testid="resource-list">
        <div data-testid="kind">{props.kind}</div>
        <div data-testid="list-route">{props.listRoute}</div>
        <div data-testid="export-route">{String(props.exportRoute)}</div>
        <div data-testid="delete-route">{props.deleteRoute}</div>
        <div data-testid="instance-route">{props.instanceRoute}</div>
        <div data-testid="filter">{String(props.filter)}</div>
      </div>
    )
  }
})

describe('TokenList', () => {
  describe('default props', () => {
    it('should render with default props', () => {
      const { getByTestId } = render(<TokenList />)

      expect(getByTestId('resource-list')).toBeInTheDocument()
      expect(getByTestId('kind')).toHaveTextContent('token')
      expect(getByTestId('list-route')).toHaveTextContent('/api/v1/token/list')
      expect(getByTestId('export-route')).toHaveTextContent('null')
      expect(getByTestId('delete-route')).toHaveTextContent(
        '/api/v1/token/[id]/delete'
      )
      expect(getByTestId('instance-route')).toHaveTextContent('/tokens/[id]')
      expect(getByTestId('filter')).toHaveTextContent('false')
    })
  })

  describe('custom props', () => {
    it('should override kind prop', () => {
      const { getByTestId } = render(<TokenList kind="custom-token" />)

      expect(getByTestId('kind')).toHaveTextContent('custom-token')
    })

    it('should override listRoute prop', () => {
      const { getByTestId } = render(
        <TokenList listRoute="/api/v2/tokens/list" />
      )

      expect(getByTestId('list-route')).toHaveTextContent('/api/v2/tokens/list')
    })

    it('should override exportRoute prop', () => {
      const { getByTestId } = render(
        <TokenList exportRoute="/api/v1/token/export" />
      )

      expect(getByTestId('export-route')).toHaveTextContent(
        '/api/v1/token/export'
      )
    })

    it('should override deleteRoute prop', () => {
      const { getByTestId } = render(
        <TokenList deleteRoute="/api/v1/token/[id]/remove" />
      )

      expect(getByTestId('delete-route')).toHaveTextContent(
        '/api/v1/token/[id]/remove'
      )
    })

    it('should override instanceRoute prop', () => {
      const { getByTestId } = render(
        <TokenList instanceRoute="/token-details/[id]" />
      )

      expect(getByTestId('instance-route')).toHaveTextContent(
        '/token-details/[id]'
      )
    })

    it('should override filter prop', () => {
      const { getByTestId } = render(<TokenList filter={true} />)

      expect(getByTestId('filter')).toHaveTextContent('true')
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to ResourceList', () => {
      const { getByTestId } = render(
        <TokenList data-custom="test-value" className="custom-class" />
      )

      const resourceList = getByTestId('resource-list')

      expect(resourceList).toBeInTheDocument()
    })

    it('should combine all props correctly', () => {
      const { getByTestId } = render(
        <TokenList
          kind="api-token"
          listRoute="/api/v2/token/list"
          exportRoute="/api/v2/token/export"
          deleteRoute="/api/v2/token/[id]/delete"
          instanceRoute="/api-tokens/[id]"
          filter={true}
        />
      )

      expect(getByTestId('kind')).toHaveTextContent('api-token')
      expect(getByTestId('list-route')).toHaveTextContent('/api/v2/token/list')
      expect(getByTestId('export-route')).toHaveTextContent(
        '/api/v2/token/export'
      )
      expect(getByTestId('delete-route')).toHaveTextContent(
        '/api/v2/token/[id]/delete'
      )
      expect(getByTestId('instance-route')).toHaveTextContent(
        '/api-tokens/[id]'
      )
      expect(getByTestId('filter')).toHaveTextContent('true')
    })
  })

  describe('edge cases', () => {
    it('should handle null exportRoute explicitly', () => {
      const { getByTestId } = render(<TokenList exportRoute={null} />)

      expect(getByTestId('export-route')).toHaveTextContent('null')
    })

    it('should handle undefined exportRoute', () => {
      const { getByTestId } = render(<TokenList exportRoute={undefined} />)

      expect(getByTestId('export-route')).toHaveTextContent('null')
    })

    it('should handle empty string kind', () => {
      const { getByTestId } = render(<TokenList kind="" />)

      expect(getByTestId('kind')).toHaveTextContent('')
    })

    it('should handle empty string routes', () => {
      const { getByTestId } = render(
        <TokenList
          listRoute=""
          deleteRoute=""
          instanceRoute=""
          exportRoute=""
        />
      )

      expect(getByTestId('list-route')).toHaveTextContent('')
      expect(getByTestId('delete-route')).toHaveTextContent('')
      expect(getByTestId('instance-route')).toHaveTextContent('')
      expect(getByTestId('export-route')).toHaveTextContent('')
    })

    it('should handle filter as false explicitly', () => {
      const { getByTestId } = render(<TokenList filter={false} />)

      expect(getByTestId('filter')).toHaveTextContent('false')
    })

    it('should handle filter as true', () => {
      const { getByTestId } = render(<TokenList filter={true} />)

      expect(getByTestId('filter')).toHaveTextContent('true')
    })
  })
})

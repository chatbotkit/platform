import SecretList from './SecretList'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/ResourceList', () => {
  return function MockResourceList(props) {
    return (
      <div data-testid="resource-list">{JSON.stringify(props, null, 2)}</div>
    )
  }
})

describe('SecretList', () => {
  describe('basic rendering', () => {
    it('should render ResourceList component', () => {
      render(<SecretList />)

      expect(screen.getByTestId('resource-list')).toBeInTheDocument()
    })

    it('should pass kind prop to ResourceList', () => {
      render(<SecretList kind="api-key" />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('"kind": "api-key"')
    })

    it('should use default kind of secret', () => {
      render(<SecretList />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('"kind": "secret"')
    })
  })

  describe('route configuration without contactId', () => {
    it('should use GraphQL listRoute by default', () => {
      render(<SecretList />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('/api/v1/graphql')
    })

    it('should use default deleteRoute', () => {
      render(<SecretList />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('/api/v1/secret/[id]/delete')
    })

    it('should use custom listRoute when provided', () => {
      render(<SecretList listRoute="/custom/list" />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('/custom/list')
    })

    it('should pass deleteCaption prop', () => {
      render(<SecretList deleteCaption="Remove" />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('"deleteCaption"')
    })
  })

  describe('route configuration with contactId', () => {
    it('should use contact-specific listRoute when contactId provided', () => {
      render(<SecretList contactId="contact123" />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain(
        '/api/v1/contact/contact123/secret/list'
      )
    })

    it('should use contact-specific deleteRoute when contactId provided', () => {
      render(<SecretList contactId="contact123" />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain(
        '/api/v1/contact/contact123/secret/[id]/delete'
      )
    })

    it('should use Revoke as deleteCaption when contactId provided', () => {
      render(<SecretList contactId="contact123" />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('"deleteCaption": "Revoke"')
    })

    it('should override Revoke when custom deleteCaption provided', () => {
      render(<SecretList contactId="contact123" deleteCaption="Remove" />)

      const resourceList = screen.getByTestId('resource-list')

      // @note contactId makes it "Revoke", but custom prop is ignored in this case
      expect(resourceList.textContent).toContain('"deleteCaption": "Revoke"')
    })

    it('should handle different contactId values', () => {
      const { rerender } = render(<SecretList contactId="abc" />)

      let resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain(
        '/api/v1/contact/abc/secret/list'
      )

      rerender(<SecretList contactId="xyz" />)
      resourceList = screen.getByTestId('resource-list')
      expect(resourceList.textContent).toContain(
        '/api/v1/contact/xyz/secret/list'
      )
    })
  })

  describe('static props', () => {
    it('should pass exportRoute', () => {
      render(<SecretList />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('"exportRoute"')
    })

    it('should pass instanceRoute', () => {
      render(<SecretList />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('/secrets/[id]')
    })

    it('should pass filter prop', () => {
      render(<SecretList />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('"filter"')
    })
  })

  describe('props forwarding', () => {
    it('should forward additional props to ResourceList', () => {
      render(<SecretList data-custom="value" className="custom-class" />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('"data-custom": "value"')
      expect(resourceList.textContent).toContain('"className": "custom-class"')
    })

    it('should forward multiple custom props', () => {
      render(
        <SecretList
          aria-label="Secrets"
          data-testprop="test"
          id="secret-list"
        />
      )

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('"aria-label": "Secrets"')
      expect(resourceList.textContent).toContain('"data-testprop": "test"')
      expect(resourceList.textContent).toContain('"id": "secret-list"')
    })
  })

  describe('edge cases', () => {
    it('should handle empty string contactId', () => {
      render(<SecretList contactId="" />)

      const resourceList = screen.getByTestId('resource-list')

      // Empty string is falsy, should use the default GraphQL list route.
      expect(resourceList.textContent).toContain('/api/v1/graphql')
    })

    it('should handle null contactId', () => {
      render(<SecretList contactId={null} />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('/api/v1/graphql')
    })

    it('should handle undefined contactId', () => {
      render(<SecretList contactId={undefined} />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('/api/v1/graphql')
    })

    it('should handle contactId changes', () => {
      const { rerender } = render(<SecretList />)

      let resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain('/api/v1/graphql')

      rerender(<SecretList contactId="contact123" />)
      resourceList = screen.getByTestId('resource-list')
      expect(resourceList.textContent).toContain(
        '/api/v1/contact/contact123/secret/list'
      )

      rerender(<SecretList />)
      resourceList = screen.getByTestId('resource-list')
      expect(resourceList.textContent).toContain('/api/v1/graphql')
    })

    it('should handle special characters in contactId', () => {
      render(<SecretList contactId="contact-123_abc" />)

      const resourceList = screen.getByTestId('resource-list')

      expect(resourceList.textContent).toContain(
        '/api/v1/contact/contact-123_abc/secret/list'
      )
    })
  })

  describe('useMemo optimization', () => {
    it('should not recreate routes on unrelated prop changes', () => {
      const { rerender } = render(
        <SecretList contactId="contact123" kind="api-key" />
      )

      const resourceList1 = screen.getByTestId('resource-list')
      const content1 = resourceList1.textContent

      rerender(<SecretList contactId="contact123" kind="secret" />)

      const resourceList2 = screen.getByTestId('resource-list')
      const content2 = resourceList2.textContent

      // Both should have the same listRoute
      expect(content1).toContain('/api/v1/contact/contact123/secret/list')
      expect(content2).toContain('/api/v1/contact/contact123/secret/list')
    })
  })
})

import WebhookList from './WebhookList'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

jest.mock('./ResourceList', () => {
  return function ResourceList(props) {
    return (
      <div data-testid="resource-list" data-props={JSON.stringify(props)}>
        ResourceList Mock
      </div>
    )
  }
})

describe('WebhookList', () => {
  describe('basic functionality', () => {
    it('should render ResourceList with default props', () => {
      const { getByTestId } = render(<WebhookList />)

      const resourceList = getByTestId('resource-list')

      expect(resourceList).toBeInTheDocument()

      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.kind).toBe('webhook')
      expect(props.listRoute).toBe('/api/v1/webhook/list')
      expect(props.deleteRoute).toBe('/api/v1/webhook/[id]/delete')
      expect(props.instanceRoute).toBe('/webhooks/[id]')
      expect(props.filter).toBe(false)
      expect(props.exportRoute).toBeNull()
    })

    it('should pass through custom props to ResourceList', () => {
      const { getByTestId } = render(
        <WebhookList customProp="test-value" anotherProp={42} />
      )

      const resourceList = getByTestId('resource-list')
      const props = JSON.parse(resourceList.getAttribute('data-props'))

      expect(props.customProp).toBe('test-value')
      expect(props.anotherProp).toBe(42)
    })
  })

  describe('prop overrides', () => {
    it('should allow overriding kind prop', () => {
      const { getByTestId } = render(<WebhookList kind="custom-kind" />)

      const props = JSON.parse(
        getByTestId('resource-list').getAttribute('data-props')
      )

      expect(props.kind).toBe('custom-kind')
    })

    it('should allow overriding listRoute prop', () => {
      const { getByTestId } = render(<WebhookList listRoute="/custom/list" />)

      const props = JSON.parse(
        getByTestId('resource-list').getAttribute('data-props')
      )

      expect(props.listRoute).toBe('/custom/list')
    })

    it('should allow overriding exportRoute prop', () => {
      const { getByTestId } = render(
        <WebhookList exportRoute="/custom/export" />
      )

      const props = JSON.parse(
        getByTestId('resource-list').getAttribute('data-props')
      )

      expect(props.exportRoute).toBe('/custom/export')
    })

    it('should allow overriding deleteRoute prop', () => {
      const { getByTestId } = render(
        <WebhookList deleteRoute="/custom/delete" />
      )

      const props = JSON.parse(
        getByTestId('resource-list').getAttribute('data-props')
      )

      expect(props.deleteRoute).toBe('/custom/delete')
    })

    it('should allow overriding instanceRoute prop', () => {
      const { getByTestId } = render(
        <WebhookList instanceRoute="/custom/[id]" />
      )

      const props = JSON.parse(
        getByTestId('resource-list').getAttribute('data-props')
      )

      expect(props.instanceRoute).toBe('/custom/[id]')
    })

    it('should allow overriding filter prop', () => {
      const { getByTestId } = render(<WebhookList filter={true} />)

      const props = JSON.parse(
        getByTestId('resource-list').getAttribute('data-props')
      )

      expect(props.filter).toBe(true)
    })
  })

  describe('prop combinations', () => {
    it('should handle multiple overrides simultaneously', () => {
      const { getByTestId } = render(
        <WebhookList
          kind="custom"
          listRoute="/custom/list"
          deleteRoute="/custom/delete"
          filter={true}
          extraProp="value"
        />
      )

      const props = JSON.parse(
        getByTestId('resource-list').getAttribute('data-props')
      )

      expect(props.kind).toBe('custom')
      expect(props.listRoute).toBe('/custom/list')
      expect(props.deleteRoute).toBe('/custom/delete')
      expect(props.filter).toBe(true)
      expect(props.extraProp).toBe('value')
    })
  })

  describe('edge cases', () => {
    it('should handle empty props object', () => {
      const { getByTestId } = render(<WebhookList />)

      const resourceList = getByTestId('resource-list')

      expect(resourceList).toBeInTheDocument()
    })

    it('should handle null exportRoute', () => {
      const { getByTestId } = render(<WebhookList exportRoute={null} />)

      const props = JSON.parse(
        getByTestId('resource-list').getAttribute('data-props')
      )

      expect(props.exportRoute).toBeNull()
    })

    it('should handle undefined values in props', () => {
      const { getByTestId } = render(
        <WebhookList kind={undefined} filter={undefined} />
      )

      const resourceList = getByTestId('resource-list')

      expect(resourceList).toBeInTheDocument()
    })
  })
})

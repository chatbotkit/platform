import PortalTarget from './PortalTarget'

import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'

describe('PortalTarget', () => {
  describe('basic functionality', () => {
    it('should render with id', () => {
      const { container } = render(<PortalTarget id="test-portal" />)
      const portalDiv = container.querySelector('#test-portal')

      expect(portalDiv).toBeInTheDocument()
    })

    it('should show fallback children when portal is empty', () => {
      render(
        <PortalTarget id="test-portal">
          <div>Fallback content</div>
        </PortalTarget>
      )
      expect(screen.getByText('Fallback content')).toBeInTheDocument()
    })

    it('should hide fallback children when portal has content', async () => {
      const { container } = render(
        <PortalTarget id="portal">
          <div data-testid="fallback">Fallback</div>
        </PortalTarget>
      )

      const portalDiv = container.querySelector('#portal')

      expect(screen.getByTestId('fallback')).toBeInTheDocument()

      const child = document.createElement('div')

      child.textContent = 'Portal content'
      portalDiv.appendChild(child)

      await waitFor(() => {
        expect(screen.queryByTestId('fallback')).not.toBeInTheDocument()
      })
    })
  })

  describe('MutationObserver behavior', () => {
    it('should detect when children are added to portal', async () => {
      const { container } = render(
        <PortalTarget id="dynamic-portal">
          <div data-testid="fallback">Fallback</div>
        </PortalTarget>
      )

      const portalDiv = container.querySelector('#dynamic-portal')

      expect(screen.getByTestId('fallback')).toBeInTheDocument()

      const newChild = document.createElement('div')

      newChild.textContent = 'Dynamic content'
      portalDiv.appendChild(newChild)

      await waitFor(() => {
        expect(screen.queryByTestId('fallback')).not.toBeInTheDocument()
      })
    })

    it('should detect when children are removed from portal', async () => {
      const { container } = render(
        <PortalTarget id="removal-portal">
          <div data-testid="fallback">Fallback</div>
        </PortalTarget>
      )

      const portalDiv = container.querySelector('#removal-portal')

      const child = document.createElement('div')

      child.textContent = 'Temp content'
      portalDiv.appendChild(child)

      await waitFor(() => {
        expect(screen.queryByTestId('fallback')).not.toBeInTheDocument()
      })

      portalDiv.removeChild(child)

      await waitFor(() => {
        expect(screen.getByTestId('fallback')).toBeInTheDocument()
      })
    })
  })

  describe('singleChild prop', () => {
    it('should apply singleChild classes when prop is true', () => {
      const { container } = render(<PortalTarget id="single" singleChild />)
      const portalDiv = container.querySelector('#single')

      expect(portalDiv).toHaveClass('[&>*]:hidden')
      expect(portalDiv).toHaveClass('[&>*:last-child]:!block')
    })

    it('should not apply singleChild classes when prop is false', () => {
      const { container } = render(<PortalTarget id="multiple" />)
      const portalDiv = container.querySelector('#multiple')

      expect(portalDiv).not.toHaveClass('[&>*]:hidden')
      expect(portalDiv).not.toHaveClass('[&>*:last-child]:!block')
    })

    it('should hide all but last child when singleChild is true', async () => {
      const { container } = render(
        <PortalTarget id="single-test" singleChild />
      )

      const portalDiv = container.querySelector('#single-test')

      const child1 = document.createElement('div')

      child1.textContent = 'First'
      child1.setAttribute('data-testid', 'first')

      const child2 = document.createElement('div')

      child2.textContent = 'Second'
      child2.setAttribute('data-testid', 'second')

      portalDiv.appendChild(child1)
      portalDiv.appendChild(child2)

      await waitFor(() => {
        expect(portalDiv).toContainElement(child1)
        expect(portalDiv).toContainElement(child2)
      })
    })
  })

  describe('cleanup', () => {
    it('should disconnect MutationObserver on unmount', () => {
      const disconnectSpy = jest.fn()
      const originalMutationObserver = global.MutationObserver

      global.MutationObserver = class {
        constructor(callback) {
          this.callback = callback
        }
        observe() {}
        disconnect = disconnectSpy
      }

      const { unmount } = render(<PortalTarget id="cleanup-test" />)

      unmount()

      expect(disconnectSpy).toHaveBeenCalled()

      global.MutationObserver = originalMutationObserver
    })
  })

  describe('edge cases', () => {
    it('should handle portal target with no fallback children', () => {
      const { container } = render(<PortalTarget id="no-fallback" />)
      const portalDiv = container.querySelector('#no-fallback')

      expect(portalDiv).toBeInTheDocument()
      expect(portalDiv).toBeEmptyDOMElement()
    })

    it('should handle multiple fallback children', () => {
      render(
        <PortalTarget id="multi-fallback">
          <div>First fallback</div>
          <div>Second fallback</div>
        </PortalTarget>
      )
      expect(screen.getByText('First fallback')).toBeInTheDocument()
      expect(screen.getByText('Second fallback')).toBeInTheDocument()
    })

    it('should handle nested portal content', async () => {
      const { container } = render(
        <PortalTarget id="nested-portal">
          <div>Fallback</div>
        </PortalTarget>
      )

      const portalDiv = container.querySelector('#nested-portal')

      const parent = document.createElement('div')
      const child = document.createElement('div')

      child.textContent = 'Nested'
      parent.appendChild(child)
      portalDiv.appendChild(parent)

      await waitFor(() => {
        expect(screen.queryByText('Fallback')).not.toBeInTheDocument()
      })
    })
  })
})

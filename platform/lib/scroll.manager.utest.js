import { ScrollManager } from '@/lib/scroll.manager'

describe('ScrollManager', () => {
  let container
  let scrollManager

  beforeEach(() => {
    // Create a mock container element attached to the DOM
    container = document.createElement('div')
    document.body.appendChild(container)

    // Mock scroll method since jsdom doesn't implement it
    container.scroll = jest.fn()

    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }))
  })

  afterEach(() => {
    if (scrollManager) {
      scrollManager.destroy()
      scrollManager = null
    }

    if (container && container.parentNode) {
      container.parentNode.removeChild(container)
    }

    container = null
  })

  describe('addStopElement', () => {
    beforeEach(() => {
      scrollManager = new ScrollManager(container)
    })

    it('should throw an error when adding a stop element that is not connected to the DOM', () => {
      const disconnectedElement = document.createElement('div')
      // Element is NOT connected to the DOM

      expect(() => {
        scrollManager.addStopElement(disconnectedElement)
      }).toThrow('Cannot add a stop element that is not connected to the DOM.')
    })

    it('should successfully add a stop element that is connected to the DOM', () => {
      const connectedElement = document.createElement('div')

      document.body.appendChild(connectedElement)

      expect(() => {
        scrollManager.addStopElement(connectedElement)
      }).not.toThrow()

      // Cleanup
      document.body.removeChild(connectedElement)
    })
  })

  describe('addAnchorElement', () => {
    beforeEach(() => {
      scrollManager = new ScrollManager(container)
    })

    it('should throw an error when adding an anchor element that is not connected to the DOM', () => {
      const disconnectedElement = document.createElement('div')
      // Element is NOT connected to the DOM

      expect(() => {
        scrollManager.addAnchorElement(disconnectedElement)
      }).toThrow(
        'Cannot add an anchor element that is not connected to the DOM.'
      )
    })

    it('should successfully add an anchor element that is connected to the DOM', () => {
      const connectedElement = document.createElement('div')

      document.body.appendChild(connectedElement)

      expect(() => {
        scrollManager.addAnchorElement(connectedElement)
      }).not.toThrow()

      // Cleanup
      document.body.removeChild(connectedElement)
    })
  })
})

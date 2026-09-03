import IPhoneFrame from './IPhoneFrame'

import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

describe('IPhoneFrame', () => {
  describe('basic functionality', () => {
    it('should render without crashing', () => {
      const { container } = render(<IPhoneFrame />)

      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render children', () => {
      const { getByText } = render(
        <IPhoneFrame>
          <div>Test Content</div>
        </IPhoneFrame>
      )

      expect(getByText('Test Content')).toBeInTheDocument()
    })

    it('should render multiple children', () => {
      const { getByText } = render(
        <IPhoneFrame>
          <div>First Child</div>
          <div>Second Child</div>
          <div>Third Child</div>
        </IPhoneFrame>
      )

      expect(getByText('First Child')).toBeInTheDocument()
      expect(getByText('Second Child')).toBeInTheDocument()
      expect(getByText('Third Child')).toBeInTheDocument()
    })

    it('should render without children', () => {
      const { container } = render(<IPhoneFrame />)
      const frame = container.firstChild

      expect(frame).toBeInTheDocument()
    })
  })

  describe('styling and structure', () => {
    it('should have base iPhone frame styles', () => {
      const { container } = render(<IPhoneFrame />)
      const frame = container.firstChild

      expect(frame).toHaveClass('relative')
      expect(frame).toHaveClass('bg-black')
      expect(frame).toHaveClass('rounded-5xl')
      expect(frame).toHaveClass('overflow-hidden')
    })

    it('should have border styles', () => {
      const { container } = render(<IPhoneFrame />)
      const frame = container.firstChild

      expect(frame).toHaveClass('border-4')
      expect(frame).toHaveClass('border-black')
      expect(frame).toHaveClass('dark:border-white')
    })

    it('should render notch element', () => {
      const { container } = render(<IPhoneFrame />)
      const notch = container.querySelector(
        '.absolute.z-50.top-2.left-1\\/2.-translate-x-1\\/2'
      )

      expect(notch).toBeInTheDocument()
    })

    it('should have notch with correct dimensions', () => {
      const { container } = render(<IPhoneFrame />)
      const notch = container.querySelector('.w-24.h-5')

      expect(notch).toBeInTheDocument()
      expect(notch).toHaveClass('rounded-full')
      expect(notch).toHaveClass('bg-black')
    })

    it('should have content wrapper with flexbox', () => {
      const { container } = render(
        <IPhoneFrame>
          <div>Content</div>
        </IPhoneFrame>
      )
      const contentWrapper = container.querySelector(
        '.flex.flex-row.w-full.h-full'
      )

      expect(contentWrapper).toBeInTheDocument()
      expect(contentWrapper).toHaveClass('overflow-hidden')
    })
  })

  describe('className prop', () => {
    it('should apply custom className', () => {
      const { container } = render(<IPhoneFrame className="custom-class" />)
      const frame = container.firstChild

      expect(frame).toHaveClass('custom-class')
    })

    it('should merge custom className with base classes', () => {
      const { container } = render(
        <IPhoneFrame className="w-96 h-96 shadow-lg" />
      )
      const frame = container.firstChild

      expect(frame).toHaveClass('w-96')
      expect(frame).toHaveClass('h-96')
      expect(frame).toHaveClass('shadow-lg')
      expect(frame).toHaveClass('relative')
      expect(frame).toHaveClass('bg-black')
    })

    it('should handle empty className', () => {
      const { container } = render(<IPhoneFrame className="" />)
      const frame = container.firstChild

      expect(frame).toHaveClass('relative')
    })

    it('should handle undefined className', () => {
      const { container } = render(<IPhoneFrame className={undefined} />)
      const frame = container.firstChild

      expect(frame).toHaveClass('relative')
    })

    it('should handle multiple custom classes', () => {
      const { container } = render(
        <IPhoneFrame className="mx-auto my-4 scale-90" />
      )
      const frame = container.firstChild

      expect(frame).toHaveClass('mx-auto')
      expect(frame).toHaveClass('my-4')
      expect(frame).toHaveClass('scale-90')
    })
  })

  describe('children rendering', () => {
    it('should render text children', () => {
      const { getByText } = render(<IPhoneFrame>Plain text</IPhoneFrame>)

      expect(getByText('Plain text')).toBeInTheDocument()
    })

    it('should render complex component children', () => {
      const ComplexComponent = () => (
        <div>
          <h1>Title</h1>
          <p>Paragraph</p>
          <button type="button">Action</button>
        </div>
      )
      const { getByText, getByRole } = render(
        <IPhoneFrame>
          <ComplexComponent />
        </IPhoneFrame>
      )

      expect(getByText('Title')).toBeInTheDocument()
      expect(getByText('Paragraph')).toBeInTheDocument()
      expect(getByRole('button')).toBeInTheDocument()
    })

    it('should render images as children', () => {
      const { getByAltText } = render(
        <IPhoneFrame>
          <img src="/test.jpg" alt="Test" />
        </IPhoneFrame>
      )

      expect(getByAltText('Test')).toBeInTheDocument()
    })

    it('should render nested components', () => {
      const { getByText } = render(
        <IPhoneFrame>
          <div>
            <div>
              <span>Nested content</span>
            </div>
          </div>
        </IPhoneFrame>
      )

      expect(getByText('Nested content')).toBeInTheDocument()
    })

    it('should handle null children', () => {
      const { container } = render(<IPhoneFrame>{null}</IPhoneFrame>)
      const frame = container.firstChild

      expect(frame).toBeInTheDocument()
    })

    it('should handle undefined children', () => {
      const { container } = render(<IPhoneFrame>{undefined}</IPhoneFrame>)
      const frame = container.firstChild

      expect(frame).toBeInTheDocument()
    })

    it('should handle boolean children', () => {
      const { container } = render(
        <IPhoneFrame>{false && <div>Hidden</div>}</IPhoneFrame>
      )
      const frame = container.firstChild

      expect(frame).toBeInTheDocument()
    })

    it('should render array of children', () => {
      const items = ['Item 1', 'Item 2', 'Item 3']
      const { getByText } = render(
        <IPhoneFrame>
          {items.map((item, index) => (
            <div key={index}>{item}</div>
          ))}
        </IPhoneFrame>
      )

      items.forEach((item) => {
        expect(getByText(item)).toBeInTheDocument()
      })
    })
  })

  describe('edge cases', () => {
    it('should handle very long content', () => {
      const longText = 'A'.repeat(1000)
      const { getByText } = render(
        <IPhoneFrame>
          <div>{longText}</div>
        </IPhoneFrame>
      )

      expect(getByText(longText)).toBeInTheDocument()
    })

    it('should handle special characters in children', () => {
      const specialText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/'
      const { getByText } = render(<IPhoneFrame>{specialText}</IPhoneFrame>)

      expect(getByText(specialText)).toBeInTheDocument()
    })

    it('should handle unicode characters', () => {
      const unicodeText = '你好 👋 🌍'
      const { getByText } = render(<IPhoneFrame>{unicodeText}</IPhoneFrame>)

      expect(getByText(unicodeText)).toBeInTheDocument()
    })

    it('should handle empty string children', () => {
      const { container } = render(<IPhoneFrame>{''}</IPhoneFrame>)
      const frame = container.firstChild

      expect(frame).toBeInTheDocument()
    })

    it('should handle number children', () => {
      const { getByText } = render(<IPhoneFrame>{42}</IPhoneFrame>)

      expect(getByText('42')).toBeInTheDocument()
    })

    it('should handle zero as children', () => {
      const { getByText } = render(<IPhoneFrame>{0}</IPhoneFrame>)

      expect(getByText('0')).toBeInTheDocument()
    })
  })

  describe('structure integrity', () => {
    it('should have two main child elements (notch and content)', () => {
      const { container } = render(
        <IPhoneFrame>
          <div>Test</div>
        </IPhoneFrame>
      )
      const frame = container.firstChild

      expect(frame.children).toHaveLength(2)
    })

    it('should maintain notch z-index', () => {
      const { container } = render(<IPhoneFrame />)
      const notch = container.querySelector('.z-50')

      expect(notch).toBeInTheDocument()
    })

    it('should maintain proper overflow handling', () => {
      const { container } = render(
        <IPhoneFrame>
          <div>Content</div>
        </IPhoneFrame>
      )
      const frame = container.firstChild
      const contentWrapper = frame.querySelector('.overflow-hidden.flex')

      expect(contentWrapper).toBeInTheDocument()
    })
  })
})

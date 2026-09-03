import SendInstructions from './SendInstructions'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('./KeyCombo', () => {
  return function KeyCombo({ secondKey }) {
    return <span data-testid="key-combo">{secondKey}</span>
  }
})

describe('SendInstructions', () => {
  describe('basic functionality', () => {
    it('should render with default message when not started', () => {
      render(<SendInstructions />)
      expect(screen.getByText(/start the conversation/i)).toBeInTheDocument()
    })

    it('should render with alt message when started', () => {
      render(<SendInstructions started={true} />)
      expect(screen.getByText(/send a message/i)).toBeInTheDocument()
    })

    it('should render KeyCombo component', () => {
      render(<SendInstructions />)
      expect(screen.getByTestId('key-combo')).toBeInTheDocument()
      expect(screen.getByTestId('key-combo')).toHaveTextContent('Enter')
    })
  })

  describe('custom messages', () => {
    it('should render custom message when provided', () => {
      render(<SendInstructions message="begin chatting" />)
      expect(screen.getByText(/begin chatting/i)).toBeInTheDocument()
    })

    it('should render custom altMessage when started', () => {
      render(<SendInstructions started={true} altMessage="reply now" />)
      expect(screen.getByText(/reply now/i)).toBeInTheDocument()
    })
  })

  describe('props spreading', () => {
    it('should pass additional props to container div', () => {
      const { container } = render(
        <SendInstructions
          data-testid="custom-instructions"
          className="custom-class"
        />
      )
      const wrapper = container.querySelector(
        '[data-testid="custom-instructions"]'
      )

      expect(wrapper).toBeInTheDocument()
      expect(wrapper).toHaveClass('custom-class')
    })
  })

  describe('edge cases', () => {
    it('should handle started=false explicitly', () => {
      render(<SendInstructions started={false} />)
      expect(screen.getByText(/start the conversation/i)).toBeInTheDocument()
    })

    it('should handle empty string messages', () => {
      render(<SendInstructions message="" altMessage="" started={true} />)
      expect(screen.getByText(/press/i)).toBeInTheDocument()
    })
  })
})

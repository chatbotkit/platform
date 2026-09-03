import ChatInput from './ChatInput'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/AutoTextarea', () => {
  const React = jest.requireActual('react')

  return {
    __esModule: true,
    default: React.forwardRef(function AutoTextarea(props, ref) {
      return <textarea {...props} ref={ref} />
    }),
  }
})

describe('ChatInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic rendering', () => {
    it('should render textarea', () => {
      render(<ChatInput onSend={jest.fn()} />)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('should render without send button by default', () => {
      render(<ChatInput onSend={jest.fn()} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('should render send button when sendCaption is provided', () => {
      render(<ChatInput onSend={jest.fn()} sendCaption="Send" />)
      expect(screen.getByRole('button')).toHaveTextContent('Send')
    })

    it('should render children', () => {
      render(
        <ChatInput onSend={jest.fn()}>
          <div data-testid="child">Child content</div>
        </ChatInput>
      )
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
  })

  describe('send button', () => {
    it('should display custom sendCaption text', () => {
      render(<ChatInput onSend={jest.fn()} sendCaption="Submit" />)
      expect(screen.getByRole('button')).toHaveTextContent('Submit')
    })

    it('should call onSend when button is clicked', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} sendCaption="Send" />)

      fireEvent.click(screen.getByRole('button'))
      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('should prevent default on button click', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} sendCaption="Send" />)

      const button = screen.getByRole('button')
      const clickEvent = new MouseEvent('click', { bubbles: true })
      const preventDefaultSpy = jest.spyOn(clickEvent, 'preventDefault')

      fireEvent(button, clickEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('should stop propagation on button click', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} sendCaption="Send" />)

      const button = screen.getByRole('button')
      const clickEvent = new MouseEvent('click', { bubbles: true })
      const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation')

      fireEvent(button, clickEvent)

      expect(stopPropagationSpy).toHaveBeenCalled()
    })
  })

  describe('keyboard handling', () => {
    it('should call onSend on Enter key', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} />)

      const textarea = screen.getByRole('textbox')

      fireEvent.keyDown(textarea, { keyCode: 13 })

      expect(onSend).toHaveBeenCalledTimes(1)
    })

    it('should not call onSend on Shift+Enter', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} />)

      const textarea = screen.getByRole('textbox')

      fireEvent.keyDown(textarea, { keyCode: 13, shiftKey: true })

      expect(onSend).not.toHaveBeenCalled()
    })

    it('should not call onSend on Ctrl+Enter', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} />)

      const textarea = screen.getByRole('textbox')

      fireEvent.keyDown(textarea, { keyCode: 13, ctrlKey: true })

      expect(onSend).not.toHaveBeenCalled()
    })

    it('should not call onSend on Meta+Enter', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} />)

      const textarea = screen.getByRole('textbox')

      fireEvent.keyDown(textarea, { keyCode: 13, metaKey: true })

      expect(onSend).not.toHaveBeenCalled()
    })

    it('should not call onSend on other keys', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} />)

      const textarea = screen.getByRole('textbox')

      fireEvent.keyDown(textarea, { keyCode: 65 }) // 'A' key

      expect(onSend).not.toHaveBeenCalled()
    })

    it('should use custom onKeyDown when provided', () => {
      const onSend = jest.fn()
      const customOnKeyDown = jest.fn()

      render(<ChatInput onSend={onSend} onKeyDown={customOnKeyDown} />)

      const textarea = screen.getByRole('textbox')

      fireEvent.keyDown(textarea, { keyCode: 13 })

      expect(customOnKeyDown).toHaveBeenCalled()
      expect(onSend).not.toHaveBeenCalled()
    })
  })

  describe('disabled states', () => {
    it('should disable textarea when inputDisabled is true', () => {
      render(<ChatInput onSend={jest.fn()} inputDisabled={true} />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('should disable button when sendDisabled is true', () => {
      render(
        <ChatInput onSend={jest.fn()} sendCaption="Send" sendDisabled={true} />
      )
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should disable textarea when disabled is true', () => {
      render(<ChatInput onSend={jest.fn()} disabled={true} />)
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('should disable button when disabled is true', () => {
      render(
        <ChatInput onSend={jest.fn()} sendCaption="Send" disabled={true} />
      )
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should disable textarea when both inputDisabled and disabled are true', () => {
      render(
        <ChatInput onSend={jest.fn()} inputDisabled={true} disabled={true} />
      )
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('should disable button when both sendDisabled and disabled are true', () => {
      render(
        <ChatInput
          onSend={jest.fn()}
          sendCaption="Send"
          sendDisabled={true}
          disabled={true}
        />
      )
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('should only disable textarea when inputDisabled is true and sendDisabled is false', () => {
      render(
        <ChatInput
          onSend={jest.fn()}
          sendCaption="Send"
          inputDisabled={true}
          sendDisabled={false}
        />
      )
      expect(screen.getByRole('textbox')).toBeDisabled()
      expect(screen.getByRole('button')).not.toBeDisabled()
    })

    it('should only disable button when sendDisabled is true and inputDisabled is false', () => {
      render(
        <ChatInput
          onSend={jest.fn()}
          sendCaption="Send"
          inputDisabled={false}
          sendDisabled={true}
        />
      )
      expect(screen.getByRole('textbox')).not.toBeDisabled()
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('event object modification', () => {
    it('should modify event.target to point to textarea on button click', () => {
      const onSend = jest.fn()
      const { container } = render(
        <ChatInput onSend={onSend} sendCaption="Send" />
      )

      const textarea = screen.getByRole('textbox')
      const button = screen.getByRole('button')

      fireEvent.click(button)

      expect(onSend).toHaveBeenCalled()

      const event = onSend.mock.calls[0][0]

      expect(event.target).toBe(textarea)
    })

    it('should preserve originalTarget chain', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} sendCaption="Send" />)

      fireEvent.click(screen.getByRole('button'))

      expect(onSend).toHaveBeenCalled()

      const event = onSend.mock.calls[0][0]

      expect(event.originalTarget).toBeDefined()
    })
  })

  describe('passthrough props', () => {
    it('should pass through props to AdvancedAutoTextarea', () => {
      render(
        <ChatInput
          onSend={jest.fn()}
          placeholder="Type a message"
          data-testid="chat-input"
        />
      )

      const textarea = screen.getByRole('textbox')

      expect(textarea).toHaveAttribute('placeholder', 'Type a message')
    })

    it('should pass through value prop', () => {
      render(<ChatInput onSend={jest.fn()} value="test message" />)
      expect(screen.getByRole('textbox')).toHaveValue('test message')
    })

    it('should pass through onChange prop', () => {
      const onChange = jest.fn()

      render(<ChatInput onSend={jest.fn()} onChange={onChange} />)

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'new value' },
      })
      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle onSend with null textarea reference', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} sendCaption="Send" />)

      fireEvent.click(screen.getByRole('button'))
      expect(onSend).toHaveBeenCalled()
    })

    it('should handle rapid button clicks', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} sendCaption="Send" />)

      const button = screen.getByRole('button')

      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      expect(onSend).toHaveBeenCalledTimes(3)
    })

    it('should handle rapid Enter key presses', () => {
      const onSend = jest.fn()

      render(<ChatInput onSend={onSend} />)

      const textarea = screen.getByRole('textbox')

      fireEvent.keyDown(textarea, { keyCode: 13 })
      fireEvent.keyDown(textarea, { keyCode: 13 })

      expect(onSend).toHaveBeenCalledTimes(2)
    })
  })
})

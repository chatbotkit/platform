import AttachmentsArea, { Attachment } from './AttachmentsArea'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')

describe('Attachment', () => {
  it('renders image attachment', () => {
    render(
      <Attachment
        type="image/png"
        name="test.png"
        url="blob:test-url"
        data-testid="attachment"
      />
    )

    const img = screen.getByAltText('attachment')

    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'blob:test-url')
    expect(img).toHaveClass('h-16', 'aspect-auto', 'rounded-lg')
  })

  it('renders non-image attachment with paperclip icon', () => {
    const { container } = render(
      <Attachment type="application/pdf" name="test.pdf" url="blob:test-url" />
    )

    const img = screen.queryByAltText('attachment')

    expect(img).not.toBeInTheDocument()

    // Should render a div with icon
    const iconContainer = container.querySelector('.w-16.h-16')

    expect(iconContainer).toBeInTheDocument()
    expect(iconContainer).toHaveClass('rounded-lg', 'flex', 'flex-col')
  })

  it('shows tooltip with name when provided', () => {
    const { container } = render(
      <Attachment type="image/png" name="my-file.png" url="blob:test-url" />
    )

    const tooltip = container.querySelector('.tooltip')

    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveTextContent('my-file.png')
  })

  it('does not show tooltip when name is not provided', () => {
    const { container } = render(
      <Attachment type="image/png" url="blob:test-url" />
    )

    const tooltip = container.querySelector('.tooltip')

    expect(tooltip).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <Attachment
        type="image/png"
        name="test.png"
        url="blob:test-url"
        className="custom-class"
      />
    )

    const img = screen.getByAltText('attachment')

    expect(img).toHaveClass('custom-class')
  })
})

describe('AttachmentsArea', () => {
  const mockAttachments = [
    { type: 'image/png', name: 'file1.png' },
    { type: 'application/pdf', name: 'file2.pdf' },
  ]

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders null when no attachments', () => {
    const { container } = render(
      <AttachmentsArea attachments={[]} setAttachments={jest.fn()} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders null when attachments is undefined', () => {
    const { container } = render(
      <AttachmentsArea attachments={undefined} setAttachments={jest.fn()} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders all attachments when provided', () => {
    render(
      <AttachmentsArea
        attachments={mockAttachments}
        setAttachments={jest.fn()}
      />
    )

    // First attachment is an image
    const images = screen.getAllByAltText('attachment')

    expect(images).toHaveLength(1) // Only the image attachment has alt text

    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2)
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockAttachments[0])
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockAttachments[1])
  })

  it('removes attachment when X icon is clicked', () => {
    const setAttachments = jest.fn()
    const { container } = render(
      <AttachmentsArea
        attachments={mockAttachments}
        setAttachments={setAttachments}
      />
    )

    const removeButtons = container.querySelectorAll('.absolute.top-1.right-1')

    expect(removeButtons).toHaveLength(2)

    fireEvent.click(removeButtons[0])

    expect(setAttachments).toHaveBeenCalledTimes(1)
    expect(setAttachments).toHaveBeenCalledWith([mockAttachments[1]])
  })

  it('removes correct attachment when multiple exist', () => {
    const setAttachments = jest.fn()
    const { container } = render(
      <AttachmentsArea
        attachments={mockAttachments}
        setAttachments={setAttachments}
      />
    )

    const removeButtons = container.querySelectorAll('.absolute.top-1.right-1')

    fireEvent.click(removeButtons[1])

    expect(setAttachments).toHaveBeenCalledWith([mockAttachments[0]])
  })

  it('applies custom className', () => {
    const { container } = render(
      <AttachmentsArea
        attachments={mockAttachments}
        setAttachments={jest.fn()}
        className="custom-area-class"
      />
    )

    const area = container.querySelector('.attachments-area')

    expect(area).toHaveClass('custom-area-class')
  })

  it('renders children when provided', () => {
    render(
      <AttachmentsArea attachments={mockAttachments} setAttachments={jest.fn()}>
        <div data-testid="child">Child content</div>
      </AttachmentsArea>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('passes through additional props', () => {
    const { container } = render(
      <AttachmentsArea
        attachments={mockAttachments}
        setAttachments={jest.fn()}
        data-testid="custom-area"
      />
    )

    const area = container.querySelector('[data-testid="custom-area"]')

    expect(area).toBeInTheDocument()
  })
})

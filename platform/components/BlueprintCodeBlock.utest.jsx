import BlueprintCodeBlock, {
  getBlueprintPreviewSrc,
} from './BlueprintCodeBlock'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/lib/toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

describe('BlueprintCodeBlock', () => {
  let writeTextMock

  beforeEach(() => {
    jest.clearAllMocks()

    writeTextMock = jest.fn().mockResolvedValue()
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })
  })

  it('renders the blueprint preview iframe', () => {
    const source = '\n{"nodes":[]}\n'

    render(<BlueprintCodeBlock>{source}</BlueprintCodeBlock>)

    const iframe = screen.getByTitle('Blueprint Preview')

    expect(iframe).toHaveClass('blueprint')
    expect(iframe).toHaveClass('!w-full')
    expect(iframe).toHaveClass('!ml-0')
    expect(iframe).toHaveAttribute('src', getBlueprintPreviewSrc(source))
  })

  it('copies the trimmed blueprint source', () => {
    render(<BlueprintCodeBlock>{'\n{"nodes":[]}\n'}</BlueprintCodeBlock>)

    fireEvent.click(screen.getByRole('button', { name: 'Copy blueprint' }))

    expect(writeTextMock).toHaveBeenCalledWith('{"nodes":[]}')
  })

  it('does not render empty sources', () => {
    const { container } = render(
      <BlueprintCodeBlock>{'\n'}</BlueprintCodeBlock>
    )

    expect(container).toBeEmptyDOMElement()
  })
})

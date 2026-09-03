/* eslint-disable @typescript-eslint/no-require-imports */
import Diagram from './Diagram'

import '@testing-library/jest-dom'
import { act, render } from '@testing-library/react'

jest.mock('mermaid', () => ({
  initialize: jest.fn(),
  render: jest.fn(),
}))

jest.mock('@/lib/b64', () => ({
  encode: jest.fn((str) => Buffer.from(str).toString('base64')),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/object', () => ({
  merge: jest.fn((...args) => Object.assign({}, ...args)),
}))

jest.mock('@/lib/save', () => ({
  saveBlob: jest.fn(),
}))

jest.mock('@/lib/toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}))

const mermaid = require('mermaid')
const { captureException } = require('@/lib/error')

const VALID_MERMAID = 'graph LR\n  A --> B'
const INVALID_MERMAID = 'graph LR\n  A --> B['

describe('Diagram', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders when mermaid renders successfully', async () => {
    mermaid.render.mockResolvedValue({ svg: '<svg>test</svg>' })

    await act(async () => {
      render(<Diagram source={VALID_MERMAID} />)
    })

    expect(mermaid.render).toHaveBeenCalled()
  })

  it('does not call captureException when mermaid throws a parse error', async () => {
    const parseError = new Error('Parse error on line 3:')

    mermaid.render.mockRejectedValue(parseError)

    await act(async () => {
      render(<Diagram source={INVALID_MERMAID} />)
    })

    expect(captureException).not.toHaveBeenCalled()
  })

  it('does not call captureException when mermaid throws UnknownDiagramError', async () => {
    const unknownDiagramError = new Error(
      'No diagram type detected matching given configuration for text: \nflow\n'
    )

    unknownDiagramError.name = 'UnknownDiagramError'

    mermaid.render.mockRejectedValue(unknownDiagramError)

    await act(async () => {
      render(<Diagram source="flow\nA --> B" />)
    })

    expect(captureException).not.toHaveBeenCalled()
  })

  it('renders nothing when mermaid fails to parse', async () => {
    mermaid.render.mockRejectedValue(new Error('Parse error on line 1:'))

    let container

    await act(async () => {
      container = render(<Diagram source={INVALID_MERMAID} />).container
    })

    expect(container.firstChild).toBeNull()
  })
})

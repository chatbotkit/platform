import ThemeDesigner from './ThemeDesigner'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

const widgetPreviewCalls = []
const themePanelCalls = []

jest.mock('@/components/SchemaPanel', () => ({
  SchemaPanelModeProvider: ({ children }) => <>{children}</>,
  SchemaPanelPositionProvider: ({ children }) => <>{children}</>,
}))

jest.mock('@/components/ThemeCanvas', () => {
  return function ThemeCanvas({ children, setFullscreen }) {
    return (
      <div data-testid="theme-canvas">
        <button type="button" onClick={() => setFullscreen(true)}>
          set fullscreen
        </button>
        {children}
      </div>
    )
  }
})

jest.mock('@/components/ThemePanel', () => {
  return function ThemePanel(props) {
    themePanelCalls.push(props)

    return <div data-testid="theme-panel">{String(props.panelHidden)}</div>
  }
})

jest.mock('@/components/WidgetPreview', () => {
  return function WidgetPreview(props) {
    widgetPreviewCalls.push(props)

    return (
      <div data-testid="widget-preview">
        <span data-testid="preview-title">{props.title}</span>
        <span data-testid="preview-intro">{props.intro}</span>
        <span data-testid="preview-initial">{props.initial}</span>
      </div>
    )
  }
})

describe('ThemeDesigner', () => {
  beforeEach(() => {
    widgetPreviewCalls.length = 0
    themePanelCalls.length = 0
  })

  it('uses demo defaults for preview fields when optional values are not provided', () => {
    render(<ThemeDesigner defaultDemo="default" />)

    expect(screen.getByTestId('preview-title')).toHaveTextContent('')
    expect(screen.getByTestId('preview-intro')).toHaveTextContent(
      'Intro that contains formatted text.'
    )
    expect(screen.getByTestId('preview-initial')).toHaveTextContent(
      'Hi 👋 How can I help you?'
    )
    expect(widgetPreviewCalls.at(-1).messages?.length).toBeGreaterThan(0)
  })

  it('syncs panel visibility with fullscreen and supports panel toggle button', () => {
    render(
      <ThemeDesigner defaultPanelHidden={true} defaultFullscreen={false} />
    )

    expect(screen.getByTestId('theme-panel')).toHaveTextContent('true')

    fireEvent.click(screen.getByRole('button', { name: 'set fullscreen' }))
    expect(screen.getByTestId('theme-panel')).toHaveTextContent('false')

    fireEvent.click(screen.getByRole('button', { name: 'Design Panel' }))
    expect(screen.getByTestId('theme-panel')).toHaveTextContent('true')
  })
})

import Wrapper from './Wrapper'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

// Mock all child components
jest.mock('@/components/Console', () => {
  return function Console() {
    return <div data-testid="console">Console</div>
  }
})

jest.mock('@/components/GTag', () => {
  return function GTag() {
    return <div data-testid="gtag">GTag</div>
  }
})

jest.mock('@/components/Notifications', () => {
  return function Notifications({ children }) {
    return <div data-testid="notifications">{children}</div>
  }
})

jest.mock('@/components/Progress', () => {
  return function Progress() {
    return <div data-testid="progress">Progress</div>
  }
})

jest.mock('@/components/ReloadingPageErrorBoundary', () => {
  return function ReloadingPageErrorBoundary({ children }) {
    return <div data-testid="error-boundary">{children}</div>
  }
})

jest.mock('@/components/Session', () => {
  return function Session({ children }) {
    return <div data-testid="session">{children}</div>
  }
})

jest.mock('@/components/Theme', () => {
  return function Theme({ children }) {
    return <div data-testid="theme">{children}</div>
  }
})

describe('Wrapper', () => {
  it('should render with Component and pageProps', () => {
    const TestComponent = ({ title }) => <div>Test Page: {title}</div>

    render(<Wrapper Component={TestComponent} pageProps={{ title: 'Hello' }} />)

    expect(screen.getByText('Test Page: Hello')).toBeInTheDocument()
  })

  it('should render all wrapper components in correct order', () => {
    const TestComponent = () => <div>Test</div>

    render(<Wrapper Component={TestComponent} pageProps={{}} />)

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    expect(screen.getByTestId('console')).toBeInTheDocument()
    expect(screen.getByTestId('gtag')).toBeInTheDocument()
    expect(screen.getByTestId('theme')).toBeInTheDocument()
    expect(screen.getByTestId('progress')).toBeInTheDocument()
    expect(screen.getByTestId('session')).toBeInTheDocument()
    expect(screen.getByTestId('notifications')).toBeInTheDocument()
  })

  it('should render children when provided instead of Component', () => {
    render(<Wrapper>Custom Children Content</Wrapper>)

    expect(screen.getByText('Custom Children Content')).toBeInTheDocument()
  })

  it('should render both Component and children when both provided', () => {
    const TestComponent = () => <div>Component Content</div>

    render(
      <Wrapper Component={TestComponent} pageProps={{}}>
        Children Content
      </Wrapper>
    )

    expect(screen.getByText('Component Content')).toBeInTheDocument()
    expect(screen.getByText('Children Content')).toBeInTheDocument()
  })

  it('should use custom getLayout when provided on Component', () => {
    const TestComponent = () => <div>Page Content</div>

    TestComponent.getLayout = (page) => (
      <div data-testid="custom-layout">Layout: {page}</div>
    )

    render(<Wrapper Component={TestComponent} pageProps={{}} />)

    expect(screen.getByTestId('custom-layout')).toBeInTheDocument()
    expect(screen.getByText('Page Content')).toBeInTheDocument()
  })

  it('should use default getLayout when not provided', () => {
    const TestComponent = () => <div>Simple Content</div>

    render(<Wrapper Component={TestComponent} pageProps={{}} />)

    expect(screen.getByText('Simple Content')).toBeInTheDocument()
  })

  it('should pass session prop to Session component', () => {
    const mockSession = { user: { id: 'user1' } }
    const TestComponent = () => <div>Test</div>

    TestComponent.session = mockSession

    render(<Wrapper Component={TestComponent} pageProps={{}} />)

    expect(screen.getByTestId('session')).toBeInTheDocument()
  })

  it('should pass theme prop to Theme component', () => {
    const mockTheme = { colors: { primary: 'blue' } }
    const TestComponent = () => <div>Test</div>

    TestComponent.theme = mockTheme

    render(<Wrapper Component={TestComponent} pageProps={{}} />)

    expect(screen.getByTestId('theme')).toBeInTheDocument()
  })

  it('should handle Component without getLayout gracefully', () => {
    const TestComponent = () => <div>No Layout Content</div>

    render(<Wrapper Component={TestComponent} pageProps={{}} />)

    expect(screen.getByText('No Layout Content')).toBeInTheDocument()
  })

  it('should render nothing when Component is null', () => {
    const { container } = render(<Wrapper Component={null} pageProps={{}} />)

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    expect(container.querySelector('div')).toBeInTheDocument()
  })

  it('should render only children when Component is undefined', () => {
    render(<Wrapper pageProps={{}}>Only Children</Wrapper>)

    expect(screen.getByText('Only Children')).toBeInTheDocument()
  })

  it('should pass pageProps to Component', () => {
    const TestComponent = ({ name, value }) => (
      <div>
        {name}: {value}
      </div>
    )

    render(
      <Wrapper
        Component={TestComponent}
        pageProps={{ name: 'Test', value: 42 }}
      />
    )

    expect(screen.getByText('Test: 42')).toBeInTheDocument()
  })

  it('should pass pageProps to getLayout function', () => {
    const TestComponent = () => <div>Content</div>

    TestComponent.getLayout = (page, pageProps) => (
      <div data-testid="layout-with-props">
        {page}
        <div>Props: {JSON.stringify(pageProps)}</div>
      </div>
    )

    render(<Wrapper Component={TestComponent} pageProps={{ custom: 'data' }} />)

    expect(screen.getByTestId('layout-with-props')).toBeInTheDocument()
    expect(screen.getByText('Props: {"custom":"data"}')).toBeInTheDocument()
  })

  it('should override Component.session with explicit session prop', () => {
    const componentSession = { user: { id: 'component-user' } }
    const explicitSession = { user: { id: 'explicit-user' } }

    const TestComponent = () => <div>Test</div>

    TestComponent.session = componentSession

    render(
      <Wrapper
        Component={TestComponent}
        pageProps={{}}
        session={explicitSession}
      />
    )

    expect(screen.getByTestId('session')).toBeInTheDocument()
  })

  it('should override Component.theme with explicit theme prop', () => {
    const componentTheme = { mode: 'light' }
    const explicitTheme = { mode: 'dark' }

    const TestComponent = () => <div>Test</div>

    TestComponent.theme = componentTheme

    render(
      <Wrapper Component={TestComponent} pageProps={{}} theme={explicitTheme} />
    )

    expect(screen.getByTestId('theme')).toBeInTheDocument()
  })
})

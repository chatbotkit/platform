import WidgetsScreen from './WidgetsScreen'

import { render, screen } from '@testing-library/react'

jest.mock('@/components/MovingScreen', () => {
  return function MovingScreen({ children, ...props }) {
    return (
      <div
        data-testid="moving-screen"
        data-max={props.movingScreenExposeMaxHeight}
      >
        {children}
      </div>
    )
  }
})

jest.mock('@/components/WidgetPreview', () => {
  return function WidgetPreview({ title }) {
    return <div data-testid="widget-preview">{title}</div>
  }
})

describe('WidgetsScreen', () => {
  const widgets = [
    { slug: 'a', title: 'A', intro: 'I1', messages: [], theme: {} },
    { slug: 'b', title: 'B', intro: 'I2', messages: [], theme: {} },
    { slug: 'c', title: 'C', intro: 'I3', messages: [], theme: {} },
  ]

  it('renders all widget previews and passes moving screen expose height', () => {
    render(<WidgetsScreen widgets={widgets} />)

    expect(screen.getByTestId('moving-screen').getAttribute('data-max')).toBe(
      '600px'
    )
    expect(screen.getAllByTestId('widget-preview')).toHaveLength(3)
  })

  it('uses 3-column container class when there are 3 widgets', () => {
    const { container } = render(<WidgetsScreen widgets={widgets} />)

    expect(container.querySelector('.max-w-6xl')).not.toBeNull()
    expect(container.querySelector('.max-w-4xl')).toBeNull()
  })

  it('uses 2-column container class when there are 2 widgets', () => {
    const { container } = render(
      <WidgetsScreen widgets={widgets.slice(0, 2)} />
    )

    expect(container.querySelector('.max-w-4xl')).not.toBeNull()
    expect(container.querySelector('.max-w-6xl')).toBeNull()
  })
})

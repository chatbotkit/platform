import List from './List'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/components/Component', () => {
  return function Component({ as: As = 'div', children, ...props }) {
    return <As {...props}>{children}</As>
  }
})

jest.mock('@/components/Link', () => {
  return function Link({ href, children, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }
})

jest.mock('@/components/TimeAgo', () => {
  return function TimeAgo({ time }) {
    return <span data-testid="time-ago">{String(time)}</span>
  }
})

jest.mock('@/components/MenuButton', () => {
  return function MenuButton({ menu, children }) {
    return (
      <div>
        <button type="button">{children}</button>
        {menu.map((item) => (
          <button key={item.title} type="button" onClick={item.onClick}>
            {item.title}
          </button>
        ))}
      </div>
    )
  }
})

describe('List', () => {
  it('shows empty message when no children are provided', () => {
    render(<List emptyMessage="Nothing here" />)

    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('renders title as a link when title and link props are set', () => {
    render(
      <List title="View all" link="/items">
        <List.Item title="One" />
      </List>
    )

    const link = screen.getByRole('link', { name: 'View all' })

    expect(link).toHaveAttribute('href', '/items')
  })

  it('invokes item action callbacks and string actions', () => {
    const fnAction = jest.fn()
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null)

    render(
      <List>
        <List.Item
          title="Row"
          actions={{
            Edit: fnAction,
            Visit: 'https://example.com',
          }}
        />
      </List>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Visit' }))

    expect(fnAction).toHaveBeenCalledTimes(1)
    expect(openSpy).toHaveBeenCalledWith('https://example.com')

    openSpy.mockRestore()
  })
})

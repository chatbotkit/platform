import FAQ from './FAQ'

import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/config/site', () => ({
  siteHostname: 'partner.example.com',
  siteUrl: 'https://partner.example.com',
}))

jest.mock('@/lib/host', () => ({
  getExternalAPIHost: jest.fn(() => 'api.partner.example.com'),
  getExternalStaticHost: jest.fn(() => 'static.partner.example.com'),
  getExternalWidgetHost: jest.fn(() => 'widgets.partner.example.com'),
}))

jest.mock('@/components/Component', () => ({
  __esModule: true,
  default: ({ as: As = 'div', children, ...props }) => (
    <As {...props}>{children}</As>
  ),
}))

jest.mock('@/components/Collapsible', () => ({
  __esModule: true,
  default: ({ as: As = 'div', children, ...props }) => (
    <As {...props}>{children}</As>
  ),
}))

jest.mock('@/components/FAQStructuredData', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}))

jest.mock('@heroicons/react/24/outline', () => ({
  ChevronDownIcon: (props) => <svg data-testid="chevron" {...props} />,
}))

describe('FAQ', () => {
  const faq = [
    { question: 'Question 1', answer: 'Answer 1' },
    { question: 'Question 2', answer: 'Answer 2' },
  ]

  it('returns no section when faq is empty', () => {
    const { container } = render(<FAQ faq={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders heading and limits displayed items by length', () => {
    render(<FAQ faq={faq} length={1} />)

    expect(screen.getByText('Frequently Asked Questions')).toBeTruthy()
    expect(screen.getByText('Question 1')).toBeTruthy()
    expect(screen.queryByText('Question 2')).toBeNull()
  })

  it('toggles answer visibility on question click', () => {
    render(<FAQ faq={faq} />)

    const answer = screen.getByText('Answer 1')
    const container = answer.closest('dd')

    expect(container.className).toContain('!opacity-0')

    fireEvent.click(screen.getByText('Question 1'))

    expect(container.className).not.toContain('!opacity-0')
  })

  it('preserves canonical external documentation links', () => {
    render(
      <FAQ
        faq={[
          {
            question: 'Where are the docs?',
            answer: 'See https://chatbotkit.com/docs/bots',
          },
        ]}
      />
    )

    expect(
      screen.getByText('See https://chatbotkit.com/docs/bots')
    ).toBeTruthy()
  })
})

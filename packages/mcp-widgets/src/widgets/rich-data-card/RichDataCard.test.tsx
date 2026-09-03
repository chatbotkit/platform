import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RichDataCard } from './RichDataCard'

describe('RichDataCard', () => {
  it('renders with title', () => {
    render(<RichDataCard title="Test Title" />)
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })

  it('renders with description', () => {
    render(<RichDataCard title="Title" description="Test description" />)
    expect(screen.getByText('Test description')).toBeInTheDocument()
  })

  it('renders with icon', () => {
    render(<RichDataCard title="Title" icon="🌤️" />)
    expect(screen.getByText('🌤️')).toBeInTheDocument()
  })

  it('renders data as key-value pairs', () => {
    render(
      <RichDataCard
        title="Data"
        data={{ temperature: '72°F', conditions: 'Sunny' }}
      />
    )
    expect(screen.getByText('Temperature')).toBeInTheDocument()
    expect(screen.getByText('72°F')).toBeInTheDocument()
    expect(screen.getByText('Conditions')).toBeInTheDocument()
    expect(screen.getByText('Sunny')).toBeInTheDocument()
  })

  it('renders sections with titles', () => {
    render(
      <RichDataCard
        title="Order"
        sections={[
          { title: 'Shipping', data: { method: 'Express' } },
          { title: 'Payment', data: { status: 'Paid' } },
        ]}
      />
    )
    expect(screen.getByText('Shipping')).toBeInTheDocument()
    expect(screen.getByText('Express')).toBeInTheDocument()
    expect(screen.getByText('Payment')).toBeInTheDocument()
    expect(screen.getByText('Paid')).toBeInTheDocument()
  })

  it('renders footer', () => {
    render(<RichDataCard title="Title" footer="Footer text" />)
    expect(screen.getByText('Footer text')).toBeInTheDocument()
  })

  it('applies status styling', () => {
    const { container } = render(
      <RichDataCard title="Success" status="success" />
    )
    const card = container.querySelector('.rdc-card')
    expect(card).toHaveStyle({ borderColor: '#22c55e' })
  })
})

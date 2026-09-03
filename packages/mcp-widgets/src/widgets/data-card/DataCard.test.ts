import { describe, it, expect, beforeAll } from 'vitest'
import { DataCardElement, register } from './DataCard'

describe('DataCardElement', () => {
  beforeAll(() => {
    register('test-data-card')
  })

  it('exports the DataCardElement class', () => {
    expect(DataCardElement).toBeDefined()
    expect(DataCardElement.observedAttributes).toContain('title')
    expect(DataCardElement.observedAttributes).toContain('data')
    expect(DataCardElement.observedAttributes).toContain('status')
  })

  it('registers as a custom element', () => {
    expect(customElements.get('test-data-card')).toBeDefined()
  })

  it('renders with title attribute', () => {
    const el = document.createElement('test-data-card') as DataCardElement
    el.setAttribute('title', 'Test Title')
    document.body.appendChild(el)

    const shadow = el.shadowRoot
    expect(shadow).not.toBeNull()
    expect(shadow?.innerHTML).toContain('Test Title')

    document.body.removeChild(el)
  })

  it('renders data as key-value pairs', () => {
    const el = document.createElement('test-data-card') as DataCardElement
    el.setAttribute('data', JSON.stringify({ foo: 'bar', count: 42 }))
    document.body.appendChild(el)

    const shadow = el.shadowRoot
    expect(shadow?.innerHTML).toContain('Foo')
    expect(shadow?.innerHTML).toContain('bar')
    expect(shadow?.innerHTML).toContain('42')

    document.body.removeChild(el)
  })

  it('applies status styling', () => {
    const el = document.createElement('test-data-card') as DataCardElement
    el.setAttribute('status', 'success')
    document.body.appendChild(el)

    const shadow = el.shadowRoot
    expect(shadow?.innerHTML).toContain('#22c55e') // success border color

    document.body.removeChild(el)
  })
})

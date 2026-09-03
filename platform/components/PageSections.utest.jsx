import PageSections from './PageSections'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

describe('PageSections', () => {
  it('applies the default section styling classes', () => {
    const { container } = render(<PageSections />)
    const sections = container.firstChild

    expect(sections).toHaveClass('page-sections')
    expect(sections).toHaveClass('zebra')
    expect(sections.className).toContain('[&>*:first-child>.main-page]:pt-8')
    expect(sections.className).toContain(
      '[&>*:first-child]:!bg-white dark:[&>*:first-child]:!bg-black'
    )
  })

  it('merges custom className', () => {
    const { container } = render(<PageSections className="custom-sections" />)

    expect(container.firstChild).toHaveClass('custom-sections')
  })

  it('forwards extra props to the root element', () => {
    const { container } = render(<PageSections data-testid="sections" />)

    expect(
      container.querySelector('[data-testid="sections"]')
    ).toBeInTheDocument()
  })

  it('does not render tabs for a single section', () => {
    render(
      <PageSections>
        <section>
          <div className="main-page">
            <h2>Only Section</h2>
          </div>
        </section>
      </PageSections>
    )

    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('extracts tab titles from section headings', async () => {
    render(
      <PageSections>
        <section>
          <div className="main-page">
            <h2>First Section</h2>
          </div>
        </section>
        <section>
          <div className="main-page">
            <h2>Second Section</h2>
          </div>
        </section>
      </PageSections>
    )

    expect(
      await screen.findByRole('tab', { name: 'First Section' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Second Section' })
    ).toBeInTheDocument()
  })

  it('prefers section data titles over heading text', async () => {
    render(
      <PageSections>
        <section data-page-section-title="Short One">
          <div className="main-page">
            <h2>This Is A Longer Visible Heading</h2>
          </div>
        </section>
        <section data-page-section-title="Short Two">
          <div className="main-page">
            <h2>This Is Another Longer Visible Heading</h2>
          </div>
        </section>
      </PageSections>
    )

    expect(
      await screen.findByRole('tab', { name: 'Short One' })
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Short Two' })).toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'This Is A Longer Visible Heading' })
    ).not.toBeInTheDocument()
  })

  it('uses natural-width truncating tabs without wrapping or scrolling', async () => {
    const { container } = render(
      <PageSections>
        <section>
          <div className="main-page">
            <h2>First Very Long Section Title</h2>
          </div>
        </section>
        <section>
          <div className="main-page">
            <h2>Second Very Long Section Title</h2>
          </div>
        </section>
      </PageSections>
    )

    const firstTab = await screen.findByRole('tab', {
      name: 'First Very Long Section Title',
    })
    const tabList = container.querySelector('.tab-list')

    expect(tabList).toHaveClass('w-full')
    expect(tabList).toHaveClass('flex-nowrap')
    expect(tabList).toHaveClass('overflow-hidden')
    expect(tabList).not.toHaveClass('overflow-x-auto')
    expect(firstTab).toHaveClass('min-w-0', 'truncate')
    expect(firstTab).not.toHaveClass('flex-1')
    expect(firstTab).not.toHaveClass('shrink-0')
  })

  it('sorts tabs by data page section index with higher values first', async () => {
    const { container } = render(
      <PageSections>
        <section data-testid="low-section" data-page-section-index="10">
          <div className="main-page">
            <h2>Low Section</h2>
          </div>
        </section>
        <section data-testid="high-section" data-page-section-index="20">
          <div className="main-page">
            <h2>High Section</h2>
          </div>
        </section>
        <section data-testid="default-section">
          <div className="main-page">
            <h2>Default Section</h2>
          </div>
        </section>
      </PageSections>
    )

    const tabs = await screen.findAllByRole('tab')

    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'High Section',
      'Low Section',
      'Default Section',
    ])

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="low-section"]').style.display
      ).toBe('none')
    })

    expect(
      container.querySelector('[data-testid="high-section"]').style.display
    ).toBe('')
    expect(
      container.querySelector('[data-testid="default-section"]').style.display
    ).toBe('none')
  })

  it('selects the data page section default tab regardless of tab order', async () => {
    const { container } = render(
      <PageSections>
        <section data-testid="default-section" data-page-section-default>
          <div className="main-page">
            <h2>Default Section</h2>
          </div>
        </section>
        <section data-testid="first-section" data-page-section-index="20">
          <div className="main-page">
            <h2>First Section</h2>
          </div>
        </section>
      </PageSections>
    )

    const tabs = await screen.findAllByRole('tab')

    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'First Section',
      'Default Section',
    ])

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="first-section"]').style.display
      ).toBe('none')
    })

    expect(
      container.querySelector('[data-testid="default-section"]').style.display
    ).toBe('')
  })

  it('renders data page section more tabs behind a secondary tab row', async () => {
    const { container } = render(
      <PageSections>
        <section data-testid="primary-section">
          <div className="main-page">
            <h2>Primary Section</h2>
          </div>
        </section>
        <section data-testid="secondary-section" data-page-section-more>
          <div className="main-page">
            <h2>Secondary Section</h2>
          </div>
        </section>
        <section data-testid="another-secondary-section" data-page-section-more>
          <div className="main-page">
            <h2>Another Secondary Section</h2>
          </div>
        </section>
      </PageSections>
    )

    expect(
      await screen.findByRole('tab', { name: 'Primary Section' })
    ).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'Secondary Section' })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('More'))

    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Secondary Section' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: 'Another Secondary Section' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: 'Primary Section' })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Secondary Section' }))

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="primary-section"]').style
          .display
      ).toBe('none')
    })

    expect(
      container.querySelector('[data-testid="secondary-section"]').style
        .display
    ).toBe('')

    fireEvent.click(screen.getByText('Back'))

    expect(
      screen.getByRole('tab', { name: 'Primary Section' })
    ).toBeInTheDocument()
    expect(screen.getByText('More')).toBeInTheDocument()
  })

  it('hides and reveals sections with styles when tabs change', async () => {
    const { container } = render(
      <PageSections>
        <section data-testid="first-section">
          <div className="main-page">
            <h2>First Section</h2>
          </div>
        </section>
        <section data-testid="second-section">
          <div className="main-page">
            <h2>Second Section</h2>
          </div>
        </section>
      </PageSections>
    )

    const firstSection = container.querySelector(
      '[data-testid="first-section"]'
    )
    const secondSection = container.querySelector(
      '[data-testid="second-section"]'
    )

    await waitFor(() => {
      expect(secondSection.style.display).toBe('none')
    })

    expect(firstSection.style.display).toBe('')

    fireEvent.click(screen.getByRole('tab', { name: 'Second Section' }))

    await waitFor(() => {
      expect(firstSection.style.display).toBe('none')
    })

    expect(secondSection.style.display).toBe('')
  })
})

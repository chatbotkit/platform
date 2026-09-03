import SimpleTabs from './SimpleTabs'

import '@testing-library/jest-dom'
import { fireEvent, render } from '@testing-library/react'

describe('SimpleTabs', () => {
  describe('rendering with object-based tabs', () => {
    it('should render tabs from an object', () => {
      const tabs = {
        'Tab One': { content: <div>Content 1</div> },
        'Tab Two': { content: <div>Content 2</div> },
      }

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('Tab One')).toBeInTheDocument()
      expect(getByText('Tab Two')).toBeInTheDocument()
      expect(getByText('Content 1')).toBeInTheDocument()
    })

    it('should render content from children property', () => {
      const tabs = {
        First: { children: <div>Children content</div> },
      }

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('Children content')).toBeInTheDocument()
    })

    it('should render content from panel property', () => {
      const tabs = {
        First: { panel: <div>Panel content</div> },
      }

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('Panel content')).toBeInTheDocument()
    })

    it('should render the tab object itself if no content/children/panel', () => {
      const tabs = {
        First: <div>Direct content</div>,
      }

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('Direct content')).toBeInTheDocument()
    })
  })

  describe('rendering with array-based tabs', () => {
    it('should render tabs from an array with title property', () => {
      const tabs = [
        { title: 'First Tab', content: <div>First content</div> },
        { title: 'Second Tab', content: <div>Second content</div> },
      ]

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('First Tab')).toBeInTheDocument()
      expect(getByText('Second Tab')).toBeInTheDocument()
    })

    it('should fallback to label if title is not present', () => {
      const tabs = [{ label: 'Label Tab', content: <div>Content</div> }]

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('Label Tab')).toBeInTheDocument()
    })

    it('should fallback to name if title and label are not present', () => {
      const tabs = [{ name: 'Name Tab', content: <div>Content</div> }]

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('Name Tab')).toBeInTheDocument()
    })

    it('should fallback to key if title, label and name are not present', () => {
      const tabs = [{ key: 'Key Tab', content: <div>Content</div> }]

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('Key Tab')).toBeInTheDocument()
    })

    it('should fallback to "Tab" if no identifier properties are present', () => {
      const tabs = [{ content: <div>Content</div> }]

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('Tab')).toBeInTheDocument()
    })
  })

  describe('hidden tabs', () => {
    it('should not render tabs marked as hidden (object format)', () => {
      const tabs = {
        Visible: { content: <div>Visible content</div> },
        Hidden: { content: <div>Hidden content</div>, hidden: true },
      }

      const { getByText, queryByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('Visible')).toBeInTheDocument()
      expect(queryByText('Hidden')).not.toBeInTheDocument()
      expect(getByText('Visible content')).toBeInTheDocument()
      expect(queryByText('Hidden content')).not.toBeInTheDocument()
    })

    it('should not render tabs marked as hidden (array format)', () => {
      const tabs = [
        { title: 'Visible', content: <div>Visible content</div> },
        { title: 'Hidden', content: <div>Hidden content</div>, hidden: true },
      ]

      const { getByText, queryByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('Visible')).toBeInTheDocument()
      expect(queryByText('Hidden')).not.toBeInTheDocument()
      expect(getByText('Visible content')).toBeInTheDocument()
      expect(queryByText('Hidden content')).not.toBeInTheDocument()
    })

    it('should render tabs without hidden property', () => {
      const tabs = {
        'No Hidden Prop': { content: <div>Content</div> },
      }

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('No Hidden Prop')).toBeInTheDocument()
    })

    it('should render tabs with hidden set to false', () => {
      const tabs = {
        'Hidden False': { content: <div>Content</div>, hidden: false },
      }

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      expect(getByText('Hidden False')).toBeInTheDocument()
    })
  })

  describe('default tab selection', () => {
    it('should select the first tab by default', () => {
      const tabs = {
        First: { content: <div>First content</div> },
        Second: { content: <div>Second content</div> },
      }

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      // First tab's content should be visible
      expect(getByText('First content')).toBeInTheDocument()
    })

    it('should select tab marked as default (object format)', () => {
      const tabs = {
        First: { content: <div>First content</div> },
        Second: { content: <div>Second content</div>, default: true },
      }

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      // Second tab's content should be visible
      expect(getByText('Second content')).toBeInTheDocument()
    })

    it('should select tab marked as default (array format)', () => {
      const tabs = [
        { title: 'First', content: <div>First content</div> },
        { title: 'Second', content: <div>Second content</div>, default: true },
      ]

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      // Second tab's content should be visible
      expect(getByText('Second content')).toBeInTheDocument()
    })

    it('should fallback to first tab if default is not found', () => {
      const tabs = {
        First: { content: <div>First content</div> },
        Second: { content: <div>Second content</div>, default: false },
      }

      const { getByText } = render(<SimpleTabs tabs={tabs} />)

      // First tab's content should be visible
      expect(getByText('First content')).toBeInTheDocument()
    })
  })

  describe('tab switching', () => {
    it('should switch content when clicking on tabs', () => {
      const tabs = {
        First: { content: <div>First content</div> },
        Second: { content: <div>Second content</div> },
      }

      const { getByText, queryByText } = render(<SimpleTabs tabs={tabs} />)

      // Initially first tab content is visible
      expect(getByText('First content')).toBeInTheDocument()

      // Click on second tab
      fireEvent.click(getByText('Second'))

      // Second tab content should now be visible
      expect(getByText('Second content')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('should apply custom className to the container', () => {
      const tabs = {
        First: { content: <div>Content</div> },
      }

      const { container } = render(
        <SimpleTabs tabs={tabs} className="custom-class" />
      )

      const tabGroup = container.querySelector('.simple-tabs')

      expect(tabGroup).toHaveClass('custom-class')
    })

    it('should have base styling classes', () => {
      const tabs = {
        First: { content: <div>Content</div> },
      }

      const { container } = render(<SimpleTabs tabs={tabs} />)

      const tabGroup = container.querySelector('.simple-tabs')

      expect(tabGroup).toHaveClass('simple-tabs', 'space-y-6')
    })

    it('should apply tab-list styling', () => {
      const tabs = {
        First: { content: <div>Content</div> },
      }

      const { container } = render(<SimpleTabs tabs={tabs} />)

      const tabList = container.querySelector('.tab-list')

      expect(tabList).toHaveClass('flex', 'space-x-4')
    })
  })

  describe('keepMounted', () => {
    const tabs = {
      First: { content: <div>First content</div> },
      Second: { content: <div>Second content</div> },
    }

    it('should unmount the unselected panels by default', () => {
      const { queryByText } = render(<SimpleTabs tabs={tabs} />)

      expect(queryByText('First content')).toBeInTheDocument()
      expect(queryByText('Second content')).not.toBeInTheDocument()
    })

    it('should keep the unselected panels mounted when asked', () => {
      const { queryByText } = render(
        <SimpleTabs tabs={tabs} keepMounted={true} />
      )

      expect(queryByText('First content')).toBeInTheDocument()
      expect(queryByText('Second content')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle empty object tabs', () => {
      const { container } = render(<SimpleTabs tabs={{}} />)

      expect(container.querySelector('.simple-tabs')).toBeInTheDocument()
    })

    it('should handle empty array tabs', () => {
      const { container } = render(<SimpleTabs tabs={[]} />)

      expect(container.querySelector('.simple-tabs')).toBeInTheDocument()
    })

    it('should handle null/undefined content gracefully', () => {
      const tabs = {
        First: null,
        Second: undefined,
      }

      const { getByText, container } = render(<SimpleTabs tabs={tabs} />)

      // Tab titles should still render
      expect(getByText('First')).toBeInTheDocument()
      expect(getByText('Second')).toBeInTheDocument()

      // Component should not crash
      expect(container.querySelector('.simple-tabs')).toBeInTheDocument()
    })

    it('should forward additional props to Tab.Group', () => {
      const onChange = jest.fn()
      const tabs = {
        First: { content: <div>Content</div> },
        Second: { content: <div>Other</div> },
      }

      const { getByText } = render(
        <SimpleTabs tabs={tabs} onChange={onChange} />
      )

      fireEvent.click(getByText('Second'))

      expect(onChange).toHaveBeenCalled()
    })
  })
})

import WidgetPluginsSelect from './WidgetPluginsSelect'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@/components/CommaListSelect', () => {
  return function MockCommaListSelect(props) {
    return (
      <div data-testid="comma-list-select" data-props={JSON.stringify(props)} />
    )
  }
})

describe('WidgetPluginsSelect', () => {
  it('passes the default placeholder to CommaListSelect', () => {
    render(<WidgetPluginsSelect />)

    const element = screen.getByTestId('comma-list-select')
    const props = JSON.parse(element.getAttribute('data-props'))

    expect(props.placeholder).toBe('Type the plugin and press enter...')
  })

  it('forwards incoming props', () => {
    render(<WidgetPluginsSelect name="plugins" value="alpha" />)

    const element = screen.getByTestId('comma-list-select')
    const props = JSON.parse(element.getAttribute('data-props'))

    expect(props.name).toBe('plugins')
    expect(props.value).toBe('alpha')
  })
})

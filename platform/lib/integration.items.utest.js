import React from 'react'

import { actions, icons, items } from './integration.items'

describe('integration.items', () => {
  it('should expose unique action slugs', () => {
    const slugs = actions.map((action) => action.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('should map every action by slug in items', () => {
    for (const action of actions) {
      expect(items[action.slug]).toBe(action)
    }
  })

  it('should include expected primary integration actions', () => {
    expect(items.widget.title).toBe('AI Widget')
    expect(items.slack.title).toBe('Slack Bot')
    expect(items.mcpserver.title).toBe('MCP Server')
  })

  it('should expose icon render functions on actions', () => {
    for (const action of actions) {
      expect(typeof action.Icon).toBe('function')
    }
  })

  it('should render icon elements with merged class names', () => {
    const element = icons.slack({ className: 'w-4 h-4' })

    expect(React.isValidElement(element)).toBe(true)
    expect(element.props.className).toContain('w-4')
    expect(element.props.className).toContain('h-4')
  })

  it('should not hardcode brand colors on icon elements', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    try {
      for (const action of actions) {
        const element = action.Icon({ className: 'integration-icon' })

        expect(element.props.className).toBe('integration-icon')
      }
    } finally {
      consoleError.mockRestore()
    }
  })
})

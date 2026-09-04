/**
 * @jest-environment jsdom
 */

describe('widget v2 configuration merge', () => {
  afterEach(() => {
    delete window.chatbotkitWidgetConfiguration
    delete Object.prototype.polluted
  })

  it('should not let the page configuration pollute Object.prototype', async () => {
    // @note the bundle reads its script tag on load and merges the page
    // configuration before it checks for a widget id, so no widget id is
    // needed to reach the merge and nothing gets mounted
    const script = document.createElement('script')

    script.src = 'https://example.com/static/embed.widget.v2.js'

    Object.defineProperty(document, 'currentScript', {
      configurable: true,
      value: script,
    })

    window.chatbotkitWidgetConfiguration = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"params":{"caption":"Hi"}}'
    )

    await import('./v2')

    expect(window.customElements.get('chatbotkit-widget')).toBeDefined()

    expect({}.polluted).toBeUndefined()
    expect(Object.prototype).not.toHaveProperty('polluted')
  })
})

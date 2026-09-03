import { ConfigContext, ThemeWrapper, getThemeConfig } from './frame'

import { cleanup, render } from '@testing-library/react'

describe('ThemeWrapper', () => {
  afterEach(() => {
    cleanup()

    // clean up any Google Fonts links that might have been added

    const links = document.head.querySelectorAll(
      'link[href*="fonts.googleapis.com"]'
    )

    links.forEach((link) => link.remove())
  })

  describe('Google Fonts link cleanup', () => {
    it('should not throw when cleanup runs after link is already removed', () => {
      // @note this test reproduces the regression
      // The bug occurs when React's effect cleanup runs but the link element
      // has already been removed from document.head (e.g., by Strict Mode
      // double-invocation or concurrent rendering)

      const theme = getThemeConfig({ fontFamily: 'Roboto' })

      const wrapper = ({ children }) => (
        <ConfigContext.Provider value={{ theme: null }}>
          {children}
        </ConfigContext.Provider>
      )

      const { unmount } = render(
        <ThemeWrapper theme={theme}>
          <div>Test content</div>
        </ThemeWrapper>,
        { wrapper }
      )

      // find the link element that was added

      const link = document.head.querySelector(
        'link[href*="fonts.googleapis.com"]'
      )

      expect(link).not.toBeNull()

      // simulate external removal (browser extension, script, etc.)

      link.remove()

      // this should NOT throw NotFoundError

      expect(() => unmount()).not.toThrow()
    })

    it('should add Google Fonts link when fontFamily is provided', () => {
      const theme = getThemeConfig({ fontFamily: 'Open Sans' })

      const wrapper = ({ children }) => (
        <ConfigContext.Provider value={{ theme: null }}>
          {children}
        </ConfigContext.Provider>
      )

      render(
        <ThemeWrapper theme={theme}>
          <div>Test content</div>
        </ThemeWrapper>,
        { wrapper }
      )

      const link = document.head.querySelector(
        'link[href*="fonts.googleapis.com"]'
      )

      expect(link).not.toBeNull()
      expect(link.href).toContain('Open%20Sans')
    })

    it('should not add Google Fonts link for ui-monospace', () => {
      const theme = getThemeConfig({ fontFamily: 'ui-monospace' })

      const wrapper = ({ children }) => (
        <ConfigContext.Provider value={{ theme: null }}>
          {children}
        </ConfigContext.Provider>
      )

      render(
        <ThemeWrapper theme={theme}>
          <div>Test content</div>
        </ThemeWrapper>,
        { wrapper }
      )

      const link = document.head.querySelector(
        'link[href*="fonts.googleapis.com"]'
      )

      expect(link).toBeNull()
    })

    it('should remove Google Fonts link on unmount when link still exists', () => {
      const theme = getThemeConfig({ fontFamily: 'Lato' })

      const wrapper = ({ children }) => (
        <ConfigContext.Provider value={{ theme: null }}>
          {children}
        </ConfigContext.Provider>
      )

      const { unmount } = render(
        <ThemeWrapper theme={theme}>
          <div>Test content</div>
        </ThemeWrapper>,
        { wrapper }
      )

      const link = document.head.querySelector(
        'link[href*="fonts.googleapis.com"]'
      )

      expect(link).not.toBeNull()

      unmount()

      const linkAfterUnmount = document.head.querySelector(
        'link[href*="fonts.googleapis.com"]'
      )

      expect(linkAfterUnmount).toBeNull()
    })
  })
})

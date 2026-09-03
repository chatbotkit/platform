/* eslint-disable @typescript-eslint/no-require-imports */

describe('app.router.pages.config', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should load without throwing', () => {
    expect(() => require('./app.router.pages.config')).not.toThrow()
  })

  it('should be safely importable multiple times', () => {
    expect(() => {
      require('./app.router.pages.config')
      require('./app.router.pages.config')
    }).not.toThrow()
  })
})

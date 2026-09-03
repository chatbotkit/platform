/* eslint-disable @typescript-eslint/no-require-imports */

describe('messenger.config', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should load module without throwing', () => {
    expect(() => require('./messenger.config')).not.toThrow()
  })

  it('should load repeatedly without side effects', () => {
    expect(() => {
      require('./messenger.config')
      require('./messenger.config')
    }).not.toThrow()
  })
})

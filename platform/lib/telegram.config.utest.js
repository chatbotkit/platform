/* eslint-disable @typescript-eslint/no-require-imports */

describe('telegram.config', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should load module without throwing', () => {
    expect(() => require('./telegram.config')).not.toThrow()
  })

  it('should load repeatedly without side effects', () => {
    expect(() => {
      require('./telegram.config')
      require('./telegram.config')
    }).not.toThrow()
  })
})

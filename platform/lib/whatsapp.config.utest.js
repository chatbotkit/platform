/* eslint-disable @typescript-eslint/no-require-imports */

describe('whatsapp.config', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should load module without throwing', () => {
    expect(() => require('./whatsapp.config')).not.toThrow()
  })

  it('should load repeatedly without side effects', () => {
    expect(() => {
      require('./whatsapp.config')
      require('./whatsapp.config')
    }).not.toThrow()
  })
})

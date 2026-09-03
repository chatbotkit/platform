import secrets from './index'

describe('community platform secret catalogue', () => {
  it('is empty', () => {
    expect(secrets).toEqual({})
  })

  it('reports no entry for a platform template', () => {
    expect(secrets['platform/google/mail']).toBeUndefined()
  })
})

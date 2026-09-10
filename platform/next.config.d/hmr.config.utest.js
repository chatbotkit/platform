import config from './hmr.config'

describe('hmr.config', () => {
  it('keeps the Server Components HMR fetch cache off', () => {
    // @note the database driver speaks a stateful protocol over fetch; a
    // replayed `BEGIN` binds a request to an already committed transaction
    expect(config.experimental.serverComponentsHmrCache).toBe(false)
  })
})

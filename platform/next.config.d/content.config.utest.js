/* eslint-disable @typescript-eslint/no-require-imports */

const config = require('./content.config').default

describe('content.config', () => {
  it('redirects platform-owned content routes to their publishing sites', async () => {
    await expect(config.redirects()).resolves.toEqual([
      {
        source: '/manuals/:path*',
        destination: 'https://docs.cbk.ai/:path*',
        permanent: true,
      },
    ])
  })
})

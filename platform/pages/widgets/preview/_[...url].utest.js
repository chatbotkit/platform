/**
 * @jest-environment node
 */
import { makeScreenshot } from '@/lib/webshot'

import { getServerSideProps } from './[...url]'

jest.mock('@/lib/webshot', () => ({
  makeScreenshot: jest.fn((url) => `shot:${url}`),
  makeScreenshotRequest: jest.fn(),
}))
jest.mock('@/lib/cdn', () => ({
  CACHE_PRESETS: {},
  applyCacheHeaders: jest.fn(),
}))
jest.mock('@/lib/fetch', () => jest.fn())
jest.mock('@/lib/save', () => ({ saveBlob: jest.fn() }))
jest.mock('@/lib/dataurl.fetch', () => ({ fetchDataUrl: jest.fn() }))
jest.mock('@/lib/dataurl.response', () => ({ responseToDataUrl: jest.fn() }))
jest.mock('@/pages/api/v1/url/unfurl', () => ({ unfurlPage: jest.fn() }))
jest.mock('@/components/DotsLoader', () => () => null)
jest.mock('@/components/Meta', () => () => null)
jest.mock('@/components/Toggle', () => () => null)
jest.mock('@/components/WidgetPreview', () => () => null)
jest.mock('@/hooks/useEntryAnimation', () => jest.fn())
jest.mock('@/hooks/useFetch', () => jest.fn())
jest.mock('@/hooks/useImageColorPalette', () => jest.fn())
jest.mock('@/hooks/usePopup', () => jest.fn())
jest.mock('@/hooks/useRouter', () => jest.fn())
jest.mock('@/hooks/useSession', () => jest.fn())

function context(host, mode) {
  return {
    query: { url: [mode, 'example.com'] },
    resolvedUrl: `/widgets/preview/${mode}/example.com`,
    req: {
      method: 'GET',
      url: `/widgets/preview/${mode}/example.com`,
      query: {},
      headers: { host },
    },
    res: { setHeader: jest.fn() },
  }
}

describe('widget preview capture routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each(['capture', 'screenshot', 'card'])(
    'shoots the %s page on the origin the deployment serves',
    async (mode) => {
      const result = await getServerSideProps(context('cbk.localhost:3000', mode))

      // @note a hard-coded https origin would point the screenshot service
      // at a scheme the local stack does not serve
      expect(makeScreenshot).toHaveBeenCalledWith(
        expect.stringMatching(
          /^http:\/\/cbk\.localhost:3000\/widgets\/preview\/example\.com\?layout=/
        ),
        expect.any(Object)
      )
      expect(result.redirect.destination).toMatch(/^shot:http:\/\/cbk\.localhost:3000\//)
    }
  )
})

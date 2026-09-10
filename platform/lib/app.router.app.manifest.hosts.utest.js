import { getAppManifestPath } from '@/lib/app.router.app.manifest'
import { setupHeadersContext } from '@/lib/context.setup'
import {
  executeInContext,
  getContextFrontendHost,
  getContextRequestHost,
} from '@/lib/context.store'

jest.mock('@/config/origins', () => ({
  appMainHost: 'apps.manifest.localhost:4300',
  appLabsHost: 'labs.manifest.localhost:4300',
}))

jest.mock('@/config/hosts', () => ({
  ...jest.requireActual('@/config/hosts'),
  hostsConfig: {
    shell: {
      match: ['apps.manifest.localhost:4300', 'labs.manifest.localhost:4300'],
      site: 'console.manifest.localhost:4300',
      api: 'console.manifest.localhost:4300',
      static: 'console.manifest.localhost:4300',
      widgets: 'console.manifest.localhost:4300',
    },
  },
}))

describe('manifest discovery with request host mappings', () => {
  it.each(['apps', 'labs'])(
    'keeps the manifest link on the mapped %s shell',
    async (shell) => {
      await executeInContext(async () => {
        const host = `${shell}.manifest.localhost:4300`

        setupHeadersContext(new Headers({ host }))

        expect(getContextRequestHost()).toBe(host)
        expect(getContextFrontendHost()).toBe('console.manifest.localhost:4300')
        expect(getAppManifestPath()).toBe('/app.webmanifest')
      })
    }
  )

  it('does not advertise an app manifest on a platform-only host', async () => {
    await executeInContext(async () => {
      setupHeadersContext(
        new Headers({ host: 'console.manifest.localhost:4300' })
      )

      expect(getAppManifestPath()).toBeNull()
    })
  })
})

/**
 * @jest-environment node
 */
import { headers } from 'next/headers'

import { withAppRouterContext } from '@/lib/app.router.context'
import {
  executeInContext,
  getContextFrontendHost,
  getContextRequestHost,
  setContextFrontendHost,
} from '@/lib/context.store'

jest.mock('next/headers', () => ({
  headers: jest.fn(),
}))

describe('withAppRouterContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize header context and forward arguments', async () => {
    headers.mockReturnValue(new Headers({ host: 'portal.example.com' }))

    const entrypoint = withAppRouterContext(async (prefix, suffix) => ({
      host: getContextRequestHost(),
      value: `${prefix}-${suffix}`,
    }))

    await expect(entrypoint('hello', 'world')).resolves.toEqual({
      host: 'portal.example.com',
      value: 'hello-world',
    })
  })

  it('should not inherit mutable state from an enclosing context', async () => {
    headers.mockReturnValue(new Headers({ host: 'child.example.com' }))

    await executeInContext(async () => {
      setContextFrontendHost('parent.example.com')

      const entrypoint = withAppRouterContext(async () => ({
        frontendHost: getContextFrontendHost(),
        requestHost: getContextRequestHost(),
      }))

      await expect(entrypoint()).resolves.toEqual({
        frontendHost: undefined,
        requestHost: 'child.example.com',
      })

      expect(getContextFrontendHost()).toBe('parent.example.com')
    })
  })
})

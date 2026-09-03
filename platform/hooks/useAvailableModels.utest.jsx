import useAvailableModels, {
  _resetAvailableModelsCache,
  useAvailableDefaultModel,
} from './useAvailableModels'

import '@testing-library/jest-dom'
import { renderHook, waitFor } from '@testing-library/react'

describe('useAvailableModels', () => {
  beforeEach(() => {
    _resetAvailableModelsCache()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    delete global.fetch
  })

  it('resolves the model ids from the platform list', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: 'gpt-5.4-mini' }, { id: 'base' }] }),
    })

    const { result } = renderHook(() => useAvailableModels())

    await waitFor(() => {
      expect(result.current).toEqual(['gpt-5.4-mini', 'base'])
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/platform/model/list?type=language',
      undefined
    )
  })

  it('resolves the deployment default from the platform list', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ id: 'other' }, { id: 'served-default', default: true }],
      }),
    })

    const { result } = renderHook(() => useAvailableDefaultModel())

    await waitFor(() => {
      expect(result.current).toBe('served-default')
    })
  })

  it('resolves no default when the platform list marks none', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: 'other' }] }),
    })

    const models = renderHook(() => useAvailableModels())
    const defaultModel = renderHook(() => useAvailableDefaultModel())

    await waitFor(() => {
      expect(models.result.current).toEqual(['other'])
    })

    expect(defaultModel.result.current).toBeNull()
  })

  it('shares one fetch per type across instances', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: 'base' }] }),
    })

    const first = renderHook(() => useAvailableModels('image'))
    const second = renderHook(() => useAvailableModels('image'))
    const other = renderHook(() => useAvailableModels('video'))

    await waitFor(() => {
      expect(first.result.current).toEqual(['base'])
      expect(second.result.current).toEqual(['base'])
      expect(other.result.current).toEqual(['base'])
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/platform/model/list?type=image',
      undefined
    )
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/platform/model/list?type=video',
      undefined
    )
  })

  it('returns null and retries after a failure', async () => {
    global.fetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: 'base' }] }),
    })

    const failed = renderHook(() => useAvailableModels())

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    expect(failed.result.current).toBeNull()

    const retried = renderHook(() => useAvailableModels())

    await waitFor(() => {
      expect(retried.result.current).toEqual(['base'])
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})

import fetch from '@/lib/fetch'

import useSkillsetSecrets, {
  SECRET_NEEDS_SETUP,
  SECRET_PER_CONTACT,
} from './useSkillsetSecrets'

import { act, renderHook, waitFor } from '@testing-library/react'

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/fetch', () => jest.fn())

describe('useSkillsetSecrets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should initialize with empty secrets and loading false', () => {
    const { result } = renderHook(() => useSkillsetSecrets(null))

    expect(result.current.secrets).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('should load shared secrets with authenticated status', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          shared: {
            edges: [
              {
                node: {
                  id: 'secret-1',
                  name: 'AWS Key',
                  description: 'AWS Credentials',
                  type: 'bearer',
                  kind: 'shared',
                  verification: {
                    status: 'authenticated',
                    action: null,
                  },
                },
              },
            ],
          },
          personal: {
            edges: [],
          },
        },
        errors: null,
      }),
    }

    fetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useSkillsetSecrets('skillset-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secrets).toHaveLength(1)
    expect(result.current.secrets[0]).toMatchObject({
      id: 'secret-1',
      name: 'AWS Key',
      status: 'authenticated',
      actionUrl: null,
    })
  })

  it('should load personal secrets with contact status', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          shared: {
            edges: [],
          },
          personal: {
            edges: [
              {
                node: {
                  id: 'secret-2',
                  name: 'Gmail',
                  description: 'Gmail Auth',
                  type: 'oauth',
                  kind: 'personal',
                },
              },
            ],
          },
        },
        errors: null,
      }),
    }

    fetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useSkillsetSecrets('skillset-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secrets).toHaveLength(1)
    expect(result.current.secrets[0]).toMatchObject({
      id: 'secret-2',
      name: 'Gmail',
      status: SECRET_PER_CONTACT,
      actionUrl: null,
    })
  })

  it('should handle unauthenticated shared secrets with action URL', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          shared: {
            edges: [
              {
                node: {
                  id: 'secret-3',
                  name: 'Slack',
                  description: 'Slack App',
                  type: 'oauth',
                  kind: 'shared',
                  verification: {
                    status: 'unauthenticated',
                    action: {
                      type: 'redirect',
                      url: 'https://example.com/setup',
                    },
                  },
                },
              },
            ],
          },
          personal: {
            edges: [],
          },
        },
        errors: null,
      }),
    }

    fetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useSkillsetSecrets('skillset-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secrets[0]).toMatchObject({
      id: 'secret-3',
      status: SECRET_NEEDS_SETUP,
      actionUrl: 'https://example.com/setup',
    })
  })

  it('should combine shared and personal secrets', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          shared: {
            edges: [
              {
                node: {
                  id: 'shared-1',
                  name: 'AWS',
                  type: 'bearer',
                  kind: 'shared',
                  verification: {
                    status: 'authenticated',
                  },
                },
              },
            ],
          },
          personal: {
            edges: [
              {
                node: {
                  id: 'personal-1',
                  name: 'Gmail',
                  type: 'oauth',
                  kind: 'personal',
                },
              },
            ],
          },
        },
        errors: null,
      }),
    }

    fetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useSkillsetSecrets('skillset-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secrets).toHaveLength(2)
    expect(result.current.secrets[0].id).toBe('shared-1')
    expect(result.current.secrets[1].id).toBe('personal-1')
  })

  it('should handle GraphQL errors', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: null,
        errors: [
          {
            message: 'Unauthorized',
          },
        ],
      }),
    }

    fetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useSkillsetSecrets('skillset-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secrets).toEqual([])
  })

  it('should handle network errors', async () => {
    const mockError = new Error('Network error')

    fetch.mockRejectedValue(mockError)

    const { result } = renderHook(() => useSkillsetSecrets('skillset-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secrets).toEqual([])
  })

  it('should handle HTTP errors', async () => {
    const mockResponse = {
      ok: false,
      json: jest.fn().mockResolvedValue({
        errors: [
          {
            message: 'Server error',
          },
        ],
      }),
    }

    fetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useSkillsetSecrets('skillset-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secrets).toEqual([])
  })

  it('should not load secrets when skillsetId is null', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          shared: { edges: [] },
          personal: { edges: [] },
        },
      }),
    }

    fetch.mockResolvedValue(mockResponse)

    renderHook(() => useSkillsetSecrets(null))

    await waitFor(() => {
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  it('should allow manual refresh', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          shared: {
            edges: [
              {
                node: {
                  id: 'secret-1',
                  name: 'Secret',
                  type: 'bearer',
                  kind: 'shared',
                  verification: { status: 'authenticated' },
                },
              },
            ],
          },
          personal: { edges: [] },
        },
      }),
    }

    fetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useSkillsetSecrets('skillset-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const initialSecrets = result.current.secrets

    // Manually refresh
    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.secrets).toEqual(initialSecrets)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('should handle null edges gracefully', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          shared: {
            edges: [
              {
                node: {
                  id: 'secret-1',
                  name: 'Secret',
                  type: 'bearer',
                  kind: 'shared',
                  verification: { status: 'authenticated' },
                },
              },
              null, // null edge
            ],
          },
          personal: {
            edges: [null], // null edge
          },
        },
      }),
    }

    fetch.mockResolvedValue(mockResponse)

    const { result } = renderHook(() => useSkillsetSecrets('skillset-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Should only include valid nodes
    expect(result.current.secrets).toHaveLength(1)
    expect(result.current.secrets[0].id).toBe('secret-1')
  })

  it('should send correct GraphQL query', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: { shared: { edges: [] }, personal: { edges: [] } },
      }),
    }

    fetch.mockResolvedValue(mockResponse)

    renderHook(() => useSkillsetSecrets('skillset-abc'))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })

    const callArgs = fetch.mock.calls[0]

    expect(callArgs[0]).toBe('/api/v1/graphql')
    expect(callArgs[1].method).toBe('POST')
    expect(callArgs[1].body).toContain('SkillsetSecrets')
    expect(callArgs[1].body).toContain('skillset-abc')
  })
})

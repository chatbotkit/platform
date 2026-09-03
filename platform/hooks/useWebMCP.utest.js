import useWebMCP from './useWebMCP'

import { renderHook } from '@testing-library/react'

function createTool(name = 'chatbotkit.search') {
  return {
    name,
    description: `${name} description`,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
        },
      },
    },
    execute: jest.fn(),
  }
}

describe('useWebMCP', () => {
  let registerTool

  beforeEach(() => {
    registerTool = jest.fn()
    navigator.modelContext = {
      registerTool,
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete navigator.modelContext
  })

  it('should do nothing when WebMCP is unavailable', () => {
    delete navigator.modelContext

    expect(() => renderHook(() => useWebMCP(createTool()))).not.toThrow()
  })

  it('should do nothing when no tools are provided', () => {
    renderHook(() => useWebMCP(null))

    expect(registerTool).not.toHaveBeenCalled()
  })

  it('should register a single tool', () => {
    const tool = createTool()

    renderHook(() => useWebMCP(tool))

    expect(registerTool).toHaveBeenCalledTimes(1)
    expect(registerTool).toHaveBeenCalledWith(
      tool,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    )
  })

  it('should register multiple tools with the same abort signal', () => {
    const toolA = createTool('chatbotkit.search')
    const toolB = createTool('chatbotkit.navigate')

    renderHook(() => useWebMCP([toolA, toolB]))

    expect(registerTool).toHaveBeenCalledTimes(2)
    expect(registerTool).toHaveBeenNthCalledWith(
      1,
      toolA,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    )
    expect(registerTool).toHaveBeenNthCalledWith(
      2,
      toolB,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    )

    const firstSignal = registerTool.mock.calls[0][1].signal
    const secondSignal = registerTool.mock.calls[1][1].signal

    expect(firstSignal).toBe(secondSignal)
    expect(firstSignal.aborted).toBe(false)
  })

  it('should abort registered tools on unmount', () => {
    const { unmount } = renderHook(() => useWebMCP(createTool()))

    const signal = registerTool.mock.calls[0][1].signal

    expect(signal.aborted).toBe(false)

    unmount()

    expect(signal.aborted).toBe(true)
  })

  it('should abort previous registrations before registering new tools', () => {
    const toolA = createTool('chatbotkit.search')
    const toolB = createTool('chatbotkit.navigate')

    const { rerender } = renderHook(({ tool }) => useWebMCP(tool), {
      initialProps: { tool: toolA },
    })

    const firstSignal = registerTool.mock.calls[0][1].signal

    expect(firstSignal.aborted).toBe(false)

    rerender({ tool: toolB })

    expect(firstSignal.aborted).toBe(true)
    expect(registerTool).toHaveBeenCalledTimes(2)
    expect(registerTool).toHaveBeenNthCalledWith(
      2,
      toolB,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    )
  })

  it('should not register a keyed map of functions as a single tool', () => {
    // @note regression coverage: a keyed map (not an array
    // of tools) must not be passed through to registerTool, which would throw
    // on the missing top-level `description`.
    const functionsMap = {
      'chatbotkit.search': {
        description: 'search description',
        parameters: { type: 'object' },
        handler: jest.fn(),
      },
    }

    renderHook(() => useWebMCP(functionsMap))

    expect(registerTool).not.toHaveBeenCalled()
  })

  it('should skip malformed tools but still register valid ones', () => {
    const validTool = createTool('chatbotkit.search')

    renderHook(() => useWebMCP([{ inputSchema: {} }, validTool]))

    expect(registerTool).toHaveBeenCalledTimes(1)
    expect(registerTool).toHaveBeenCalledWith(
      validTool,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('should keep registering remaining tools when one throws', () => {
    const toolA = createTool('chatbotkit.search')
    const toolB = createTool('chatbotkit.navigate')

    registerTool.mockImplementationOnce(() => {
      throw new TypeError('rejected by browser')
    })

    renderHook(() => useWebMCP([toolA, toolB]))

    expect(registerTool).toHaveBeenCalledTimes(2)
    expect(registerTool).toHaveBeenNthCalledWith(2, toolB, expect.anything())
  })
})

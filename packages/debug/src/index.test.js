import { assert, debug } from './index'

describe('assert', () => {
  it('should not throw an error when the test is true', () => {
    expect(() => {
      assert(true, 'This should not throw an error')
    }).not.toThrow()
  })

  it('should throw an error when the test is false', () => {
    expect(() => {
      assert(false, 'This should throw an error')
    }).toThrow('This should throw an error')
  })
})

describe('debug logging', () => {
  let consoleSpy

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('should serialize nested objects properly in logs', () => {
    const nestedObject = {
      level1: {
        level2: {
          level3: {
            value: 'test',
          },
        },
      },
    }

    debug(nestedObject).log()

    expect(consoleSpy).toHaveBeenCalled()

    const loggedArg = consoleSpy.mock.calls[0][1]

    // should contain the nested value, not [Object]
    expect(loggedArg).toContain('test')
    expect(loggedArg).toContain('level3')
  })

  it('should limit depth of very deep objects', () => {
    // create an object deeper than maxDepth (10 in development)
    const deepObject = {
      l1: {
        l2: {
          l3: {
            l4: {
              l5: {
                l6: {
                  l7: {
                    l8: {
                      l9: {
                        l10: {
                          l11: {
                            deep: 'value',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }

    debug(deepObject).log()

    expect(consoleSpy).toHaveBeenCalled()

    const loggedArg = consoleSpy.mock.calls[0][1]

    // at depth 10, deeper objects should be [Object]
    expect(loggedArg).toContain('[Object]')
  })

  it('should handle circular references', () => {
    const circularObj = { name: 'test' }

    circularObj.self = circularObj

    debug(circularObj).log()

    expect(consoleSpy).toHaveBeenCalled()

    const loggedArg = consoleSpy.mock.calls[0][1]

    expect(loggedArg).toContain('[Circular]')
    expect(loggedArg).toContain('test')
  })

  it('should handle arrays with depth limiting', () => {
    const deepArray = {
      items: [
        {
          l1: {
            l2: {
              l3: {
                l4: {
                  l5: {
                    l6: {
                      l7: {
                        l8: {
                          l9: { l10: { tooDeep: 'value' } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    }

    debug(deepArray).log()

    expect(consoleSpy).toHaveBeenCalled()

    const loggedArg = consoleSpy.mock.calls[0][1]

    // should show [Object] for very deep arrays
    expect(loggedArg).toContain('[Object]')
  })

  it('should truncate long strings', () => {
    debug({ audio: 'a'.repeat(3000) }).log()

    expect(consoleSpy).toHaveBeenCalled()

    const loggedArg = consoleSpy.mock.calls[0][1]

    expect(loggedArg).toContain('[String(3000)]')
    expect(loggedArg.length).toBeLessThan(2500)
  })

  it('should summarize binary data', () => {
    debug({ buffer: Buffer.alloc(4096) }).log()

    expect(consoleSpy).toHaveBeenCalled()

    const loggedArg = consoleSpy.mock.calls[0][1]

    expect(loggedArg).toContain('[Buffer(4096)]')
    expect(loggedArg).not.toContain('"0":')
  })

  it('should summarize class instances', () => {
    class CustomRuntimeObject {
      constructor() {
        this._events = {}
        this._buffer = Buffer.alloc(4096)
      }
    }

    debug({ socket: new CustomRuntimeObject() }).log()

    expect(consoleSpy).toHaveBeenCalled()

    const loggedArg = consoleSpy.mock.calls[0][1]

    expect(loggedArg).toContain('[CustomRuntimeObject]')
    expect(loggedArg).not.toContain('_buffer')
  })

  it('should safely summarize invalid dates', () => {
    debug({ createdAt: new Date('invalid') }).log()

    expect(consoleSpy).toHaveBeenCalled()

    const loggedArg = consoleSpy.mock.calls[0][1]

    expect(loggedArg).toContain('Invalid Date')
  })
})

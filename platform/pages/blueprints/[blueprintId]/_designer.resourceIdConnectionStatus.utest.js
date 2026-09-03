import { getResourceIdConnectionStatus } from './designer'

describe('getResourceIdConnectionStatus', () => {
  const nodes = [{ id: '#bot:::existing' }]

  it('treats empty values as empty', () => {
    expect(getResourceIdConnectionStatus('', nodes)).toBe('empty')
    expect(getResourceIdConnectionStatus(null, nodes)).toBe('empty')
  })

  it('treats external and dynamic references as empty', () => {
    expect(getResourceIdConnectionStatus('@known-resource', nodes)).toBe(
      'empty'
    )
    expect(getResourceIdConnectionStatus('(runtimeResourceId)', nodes)).toBe(
      'empty'
    )
  })

  it('validates blueprint-local references against graph nodes', () => {
    expect(getResourceIdConnectionStatus('#bot:::existing', nodes)).toBe(
      'connected'
    )
    expect(getResourceIdConnectionStatus('#bot:::missing', nodes)).toBe(
      'orphan'
    )
  })

  it('treats cuid-shaped platform IDs as valid', () => {
    expect(
      getResourceIdConnectionStatus('abcdefghijklmnopqrstuvwx', nodes)
    ).toBe('valid')
    expect(
      getResourceIdConnectionStatus('cmoli2n6t000tcafbys9xzw83', nodes)
    ).toBe('valid')
  })

  it('treats uuid-shaped platform IDs as valid', () => {
    expect(
      getResourceIdConnectionStatus(
        '123e4567-e89b-12d3-a456-426614174000',
        nodes
      )
    ).toBe('valid')
  })

  it('treats non-platform external values as invalid', () => {
    expect(getResourceIdConnectionStatus('not-a-cuid', nodes)).toBe('orphan')
  })
})

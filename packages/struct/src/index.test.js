/* eslint-disable no-undef */
import { SafeJson, makeJsonSafe, stripEmpty } from './index'

describe('makeJsonSafe', () => {
  it('should exclude properties with keys starting with #', () => {
    const unsafeObject = {
      '#secret': 'hidden value',
      visible: 'visible value',
    }

    expect(makeJsonSafe(unsafeObject)).toEqual({ visible: 'visible value' })
  })

  it('should handle nested properties with keys starting with #', () => {
    const unsafeObject = {
      visible: 'visible value',
      nested: {
        '#secret': 'hidden value',
        alsoVisible: 'also visible value',
      },
    }

    expect(makeJsonSafe(unsafeObject)).toEqual({
      visible: 'visible value',
      nested: {
        alsoVisible: 'also visible value',
      },
    })
  })

  it('should handle arrays containing objects with keys starting with #', () => {
    const unsafeObject = [
      {
        '#secret': 'hidden value',
        visible: 'visible value',
      },
    ]

    expect(makeJsonSafe(unsafeObject)).toEqual([{ visible: 'visible value' }])
  })

  it('should exclude properties with keys matching the regexp from options', () => {
    const unsafeObject = {
      secret: 'hidden value',
      visible: 'visible value',
    }

    const options = {
      unsafeKeys: /secret/,
    }

    expect(makeJsonSafe(unsafeObject, options)).toEqual({
      visible: 'visible value',
    })
  })

  it('should handle nested properties with keys matching the regexp from options', () => {
    const unsafeObject = {
      visible: 'visible value',
      nested: {
        secret: 'hidden value',
        alsoVisible: 'also visible value',
      },
    }

    const options = {
      unsafeKeys: /secret/,
    }

    expect(makeJsonSafe(unsafeObject, options)).toEqual({
      visible: 'visible value',
      nested: {
        alsoVisible: 'also visible value',
      },
    })
  })

  it('should handle arrays containing objects with keys matching the regexp from options', () => {
    const unsafeObject = [
      {
        secret: 'hidden value',
        visible: 'visible value',
      },
    ]

    const options = {
      unsafeKeys: /secret/,
    }

    expect(makeJsonSafe(unsafeObject, options)).toEqual([
      { visible: 'visible value' },
    ])
  })

  it('should handle multiple matches with the regexp from options', () => {
    const unsafeObject = {
      secret: 'hidden value',
      visible: 'visible value',
      supersecret: 'also hidden',
    }

    const options = {
      unsafeKeys: /secret/,
    }

    expect(makeJsonSafe(unsafeObject, options)).toEqual({
      visible: 'visible value',
    })
  })

  it('should fall back to default behavior if no options are provided', () => {
    const unsafeObject = {
      '#secret': 'hidden value',
      visible: 'visible value',
    }

    expect(makeJsonSafe(unsafeObject)).toEqual({ visible: 'visible value' })
  })

  it('should not exclude any properties if unsafeKeys is null', () => {
    const unsafeObject = {
      secret: 'hidden value',
      '#special': 'should stay',
      visible: 'visible value',
    }

    const options = {
      unsafeKeys: null,
    }

    expect(makeJsonSafe(unsafeObject, options)).toEqual({
      secret: 'hidden value',
      '#special': 'should stay',
      visible: 'visible value',
    })
  })

  it('should be able to serialise maps', () => {
    const unsafeObject = new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ])

    const options = {}

    expect(makeJsonSafe(unsafeObject, options)).toEqual({
      key1: 'value1',
      key2: 'value2',
    })
  })
})

describe('SafeJson', () => {
  it('should bypass makeJsonSafe processing', () => {
    const data = {
      '#bot:::abc123': { type: 'bot', data: { name: 'Test' } },
      '#skillset:::def456': { type: 'skillset', data: { name: 'Skills' } },
    }

    const result = makeJsonSafe(new SafeJson(data))

    expect(result).toEqual(data)
  })

  it('should preserve nested # keys without stripping', () => {
    const data = {
      resources: {
        '#bot:::abc': { skillsetId: '#skillset:::def' },
      },
    }

    const result = makeJsonSafe(new SafeJson(data))

    expect(result).toBe(data)
  })

  it('should serialize via toJSON', () => {
    const data = { '#key': 'value' }
    const safe = new SafeJson(data)

    expect(JSON.stringify(safe)).toBe(JSON.stringify(data))
  })
})

describe('makeJsonSafe primitive and special values', () => {
  it('converts undefined to null', () => {
    expect(makeJsonSafe(undefined)).toBeNull()
  })

  it('keeps null as null', () => {
    expect(makeJsonSafe(null)).toBeNull()
  })

  it('converts Infinity variants and NaN to tagged strings', () => {
    expect(makeJsonSafe(Infinity)).toBe('$Infinity')
    expect(makeJsonSafe(-Infinity)).toBe('-$Infinity')
    expect(makeJsonSafe(Number.NaN)).toBe('$NaN')
  })

  it('converts bigint values based on JS safe integer bounds', () => {
    expect(makeJsonSafe(BigInt(42))).toBe(42)
    expect(makeJsonSafe(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1))).toBe(
      `${BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)}n`
    )
  })

  it('converts Date and URL values', () => {
    const date = new Date('2024-01-01T00:00:00.000Z')
    const url = new URL('https://example.com/a?b=c')

    expect(makeJsonSafe(date)).toBe(date.getTime())
    expect(makeJsonSafe(url)).toBe('https://example.com/a?b=c')
  })

  it('converts functions to null and leaves regular primitives unchanged', () => {
    expect(makeJsonSafe(() => 'x')).toBeNull()
    expect(makeJsonSafe('text')).toBe('text')
    expect(makeJsonSafe(123)).toBe(123)
    expect(makeJsonSafe(true)).toBe(true)
  })
})

describe('makeJsonSafe collections and objects', () => {
  it('converts sets and arrays recursively', () => {
    const input = new Set([1, undefined, { nested: undefined, keep: 2 }])

    expect(makeJsonSafe(input)).toEqual([1, null, { keep: 2 }])
  })

  it('converts map keys and values recursively', () => {
    const input = new Map([
      ['a', { value: 1, drop: undefined }],
      [BigInt(7), new URL('https://example.com/')],
    ])

    expect(makeJsonSafe(input)).toEqual({
      a: { value: 1 },
      7: 'https://example.com/',
    })
  })

  it('converts decimal-like objects via toNumber', () => {
    const proto = { toStringTag: '[object Decimal]' }
    const value = Object.create(proto)

    value.toNumber = () => 12.5

    expect(makeJsonSafe(value)).toBe(12.5)
  })
})

describe('stripEmpty', () => {
  it('strips empty strings from nested objects and arrays', () => {
    const input = {
      a: '',
      b: 'x',
      c: ['', 'y', { d: '', e: 'z' }],
    }

    expect(stripEmpty(input)).toEqual({
      a: undefined,
      b: 'x',
      c: ['y', { d: undefined, e: 'z' }],
    })
  })

  it('returns primitive values as-is when not empty string', () => {
    expect(stripEmpty(0)).toBe(0)
    expect(stripEmpty(false)).toBe(false)
    expect(stripEmpty(null)).toBeNull()
  })
})

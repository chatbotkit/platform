import { getMeta, getPublicMeta } from '@/lib/meta'

describe('getMeta', () => {
  test('should return updated meta when $update is present', () => {
    const meta = {
      $update: { datasetId: '123', datasetActionName: 'create' },
    }

    const previousMeta = {
      datasetId: '456',
      datasetActionName: 'update',
      abc: 123,
    }

    const expected = { datasetId: '123', datasetActionName: 'create', abc: 123 }
    const result = getMeta(meta, previousMeta)

    expect(result).toEqual(expected)
  })

  test('should return new meta when $update is not present', () => {
    const meta = { datasetId: '123', datasetActionName: 'create' }

    const previousMeta = {
      datasetId: '456',
      datasetActionName: 'update',
      abc: 123,
    }

    const expected = { datasetId: '123', datasetActionName: 'create' }
    const result = getMeta(meta, previousMeta)

    expect(result).toEqual(expected)
  })

  test('it should omit keys starting with non-word characters', () => {
    const meta = {
      _abc: 123,
      abc123: 456,
    }

    const previousMeta = {}
    const expected = { abc123: 456 }
    const result = getMeta(meta, previousMeta)

    expect(result).toEqual(expected)
  })

  test('update with omitted keys starting with non-word characters', () => {
    const meta = {
      $update: { _abc: 123, abc123: 456 },
    }

    const previousMeta = { xyz: 789 }
    const expected = { abc123: 456, xyz: 789 }
    const result = getMeta(meta, previousMeta)

    expect(result).toEqual(expected)
  })
})

describe('getPublicMeta', () => {
  test('should omit keys starting with non-word characters', () => {
    const meta = {
      _internal: 123,
      '#secret': 'hidden value',
      $update: { abc: 1 },
      abc123: 456,
    }

    const result = getPublicMeta(meta)

    expect(result).toEqual({ abc123: 456 })
  })

  test('should keep nested keys untouched', () => {
    const meta = {
      abc: { _internal: 123 },
    }

    const result = getPublicMeta(meta)

    expect(result).toEqual({ abc: { _internal: 123 } })
  })

  test('should pass through null and undefined meta', () => {
    expect(getPublicMeta(null)).toBeNull()
    expect(getPublicMeta(undefined)).toBeUndefined()
  })
})

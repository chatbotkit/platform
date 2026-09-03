import { prepareMetaForEmbedding, prepareTextForEmbedding } from '@/lib/embed'

describe('prepareTextForEmbedding', () => {
  it('must return correct text', () => {
    expect(prepareTextForEmbedding('abc')).toEqual('abc')
    expect(prepareTextForEmbedding('a\nb\nc')).toEqual('a b c')
    expect(prepareTextForEmbedding('a\n\nb\n\nc')).toEqual('a b c')
    expect(prepareTextForEmbedding('a\n\nb\n\nc   d')).toEqual('a b c d')
  })
})

describe('prepareMetaForEmbedding', () => {
  it('must return object of primitive types', () => {
    expect(prepareMetaForEmbedding({ abc: 123 })).toEqual({ abc: 123 })
    expect(prepareMetaForEmbedding({ abc: true })).toEqual({ abc: true })
    expect(prepareMetaForEmbedding({ abc: false })).toEqual({ abc: false })
    expect(prepareMetaForEmbedding({ abc: () => {}, xyz: 'test' })).toEqual({
      xyz: 'test',
    })
    expect(
      prepareMetaForEmbedding({ abc: { xyz: 'test' }, xyz: 'test' })
    ).toEqual({
      xyz: 'test',
    })
    expect(prepareMetaForEmbedding({ arr: [1, 2, 3] })).toEqual({
      arr: '1,2,3',
    })
    expect(prepareMetaForEmbedding({ arr: [1, 2, null] })).toEqual({
      arr: '1,2',
    })
    expect(prepareMetaForEmbedding({ arr: [1, undefined, null] })).toEqual({
      arr: '1',
    })
  })
  it('must not include keys starting with # or _', () => {
    expect(prepareMetaForEmbedding({ _abc: 123 })).toEqual({})
    expect(prepareMetaForEmbedding({ '#abc': 123 })).toEqual({})
    expect(prepareMetaForEmbedding({ $abc: 123 })).toEqual({})
  })
})

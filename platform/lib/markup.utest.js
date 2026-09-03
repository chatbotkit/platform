import { normalizeMarkup } from '@/lib/markup'

describe('normalizeMarkup', () => {
  it('must remove empty anchors', () => {
    expect(normalizeMarkup('abc ![]()')).toEqual('abc ')
    expect(normalizeMarkup('abc ![  ](  )')).toEqual('abc ')
  })

  // @note the pattern these cases exercise now comes from the storage module
  // rather than being written out here, so that changing storage backend cannot
  // leave the platform recognising the wrong shape of URL. The anchor form was
  // untested before that change, which made it the riskiest part of the swap.

  it('must remove an image anchor pointing at a temp url', () => {
    const url =
      'https://bucket.amazonaws.com/key.png?X-Amz-Expires=3600&X-Amz-Signature=abc'

    expect(normalizeMarkup(`see ![alt](${url}) end`)).toEqual('see  end')
  })

  it('must remove a link anchor pointing at a temp url', () => {
    const url =
      'https://bucket.amazonaws.com/key.pdf?X-Amz-Expires=3600&X-Amz-Signature=abc'

    expect(normalizeMarkup(`see [alt](${url}) end`)).toEqual('see  end')
  })

  it('must leave a url that does not expire alone', () => {
    // @note over-matching would strip durable links out of conversations, which
    // is worse than the leak this function exists to prevent
    expect(normalizeMarkup('see https://chatbotkit.com/docs end')).toEqual(
      'see https://chatbotkit.com/docs end'
    )
  })

  it('must leave an anchor to a durable url alone', () => {
    expect(normalizeMarkup('see [docs](https://chatbotkit.com/docs) end')).toEqual(
      'see [docs](https://chatbotkit.com/docs) end'
    )
  })

  it('must remove temp urls', () => {
    expect(
      normalizeMarkup(
        'https://s3.us-west-2.amazonaws.com/secure.notion-static.com/0649cb98-360d-4d92-8673-5f8ca69355e5/Untitled.png?X-Amz-AlgorithmAWS4-HMAC-SHA256&X-Amz-Content-Sha256UNSIGNED-PAYLOAD&X-Amz-CredentialAKIAIOSFODNN7EXAMPLE%2F20230503%2Fus-west-2%2Fs3%2Faws4_request&X-Amz-Date20230503T220054Z&X-Amz-Expires3600&X-Amz-Signature3142be4364875a29e4676059ffb73bb2e60fbbb5f94b16c146d1636103d05ff9&X-Amz-SignedHeadershost&x-idGetObject'
      )
    ).toEqual('')
  })
})

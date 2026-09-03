import * as slackTypesModule from './slack.types'

describe('slack.types', () => {
  it('exports no runtime values because it only re-exports types', () => {
    expect(slackTypesModule).toEqual({})
  })
})

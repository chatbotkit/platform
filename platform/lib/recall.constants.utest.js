import {
  DEFAULT_RECALL_REGION,
  RECALL_BOT_OUTPUT_SPEAKER_ID,
  RECALL_REGION_LABELS,
  RECALL_REGIONS,
} from './recall.constants'

describe('recall.constants', () => {
  it('exposes a default region that exists in supported regions', () => {
    expect(DEFAULT_RECALL_REGION).toBe('us-east-1')
    expect(RECALL_REGIONS).toContain(DEFAULT_RECALL_REGION)
  })

  it('defines supported regions in expected order', () => {
    expect(RECALL_REGIONS).toEqual([
      'us-west-2',
      'us-east-1',
      'eu-central-1',
      'ap-northeast-1',
    ])
  })

  it('maps every supported region to a human readable label', () => {
    expect(RECALL_REGION_LABELS).toEqual({
      'us-west-2': 'US West',
      'us-east-1': 'US East',
      'eu-central-1': 'EU',
      'ap-northeast-1': 'Asia Pacific',
    })
  })

  it('uses the expected speaker id for bot audio output', () => {
    expect(RECALL_BOT_OUTPUT_SPEAKER_ID).toBe(2147483647)
  })
})

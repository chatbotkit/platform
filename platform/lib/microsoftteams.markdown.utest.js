import {
  chunkText,
  markdownToMessages,
  normalizeConversationId,
  stripMentionTags,
} from './microsoftteams.markdown'

describe('microsoftteams.markdown', () => {
  describe('stripMentionTags', () => {
    it('removes mention tags and trims the remaining text', () => {
      expect(stripMentionTags('  <at>Bot</at> hello world  ')).toBe(
        'hello world'
      )
    })

    it('removes multiple mention tags with attributes', () => {
      expect(
        stripMentionTags('<at id="1">Bot</at> hi <at id="2">User</at>')
      ).toBe('hi')
    })
  })

  describe('normalizeConversationId', () => {
    it('removes Teams message id suffix', () => {
      expect(normalizeConversationId('abc;messageid=123')).toBe('abc')
    })

    it('returns unchanged id when no suffix exists', () => {
      expect(normalizeConversationId('abc')).toBe('abc')
    })
  })

  describe('chunkText', () => {
    it('returns a single chunk when text is within limit', () => {
      expect(chunkText('short', 10)).toEqual(['short'])
    })

    it('splits on paragraph boundaries when possible', () => {
      const text = 'aaaa\n\nbbbb\n\ncccc'

      expect(chunkText(text, 10)).toEqual(['aaaa\n\nbbbb', 'cccc'])
    })

    it('falls back to hard split when no boundary exists', () => {
      expect(chunkText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
    })
  })

  describe('markdownToMessages', () => {
    it('converts each chunk to a text message', async () => {
      await expect(markdownToMessages('abcd efgh ijkl')).resolves.toEqual([
        { type: 'text', text: 'abcd efgh ijkl' },
      ])
    })
  })
})

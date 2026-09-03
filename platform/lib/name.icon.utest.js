import { nameToIcon } from '@/lib/name.icon'

describe('nameToIcon', () => {
  describe('AI models', () => {
    it.each([
      ['gpt-4', '@logo/openai.com'],
      ['gpt-4o', '@logo/openai.com'],
      ['gpt-4-turbo', '@logo/openai.com'],
      ['gpt-3.5-turbo', '@logo/openai.com'],
      ['gpt-4o-mini', '@logo/openai.com'],
    ])('should map OpenAI GPT model %s to OpenAI logo', (name, icon) => {
      expect(nameToIcon(name)).toBe(icon)
    })

    it.each([
      ['o1', '@logo/openai.com'],
      ['o3', '@logo/openai.com'],
      ['o4', '@logo/openai.com'],
    ])('should map OpenAI o-series model %s to OpenAI logo', (name, icon) => {
      expect(nameToIcon(name)).toBe(icon)
    })

    it.each([
      ['claude-3', '@logo/anthropic.com'],
      ['claude-3-opus', '@logo/anthropic.com'],
      ['claude-3.5-sonnet', '@logo/anthropic.com'],
    ])('should map Anthropic model %s to Anthropic logo', (name, icon) => {
      expect(nameToIcon(name)).toBe(icon)
    })

    it.each([
      ['sonar', '@logo/perplexity.ai'],
      ['sonar-pro', '@logo/perplexity.ai'],
    ])('should map Perplexity model %s to Perplexity logo', (name, icon) => {
      expect(nameToIcon(name)).toBe(icon)
    })

    it.each([
      ['gemini-1.5-pro', '@logo/google.com'],
      ['gemini-flash', '@logo/google.com'],
      ['gemini-2.0', '@logo/google.com'],
    ])('should map Google Gemini model %s to Google logo', (name, icon) => {
      expect(nameToIcon(name)).toBe(icon)
    })

    it.each([
      ['llama-3', '@logo/llama.com'],
      ['llama-3.1-70b', '@logo/llama.com'],
      ['llama-2', '@logo/llama.com'],
    ])('should map Meta Llama model %s to Llama logo', (name, icon) => {
      expect(nameToIcon(name)).toBe(icon)
    })

    it.each([
      ['deepseek-r1', '@google/deepseek.com'],
      ['deepseek-v3', '@google/deepseek.com'],
    ])('should map DeepSeek model %s to DeepSeek logo', (name, icon) => {
      expect(nameToIcon(name)).toBe(icon)
    })
  })

  describe('products', () => {
    it('should map gdrive to Google logo', () => {
      expect(nameToIcon('gdrive')).toBe('@logo/google.com')
    })

    it('should map gmail to Google logo', () => {
      expect(nameToIcon('gmail')).toBe('@logo/google.com')
    })

    it('should map jira to Atlassian logo', () => {
      expect(nameToIcon('jira')).toBe('@logo/atlassian.com')
    })

    it('should map confluence to Atlassian logo', () => {
      expect(nameToIcon('confluence')).toBe('@logo/atlassian.com')
    })
  })

  describe('companies', () => {
    it.each([
      ['slack', '@logo/slack.com'],
      ['github', '@logo/github.com'],
      ['google', '@logo/google.com'],
      ['notion', '@logo/notion.so'],
      ['atlassian', '@logo/atlassian.com'],
      ['hubspot', '@logo/hubspot.com'],
      ['zoom', '@logo/zoom.us'],
      ['dropbox', '@logo/dropbox.com'],
      ['sentry', '@logo/sentry.io'],
      ['zendesk', '@logo/zendesk.com'],
    ])('should map company name %s to correct logo', (name, icon) => {
      expect(nameToIcon(name)).toBe(icon)
    })
  })

  describe('unrecognized names', () => {
    it('should return null for empty string', () => {
      expect(nameToIcon('')).toBeNull()
    })

    it('should return null for unknown model name', () => {
      expect(nameToIcon('unknown-model-xyz')).toBeNull()
    })

    it('should return null for random text', () => {
      expect(nameToIcon('some random text here')).toBeNull()
    })
  })

  describe('case insensitivity', () => {
    it('should match GPT case-insensitively', () => {
      expect(nameToIcon('GPT-4')).toBe('@logo/openai.com')
    })

    it('should match Claude case-insensitively', () => {
      expect(nameToIcon('CLAUDE-3')).toBe('@logo/anthropic.com')
    })

    it('should match Slack case-insensitively', () => {
      expect(nameToIcon('Slack')).toBe('@logo/slack.com')
    })
  })
})

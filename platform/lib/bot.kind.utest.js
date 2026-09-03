import { isModelBot } from '@/lib/bot.kind'

describe('isModelBot', () => {
  describe('GPT model detection', () => {
    it('should detect "gpt" in bot name', () => {
      expect(isModelBot({ name: 'gpt' })).toBe(true)
    })

    it('should detect "GPT" in uppercase', () => {
      expect(isModelBot({ name: 'GPT' })).toBe(true)
    })

    it('should detect "gpt-4"', () => {
      expect(isModelBot({ name: 'gpt-4' })).toBe(true)
    })

    it('should detect "GPT-3.5"', () => {
      expect(isModelBot({ name: 'GPT-3.5' })).toBe(true)
    })

    it('should detect "gpt-3.5-turbo"', () => {
      expect(isModelBot({ name: 'gpt-3.5-turbo' })).toBe(true)
    })

    it('should detect "GPT4" without dash', () => {
      expect(isModelBot({ name: 'GPT4' })).toBe(true)
    })

    it('should detect "ChatGPT"', () => {
      expect(isModelBot({ name: 'ChatGPT' })).toBe(true)
    })

    it('should detect gpt in mixed case', () => {
      expect(isModelBot({ name: 'GpT-4' })).toBe(true)
      expect(isModelBot({ name: 'gPt' })).toBe(true)
    })
  })

  describe('Claude model detection', () => {
    it('should detect "claude" in bot name', () => {
      expect(isModelBot({ name: 'claude' })).toBe(true)
    })

    it('should detect "Claude" in uppercase', () => {
      expect(isModelBot({ name: 'Claude' })).toBe(true)
    })

    it('should detect "claude-2"', () => {
      expect(isModelBot({ name: 'claude-2' })).toBe(true)
    })

    it('should detect "Claude 3"', () => {
      expect(isModelBot({ name: 'Claude 3' })).toBe(true)
    })

    it('should detect "claude-3-opus"', () => {
      expect(isModelBot({ name: 'claude-3-opus' })).toBe(true)
    })

    it('should detect "Claude-3-Sonnet"', () => {
      expect(isModelBot({ name: 'Claude-3-Sonnet' })).toBe(true)
    })

    it('should detect claude in mixed case', () => {
      expect(isModelBot({ name: 'ClAuDe' })).toBe(true)
    })
  })

  describe('Sonar model detection', () => {
    it('should detect "sonar" in bot name', () => {
      expect(isModelBot({ name: 'sonar' })).toBe(true)
    })

    it('should detect "Sonar" in uppercase', () => {
      expect(isModelBot({ name: 'Sonar' })).toBe(true)
    })

    it('should detect "sonar-medium"', () => {
      expect(isModelBot({ name: 'sonar-medium' })).toBe(true)
    })

    it('should detect "Sonar Large"', () => {
      expect(isModelBot({ name: 'Sonar Large' })).toBe(true)
    })

    it('should detect sonar in mixed case', () => {
      expect(isModelBot({ name: 'SoNaR' })).toBe(true)
    })
  })

  describe('DeepSeek model detection', () => {
    it('should detect "deepseek" in bot name', () => {
      expect(isModelBot({ name: 'deepseek' })).toBe(true)
    })

    it('should detect "DeepSeek" in uppercase', () => {
      expect(isModelBot({ name: 'DeepSeek' })).toBe(true)
    })

    it('should detect "deepseek-coder"', () => {
      expect(isModelBot({ name: 'deepseek-coder' })).toBe(true)
    })

    it('should detect "DeepSeek V2"', () => {
      expect(isModelBot({ name: 'DeepSeek V2' })).toBe(true)
    })

    it('should detect deepseek in mixed case', () => {
      expect(isModelBot({ name: 'DeEpSeEk' })).toBe(true)
    })
  })

  describe('Llama model detection', () => {
    it('should detect "llama" in bot name', () => {
      expect(isModelBot({ name: 'llama' })).toBe(true)
    })

    it('should detect "Llama" in uppercase', () => {
      expect(isModelBot({ name: 'Llama' })).toBe(true)
    })

    it('should detect "llama-2"', () => {
      expect(isModelBot({ name: 'llama-2' })).toBe(true)
    })

    it('should detect "Llama 3"', () => {
      expect(isModelBot({ name: 'Llama 3' })).toBe(true)
    })

    it('should detect "llama-3-70b"', () => {
      expect(isModelBot({ name: 'llama-3-70b' })).toBe(true)
    })

    it('should detect llama in mixed case', () => {
      expect(isModelBot({ name: 'LLaMA' })).toBe(true)
      expect(isModelBot({ name: 'llAmA' })).toBe(true)
    })
  })

  describe('Gemini model detection', () => {
    it('should detect "gemini" in bot name', () => {
      expect(isModelBot({ name: 'gemini' })).toBe(true)
    })

    it('should detect "Gemini" in uppercase', () => {
      expect(isModelBot({ name: 'Gemini' })).toBe(true)
    })

    it('should detect "gemini-pro"', () => {
      expect(isModelBot({ name: 'gemini-pro' })).toBe(true)
    })

    it('should detect "Gemini 1.5"', () => {
      expect(isModelBot({ name: 'Gemini 1.5' })).toBe(true)
    })

    it('should detect "gemini-ultra"', () => {
      expect(isModelBot({ name: 'gemini-ultra' })).toBe(true)
    })

    it('should detect gemini in mixed case', () => {
      expect(isModelBot({ name: 'GeMiNi' })).toBe(true)
    })
  })

  describe('Mistral model detection', () => {
    it('should detect "mistral" in bot name', () => {
      expect(isModelBot({ name: 'mistral' })).toBe(true)
    })

    it('should detect "Mistral" in uppercase', () => {
      expect(isModelBot({ name: 'Mistral' })).toBe(true)
    })

    it('should detect "mistral-7b"', () => {
      expect(isModelBot({ name: 'mistral-7b' })).toBe(true)
    })

    it('should detect "Mistral Large"', () => {
      expect(isModelBot({ name: 'Mistral Large' })).toBe(true)
    })

    it('should detect "mistral-medium"', () => {
      expect(isModelBot({ name: 'mistral-medium' })).toBe(true)
    })

    it('should detect mistral in mixed case', () => {
      expect(isModelBot({ name: 'MiStRaL' })).toBe(true)
    })
  })

  describe('o-series model detection', () => {
    it('should detect "o1" as model bot', () => {
      expect(isModelBot({ name: 'o1' })).toBe(true)
    })

    it('should detect "O1" in uppercase', () => {
      expect(isModelBot({ name: 'O1' })).toBe(true)
    })

    it('should detect "o2"', () => {
      expect(isModelBot({ name: 'o2' })).toBe(true)
    })

    it('should detect "o3"', () => {
      expect(isModelBot({ name: 'o3' })).toBe(true)
    })

    it('should detect "o9"', () => {
      expect(isModelBot({ name: 'o9' })).toBe(true)
    })

    it('should detect "o1-preview"', () => {
      expect(isModelBot({ name: 'o1-preview' })).toBe(true)
    })

    it('should detect "o1-mini"', () => {
      expect(isModelBot({ name: 'o1-mini' })).toBe(true)
    })

    it('should detect "O3-turbo"', () => {
      expect(isModelBot({ name: 'O3-turbo' })).toBe(true)
    })

    it('should detect o-series in mixed case', () => {
      expect(isModelBot({ name: 'O1' })).toBe(true)
      expect(isModelBot({ name: 'o2' })).toBe(true)
    })
  })

  describe('non-model bot names', () => {
    it('should not detect regular bot names', () => {
      expect(isModelBot({ name: 'Customer Support Bot' })).toBe(false)
    })

    it('should not detect "Assistant"', () => {
      expect(isModelBot({ name: 'Assistant' })).toBe(false)
    })

    it('should not detect "Helper"', () => {
      expect(isModelBot({ name: 'Helper' })).toBe(false)
    })

    it('should not detect "Chatbot"', () => {
      expect(isModelBot({ name: 'Chatbot' })).toBe(false)
    })

    it('should not detect "AI Bot"', () => {
      expect(isModelBot({ name: 'AI Bot' })).toBe(false)
    })

    it('should not detect random names', () => {
      expect(isModelBot({ name: 'John' })).toBe(false)
      expect(isModelBot({ name: 'Sales Bot' })).toBe(false)
      expect(isModelBot({ name: 'FAQ Assistant' })).toBe(false)
    })

    it('should not detect partial matches', () => {
      expect(isModelBot({ name: 'gp' })).toBe(false)
      expect(isModelBot({ name: 'clau' })).toBe(false)
      expect(isModelBot({ name: 'llam' })).toBe(false)
    })

    it('should not detect model names with spaces breaking the word', () => {
      expect(isModelBot({ name: 'g pt' })).toBe(false)
      expect(isModelBot({ name: 'cl aude' })).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle empty name', () => {
      expect(isModelBot({ name: '' })).toBe(false)
    })

    it('should handle undefined name', () => {
      expect(isModelBot({ name: undefined })).toBe(false)
    })

    it('should handle null name', () => {
      expect(isModelBot({ name: null })).toBe(false)
    })

    it('should handle missing name property', () => {
      expect(isModelBot({})).toBe(false)
    })

    it('should handle bot with only whitespace name', () => {
      expect(isModelBot({ name: '   ' })).toBe(false)
    })

    it('should handle bot with newline in name', () => {
      expect(isModelBot({ name: 'gpt\n4' })).toBe(true)
    })

    it('should handle bot with tab in name', () => {
      expect(isModelBot({ name: 'claude\t2' })).toBe(true)
    })

    it('should handle special characters around model name', () => {
      expect(isModelBot({ name: '[GPT-4]' })).toBe(true)
      expect(isModelBot({ name: '(Claude)' })).toBe(true)
      expect(isModelBot({ name: 'gpt@4' })).toBe(true)
    })

    it('should handle unicode characters', () => {
      expect(isModelBot({ name: 'GPT-4 🤖' })).toBe(true)
      expect(isModelBot({ name: 'Claude 智能' })).toBe(true)
    })

    it('should handle very long names', () => {
      expect(isModelBot({ name: 'gpt' + 'x'.repeat(1000) })).toBe(true)
    })
  })

  describe('model name in context', () => {
    it('should detect model name at start', () => {
      expect(isModelBot({ name: 'GPT-4 Assistant' })).toBe(true)
      expect(isModelBot({ name: 'Claude Helper' })).toBe(true)
    })

    it('should detect model name in middle', () => {
      expect(isModelBot({ name: 'My GPT-4 Bot' })).toBe(true)
      expect(isModelBot({ name: 'Custom Claude Bot' })).toBe(true)
    })

    it('should detect model name at end', () => {
      expect(isModelBot({ name: 'Assistant GPT' })).toBe(true)
      expect(isModelBot({ name: 'Helper Claude' })).toBe(true)
    })

    it('should detect multiple model names', () => {
      expect(isModelBot({ name: 'GPT and Claude' })).toBe(true)
      expect(isModelBot({ name: 'Llama or Mistral' })).toBe(true)
    })
  })

  describe('o-series edge cases', () => {
    it('should detect single digit o-series', () => {
      expect(isModelBot({ name: 'o0' })).toBe(true)
    })

    it('should not detect "o" alone', () => {
      expect(isModelBot({ name: 'o' })).toBe(false)
    })

    it('should not detect "o" with non-digit', () => {
      expect(isModelBot({ name: 'oa' })).toBe(false)
      expect(isModelBot({ name: 'ox' })).toBe(false)
    })

    it('should detect o-series with suffix', () => {
      expect(isModelBot({ name: 'o1-variant' })).toBe(true)
    })
  })

  describe('case sensitivity', () => {
    it('should be case-insensitive for all models', () => {
      expect(isModelBot({ name: 'gPt' })).toBe(true)
      expect(isModelBot({ name: 'cLaUdE' })).toBe(true)
      expect(isModelBot({ name: 'sOnAr' })).toBe(true)
      expect(isModelBot({ name: 'dEePsEeK' })).toBe(true)
      expect(isModelBot({ name: 'lLaMa' })).toBe(true)
      expect(isModelBot({ name: 'gEmInI' })).toBe(true)
      expect(isModelBot({ name: 'mIsTrAl' })).toBe(true)
      expect(isModelBot({ name: 'O1' })).toBe(true)
    })

    it('should handle all caps', () => {
      expect(isModelBot({ name: 'GPT' })).toBe(true)
      expect(isModelBot({ name: 'CLAUDE' })).toBe(true)
      expect(isModelBot({ name: 'SONAR' })).toBe(true)
      expect(isModelBot({ name: 'DEEPSEEK' })).toBe(true)
      expect(isModelBot({ name: 'LLAMA' })).toBe(true)
      expect(isModelBot({ name: 'GEMINI' })).toBe(true)
      expect(isModelBot({ name: 'MISTRAL' })).toBe(true)
    })

    it('should handle all lowercase', () => {
      expect(isModelBot({ name: 'gpt' })).toBe(true)
      expect(isModelBot({ name: 'claude' })).toBe(true)
      expect(isModelBot({ name: 'sonar' })).toBe(true)
      expect(isModelBot({ name: 'deepseek' })).toBe(true)
      expect(isModelBot({ name: 'llama' })).toBe(true)
      expect(isModelBot({ name: 'gemini' })).toBe(true)
      expect(isModelBot({ name: 'mistral' })).toBe(true)
      expect(isModelBot({ name: 'o1' })).toBe(true)
    })
  })

  describe('consistency', () => {
    it('should return same result for same input', () => {
      const bot = { name: 'gpt-4' }

      expect(isModelBot(bot)).toBe(isModelBot(bot))
    })

    it('should return same result for equivalent names', () => {
      expect(isModelBot({ name: 'gpt' })).toBe(isModelBot({ name: 'GPT' }))
      expect(isModelBot({ name: 'claude' })).toBe(
        isModelBot({ name: 'CLAUDE' })
      )
    })

    it('should consistently return boolean', () => {
      expect(typeof isModelBot({ name: 'gpt' })).toBe('boolean')
      expect(typeof isModelBot({ name: 'test' })).toBe('boolean')
      expect(typeof isModelBot({ name: '' })).toBe('boolean')
      expect(typeof isModelBot({})).toBe('boolean')
    })
  })
})

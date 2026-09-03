export function nameToIcon(name: string): string | null {
  switch (true) {
    // models

    case /\bgpt(\d\w?)?-\w+\b/i.test(name): {
      return '@logo/openai.com'
    }

    case /\bo\d\b/i.test(name): {
      return '@logo/openai.com'
    }

    case /\bclaude\b/i.test(name): {
      return '@logo/anthropic.com'
    }

    case /\bsonar\b/i.test(name): {
      return '@logo/perplexity.ai'
    }

    case /\bgemini\b/i.test(name): {
      return '@logo/google.com'
    }

    case /\bllama\b/i.test(name): {
      return '@logo/llama.com'
    }

    case /\bdeepseek\b/i.test(name): {
      return '@google/deepseek.com'
    }

    // products

    case /\bgdrive\b/i.test(name): {
      return '@logo/google.com'
    }

    case /\bgmail\b/i.test(name): {
      return '@logo/google.com'
    }

    case /\bjira\b/i.test(name): {
      return '@logo/atlassian.com'
    }

    case /\bconfluence\b/i.test(name): {
      return '@logo/atlassian.com'
    }

    // companies

    case /\bslack\b/i.test(name): {
      return '@logo/slack.com'
    }

    case /\bgithub\b/i.test(name): {
      return '@logo/github.com'
    }

    case /\bgoogle\b/i.test(name): {
      return '@logo/google.com'
    }

    case /\bnotion\b/i.test(name): {
      return '@logo/notion.so'
    }

    case /\batlassian\b/i.test(name): {
      return '@logo/atlassian.com'
    }

    case /\bhubspot\b/i.test(name): {
      return '@logo/hubspot.com'
    }

    case /\bzoom\b/i.test(name): {
      return '@logo/zoom.us'
    }

    case /\bdropbox\b/i.test(name): {
      return '@logo/dropbox.com'
    }

    case /\bsentry\b/i.test(name): {
      return '@logo/sentry.io'
    }

    case /\bzendesk\b/i.test(name): {
      return '@logo/zendesk.com'
    }
  }

  return null
}

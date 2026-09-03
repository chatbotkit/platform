import { useState } from 'react'

import TokenAutoTextarea from './TokenAutoTextarea'

export default {
  title: 'Components/TokenAutoTextarea',
  component: TokenAutoTextarea,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    value: {
      control: 'text',
      description: 'The controlled value of the textarea',
    },
    onChange: {
      action: 'changed',
      description: 'Callback fired when value changes',
    },
    onToken: {
      action: 'token',
      description: 'Callback fired with token count',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
    maxLength: {
      control: 'number',
      description: 'Maximum character length',
    },
    rows: {
      control: 'number',
      description: 'Initial number of rows',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the textarea is disabled',
    },
    required: {
      control: 'boolean',
      description: 'Whether the textarea is required',
    },
  },
}

export const Default = {
  args: {
    placeholder: 'Type your message here...',
    rows: 3,
  },
}

const ControlledComponent = () => {
  const [value, setValue] = useState('')
  const [tokenCount, setTokenCount] = useState(0)

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Character count: {value.length} | Token count: {tokenCount}
      </div>
      <TokenAutoTextarea
        value={value}
        onChange={setValue}
        onToken={setTokenCount}
        placeholder="Type to see character and token counts..."
        rows={3}
      />
    </div>
  )
}

export const Controlled = {
  render: ControlledComponent,
}

const WithMaxLengthComponent = () => {
  const [value, setValue] = useState('')
  const [tokenCount, setTokenCount] = useState(0)
  const maxLength = 280

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">Twitter-style character limit</span>
        <span
          className={`${
            value.length > maxLength ? 'text-red-600' : 'text-gray-600'
          }`}
        >
          {value.length}/{maxLength}
        </span>
      </div>
      <TokenAutoTextarea
        value={value}
        onChange={setValue}
        onToken={setTokenCount}
        placeholder="What's happening? (280 character limit)"
        maxLength={maxLength}
        rows={3}
        className={value.length > maxLength ? 'border-red-300' : ''}
      />
      <div className="text-sm text-gray-500">Token count: {tokenCount}</div>
    </div>
  )
}

export const WithMaxLength = {
  render: WithMaxLengthComponent,
}

const AutoResizeComponent = () => {
  const [value, setValue] = useState('')
  const [tokenCount, setTokenCount] = useState(0)

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        This textarea automatically resizes as you type. Start with 2 rows and
        grows as needed.
      </div>
      <TokenAutoTextarea
        value={value}
        onChange={setValue}
        onToken={setTokenCount}
        placeholder="Start typing and watch the textarea grow..."
        rows={2}
      />
      <div className="text-sm text-gray-500">
        Characters: {value.length} | Tokens: {tokenCount}
      </div>
    </div>
  )
}

export const AutoResize = {
  render: AutoResizeComponent,
}

const WithInitialContentComponent = () => {
  const [value, setValue] = useState(
    'This is some initial content in the textarea. It demonstrates how the component handles pre-filled text and automatically adjusts its height to fit the content.'
  )

  const [tokenCount, setTokenCount] = useState(0)

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Example with initial content - notice how the height adjusts
        automatically.
      </div>
      <TokenAutoTextarea
        value={value}
        onChange={setValue}
        onToken={setTokenCount}
        placeholder="This won't show because there's initial content"
        rows={2}
      />
      <div className="text-sm text-gray-500">
        Characters: {value.length} | Tokens: {tokenCount}
      </div>
    </div>
  )
}

export const WithInitialContent = {
  render: WithInitialContentComponent,
}

const DisabledComponent = () => {
  const [tokenCount, setTokenCount] = useState(12) // Pre-set token count for demo

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Disabled state - content cannot be edited.
      </div>
      <TokenAutoTextarea
        value="This content cannot be edited because the textarea is disabled."
        onChange={() => {}} // No-op since it's disabled
        onToken={setTokenCount}
        placeholder="This placeholder won't show"
        rows={2}
        disabled
      />
      <div className="text-sm text-gray-500">Token count: {tokenCount}</div>
    </div>
  )
}

export const Disabled = {
  render: DisabledComponent,
}

const FormIntegrationComponent = () => {
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [messageTokens, setMessageTokens] = useState(0)
  const [subjectTokens, setSubjectTokens] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    alert(`Form submitted!\nSubject: ${subject}\nMessage: ${message}`)
    setIsSubmitting(false)
  }

  const isValid = subject.trim() && message.trim()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Subject
        </label>
        <TokenAutoTextarea
          id="subject"
          value={subject}
          onChange={setSubject}
          onToken={setSubjectTokens}
          placeholder="Enter email subject..."
          rows={1}
          maxLength={100}
          required
          className="w-full"
        />
        <div className="text-xs text-gray-500 mt-1">
          {subject.length}/100 characters | {subjectTokens} tokens
        </div>
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Message
        </label>
        <TokenAutoTextarea
          id="message"
          value={message}
          onChange={setMessage}
          onToken={setMessageTokens}
          placeholder="Type your message here..."
          rows={4}
          required
          className="w-full"
        />
        <div className="text-xs text-gray-500 mt-1">
          {message.length} characters | {messageTokens} tokens
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sending...' : 'Send Email'}
        </button>

        <div className="text-sm text-gray-600">
          Total tokens: {subjectTokens + messageTokens}
        </div>
      </div>
    </form>
  )
}

export const FormIntegration = {
  render: FormIntegrationComponent,
}

const TokenCountingComponent = () => {
  const [values, setValues] = useState({
    simple: '',
    complex: '',
    withNumbers: '',
  })

  const [tokens, setTokens] = useState({
    simple: 0,
    complex: 0,
    withNumbers: 0,
  })

  const handleChange = (key) => (value) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleToken = (key) => (count) => {
    setTokens((prev) => ({ ...prev, [key]: count }))
  }

  const examples = [
    {
      key: 'simple',
      label: 'Simple Text',
      placeholder: 'Type simple words...',
      description: 'Simple words typically count as 1 token each',
    },
    {
      key: 'complex',
      label: 'Complex Text',
      placeholder: 'Type complex or technical terms...',
      description: 'Complex words may be split into multiple tokens',
    },
    {
      key: 'withNumbers',
      label: 'Text with Numbers',
      placeholder: 'Type text with numbers and symbols...',
      description: 'Numbers and symbols affect token counting',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-600">
        This example demonstrates how different types of content affect token
        counting. Try typing simple words vs complex technical terms to see the
        difference.
      </div>

      {examples.map(({ key, label, placeholder, description }) => (
        <div key={key} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {label}
          </label>
          <TokenAutoTextarea
            value={values[key]}
            onChange={handleChange(key)}
            onToken={handleToken(key)}
            placeholder={placeholder}
            rows={2}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{description}</span>
            <span>
              Characters: {values[key].length} | Tokens: {tokens[key]}
            </span>
          </div>
        </div>
      ))}

      <div className="p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Token Counting Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Simple English words are usually 1 token</li>
          <li>• Complex or technical terms may be 2+ tokens</li>
          <li>• Numbers and punctuation affect token counts</li>
          <li>• Whitespace is typically not counted as tokens</li>
          <li>• Different languages have different tokenization patterns</li>
        </ul>
      </div>
    </div>
  )
}

export const TokenCounting = {
  render: TokenCountingComponent,
}

const StylingComponent = () => {
  const [value, setValue] = useState('')
  const [tokenCount, setTokenCount] = useState(0)

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Default Styling
        </h4>
        <TokenAutoTextarea
          value={value}
          onChange={setValue}
          onToken={setTokenCount}
          placeholder="Default styling..."
          rows={2}
        />
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Custom Styling
        </h4>
        <TokenAutoTextarea
          value={value}
          onChange={setValue}
          onToken={setTokenCount}
          placeholder="Custom styled textarea..."
          rows={2}
          className="border-purple-300 focus:border-purple-500 focus:ring-purple-200 bg-purple-50"
        />
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Large Size</h4>
        <TokenAutoTextarea
          value={value}
          onChange={setValue}
          onToken={setTokenCount}
          placeholder="Large sized textarea..."
          rows={3}
          className="text-lg p-4"
        />
      </div>

      <div className="text-sm text-gray-500">
        Shared content - Characters: {value.length} | Tokens: {tokenCount}
      </div>
    </div>
  )
}

export const Styling = {
  render: StylingComponent,
}

const ShowcaseComponent = () => {
  const [showcaseValue, setShowcaseValue] = useState(
    'This is a demonstration of the TokenAutoTextarea component. It automatically counts tokens as you type and resizes to fit the content.'
  )

  const [showcaseTokens, setShowcaseTokens] = useState(0)

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-4">
          TokenAutoTextarea Component
        </h3>
        <TokenAutoTextarea
          value={showcaseValue}
          onChange={setShowcaseValue}
          onToken={setShowcaseTokens}
          placeholder="Start typing to see auto-resize and token counting..."
          rows={3}
        />
        <div className="text-sm text-gray-500 mt-2">
          Characters: {showcaseValue.length} | Tokens: {showcaseTokens}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Key Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <h4 className="font-medium">Auto-Resize</h4>
            <p className="text-gray-600">
              Automatically adjusts height to fit content as you type
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Token Counting</h4>
            <p className="text-gray-600">
              Real-time token counting with callback support
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Character Limits</h4>
            <p className="text-gray-600">
              Built-in support for maximum length validation
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Form Integration</h4>
            <p className="text-gray-600">
              Works seamlessly with forms and validation
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Accessible</h4>
            <p className="text-gray-600">
              Supports all standard textarea attributes and ARIA labels
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Customizable</h4>
            <p className="text-gray-600">
              Fully customizable styling with Tailwind CSS classes
            </p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Use Cases</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• Chat message inputs with token limits</p>
          <p>• Email composition with character counting</p>
          <p>• Social media post creation (Twitter-style)</p>
          <p>• Comment forms with auto-expanding text areas</p>
          <p>• AI prompt inputs with token awareness</p>
          <p>• Long-form content creation with real-time feedback</p>
        </div>
      </section>
    </div>
  )
}

export const Showcase = {
  render: ShowcaseComponent,
}

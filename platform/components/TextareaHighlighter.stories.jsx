import { useRef, useState } from 'react'

import TextareaHighlighter from './TextareaHighlighter'

const meta = {
  title: 'Components/TextareaHighlighter',
  component: TextareaHighlighter,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    keywords: {
      control: 'object',
      description:
        'Array of regex patterns or strings to highlight in the textarea',
    },
    textarea: {
      control: false,
      description: 'Reference to the textarea element to highlight',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
}

export default meta

const BasicHighlightComponent = ({ keywords, initialValue = '' }) => {
  const textareaRef = useRef(null)
  const [value, setValue] = useState(initialValue)

  return (
    <div className="relative w-full">
      <TextareaHighlighter keywords={keywords} textarea={textareaRef.current} />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="relative z-10 w-full min-h-[200px] p-4 font-mono text-base border border-gray-300 rounded-lg resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Type something to see highlighting..."
      />
      <style jsx>{`
        mark {
          background-color: yellow;
          color: inherit;
          padding: 0;
        }
      `}</style>
    </div>
  )
}

export const Default = {
  render: () => (
    <BasicHighlightComponent
      keywords={[/\b(hello|world)\b/gi]}
      initialValue="Hello world! This is a test of the highlighting feature. Try typing 'hello' or 'world' anywhere in this text."
    />
  ),
}

export const WithMultipleKeywords = {
  render: () => {
    const keywords = [/\b(function|const|let|var|return)\b/g]
    const initialCode = `function greet(name) {
  const message = "Hello, " + name;
  return message;
}

let result = greet("World");
var x = 10;`

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Highlights JavaScript keywords: function, const, let, var, return
        </div>
        <BasicHighlightComponent
          keywords={keywords}
          initialValue={initialCode}
        />
      </div>
    )
  },
}

export const EmailHighlighting = {
  render: () => {
    const keywords = [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g]
    const initialText = `Contact us at support@example.com or sales@company.org.
You can also reach out to info@website.net for more information.`

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Highlights email addresses in the text
        </div>
        <BasicHighlightComponent
          keywords={keywords}
          initialValue={initialText}
        />
      </div>
    )
  },
}

export const URLHighlighting = {
  render: () => {
    const keywords = [/https?:\/\/[^\s]+/g]
    const initialText = `Check out these websites:
https://www.example.com
http://test.org/page
Visit https://github.com/chatbotkit for more info.`

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600">Highlights URLs in the text</div>
        <BasicHighlightComponent
          keywords={keywords}
          initialValue={initialText}
        />
      </div>
    )
  },
}

export const HashtagHighlighting = {
  render: () => {
    const keywords = [/#[A-Za-z0-9_]+/g]
    const initialText = `This is a post about #chatbotkit and #AI.
We're excited to announce #machinelearning features!
Follow us for more #tech updates.`

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Highlights hashtags in the text
        </div>
        <BasicHighlightComponent
          keywords={keywords}
          initialValue={initialText}
        />
      </div>
    )
  },
}

export const MentionHighlighting = {
  render: () => {
    const keywords = [/@[A-Za-z0-9_]+/g]
    const initialText = `Hey @john, can you review this?
cc: @mary and @admin
Thanks @everyone for your help!`

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Highlights mentions/usernames in the text
        </div>
        <BasicHighlightComponent
          keywords={keywords}
          initialValue={initialText}
        />
      </div>
    )
  },
}

export const NumberHighlighting = {
  render: () => {
    const keywords = [/\b\d+(\.\d+)?\b/g]
    const initialText = `The temperature is 23.5 degrees.
We need 100 items for the event.
Price: $49.99
Quantity: 42`

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Highlights numbers in the text
        </div>
        <BasicHighlightComponent
          keywords={keywords}
          initialValue={initialText}
        />
      </div>
    )
  },
}

export const CustomColoredHighlighting = {
  render: () => {
    const keywords = [/\b(error|warning|success|info)\b/gi]
    const initialText = `ERROR: Something went wrong!
WARNING: Please check the configuration.
SUCCESS: Operation completed successfully.
INFO: This is an informational message.`

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Highlights log levels with different colors (requires custom styles)
        </div>
        <BasicHighlightComponent
          keywords={keywords}
          initialValue={initialText}
        />
        <style jsx global>{`
          mark {
            padding: 2px 4px;
            border-radius: 3px;
            font-weight: 600;
          }
        `}</style>
      </div>
    )
  },
}

export const NamedGroupHighlighting = {
  render: () => {
    const keywords = [
      /\{(?<variable>[A-Za-z0-9_]+)\}/g,
      /\[(?<command>[A-Za-z0-9_]+)\]/g,
    ]
    const initialText = `Use {variableName} for variables.
Use [commandName] for commands.
Example: {userId} and [execute] are highlighted.`

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Highlights named groups with custom classes
        </div>
        <BasicHighlightComponent
          keywords={keywords}
          initialValue={initialText}
        />
        <style jsx global>{`
          mark.variable {
            background-color: #e0f2fe;
            color: #0369a1;
          }
          mark.command {
            background-color: #fef3c7;
            color: #92400e;
          }
        `}</style>
      </div>
    )
  },
}

const InteractiveDemoComponent = () => {
  const [pattern, setPattern] = useState('\\b(hello|world)\\b')
  const [flags, setFlags] = useState('gi')
  const [text, setText] = useState('Hello world! This is a test. Hello again!')
  const textareaRef = useRef(null)

  let keywords = []

  try {
    keywords = [new RegExp(pattern, flags)]
  } catch {
    // Invalid regex
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Interactive Demo</h3>
        <p className="text-sm text-gray-600 mb-4">
          Create your own regex pattern to highlight text
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Regex Pattern
          </label>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            placeholder="\\b(hello|world)\\b"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Flags</label>
          <input
            type="text"
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            placeholder="gi"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Text to Highlight
        </label>
        <div className="relative">
          <TextareaHighlighter
            keywords={keywords}
            textarea={textareaRef.current}
          />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="relative z-10 w-full min-h-[200px] p-4 font-mono text-base border border-gray-300 rounded-lg resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Type text here..."
          />
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <strong>Try these patterns:</strong>
        <ul className="list-disc list-inside mt-1">
          <li>
            <code>\\b(hello|world)\\b</code> - matches &quot;hello&quot; or
            &quot;world&quot;
          </li>
          <li>
            <code>#[A-Za-z0-9_]+</code> - matches hashtags
          </li>
          <li>
            <code>@[A-Za-z0-9_]+</code> - matches mentions
          </li>
          <li>
            <code>\b[A-Z][a-z]+\b</code> - matches capitalized words
          </li>
        </ul>
      </div>

      <style jsx>{`
        mark {
          background-color: yellow;
          color: inherit;
          padding: 0;
        }
      `}</style>
    </div>
  )
}

export const InteractiveDemo = {
  render: InteractiveDemoComponent,
}

export const LargeText = {
  render: () => {
    const keywords = [/\b(Lorem|ipsum|dolor|sit|amet)\b/gi]
    const loremText = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Rhoncus dolor purus non enim praesent elementum facilisis leo vel. Risus at ultrices mi tempus imperdiet. Semper risus in hendrerit gravida rutrum quisque non tellus.

Amet consectetur adipiscing elit duis tristique. Rhoncus dolor purus non enim praesent elementum facilisis. Ipsum dolor sit amet consectetur adipiscing elit. Dolor magna eget est lorem ipsum dolor sit amet.`

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Performance test with large text content
        </div>
        <BasicHighlightComponent keywords={keywords} initialValue={loremText} />
      </div>
    )
  },
}

export const NoKeywords = {
  render: () => (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        TextareaHighlighter with no keywords (no highlighting)
      </div>
      <BasicHighlightComponent
        keywords={[]}
        initialValue="This text won't have any highlighting since no keywords are provided."
      />
    </div>
  ),
}

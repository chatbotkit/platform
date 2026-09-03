import { useEffect, useMemo, useState } from 'react'

import FancyLink from './FancyLink'
import Link from './Link'
import Safedown from './Safedown'

export default {
  title: 'Components/Safedown',
  component: Safedown,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    children: {
      control: 'text',
      description: 'Markdown content to render',
    },
    extraComponents: {
      control: 'object',
      description: 'Additional React Markdown components',
    },
    codeRenderers: {
      control: 'object',
      description: 'Custom code block renderers',
    },
  },
}

function FileRenderer({ children }) {
  const id = useMemo(() => {
    return `file-${Math.random().toString(36).substring(2, 15)}`
  }, [])

  return (
    <div className="bg-gray-100 p-4 rounded-md">
      <pre className="whitespace-pre-wrap break-words">
        <strong>{id}</strong> {children}
      </pre>
    </div>
  )
}

const basicMarkdown = `# Hello World

This is a simple markdown example with **bold text** and *italic text*.

## Lists

- Item 1
- Item 2
- Item 3

## Links

Here's a link to [Google](https://google.com).

## Code

Inline code: \`console.log('hello')\`

Block code:
\`\`\`javascript
function hello() {
  console.log('Hello, world!');
}
\`\`\`
`

export const Default = {
  args: {
    children: basicMarkdown,
  },
}

export const BasicMarkdown = {
  args: {
    children: `# Safedown Component

This is a simple example of a Safedown component that renders markdown content safely.

## Features

- Renders markdown content
- Sanitizes input to prevent XSS attacks
- Supports basic markdown syntax

## Text Formatting

You can use **bold text**, *italic text*, and \`inline code\`.

## Lists

Unordered list:
- First item
- Second item
- Third item

Ordered list:
1. First step
2. Second step
3. Third step

## Blockquotes

> This is a blockquote.
> It can span multiple lines.

## Code Blocks

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
\`\`\`
`,
  },
}

const WithLinksComponent = () => {
  const extraComponents = useMemo(
    () => ({
      a({ node: _node, href, ...props }) {
        return FancyLink.isExternal(href) ? (
          <FancyLink {...props} href={href} />
        ) : (
          <Link {...props} href={href} />
        )
      },
    }),
    []
  )

  return (
    <Safedown extraComponents={extraComponents}>
      {`# Links Example

## External Links

Here are some external links that will use FancyLink component:

- [Google](https://google.com)
- [GitHub](https://github.com)
- [Stack Overflow](https://stackoverflow.com)

## Internal Links

These are internal links that will use the Link component:

- [Home](/home)
- [About](/about)
- [Contact](/contact)

## Mixed Content

You can visit [Google](https://google.com) to search for information, or go to the [dashboard](/dashboard) in our app.
`}
    </Safedown>
  )
}

export const WithLinks = {
  render: WithLinksComponent,
}

const WithCustomCodeRendererComponent = () => {
  const codeRenderers = useMemo(
    () => ({
      file({ children }) {
        return <FileRenderer>{children}</FileRenderer>
      },
    }),
    []
  )

  return (
    <Safedown codeRenderers={codeRenderers}>
      {`# Custom Code Renderer

This example shows a custom code renderer for "file" language blocks.

## Regular Code Block

\`\`\`javascript
function hello() {
  console.log('Hello, world!');
}
\`\`\`

## Custom File Renderer

\`\`\`file
Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
\`\`\`

\`\`\`file
Another file example with different content.
This shows how multiple file blocks are rendered.
\`\`\`
`}
    </Safedown>
  )
}

export const WithCustomCodeRenderer = {
  render: WithCustomCodeRendererComponent,
}

const AnimatedExample = () => {
  const [source, setSource] = useState('')

  useEffect(() => {
    const realSource = `# Animated Safedown Example

This is a demonstration of Safedown rendering content progressively.

## Features

- Renders markdown content safely
- Sanitizes input to prevent XSS attacks
- Supports basic markdown syntax
- Handles progressive content updates

## Anchor Links

You can use anchor links to navigate within the document. For example, you can link to [this section](#features) or [this section](#code-example).

Here is a fully qualified link: [https://wikipedia.org](https://wikipedia.org).

And here is another one [https://chatbotkit.com](https://chatbotkit.com).

## Code Example

Here is a python code snippet:

\`\`\`python
def hello_world():
    print("Hello, world!")
    
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
\`\`\`

## File Examples

\`\`\`file
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
\`\`\`

\`\`\`file
Another file with different content to show multiple file blocks.

This demonstrates the custom file renderer in action with progressive loading.
\`\`\`
`

    const chunkSize = 30
    let location = 0

    const interval = setInterval(() => {
      if (location < realSource.length) {
        location += chunkSize
        setSource(realSource.slice(0, location))
      } else {
        clearInterval(interval)
      }
    }, 100)

    return () => {
      clearInterval(interval)
      setSource('')
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        This example shows Safedown rendering content progressively as it&apos;s
        received.
      </div>
      <Safedown
        extraComponents={useMemo(
          () => ({
            a({ node: _node, href, ...props }) {
              return FancyLink.isExternal(href) ? (
                <FancyLink {...props} href={href} />
              ) : (
                <Link {...props} href={href} />
              )
            },
          }),
          []
        )}
        codeRenderers={useMemo(
          () => ({
            file({ children }) {
              return <FileRenderer>{children}</FileRenderer>
            },
          }),
          []
        )}
      >
        {source}
      </Safedown>
    </div>
  )
}

export const AnimatedContent = {
  render: AnimatedExample,
}

export const AdvancedMarkdown = {
  render: () => (
    <Safedown>
      {`# Advanced Markdown Features

## Tables

| Feature | Support | Notes |
|---------|---------|-------|
| Headers | ✅ | H1-H6 supported |
| Lists | ✅ | Ordered and unordered |
| Links | ✅ | Internal and external |
| Code | ✅ | Inline and blocks |
| Images | ✅ | With alt text |

## Task Lists

- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task

## Strikethrough

~~This text is crossed out~~

## Code with Syntax Highlighting

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function getUserById(id: number): User | null {
  // Implementation here
  return null;
}
\`\`\`

\`\`\`css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

@media (max-width: 768px) {
  .container {
    padding: 0 0.5rem;
  }
}
\`\`\`

## Horizontal Rule

---

## Emphasis Combinations

***Bold and italic***

**Bold with *italic inside***

*Italic with **bold inside***
`}
    </Safedown>
  ),
}

export const SecurityExample = {
  render: () => (
    <div className="space-y-4">
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h4 className="font-medium text-yellow-800">Security Note</h4>
        <p className="text-yellow-700 text-sm mt-1">
          Safedown automatically sanitizes content to prevent XSS attacks.
          Dangerous HTML tags and scripts are filtered out.
        </p>
      </div>

      <Safedown>
        {`# Security Test

## Safe Content

This is **safe** markdown content that will render properly.

- Lists work fine
- [Links](https://example.com) are safe
- \`Code blocks\` are safe

## Potentially Dangerous Content (Sanitized)

The following would be dangerous in raw HTML but is safe in Safedown:

\`\`\`html
<!-- This HTML is displayed as code, not executed -->
<script>alert('This will not execute')</script>
<img src="x" onerror="alert('XSS attempt')">
<iframe src="javascript:alert('XSS')"></iframe>
\`\`\`

## Images

Safe image embedding:

![Alt text](https://via.placeholder.com/150x100?text=Safe+Image)
`}
      </Safedown>
    </div>
  ),
}

const ShowcaseComponent = () => {
  const extraComponents = useMemo(
    () => ({
      a({ node: _node, href, ...props }) {
        return FancyLink.isExternal(href) ? (
          <FancyLink {...props} href={href} />
        ) : (
          <Link {...props} href={href} />
        )
      },
    }),
    []
  )

  const codeRenderers = useMemo(
    () => ({
      file({ children }) {
        return <FileRenderer>{children}</FileRenderer>
      },
    }),
    []
  )

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold mb-4">Basic Markdown</h3>
        <Safedown>
          {`# Hello World

This is **bold** and this is *italic*.

- List item 1
- List item 2

\`\`\`javascript
console.log('Hello, world!');
\`\`\``}
        </Safedown>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">With Custom Links</h3>
        <Safedown extraComponents={extraComponents}>
          {`Links: [External](https://google.com) | [Internal](/home)`}
        </Safedown>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Custom Code Renderer</h3>
        <Safedown codeRenderers={codeRenderers}>
          {`\`\`\`file
Custom file renderer example
\`\`\``}
        </Safedown>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Features</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• Safe markdown rendering with XSS protection</p>
          <p>• Custom component support via extraComponents</p>
          <p>• Custom code block renderers</p>
          <p>• GitHub Flavored Markdown support</p>
          <p>• Automatic link handling (internal vs external)</p>
          <p>• Image block support with lazy loading</p>
          <p>• Code syntax highlighting</p>
        </div>
      </section>
    </div>
  )
}

export const Showcase = {
  render: ShowcaseComponent,
}

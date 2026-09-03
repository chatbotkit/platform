import { useState } from 'react'

import BackstoryInput from './BackstoryInput'

const meta = {
  title: 'Components/BackstoryInput',
  component: BackstoryInput,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A textarea component for editing backstory text with syntax highlighting for substitutions and headings.',
      },
    },
  },
}

export default meta

const BackstoryDemo = ({ initialValue, ...props }) => {
  const [value, setValue] = useState(initialValue)

  return (
    <div className="space-y-4 p-4 border border-gray-200 rounded-lg dark:border-gray-700">
      <div>
        <h4 className="text-lg font-semibold mb-2">BackstoryInput Demo</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Edit the backstory text below. Try using substitutions like{' '}
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
            {'${SECRET.API_KEY}'}
          </code>{' '}
          or{' '}
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
            {'{{CONVERSATION.user_name}}'}
          </code>
          , and headings that start with <code>#</code>.
        </p>
      </div>

      <BackstoryInput
        {...props}
        value={value}
        setValue={setValue}
        placeholder="Type your backstory here..."
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium">Current Value:</label>
        <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs overflow-auto max-h-40">
          {value || '(empty)'}
        </pre>
      </div>
    </div>
  )
}

export const Default = {
  render: () => (
    <BackstoryDemo initialValue="You are a helpful AI assistant ready to help users with their questions." />
  ),
}

export const WithSubstitutions = {
  render: () => (
    <BackstoryDemo
      initialValue={`# System Configuration

You are a chatbot with access to the following:
- API Key: \${SECRET.API_KEY}
- User Name: \${CONVERSATION.user_name}
- Session ID: {{CONVERSATION.session_id}}

# Instructions

Help the user with their questions using the provided context.`}
    />
  ),
}

export const WithHeadings = {
  render: () => (
    <BackstoryDemo
      initialValue={`# Main Heading
This is some regular text under the heading.

# Another Section
More content here with regular text.

# Configuration
Some configuration details here.`}
    />
  ),
}

export const ComplexExample = {
  render: () => (
    <BackstoryDemo
      initialValue={`# Customer Support Bot

You are an AI customer support assistant for Acme Corp.

## Authentication
- API Key: \${SECRET.ACME_API_KEY}
- Support Email: support@acme.com

## User Context
- Current User: \${CONVERSATION.user_name}
- User Email: {{CONVERSATION.user_email}}
- Subscription Type: {{CONVERSATION.subscription_type}}

# Instructions

1. Always be polite and professional
2. Use the user's name when addressing them
3. Refer to our knowledge base for complex issues
4. Escalate to human support if needed

## Response Guidelines
- Keep responses concise but helpful
- Use formatting when appropriate
- Provide step-by-step instructions for technical issues

# Additional Resources
- Knowledge Base: \${SECRET.KB_URL}
- Support Portal: https://support.acme.com`}
    />
  ),
}

export const EmptyState = {
  render: () => <BackstoryDemo initialValue="" />,
}

export const WithoutMagic = {
  render: () => (
    <BackstoryDemo
      initialValue="Simple backstory without magic button."
      magic={false}
    />
  ),
}

export const WithoutQuickEdit = {
  render: () => (
    <BackstoryDemo
      initialValue="Simple backstory without quick edit feature. Select text to see that no popup appears."
      quickEdit={false}
    />
  ),
}

export const WithQuickEdit = {
  render: () => (
    <BackstoryDemo
      initialValue={`You are a helpful AI assistant. Your role is to provide clear and concise answers to user questions.

## Guidelines
- Be professional and courteous
- Provide accurate information
- Ask for clarification when needed

Select any text above and click the "Quick Edit" button to transform it with AI!`}
    />
  ),
}

export const WithoutFieldsInfo = {
  render: () => (
    <BackstoryDemo
      initialValue="Backstory with \${CONVERSATION.name} but no fields info."
      fieldsInfo={false}
    />
  ),
}

export const Disabled = {
  render: () => (
    <BackstoryDemo
      initialValue="This backstory input is disabled."
      disabled={true}
    />
  ),
}

function InteractivePlaygroundComponent() {
  const [value, setValue] = useState(`# Interactive Playground

Try editing this text to see the highlighting in action!

## Substitutions
- Secret: \${SECRET.MY_KEY}
- Conversation: {{CONVERSATION.username}}

## Features
- Headings are highlighted in light gray
- Substitutions are highlighted
- Tab key adds 4 spaces
- Zoom mode available`)

  return (
    <div className="space-y-6">
      <div className="space-y-4 p-4 border border-gray-200 rounded-lg dark:border-gray-700">
        <h3 className="text-lg font-semibold">Interactive Playground</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Edit the backstory below and see the highlighting update in real-time.
          Try:
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
          <li>
            Adding headings with <code>#</code> at the start of a line
          </li>
          <li>
            Adding substitutions like <code>{'${SECRET.KEY}'}</code> or{' '}
            <code>{'{{CONVERSATION.field}}'}</code>
          </li>
          <li>Using the Tab key to indent</li>
          <li>Testing the zoom button for full-screen editing</li>
          <li>Using the magic button to generate content</li>
        </ul>

        <BackstoryInput
          value={value}
          setValue={setValue}
          placeholder="Type your backstory here..."
          className="min-h-[300px]"
        />
      </div>

      <div className="space-y-4 p-4 border border-gray-200 rounded-lg dark:border-gray-700">
        <h4 className="text-md font-semibold">Quick Actions</h4>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setValue(
                value +
                  '\n# New Section\nAdd your content here with ${SECRET.KEY}'
              )
            }
            className="primary-button small"
          >
            Add Section
          </button>
          <button
            type="button"
            onClick={() =>
              setValue(value + '\nUser: ${CONVERSATION.user_name}')
            }
            className="primary-button small"
          >
            Add User Substitution
          </button>
          <button
            type="button"
            onClick={() => setValue(value + '\nAPI: {{SECRET.API_KEY}}')}
            className="primary-button small"
          >
            Add Secret Substitution
          </button>
          <button
            type="button"
            onClick={() => setValue('')}
            className="danger-button small"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Raw Output:</label>
        <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs overflow-auto max-h-60">
          {value || '(empty)'}
        </pre>
      </div>
    </div>
  )
}

export const InteractivePlayground = {
  render: () => <InteractivePlaygroundComponent />,
}

function ResizableContainerComponent() {
  const [value, setValue] = useState(`# Resizable Container Test

This example demonstrates BackstoryInput inside a resizable container.

## Instructions
- Drag the bottom-right corner to resize the container
- The BackstoryInput should fill the entire container
- Content should overflow internally with scrolling

## Sample Content
Here is some content to test scrolling behavior.

### Substitutions
- Secret: \${SECRET.MY_KEY}
- User: \${CONVERSATION.username}

### More Content
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

### Even More Content
Adding more lines to test overflow behavior.
This should cause the textarea to scroll internally.
The container should maintain its size.
The textarea should fill the container completely.`)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Resizable Container</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Drag the bottom-right corner to resize. The BackstoryInput should fill
          the entire container and handle overflow internally.
        </p>
      </div>

      {/* Resizable container simulating the tool node in the designer */}
      <div
        className="border-2 border-dashed border-indigo-400 rounded-lg overflow-hidden"
        style={{
          resize: 'both',
          overflow: 'hidden',
          width: '400px',
          height: '300px',
          minWidth: '200px',
          minHeight: '150px',
        }}
      >
        <div className="w-full h-full flex flex-col bg-gray-100 dark:bg-gray-900">
          {/* Header - simulating the tool header */}
          <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <span className="text-xs font-medium">📜 Backstory</span>
          </div>

          {/* Content area - this is where BackstoryInput needs to fill */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <BackstoryInput
              className="!max-h-none !h-full !overflow-auto none-input text-xs flex-1"
              wrapperClassName="flex-1 flex flex-col h-full"
              containerClassName="flex-1 h-full flex flex-col"
              textareaWrapperClassName="flex-1 h-full flex flex-col"
              value={value}
              setValue={setValue}
              fieldsInfo={false}
              zoom={false}
              magic={false}
              quickEdit={false}
              placeholder="Enter backstory content..."
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Current Value:</label>
        <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 text-xs overflow-auto max-h-40">
          {value || '(empty)'}
        </pre>
      </div>
    </div>
  )
}

export const ResizableContainer = {
  render: () => <ResizableContainerComponent />,
}

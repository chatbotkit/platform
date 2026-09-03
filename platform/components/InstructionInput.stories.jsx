import { useState } from 'react'

import InstructionInput from './InstructionInput'

const meta = {
  title: 'Components/InstructionInput',
  component: InstructionInput,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A specialized textarea component for editing bot instructions with syntax highlighting for actions, substitutions, params, placeholders, and more.',
      },
    },
  },
}

export default meta

const ControlledInstructionInput = ({ defaultValue, ...props }) => {
  const [value, setValue] = useState(defaultValue)

  return (
    <div className="space-y-4">
      <InstructionInput
        {...props}
        value={value}
        setValue={setValue}
        placeholder="Enter instruction..."
      />
      <div className="text-sm text-gray-600">
        <strong>Current Value:</strong>
        <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
          {value || '(empty)'}
        </pre>
      </div>
    </div>
  )
}

export const Default = {
  render: () => (
    <ControlledInstructionInput defaultValue="Fetch the latest data from the API." />
  ),
}

export const WithActions = {
  render: () => (
    <ControlledInstructionInput
      defaultValue={`Fetch the latest data from the API.

\`\`\`http
GET https://api.example.com/data
\`\`\``}
    />
  ),
}

export const WithSubstitutions = {
  render: () => (
    <ControlledInstructionInput
      defaultValue={`Use the secret API key: \${SECRET.API_KEY}

Reference conversation context: {{CONVERSATION.history}}

Use secret token: \${SECRET.TOKEN}`}
    />
  ),
}

export const WithParams = {
  render: () => (
    <ControlledInstructionInput
      defaultValue={`Fetch user data for $[userId]

Send email to [[emailAddress]]`}
    />
  ),
}

export const WithPlaceholders = {
  render: () => (
    <ControlledInstructionInput
      defaultValue={`Fetch data from ((API_ENDPOINT))

Process result with ((PROCESSING_METHOD))`}
    />
  ),
}

export const ComplexExample = {
  render: () => (
    <ControlledInstructionInput
      defaultValue={`Fetch user data for $[userId] from the API.

Use API key: \${SECRET.API_KEY}

\`\`\`http
GET ((API_ENDPOINT))/users/$[userId]
Authorization: Bearer \${SECRET.API_KEY}
\`\`\`

Process the response and send it to {{CONVERSATION.history}}.`}
    />
  ),
}

export const Empty = {
  render: () => <ControlledInstructionInput defaultValue="" />,
}

export const Disabled = {
  render: () => (
    <ControlledInstructionInput
      defaultValue="This instruction is disabled."
      disabled
    />
  ),
}

export const WithoutInfoBadges = {
  render: () => (
    <ControlledInstructionInput
      defaultValue={`Fetch data from ((API_ENDPOINT))

Use API key: \${SECRET.API_KEY}`}
      instructionInfo={false}
      placeholderInfo={false}
      secretsInfo={false}
      errorsInfo={false}
      fieldsInfo={false}
      actionsInfo={false}
    />
  ),
}

export const LongInstruction = {
  render: () => (
    <ControlledInstructionInput
      defaultValue={`This is a very long instruction that demonstrates the scrolling behavior.

Fetch user data for $[userId] from the API endpoint.

Use the secret API key: \${SECRET.API_KEY}

\`\`\`http
GET https://api.example.com/users/$[userId]
Authorization: Bearer \${SECRET.API_KEY}
\`\`\`

Process the response and extract the following fields:
- name
- email
- phone
- address

Send a confirmation email to [[emailAddress]] with the processed data.

Log the result to {{CONVERSATION.history}} for future reference.

If the API call fails, retry up to 3 times with exponential backoff.

Finally, return a success message to the user: "Data fetched successfully!"

This instruction demonstrates:
1. Actions (http block)
2. Substitutions (\${SECRET})
3. Params ($[param])
4. Placeholders ((placeholder))
5. Conversation context ({{CONVERSATION}})

The textarea should scroll when the content exceeds the max height.`}
    />
  ),
}

const InteractiveDemo = () => {
  const [value, setValue] = useState('')
  const [showInfo, setShowInfo] = useState(true)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showInfo}
            onChange={(e) => setShowInfo(e.target.checked)}
          />
          <span className="text-sm">Show info badges</span>
        </label>
      </div>

      <InstructionInput
        value={value}
        setValue={setValue}
        placeholder="Type your instruction here..."
        instructionInfo={showInfo}
        placeholderInfo={showInfo}
        secretsInfo={showInfo}
        errorsInfo={showInfo}
        fieldsInfo={showInfo}
        actionsInfo={showInfo}
      />

      <div className="space-y-2">
        <button
          type="button"
          className="default-button"
          onClick={() =>
            setValue(
              'Fetch data from ((API_ENDPOINT))\n\nUse key: ${SECRET.API_KEY}'
            )
          }
        >
          Load Example 1
        </button>
        <button
          type="button"
          className="default-button ml-2"
          onClick={() =>
            setValue(
              '```http\nGET https://api.example.com/data\n```\n\nProcess with $[param]'
            )
          }
        >
          Load Example 2
        </button>
        <button
          type="button"
          className="default-button ml-2"
          onClick={() => setValue('')}
        >
          Clear
        </button>
      </div>

      <div className="text-sm text-gray-600">
        <strong>Current Value:</strong>
        <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
          {value || '(empty)'}
        </pre>
      </div>
    </div>
  )
}

export const Interactive = {
  render: () => <InteractiveDemo />,
}

const AutoOpenTemplateDemo = () => {
  const [value, setValue] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> This story demonstrates the{' '}
          <code className="bg-blue-100 px-1 rounded">autoOpenTemplate</code>{' '}
          prop. When the component mounts with an empty value and{' '}
          <code className="bg-blue-100 px-1 rounded">
            autoOpenTemplate=true
          </code>
          , the template selection dialog automatically opens.
        </p>
      </div>

      <InstructionInput
        value={value}
        setValue={setValue}
        placeholder="Template will be loaded here..."
        autoOpenTemplate={true}
        onTemplateSelect={(template) => {
          setSelectedTemplate(template)
        }}
      />

      {selectedTemplate && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-sm text-green-800">
            <strong>Selected Template:</strong> {selectedTemplate.name}
          </p>
          {selectedTemplate.description && (
            <p className="text-sm text-green-700 mt-1">
              {selectedTemplate.description}
            </p>
          )}
        </div>
      )}

      <div className="text-sm text-gray-600">
        <strong>Current Value:</strong>
        <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
          {value || '(empty)'}
        </pre>
      </div>
    </div>
  )
}

export const AutoOpenTemplate = {
  render: () => <AutoOpenTemplateDemo />,
}

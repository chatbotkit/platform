import Expando from '@/components/Expando'

export default function ExtractSchemaCheatsheet({ ...props }) {
  return (
    <Expando
      {...props}
      titleClassName="default-link text-sm"
      title="Schema Cheat Sheet"
    >
      <div className="content-prose prose-code:before:content-none prose-code:after:content-none">
        <table>
          <thead className="text-bold">
            <tr>
              <th>Property</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>type: &quot;string&quot;</code>
              </td>
              <td className="-font-mono">
                Extracts text values like names, emails, descriptions.
              </td>
            </tr>
            <tr>
              <td>
                <code>type: &quot;number&quot;</code>
              </td>
              <td className="-font-mono">
                Extracts numeric values like amounts, quantities, ratings.
              </td>
            </tr>
            <tr>
              <td>
                <code>type: &quot;boolean&quot;</code>
              </td>
              <td className="-font-mono">
                Extracts true/false values for yes/no questions.
              </td>
            </tr>
            <tr>
              <td>
                <code>description</code>
              </td>
              <td className="-font-mono">
                Describes what value to extract. Be specific for better
                accuracy.
              </td>
            </tr>
            <tr>
              <td>
                <code>required: true</code>
              </td>
              <td className="-font-mono">
                Marks the field as required. The AI will prioritize extracting
                this value.
              </td>
            </tr>
            <tr>
              <td>
                <code>collect: true</code>
              </td>
              <td className="-font-mono">
                <strong>Numeric fields only.</strong> Enables metrics tracking
                for this field. Values will be collected and displayed in
                charts.
              </td>
            </tr>
            <tr>
              <td>
                <code>display</code>
              </td>
              <td className="-font-mono">
                <strong>Collected fields only.</strong> Controls how chart
                values are formatted. One of <code>number</code> (default),{' '}
                <code>percent</code>, or <code>currency/USD</code> (any ISO
                currency code).
              </td>
            </tr>
          </tbody>
        </table>
        <div className="mt-4">
          <p className="text-sm font-semibold">Example with metrics:</p>
          <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded mt-2 overflow-auto">
            {`orderAmount:
  type: number
  description: Total order amount
  collect: true
  display: currency/USD`}
          </pre>
        </div>
      </div>
    </Expando>
  )
}

import Expando from '@/components/Expando'

import clsx from 'clsx'

export default function MarkdownCheatsheet({
  markdownStyles = [],

  className,

  ...props
}) {
  return (
    <Expando
      {...props}
      titleClassName={clsx('default-link text-sm', className)}
      title="Markdown Cheat Sheet"
    >
      <div className="content-prose prose-code:before:content-none prose-code:after:content-none">
        <table>
          <thead className="text-bold">
            <tr>
              <th>Element</th>
              <th>Markdown Syntax</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Heading</td>
              <td className="font-mono"># H1</td>
            </tr>
            <tr>
              <td>Heading</td>
              <td className="font-mono">## H2</td>
            </tr>
            <tr>
              <td>Heading</td>
              <td className="font-mono">### H3</td>
            </tr>
            <tr>
              <td>Bold</td>
              <td className="font-mono">**bold text**</td>
            </tr>
            <tr>
              <td>Italic</td>
              <td className="font-mono">*italicized text*</td>
            </tr>
            <tr>
              <td>Blockquote</td>
              <td className="font-mono">&gt; blockquote</td>
            </tr>
            <tr>
              <td>Ordered List</td>
              <td className="font-mono">
                1. First item
                <br />
                2. Second item
                <br />
                3. Third item
                <br />
              </td>
            </tr>
            <tr>
              <td>Unordered List</td>
              <td className="font-mono">
                - First item
                <br />
                - Second item
                <br />
                - Third item
                <br />
              </td>
            </tr>
            <tr>
              <td>Code</td>
              <td className="font-mono">`code`</td>
            </tr>
            <tr>
              <td>Image</td>
              <td className="font-mono">![Image Text](https://image/url)</td>
            </tr>
            <tr>
              <td>Link</td>
              <td className="font-mono">[Link Text](https://image/url)</td>
            </tr>
            {markdownStyles.includes('widget') ? (
              <>
                <tr>
                  <td>Text / question suggestion button</td>
                  <td className="font-mono">[Button text]()</td>
                </tr>
                <tr>
                  <td>A button link</td>
                  <td className="font-mono">
                    [Button text](https://link#button)
                  </td>
                </tr>
                <tr>
                  <td>Bar Icon (only available in intro fields)</td>
                  <td className="font-mono">![barIcon](https://image)</td>
                </tr>
                <tr>
                  <td>Button Icon (only available in intro fields)</td>
                  <td className="font-mono">![buttonIcon](https://image)</td>
                </tr>
              </>
            ) : null}
            <tr>
              <td>Horizontal Rule / message split</td>
              <td className="font-mono">---</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Expando>
  )
}

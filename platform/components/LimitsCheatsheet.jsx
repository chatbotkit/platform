import Expando from '@/components/Expando'

export default function LimitsCheatsheet({ ...props }) {
  return (
    <Expando
      {...props}
      titleClassName="default-link text-sm"
      title="Limits Cheat Sheet"
    >
      <div className="content-prose prose-code:before:content-none prose-code:after:content-none">
        <table>
          <thead className="text-bold">
            <tr>
              <th>Name</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>{'tokens'}</code>
              </td>
              <td className="-font-mono">
                The number of tokens the user can use
              </td>
            </tr>
            <tr>
              <td>
                <code>{'conversations'}</code>
              </td>
              <td className="-font-mono">
                The number of conversations the user can create
              </td>
            </tr>
            <tr>
              <td>
                <code>{'messages'}</code>
              </td>
              <td className="-font-mono">
                The number of messages the user can send
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Expando>
  )
}

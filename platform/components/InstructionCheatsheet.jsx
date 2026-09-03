import Expando from '@/components/Expando'

export default function InstructionCheatsheet({ ...props }) {
  return (
    <Expando
      {...props}
      titleClassName="default-link text-sm"
      title="Instruction Cheat Sheet"
    >
      <div className="content-prose prose-code:before:content-none prose-code:after:content-none">
        <table>
          <thead className="text-bold">
            <tr>
              <th>Syntax</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>{'```action\n```'}</code>
              </td>
              <td className="-font-mono">Use a specific action</td>
            </tr>
            <tr>
              <td>
                <code>{'((placeholder))'}</code>
              </td>
              <td className="-font-mono">A placeholder for a value</td>
            </tr>
            <tr>
              <td>
                <code>{'$[field|description]'}</code>
              </td>
              <td className="-font-mono">
                Declare an optional field with description
              </td>
            </tr>
            <tr>
              <td>
                <code>{'$[!field|description]'}</code>
              </td>
              <td className="-font-mono">
                Declare a mandatory field with description
              </td>
            </tr>
            <tr>
              <td>
                <code>{'$[field op|description]'}</code>
              </td>
              <td className="-font-mono">Declare a field with an operand</td>
            </tr>
            <tr>
              <td>
                <code>{'${SECRET_ID}'}</code>
              </td>
              <td className="-font-mono">
                Reference a secret with id <strong>ID</strong>
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${SECRET_NAME}'}</code>
              </td>
              <td className="-font-mono">
                Reference a secret with name <strong>NAME</strong>
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${SECRET_DEFAULT}'}</code>
              </td>
              <td className="-font-mono">
                Reference the default secret associated with this ability
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${BOT_ID}'}</code>
              </td>
              <td className="-font-mono">
                Reference a bot with id <strong>ID</strong>
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${BOT_NAME}'}</code>
              </td>
              <td className="-font-mono">
                Reference a bot with name <strong>NAME</strong>
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${BOT_DEFAULT}'}</code>
              </td>
              <td className="-font-mono">
                Reference the default bot associated with this ability
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${CONVERSATION_ID}'}</code>
              </td>
              <td className="-font-mono">
                Reference the current conversation ID
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${CONVERSATION_META_FIELD}'}</code>
              </td>
              <td className="-font-mono">Reference a meta field by name</td>
            </tr>
            <tr>
              <td>
                <code>{'${CONVERSATION_CALLBACK}'}</code>
              </td>
              <td className="-font-mono">
                Reference the callback URL for the conversation
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${CONTACT_ID}'}</code>
              </td>
              <td className="-font-mono">
                Reference the ID of contact associated with the conversation.
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${CONTACT_NAME}'}</code>
              </td>
              <td className="-font-mono">
                Reference the name of contact associated with the conversation.
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${CONTACT_EMAIL}'}</code>
              </td>
              <td className="-font-mono">
                Reference the email of contact associated with the conversation.
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${CONTACT_PHONE}'}</code>
              </td>
              <td className="-font-mono">
                Reference the phone of contact associated with the conversation.
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${CONTACT_NICK}'}</code>
              </td>
              <td className="-font-mono">
                Reference the nickname of contact associated with the
                conversation.
              </td>
            </tr>
            <tr>
              <td>
                <code>{'${CONTACT_META_FIELD}'}</code>
              </td>
              <td className="-font-mono">Reference a meta field by name</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Expando>
  )
}

import KeyCombo from '@/components/KeyCombo'

export default function SendInstructions({
  started = false,

  message = 'start the conversation',
  altMessage = 'send a message',

  ...props
}) {
  return (
    <div {...props}>
      <p className="text-xs">
        Press{' '}
        <KeyCombo className="[&_kbd]:[font-family:inherit]" secondKey="Enter" />{' '}
        to {started ? altMessage : message}
      </p>
    </div>
  )
}

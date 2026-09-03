import AdvancedAutoTextarea from '@/components/AdvancedAutoTextarea'

export default function ChatInput({
  onSend,

  sendCaption,

  inputDisabled,
  sendDisabled,

  disabled = inputDisabled && sendDisabled,

  children,

  ...props
}) {
  function handleSend(event) {
    event.preventDefault()
    event.stopPropagation()

    event.superOriginalTarget = event.originalTarget
    event.originalTarget = event.target

    event.target = event.target.closest('.relative')?.querySelector('textarea')

    onSend(event)
  }

  async function handleOnKeyDown(event) {
    if (
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.keyCode === 13
    ) {
      handleSend(event)
    }
  }

  return (
    <AdvancedAutoTextarea
      {...props}
      onKeyDown={props.onKeyDown || handleOnKeyDown}
      disabled={inputDisabled || disabled}
    >
      {children}
      {sendCaption ? (
        <button
          className="primary-button small"
          type="button"
          onClick={handleSend}
          disabled={sendDisabled || disabled}
        >
          {sendCaption}
        </button>
      ) : null}
    </AdvancedAutoTextarea>
  )
}

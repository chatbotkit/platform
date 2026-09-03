import {
  useConfirmDanger,
  useConfirmInfo,
  useConfirmYesNo,
} from '@/components/Confirm'

export function ConfirmInfoButton({
  message,

  title,

  onClick,

  onConfirm,

  disabled,

  ...props
}) {
  const confirm = useConfirmInfo()

  return (
    <button
      {...props}
      type="button"
      onClick={async (event) => {
        if (disabled) {
          return
        }

        if (await confirm(message, { title })) {
          onConfirm?.()
        }

        onClick?.(event)
      }}
    />
  )
}

export function ConfirmDangerButton({
  message,

  title,

  onClick,

  onConfirm,

  disabled,

  ...props
}) {
  const confirm = useConfirmDanger()

  return (
    <button
      {...props}
      type="button"
      onClick={async (event) => {
        if (disabled) {
          return
        }

        if (await confirm(message, { title })) {
          onConfirm?.()
        }

        onClick?.(event)
      }}
    />
  )
}

export default function ConfirmButton({
  message,

  title,

  onClick,

  onConfirm,

  disabled,

  ...props
}) {
  const confirm = useConfirmYesNo()

  return (
    <button
      {...props}
      type="button"
      onClick={async (event) => {
        if (disabled) {
          return
        }

        if (await confirm(message, { title })) {
          onConfirm?.()
        }

        onClick?.(event)
      }}
    />
  )
}

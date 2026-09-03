import { saveData } from '@/lib/save'
import toast from '@/lib/toast'

export default function SaveButton({
  data,

  name,

  type,

  message = 'File saved',

  onClick,

  ...props
}) {
  function handleOnClick(event) {
    event.preventDefault()
    event.stopPropagation()

    try {
      saveData(data, { name, type })

      if (message) {
        toast.success(message)
      }
    } catch {
      toast.error('Failed to save file')
    }

    if (onClick) {
      onClick(event)
    }
  }

  return <button type="button" {...props} onClick={handleOnClick} />
}

import { useCallback } from 'react'

export default function useFormElementAutoTools({
  autoTab,
  autoSubmit,

  reportValidity,

  onAutoError,

  ...props
}) {
  const handleOnKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()

        const target = e.target

        if (!target) {
          if (onAutoError) {
            onAutoError(new Error('No target element found'))
          }

          return
        }

        const form = target.form

        if (!form) {
          if (onAutoError) {
            onAutoError(new Error('No form found'))
          }

          return
        }

        if (autoTab) {
          // perform validation first and if the element is invlaid then abort
          // the auto tab

          if (!target.checkValidity()) {
            if (onAutoError) {
              onAutoError(new Error('Element is invalid'))
            }

            if (reportValidity) {
              target.reportValidity()
            }

            return
          }

          const elementIndex = Array.from(form.elements).indexOf(target)

          if (elementIndex >= 0) {
            // find the next element that is not a submit button or input submit button or input reset button or hidden input

            for (let i = elementIndex + 1; i < form.elements.length; i++) {
              const nextElement = form.elements[i]

              if (
                !['button', 'submit', 'reset', 'hidden'].includes(
                  nextElement.type
                )
              ) {
                nextElement.focus()

                return
              }
            }
          }
        }

        if (autoSubmit) {
          // perform validation of the form first and if the form is invalid
          // then abort

          if (!form.checkValidity()) {
            if (onAutoError) {
              onAutoError(new Error('Form is invalid'))
            }

            if (reportValidity) {
              form.reportValidity()
            }

            return
          }

          const button = form.ownerDocument.createElement('input')

          button.style.display = 'none'

          button.type = 'submit'

          form.appendChild(button).click()

          // @note use button.remove() instead of form.removeChild(button) for
          // safety in case button was already removed

          button.remove()

          return
        }
      }
    },
    [autoTab, autoSubmit, reportValidity, onAutoError]
  )

  return {
    handleOnKeyDown,

    props,
  }
}

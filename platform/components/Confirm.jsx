'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import Toggle from '@/components/Toggle'

import usePopup from '@/hooks/usePopup'

const ConfirmContext = createContext()

export function useConfirm() {
  const { addPopup, removePopup } = useContext(ConfirmContext)

  const { popup, openPopup, closePopup } = usePopup({
    closePopupOnClickOutside: true,
  })

  useEffect(() => {
    const randomId = Math.random().toString(36).substring(7)

    addPopup(randomId, popup)

    return () => {
      removePopup(randomId)
    }
  }, [addPopup, removePopup, popup])

  return useCallback(
    (message, options) => {
      const {
        title,
        actions = { Confirm: { result: true, default: true } },
        cancelButtonCaption,
      } = options || {}

      return new Promise((resolve) => {
        openPopup(
          <div className="[word-break:break-word]">
            {message.message || message}
          </div>,
          {
            title: title || message.title || 'Confirm',

            cancelButtonCaption,

            onClose() {
              resolve(false)
            },

            actions: {
              ...Object.fromEntries(
                Object.entries(actions).map(([caption, config]) => {
                  let result
                  let fn

                  let isDefault = false
                  let isDanger = false

                  if (typeof config === 'object' && config !== null) {
                    isDefault = !!config.default
                    isDanger = !!config.danger

                    result = config.result
                    fn = config.fn
                  } else {
                    result = config
                  }

                  return [
                    caption,
                    {
                      default: isDefault,
                      danger: isDanger,

                      fn(data) {
                        // @note the order matters, if we don't resolve before we
                        // close the popup, then the code for onClose will trigger
                        // and resolve the promise with false

                        if (fn) {
                          fn(data)
                        }

                        resolve(result)

                        closePopup()
                      },
                    },
                  ]
                })
              ),
            },
          }
        )
      })
    },
    [openPopup, closePopup]
  )
}

export function useConfirmYesNo() {
  const confirm = useConfirm()

  return useCallback(
    (message, options) => {
      return confirm(message, {
        ...options,

        cancelButtonCaption: options?.noButtonCaption || 'No',

        actions: {
          ...options?.actions,

          [options?.yesButtonCaption || 'Yes']: { result: true },
        },
      })
    },
    [confirm]
  )
}

export function useConfirmInfo() {
  const confirm = useConfirm()

  return useCallback(
    (message, options) => {
      return confirm(message, {
        ...options,

        cancelButtonCaption: 'OK',

        actions: {
          ...options?.actions,
        },
      })
    },
    [confirm]
  )
}

export function useConfirmDanger() {
  const confirm = useConfirm()

  return useCallback(
    (message, options) => {
      return confirm(message, {
        ...options,

        actions: {
          ...options?.actions,

          Confirm: { result: true, danger: true },
        },
      })
    },
    [confirm]
  )
}

export function useConfirmDelete() {
  const confirm = useConfirm()

  return useCallback(
    (message, options) => {
      return confirm(message, {
        ...options,

        actions: {
          ...options?.actions,

          Delete: { result: true, danger: true },
        },
      })
    },
    [confirm]
  )
}

/**
 * Renders the delete confirmation prompt with a set of extra toggle options
 * (e.g. "also delete associated resources"). Holds the toggle state locally and
 * mirrors it into `valuesRef` so the caller can read the selection once the
 * dialog resolves.
 */
function DeleteConfirmBody({ message, options, valuesRef }) {
  const [values, setValues] = useState(() => {
    const initial = Object.fromEntries(
      options.map((option) => [option.name, !!option.default])
    )

    valuesRef.current = initial

    return initial
  })

  function setOption(name, checked) {
    const next = { ...values, [name]: checked }

    setValues(next)

    valuesRef.current = next
  }

  return (
    <div className="flex flex-col gap-4 [word-break:break-word]">
      <div>{message.message || message}</div>
      <div className="flex flex-col gap-3">
        {options.map((option) => (
          <Toggle
            key={option.name}
            caption={option.label}
            checked={values[option.name]}
            setChecked={(checked) => setOption(option.name, checked)}
          >
            <div className="flex flex-col gap-0.5 pl-2">
              <span className="text-sm font-medium auto-text-gray-900">
                {option.label}
              </span>
              {option.description ? (
                <span className="text-xs auto-text-gray-500">
                  {option.description}
                </span>
              ) : null}
            </div>
          </Toggle>
        ))}
      </div>
    </div>
  )
}

/**
 * Like `useConfirmDelete`, but renders optional toggle checkboxes inside the
 * dialog. Resolves `false` when cancelled, or an object of the selected option
 * values when confirmed (an empty object when no options were supplied), so the
 * caller can merge the selection into the delete request.
 */
export function useConfirmDeleteWithOptions() {
  const confirmDelete = useConfirmDelete()

  return useCallback(
    async (message, options) => {
      const deleteOptions = options?.options

      if (!deleteOptions?.length) {
        return (await confirmDelete(message, options)) ? {} : false
      }

      const valuesRef = {
        current: Object.fromEntries(
          deleteOptions.map((option) => [option.name, !!option.default])
        ),
      }

      const confirmed = await confirmDelete(
        <DeleteConfirmBody
          message={message}
          options={deleteOptions}
          valuesRef={valuesRef}
        />,
        options
      )

      return confirmed ? { ...valuesRef.current } : false
    },
    [confirmDelete]
  )
}

export function useConfirmInput() {
  const { addPopup, removePopup } = useContext(ConfirmContext)

  const { popup, openPopup, closePopup } = usePopup({
    closePopupOnClickOutside: true,
  })

  useEffect(() => {
    const randomId = Math.random().toString(36).substring(7)

    addPopup(randomId, popup)

    return () => {
      removePopup(randomId)
    }
  }, [addPopup, removePopup, popup])

  return useCallback(
    (message, options) => {
      const {
        title,
        submitButtonCaption = 'Submit',
        cancelButtonCaption,
      } = options || {}

      return new Promise((resolve) => {
        openPopup(
          <div className="[word-break:break-word]">
            {message.message || message}
          </div>,
          {
            title: title || message.title || 'Input',

            cancelButtonCaption,

            onClose() {
              resolve(false)
            },

            actions: {
              [submitButtonCaption]: {
                default: true,

                fn(data) {
                  // @note resolve with form data instead of boolean

                  resolve(data)
                  closePopup()
                },
              },
            },
          }
        )
      })
    },
    [openPopup, closePopup]
  )
}

export default function Confirm({ children }) {
  const [popups, setPopups] = useState({})

  const addPopup = useCallback((id, popup) => {
    setPopups((popups) => ({ ...popups, [id]: popup }))
  }, [])

  const removePopup = useCallback((id) => {
    setPopups((popups) => {
      const { [id]: _, ...rest } = popups

      return rest
    })
  }, [])

  const contextValue = useMemo(() => {
    return {
      addPopup,
      removePopup,
    }
  }, [addPopup, removePopup])

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      {Object.values(popups).map((value, index) => {
        return <div key={index}>{value}</div>
      })}
    </ConfirmContext.Provider>
  )
}
